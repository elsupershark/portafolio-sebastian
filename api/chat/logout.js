import { cookieSesion, json, noEncontrado, origenOk } from '../_lib.js'

export default function handler(req, res) {
    if (req.method !== 'POST' || !origenOk(req)) return noEncontrado(res)
    res.setHeader('Set-Cookie', cookieSesion(req, '', 0))
    return json(res, 200, { ok: true })
}
