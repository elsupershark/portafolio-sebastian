/* Logica pura del modulo Chat secreto.
   Misma ruta (/api/chat) para la version Vercel (sesion por cookie) y el servidor Python local (PIN en cabecera). */

export const API = '/api/chat'
export const PIN_KEY = 'sys-c-pin' /* solo se usa con el servidor Python local */
export const NICK_KEY = 'sys-c-nick'
export const CID_KEY = 'sys-c-id'

export function leer(key) {
    try {
        return localStorage.getItem(key) || ''
    } catch (e) {
        return ''
    }
}

export function guardar(key, valor) {
    try {
        if (valor) localStorage.setItem(key, valor)
        else localStorage.removeItem(key)
    } catch (e) {
        /* almacenamiento no disponible: se ignora */
    }
}

/* Identificador aleatorio de este navegador: sirve para saber cuales mensajes son mios */
export function idDispositivo() {
    const actual = leer(CID_KEY)
    if (actual) return actual
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    const nuevo = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    guardar(CID_KEY, nuevo)
    return nuevo
}

/* La cookie de sesion viaja sola (HttpOnly). Solo en modo local se envia el PIN. */
export function apiFetch(path, opts = {}, pin = '') {
    const headers = { ...(opts.headers || {}) }
    if (pin) headers['X-Pin'] = pin
    return fetch(API + path, { ...opts, cache: 'no-store', credentials: 'same-origin', headers })
}

/* Devuelve: 'sesion' (Vercel), 'pin' (servidor Python local), 'mal', 'espera' o 'error' */
export async function iniciarSesion(clave) {
    try {
        const r = await apiFetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: clave }),
        })
        if (r.ok) return 'sesion'
        if (r.status === 404) return 'pin'
        if (r.status === 401) return 'mal'
        if (r.status === 429) return 'espera'
        return 'error'
    } catch (e) {
        return 'error'
    }
}

export async function cerrarSesion() {
    try {
        await apiFetch('/logout', { method: 'POST' })
    } catch (e) {
        /* sin conexion: se ignora */
    }
}

export function fmtBytes(n) {
    if (n < 1024) return n + ' B'
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
    return (n / 1048576).toFixed(1) + ' MB'
}

export const hora = (ms) => new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

/* Copia al portapapeles; si la pagina no es segura usa el metodo antiguo */
export async function copyText(texto) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(texto)
            return true
        } catch (e) {
            /* se prueba el metodo alternativo */
        }
    }
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, texto.length)
    let ok = false
    try {
        ok = document.execCommand('copy')
    } catch (e) {
        ok = false
    }
    ta.remove()
    return ok
}
