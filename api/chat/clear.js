import { K, db, entrar, json } from '../_lib.js'

export default async function handler(req, res) {
    const cfg = entrar(req, res, 'POST')
    if (!cfg) return
    try {
        const p = db(cfg).pipeline()
        p.del(K.msgs)
        p.incr(K.rev)
        await p.exec()
        return json(res, 200, { ok: true })
    } catch {
        return json(res, 500, { error: 'Error' })
    }
}
