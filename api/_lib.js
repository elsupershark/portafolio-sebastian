/* Utilidades compartidas de las funciones del chat: configuracion, sesion firmada, Redis y limite de intentos */
import { Redis } from '@upstash/redis'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const COOKIE = 'chat_sid'
export const SESSION_HORAS = 12
export const MAX_MSGS = 200
export const MAX_BYTES = 1024 * 1024
export const MAX_FALLOS = 5
export const K = { msgs: 'chat:msgs', rev: 'chat:rev', id: 'chat:id' }

/* ---------- Configuracion (todo viene de variables de entorno de Vercel) ---------- */

export function config() {
    const secret = (process.env.CHAT_SECRET || '').trim()
    const sessionKey = (process.env.CHAT_SESSION_KEY || '').trim()
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || ''
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
    const raw = (process.env.CHAT_TTL_MIN || '').trim()
    const n = raw === '' ? 30 : Number(raw)
    const ttlMin = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1440) : 30
    const ok = secret.length >= 12 && sessionKey.length >= 32 && !!url && !!token
    return { ok, secret, sessionKey, url, token, ttlMin }
}

let redis = null
export function db(cfg) {
    if (!redis) redis = new Redis({ url: cfg.url, token: cfg.token, automaticDeserialization: false })
    return redis
}

/* ---------- Respuestas ---------- */

export function json(res, status, obj) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(obj))
}

export function noEncontrado(res) {
    res.statusCode = 404
    res.setHeader('Cache-Control', 'no-store')
    res.end()
}

export function leerBody(req) {
    let b = req.body
    if (typeof b === 'string') {
        try {
            b = JSON.parse(b)
        } catch {
            b = null
        }
    }
    return b && typeof b === 'object' && !Buffer.isBuffer(b) ? b : null
}

export function leerMensaje(texto) {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}

export const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- Clave y sesion firmada ---------- */

const sha = (s) => createHash('sha256').update(s).digest()

export function claveValida(cfg, intento) {
    return timingSafeEqual(sha(intento), sha(cfg.secret))
}

/* La firma depende de CHAT_SESSION_KEY y de CHAT_SECRET: cambiar cualquiera invalida todas las sesiones */
function firma(cfg, datos) {
    const k = createHmac('sha256', cfg.sessionKey).update(cfg.secret).digest()
    return createHmac('sha256', k).update(datos).digest('base64url')
}

export function crearSesion(cfg) {
    const exp = Math.floor(Date.now() / 1000) + SESSION_HORAS * 3600
    const datos = Buffer.from(JSON.stringify({ exp, n: randomBytes(8).toString('hex') })).toString('base64url')
    return datos + '.' + firma(cfg, datos)
}

export function sesionValida(cfg, token) {
    if (!token) return false
    const partes = token.split('.')
    if (partes.length !== 2 || !partes[0] || !partes[1]) return false
    const a = Buffer.from(partes[1])
    const b = Buffer.from(firma(cfg, partes[0]))
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false
    try {
        const p = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'))
        return typeof p.exp === 'number' && p.exp > Date.now() / 1000
    } catch {
        return false
    }
}

export function leerCookie(req, nombre) {
    const h = req.headers.cookie || ''
    for (const par of h.split(';')) {
        const i = par.indexOf('=')
        if (i < 0) continue
        if (par.slice(0, i).trim() === nombre) return par.slice(i + 1).trim()
    }
    return ''
}

export function cookieSesion(req, valor, segundos) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const partes = [COOKIE + '=' + valor, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=' + segundos]
    if (proto === 'https') partes.push('Secure')
    return partes.join('; ')
}

export function origenOk(req) {
    if (req.method === 'GET') return true
    const o = req.headers.origin
    if (!o) return true
    try {
        return new URL(o).host === req.headers.host
    } catch {
        return false
    }
}

/* Puerta de todas las rutas del chat (menos login y logout): sin sesion valida responde 404 generico */
export function entrar(req, res, metodo) {
    const cfg = config()
    if (req.method !== metodo || !cfg.ok || !origenOk(req) || !sesionValida(cfg, leerCookie(req, COOKIE))) {
        noEncontrado(res)
        return null
    }
    return cfg
}

/* ---------- Limite de intentos por IP (guardado en Redis) ---------- */

export function ipDe(req) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    return xf || (req.socket && req.socket.remoteAddress) || 'desconocida'
}

const huella = (ip) => createHash('sha256').update(ip).digest('hex').slice(0, 32)

export async function bloqueoRestante(cfg, ip) {
    const ttl = Number(await db(cfg).ttl('chat:lock:' + huella(ip)))
    return ttl > 0 ? ttl : 0
}

/* Desde el quinto fallo seguido: 60 s, 120 s, 240 s... hasta 24 h */
export async function registrarFallo(cfg, ip) {
    const r = db(cfg)
    const h = huella(ip)
    const p = r.pipeline()
    p.incr('chat:fail:' + h)
    p.expire('chat:fail:' + h, 86400)
    const res = await p.exec()
    const n = Number(res[0])
    if (n >= MAX_FALLOS) {
        const seg = Math.min(60 * 2 ** (n - MAX_FALLOS), 86400)
        await r.set('chat:lock:' + huella(ip), '1', { ex: seg })
    }
}

export async function limpiarFallos(cfg, ip) {
    await db(cfg).del('chat:fail:' + huella(ip))
}
