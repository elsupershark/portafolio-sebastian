import {
    SESSION_HORAS, bloqueoRestante, claveValida, config, cookieSesion, crearSesion, ipDe, json,
    leerBody, limpiarFallos, noEncontrado, origenOk, pausa, registrarFallo,
} from '../_lib.js'

export default async function handler(req, res) {
    if (req.method !== 'POST') return noEncontrado(res)
    const cfg = config()
    if (!cfg.ok) return json(res, 500, { error: 'Error' })
    if (!origenOk(req)) return noEncontrado(res)
    const ip = ipDe(req)
    try {
        const espera = await bloqueoRestante(cfg, ip)
        if (espera > 0) {
            res.setHeader('Retry-After', String(espera))
            return json(res, 429, { error: 'Espera' })
        }
        const body = leerBody(req)
        const clave = body && typeof body.key === 'string' ? body.key.trim() : ''
        if (!clave || clave.length > 256) return json(res, 400, { error: 'Error' })
        if (claveValida(cfg, clave)) {
            await limpiarFallos(cfg, ip)
            res.setHeader('Set-Cookie', cookieSesion(req, crearSesion(cfg), SESSION_HORAS * 3600))
            return json(res, 200, { ok: true })
        }
        await registrarFallo(cfg, ip)
        await pausa(400)
        return json(res, 401, { error: 'No autorizado' })
    } catch {
        return json(res, 500, { error: 'Error' })
    }
}
