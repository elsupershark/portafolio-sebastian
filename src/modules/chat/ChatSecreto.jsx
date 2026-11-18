import { useEffect, useRef, useState } from 'react'
import './chat.css'
import {
    NICK_KEY, PIN_KEY, apiFetch, cerrarSesion, copyText, fmtBytes, guardar, hora, idDispositivo,
    iniciarSesion, leer,
} from './lib.js'

const JP = {
    chat: '\u30c1\u30e3\u30c3\u30c8',
    secreto: '\u79d8\u5bc6',
    acceso: '\u30a2\u30af\u30bb\u30b9',
    volver: '\u623b\u308b',
}
const MAX_FILE = 1024 * 1024
const LINEAS = 5
const POLL_MS = 2000

function Mensaje({ m, mio, abierto, copiado, onCopiar, onToggle, onBorrar }) {
    const largo = m.text.split('\n').length > LINEAS || m.text.length > 360
    const quien = m.nick || m.ip || '\u2014'
    return (
        <article className={'msg' + (mio ? ' mio' : '') + (copiado ? ' copiado' : '')} onClick={() => {
            if (window.getSelection().toString()) return
            onCopiar(m)
        }}>
            <div className="meta">
                <span className="quien">{mio ? quien + ' \u00b7 t\u00fa' : quien}</span>
                <span className="meta-r">
                    <span>{hora(m.time)}</span>
                    {mio && (
                        <button type="button" className="del" title="Borrar" aria-label="Borrar este mensaje"
                            onClick={(e) => { e.stopPropagation(); onBorrar(m) }}>
                            {'\u00d7'}
                        </button>
                    )}
                </span>
            </div>
            {m.name && <div className="chip-file">{'\u25a4 ' + m.name}</div>}
            <div className={'cuerpo' + (largo ? (abierto ? ' abierto' : ' corto') : '')}>{m.text}</div>
            <div className="pie">
                <span>{fmtBytes(new Blob([m.text]).size)}</span>
                {largo && (
                    <button type="button" className="mas" onClick={(e) => { e.stopPropagation(); onToggle(m.id) }}>
                        {abierto ? 'VER MENOS' : 'VER M\u00c1S'}
                    </button>
                )}
            </div>
        </article>
    )
}

export default function ChatSecreto({ onVolver }) {
    /* pin: solo con el servidor Python local. En Vercel la sesion vive en una cookie HttpOnly. */
    const [pin, setPin] = useState(() => leer(PIN_KEY))
    const [auth, setAuth] = useState(() => (leer(PIN_KEY) ? 'in' : 'check'))
    const [claveTxt, setClaveTxt] = useState('')
    const [cargando, setCargando] = useState(false)
    const [authErr, setAuthErr] = useState('')
    const [msgs, setMsgs] = useState([])
    const [estado, setEstado] = useState('off')
    const [kick, setKick] = useState(0)
    const [nick, setNick] = useState(() => leer(NICK_KEY) || 'Sebasti\u00e1n')
    const [cid] = useState(() => idDispositivo())
    const [texto, setTexto] = useState('')
    const [abiertos, setAbiertos] = useState(() => new Set())
    const [copiado, setCopiado] = useState(null)
    const [arrastrando, setArrastrando] = useState(false)
    const [toastState, setToastState] = useState(null)
    const revRef = useRef(-1)
    const listaRef = useRef(null)
    const prevCount = useRef(0)
    const fileRef = useRef(null)
    const taRef = useRef(null)
    const toastTimer = useRef(0)
    const copiadoTimer = useRef(0)
    const dragDepth = useRef(0)

    const dentro = auth === 'in'
    const activo = auth !== 'out'

    const aviso = (msg, kind = '') => {
        setToastState({ msg, kind })
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToastState(null), 2000)
    }

    /* ---------- Consulta periodica: cada 2 s mientras la pestana esta visible; se pausa al ocultarse ---------- */
    useEffect(() => {
        if (!activo) return undefined
        let vivo = true
        let t = 0
        let enVuelo = false

        async function poll() {
            if (!vivo || enVuelo || document.hidden) return
            clearTimeout(t)
            enVuelo = true
            let espera = POLL_MS
            let seguir = true
            try {
                const r = await apiFetch('/messages?rev=' + revRef.current, {}, pin)
                if (!vivo) return
                if (r.status === 404 || r.status === 401) {
                    /* sin sesion valida (o PIN incorrecto en modo local) */
                    seguir = false
                    revRef.current = -1
                    if (pin) {
                        guardar(PIN_KEY, '')
                        setPin('')
                    }
                    setAuthErr(pin && r.status === 401 ? 'CLAVE INCORRECTA' : '')
                    setMsgs([])
                    setEstado('off')
                    setAuth('out')
                } else if (r.status === 429) {
                    setEstado('lock')
                    espera = 5000
                } else if (r.ok) {
                    const d = await r.json()
                    if (!vivo) return
                    setEstado('ok')
                    setAuth('in')
                    if (!d.unchanged) {
                        revRef.current = d.rev
                        setMsgs(d.messages || [])
                    }
                } else {
                    setEstado('off')
                    espera = 4000
                }
            } catch {
                if (vivo) setEstado('off')
            } finally {
                enVuelo = false
            }
            if (vivo && seguir && !document.hidden) t = setTimeout(poll, espera)
        }

        const onVis = () => {
            if (document.hidden) clearTimeout(t)
            else poll()
        }
        document.addEventListener('visibilitychange', onVis)
        poll()
        return () => {
            vivo = false
            clearTimeout(t)
            document.removeEventListener('visibilitychange', onVis)
        }
    }, [activo, pin, kick])

    /* Baja al ultimo mensaje cuando llega uno nuevo */
    useEffect(() => {
        const el = listaRef.current
        if (el && msgs.length > prevCount.current) el.scrollTop = el.scrollHeight
        prevCount.current = msgs.length
    }, [msgs])

    /* ---------- Acceso ---------- */
    async function entrar(e) {
        e.preventDefault()
        const k = claveTxt.trim()
        if (!k || cargando) return
        setCargando(true)
        setAuthErr('')
        const r = await iniciarSesion(k)
        setCargando(false)
        if (r === 'sesion') {
            setClaveTxt('')
            setAuth('in')
        } else if (r === 'pin') {
            guardar(PIN_KEY, k)
            setPin(k)
            setClaveTxt('')
            setAuth('in')
        } else {
            setAuthErr(r === 'mal' ? 'CLAVE INCORRECTA' : r === 'espera' ? 'ESPERA UN MOMENTO' : 'ERROR')
        }
    }

    async function salir() {
        await cerrarSesion()
        guardar(PIN_KEY, '')
        setPin('')
        revRef.current = -1
        setMsgs([])
        setEstado('off')
        setAuth('out')
        onVolver()
    }

    /* ---------- Envio ---------- */
    async function enviar(t, nombre) {
        if (!t || !t.trim()) return false
        try {
            const r = await apiFetch('/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: t, name: nombre || '', nick: nick.trim(), cid }),
            }, pin)
            if (r.status === 413) { aviso('Mensaje demasiado grande', 'err'); return false }
            if (r.status === 404 || r.status === 401) {
                setMsgs([])
                setAuth('out')
                return false
            }
            if (!r.ok) throw new Error('fallo')
            return true
        } catch {
            aviso('No se pudo enviar', 'err')
            return false
        }
    }

    async function onSubmit(e) {
        e.preventDefault()
        const t = texto
        if (!t.trim()) return
        setTexto('')
        if (taRef.current) taRef.current.style.height = 'auto'
        if (await enviar(t)) setKick((k) => k + 1)
        if (taRef.current) taRef.current.focus()
    }

    async function subir(files) {
        for (const f of files) {
            if (f.size > MAX_FILE) { aviso(f.name + ' supera 1 MB', 'err'); continue }
            const t = await f.text()
            if (t.includes('\u0000')) { aviso(f.name + ' no es texto', 'err'); continue }
            await enviar(t, f.name)
        }
        setKick((k) => k + 1)
    }

    async function borrar(m) {
        try {
            await apiFetch('/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: m.id, cid }),
            }, pin)
        } catch {
            aviso('No se pudo borrar', 'err')
        }
        setKick((k) => k + 1)
    }

    async function limpiar() {
        if (!window.confirm('\u00bfBorrar todos los mensajes?')) return
        setAbiertos(new Set())
        try {
            await apiFetch('/clear', { method: 'POST' }, pin)
        } catch {
            aviso('No se pudo borrar', 'err')
        }
        setKick((k) => k + 1)
    }

    /* ---------- Copiar ---------- */
    async function copiar(m) {
        const ok = await copyText(m.text)
        if (!ok) { aviso('NO SE PUDO COPIAR', 'err'); return }
        setCopiado(m.id)
        clearTimeout(copiadoTimer.current)
        copiadoTimer.current = setTimeout(() => setCopiado(null), 800)
        aviso('COPIADO', 'ok')
    }

    function copiarUltimo() {
        const ajenos = msgs.filter((m) => m.cid !== cid)
        const m = ajenos.length ? ajenos[ajenos.length - 1] : msgs[msgs.length - 1]
        if (!m) { aviso('Sin mensajes', 'err'); return }
        copiar(m)
    }

    function toggleAbierto(id) {
        setAbiertos((prev) => {
            const n = new Set(prev)
            if (n.has(id)) n.delete(id)
            else n.add(id)
            return n
        })
    }

    /* ---------- Arrastrar archivos ---------- */
    function onDragEnter(e) {
        e.preventDefault()
        dragDepth.current += 1
        setArrastrando(true)
    }
    function onDragLeave(e) {
        e.preventDefault()
        dragDepth.current -= 1
        if (dragDepth.current <= 0) { dragDepth.current = 0; setArrastrando(false) }
    }
    function onDrop(e) {
        e.preventDefault()
        dragDepth.current = 0
        setArrastrando(false)
        if (dentro && e.dataTransfer.files.length) subir(Array.from(e.dataTransfer.files))
    }

    const estadoTxt = estado === 'ok' ? 'EN L\u00cdNEA' : estado === 'lock' ? 'BLOQUEADO' : 'SIN CONEXI\u00d3N'

    return (
        <div className="chat-root" onDragEnter={onDragEnter} onDragOver={(e) => e.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
            {/* Fondo cyberpunk: cuadricula, resplandores y scanlines */}
            <div className="chat-bg-grid" aria-hidden="true" />
            <div className="chat-glow chat-glow-a" aria-hidden="true" />
            <div className="chat-glow chat-glow-b" aria-hidden="true" />
            <div className="chat-scan" aria-hidden="true" />

            <div className="wrap">
                <header>
                    <div className="logo">&gt;_</div>
                    <div className="head-t">
                        <p className="eyebrow">{'// ' + JP.secreto + ' \u00b7 ' + JP.chat}</p>
                        <h1 className="glitch" data-text="Chat secreto">Chat secreto</h1>
                    </div>
                    <div className="head-r">
                        {dentro && (
                            <>
                                <input
                                    type="text" className="nick" maxLength={30} spellCheck={false} autoComplete="off"
                                    placeholder="Apodo" aria-label="Tu apodo" value={nick}
                                    onChange={(e) => { setNick(e.target.value); guardar(NICK_KEY, e.target.value.trim()) }}
                                />
                                <span className={'estado ' + estado}><i className="dot" />{estadoTxt}</span>
                                <button type="button" className="btn-secondary btn-sm" onClick={copiarUltimo} disabled={!msgs.length}>COPIAR &Uacute;LTIMO</button>
                                <button type="button" className="btn-ghost btn-sm" onClick={limpiar} disabled={!msgs.length}>BORRAR TODO</button>
                            </>
                        )}
                        <button type="button" className="btn-ghost btn-sm" onClick={onVolver}>{'VOLVER \u00b7 ' + JP.volver}</button>
                        {dentro && <button type="button" className="btn-ghost btn-sm" onClick={salir}>SALIR</button>}
                    </div>
                </header>

                {(auth === 'out' || (auth === 'check' && estado === 'off')) && (
                    <form className="panel login" onSubmit={entrar}>
                        <h2>CLAVE <span className="jp">{JP.acceso}</span></h2>
                        <input
                            type="password" name="clave" autoComplete="current-password" autoFocus maxLength={256}
                            aria-label="Clave" value={claveTxt} onChange={(e) => setClaveTxt(e.target.value)}
                        />
                        <button type="submit" className="btn-primary btn-big" disabled={!claveTxt.trim() || cargando}>ENTRAR</button>
                        <p className="login-err" role="alert">{authErr}</p>
                    </form>
                )}

                {dentro && (
                    <section className="panel main">
                        <div className="lista" ref={listaRef} aria-label="Mensajes">
                            {!msgs.length && (
                                <p className="vacio">
                                    Vac&iacute;o<br />
                                    <span className="jp">{'\u7a7a'}</span>
                                </p>
                            )}
                            {msgs.map((m) => (
                                <Mensaje
                                    key={m.id} m={m} mio={m.cid === cid}
                                    abierto={abiertos.has(m.id)} copiado={copiado === m.id}
                                    onCopiar={copiar} onToggle={toggleAbierto} onBorrar={borrar}
                                />
                            ))}
                        </div>
                        <form className="compose" onSubmit={onSubmit}>
                            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { subir(Array.from(e.target.files)); e.target.value = '' }} />
                            <button type="button" className="btn-secondary adj" title="Adjuntar texto" aria-label="Adjuntar archivo de texto" onClick={() => fileRef.current && fileRef.current.click()}>
                                +
                            </button>
                            <textarea
                                ref={taRef} rows={1} spellCheck={false} autoFocus
                                aria-label="Mensaje" value={texto}
                                placeholder="Pega o escribe..."
                                onChange={(e) => {
                                    setTexto(e.target.value)
                                    e.target.style.height = 'auto'
                                    e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px'
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                        e.preventDefault()
                                        onSubmit(e)
                                    }
                                }}
                            />
                            <button type="submit" className="btn-primary" disabled={!texto.trim()}>ENVIAR</button>
                        </form>
                    </section>
                )}
            </div>

            {arrastrando && dentro && <div className="chat-drop">Suelta el texto</div>}

            <div className={'toast' + (toastState ? ' show ' + toastState.kind : '')} role="status" aria-live="polite">
                {toastState ? toastState.msg : ''}
            </div>
        </div>
    )
}
