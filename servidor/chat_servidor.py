"""
Servidor del chat secreto del portafolio.

- Guarda los mensajes solo en memoria (se pierden al detener el servidor).
- Exige un PIN en cada peticion (cabecera X-Pin).
- Bloquea temporalmente la IP que falla el PIN varias veces.
- Sirve ademas la carpeta dist/ (el portafolio compilado), asi el otro PC
  solo necesita Python y un navegador.
"""
import hmac
import json
import mimetypes
import os
import secrets
import socket
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = (BASE_DIR.parent / "dist").resolve()
PIN_FILE = BASE_DIR / "pin.txt"

# ---------- Configuracion (se puede cambiar con variables de entorno) ----------
HOST = os.environ.get("CHAT_HOST", "0.0.0.0")
PORT = int(os.environ.get("CHAT_PORT", 8080))
TTL_SECONDS = int(os.environ.get("CHAT_TTL_MIN", 60)) * 60   # 0 = no caducan
MAX_BODY = 2 * 1024 * 1024       # tamano maximo de un mensaje (2 MB)
MAX_MESSAGES = 200               # mensajes que se guardan en memoria
MAX_FAILS = 5                    # intentos de PIN fallidos antes de bloquear
LOCK_SECONDS = 60                # duracion del bloqueo por IP
API = "/api/chat"


def cargar_pin():
    """PIN fijo: variable CHAT_PIN, o el guardado en servidor/pin.txt (se crea la primera vez)."""
    env = (os.environ.get("CHAT_PIN") or "").strip()
    if env:
        return env
    try:
        guardado = PIN_FILE.read_text(encoding="utf-8").strip()
        if guardado:
            return guardado
    except OSError:
        pass
    nuevo = f"{secrets.randbelow(10**8):08d}"
    try:
        PIN_FILE.write_text(nuevo, encoding="utf-8")
    except OSError:
        pass
    return nuevo


PIN = cargar_pin()

messages = []
rev = 0
next_id = 1
fails = {}                       # ip -> (fallos, bloqueado_hasta)
lock = threading.Lock()


def local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "IP-DEL-EQUIPO"


def purge_expired():
    """Elimina mensajes caducados. Llamar con `lock` tomado."""
    global rev
    if not TTL_SECONDS:
        return
    limit = int((time.time() - TTL_SECONDS) * 1000)
    before = len(messages)
    messages[:] = [m for m in messages if m["time"] >= limit]
    if len(messages) != before:
        rev += 1


class ChatHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # no llenar la consola con cada consulta

    # ---------- utilidades ----------
    def _headers_seguridad(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Robots-Tag", "noindex, nofollow")

    def _send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self._headers_seguridad()
        self.end_headers()
        self.wfile.write(data)

    def _not_found(self):
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _authorized(self):
        """Valida el PIN. Si falla, responde 401/429 y devuelve False."""
        ip = self.client_address[0]
        now = time.time()

        with lock:
            count, locked_until = fails.get(ip, (0, 0))
            if locked_until > now:
                self._send_json({"error": "bloqueado temporalmente"}, 429)
                return False

        given = self.headers.get("X-Pin", "")
        if hmac.compare_digest(given.encode("utf-8"), PIN.encode("utf-8")):
            with lock:
                fails.pop(ip, None)
            return True

        with lock:
            count += 1
            if count >= MAX_FAILS:
                fails[ip] = (0, now + LOCK_SECONDS)
            else:
                fails[ip] = (count, 0)
        self._send_json({"error": "pin incorrecto"}, 401)
        return False

    def _servir_estatico(self, ruta):
        """Sirve el portafolio compilado (dist/) con proteccion contra rutas fuera de la carpeta."""
        try:
            rel = urllib.parse.unquote(ruta).lstrip("/") or "index.html"
            destino = (DIST_DIR / rel).resolve()
            destino.relative_to(DIST_DIR)
            if not destino.is_file():
                if "." in Path(rel).name:
                    self._not_found()
                    return
                destino = DIST_DIR / "index.html"
            data = destino.read_bytes()
        except (ValueError, OSError):
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            body = b"Falta la carpeta dist. Ejecuta: npm run build"
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        tipo = mimetypes.guess_type(str(destino))[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo in ("application/javascript", "application/json"):
            tipo += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(data)))
        self._headers_seguridad()
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src https://fonts.gstatic.com; "
            "script-src 'self'; img-src 'self' data:; connect-src 'self'",
        )
        self.end_headers()
        self.wfile.write(data)

    # ---------- GET ----------
    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)

        if url.path == API + "/messages":
            if not self._authorized():
                return
            query = urllib.parse.parse_qs(url.query)
            try:
                client_rev = int(query.get("rev", ["-1"])[0])
            except ValueError:
                client_rev = -1
            with lock:
                purge_expired()
                if client_rev == rev:
                    payload = {"unchanged": True, "rev": rev}
                else:
                    payload = {"rev": rev, "messages": list(messages)}
            self._send_json(payload)
            return

        if url.path.startswith("/api"):
            self._not_found()
            return

        self._servir_estatico(url.path)

    # ---------- POST ----------
    def do_POST(self):
        global rev, next_id
        url = urllib.parse.urlsplit(self.path)

        if url.path not in (API + "/send", API + "/delete", API + "/clear"):
            self._not_found()
            return

        if not self._authorized():
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0

        if length > MAX_BODY:
            self._send_json({"error": "demasiado grande"}, 413)
            return

        body = self.rfile.read(length) if length else b""

        if url.path == API + "/send":
            try:
                data = json.loads(body.decode("utf-8"))
                text = str(data.get("text", ""))
                name = str(data.get("name", ""))[:200]
                nick = str(data.get("nick", "")).strip()[:30]
                cid = str(data.get("cid", "")).strip()[:40]
            except Exception:
                self._send_json({"error": "datos invalidos"}, 400)
                return

            if not text.strip():
                self._send_json({"error": "mensaje vacio"}, 400)
                return

            with lock:
                messages.append({
                    "id": next_id,
                    "ip": self.client_address[0],
                    "cid": cid,
                    "nick": nick,
                    "text": text,
                    "name": name,
                    "time": int(time.time() * 1000),
                })
                next_id += 1
                if len(messages) > MAX_MESSAGES:
                    del messages[: len(messages) - MAX_MESSAGES]
                rev += 1
            self._send_json({"ok": True})
            return

        if url.path == API + "/delete":
            try:
                data = json.loads(body.decode("utf-8"))
                msg_id = int(data.get("id"))
                cid = str(data.get("cid", "")).strip()[:40]
            except Exception:
                self._send_json({"error": "datos invalidos"}, 400)
                return
            with lock:
                before = len(messages)
                # solo puedes borrar mensajes enviados desde tu propio dispositivo
                messages[:] = [m for m in messages if not (m["id"] == msg_id and m["cid"] == cid)]
                if len(messages) != before:
                    rev += 1
            self._send_json({"ok": True})
            return

        if url.path == API + "/clear":
            with lock:
                messages.clear()
                rev += 1
            self._send_json({"ok": True})
            return


if __name__ == "__main__":
    httpd = ThreadingHTTPServer((HOST, PORT), ChatHandler)
    print("Chat secreto en marcha")
    print(f"  En este equipo:  http://localhost:{PORT}/#chat")
    print(f"  Desde otro PC:   http://{local_ip()}:{PORT}/#chat")
    print(f"  PIN de acceso:   {PIN}")
    if not DIST_DIR.is_dir():
        print("  AVISO: falta la carpeta dist. Ejecuta primero: npm run build")
    if TTL_SECONDS:
        print(f"  Los mensajes caducan a los {TTL_SECONDS // 60} min")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")