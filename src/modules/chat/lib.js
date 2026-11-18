/* Logica pura del modulo Chat secreto (comunicacion con el servidor Python y utilidades) */

export const API = '/api/chat'
export const PIN_KEY = 'sys-c-pin'
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

export function apiFetch(path, pin, opts = {}) {
    return fetch(API + path, {
        ...opts,
        cache: 'no-store',
        headers: { 'X-Pin': pin, ...(opts.headers || {}) },
    })
}

export function fmtBytes(n) {
    if (n < 1024) return n + ' B'
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
    return (n / 1048576).toFixed(1) + ' MB'
}

export const hora = (ms) => new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

/* Copia al portapapeles; si la pagina es http://IP (no segura) usa el metodo antiguo */
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