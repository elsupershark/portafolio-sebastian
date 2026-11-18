import { K, db, entrar, json, leerMensaje } from '../_lib.js'

export default async function handler(req, res) {
    const cfg = entrar(req, res, 'GET')
    if (!cfg) return
    try {
        const r = db(cfg)
        const limite = Date.now() - cfg.ttlMin * 60000
        const p = r.pipeline()
        p.zremrangebyscore(K.msgs, 0, limite)
        p.get(K.rev)
        const [quitados, revRaw] = await p.exec()
        let rev = Number(revRaw) || 0
        if (Number(quitados) > 0) rev = Number(await r.incr(K.rev))

        const q = new URL(req.url, 'http://local').searchParams.get('rev')
        const cliente = q === null ? -1 : Number(q)
        if (cliente === rev) return json(res, 200, { unchanged: true, rev })

        const filas = await r.zrange(K.msgs, 0, -1)
        const messages = filas.map(leerMensaje).filter(Boolean)
        return json(res, 200, { rev, messages })
    } catch {
        return json(res, 500, { error: 'Error' })
    }
}
