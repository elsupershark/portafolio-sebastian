import { K, db, entrar, json, leerBody, leerMensaje } from '../_lib.js'

export default async function handler(req, res) {
    const cfg = entrar(req, res, 'POST')
    if (!cfg) return
    try {
        const body = leerBody(req)
        const id = body ? Number(body.id) : NaN
        const cid = body ? String(body.cid || '').trim().slice(0, 40) : ''
        if (!Number.isFinite(id) || !cid) return json(res, 400, { error: 'Error' })

        const r = db(cfg)
        const filas = await r.zrange(K.msgs, 0, -1)
        let quitado = 0
        for (const f of filas) {
            const m = leerMensaje(f)
            /* solo se borran mensajes enviados desde este mismo navegador */
            if (m && m.id === id && m.cid === cid) {
                quitado = Number(await r.zrem(K.msgs, f))
                break
            }
        }
        if (quitado) await r.incr(K.rev)
        return json(res, 200, { ok: true })
    } catch {
        return json(res, 500, { error: 'Error' })
    }
}
