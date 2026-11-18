import { K, MAX_BYTES, MAX_MSGS, db, entrar, json, leerBody } from '../_lib.js'

export default async function handler(req, res) {
    const cfg = entrar(req, res, 'POST')
    if (!cfg) return
    try {
        const body = leerBody(req)
        if (!body) return json(res, 400, { error: 'Error' })
        const text = typeof body.text === 'string' ? body.text : ''
        if (!text.trim()) return json(res, 400, { error: 'Vacio' })
        if (text.includes('\u0000')) return json(res, 400, { error: 'Solo texto' })
        if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) return json(res, 413, { error: 'Grande' })

        const name = String(body.name || '').slice(0, 200)
        const nick = String(body.nick || '').trim().slice(0, 30)
        const cid = String(body.cid || '').trim().slice(0, 40)

        const r = db(cfg)
        const id = Number(await r.incr(K.id))
        const time = Date.now()
        const msg = { id, cid, nick, text, name, time }

        const p = r.pipeline()
        p.zadd(K.msgs, { score: time, member: JSON.stringify(msg) })
        p.zremrangebyrank(K.msgs, 0, -(MAX_MSGS + 1))
        p.expire(K.msgs, cfg.ttlMin * 60 + 60)
        p.incr(K.rev)
        await p.exec()
        return json(res, 200, { ok: true })
    } catch {
        return json(res, 500, { error: 'Error' })
    }
}
