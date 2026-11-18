import { useEffect, useRef, useState } from 'react'
import './chat.css'
import {
    NICK_KEY, PIN_KEY, apiFetch, copyText, fmtBytes, guardar, hora, idDispositivo, leer,
} from './lib.js'

const JP = {
    chat: '\u30c1\u30e3\u30c3\u30c8',
    secreto: '\u79d8\u5bc6',
    acceso: '\u30a2\u30af\u30bb\u30b9',
    volver: '\u623b\u308b',
}
const MAX_FILE = 1024 * 1024
const LINEAS = 5

function Mensaje({ m, mio, abierto, copiado, onCopiar, onToggle, onBorrar }) {
    const largo = m.text.split('\n').length > LINEAS || m.text.length > 360
    const quien = m.nick ? m.nick + ' \u00b7 ' + m.ip : m.ip
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
                        <button type="button" className="del" title="Borrar este mensaje" aria-label="Borrar este mensaje"
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
    const [pin, setPin] = useState(() => leer(PIN_KEY))
    const [pinTxt, setPinTxt] = useState('')
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

    const aviso = (msg, kind = '') => {
        setToastState({ msg, kind })
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToastState(null), 2000)
    }

    /* ---------- Consulta periodica de mensajes (solo mientras esta abierto el chat) ---------- */
    useEffect(() => {
        if (!pin) return undefined
        let vivo = true
        let t = 0
        revRef.current = -1
        async function poll() {
            let espera = 1500
            try {
                const r = await apiFetch('/messages?rev=' + revRef.current, pin)
                if (!vivo) return
                if (r.status === 401) {
                    guardar(PIN_KEY, '')
                    setPin('')
                    setEstado('off')
                    setAuthErr('PIN incorrecto')
                    return
                }
                if (r.status === 429) {
                    setEstado('lock')
                    espera = 5000
                } else {
                    const d = await r.json()
                    if (!vivo) return
                    setEstado('ok')
                    if (!d.unchanged) {
                        revRef.current = d.rev
                        setMsgs(d.messages)
                    }
                }
            } catch {
                if (!vivo) return
                setEstado('off')
            }
            if (vivo) t = setTimeout(poll, espera)
        }
        poll()
        return () => {
            vivo = false
            clearTimeout(t)
        }
    }, [pin, kick])

    /* Baja al ultimo mensaje cuando llega uno nuevo */
    useEffect(() => {
        const el = listaRef.current
        if (el && msgs.length > prevCount.current) el.scrollTop = el.scrollHeight
        prevCount.current = msgs.length
    }, [msgs])

    /* ---------- Acceso ---------- */
    function entrar(e) {
        e.preventDefault()
        const p = pinTxt.trim()
        if (!p) return
        guardar(PIN_KEY, p)
        setAuthErr('')
        setPinTxt('')
        setPin(p)
    }

    function salir() {
        guardar(PIN_KEY, '')
        setPin('')
        setMsgs([])
        setEstado('off')
        onVolver()
    }

    /* ---------- Envio ---------- */
    async function enviar(t, nombre) {
        if (!t || !t.trim()) return false
        try {
            const r = await apiFetch('/send', pin, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: t, name: nombre || '', nick: nick.trim(), cid }),
            })
            if (r.status === 413) { aviso('Mensaje demasiado grande', 'err'); return false }
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
            if (t.includes('\u0000')) { aviso(f.name + ' no parece ser texto', 'err'); continue }
            await enviar(t, f.name)
        }
        setKick((k) => k + 1)
    }

    async function borrar(m) {
        try {
            await apiFetch('/delete', pin, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: m.id, cid }),
            })
        } catch {
            aviso('No se pudo borrar', 'err')
        }
        setKick((k) => k + 1)
    }

    async function limpiar() {
        if (!window.confirm('\u00bfBorrar todos los mensajes?')) return
        setAbiertos(new Set())
        try {
            await apiFetch('/clear', pin, { method: 'POST' })
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
        aviso('COPIADO AL PORTAPAPELES', 'ok')
    }

    function copiarUltimo() {
        const ajenos = msgs.filter((m) => m.cid !== cid)
        const m = ajenos.length ? ajenos[ajenos.length - 1] : msgs[msgs.length - 1]
        if (!m) { aviso('No hay mensajes', 'err'); return }
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
        if (e.dataTransfer.files.length) subir(Array.from(e.dataTransfer.files))
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
                        {pin && (
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
                        {pin && <button type="button" className="btn-ghost btn-sm" onClick={salir}>SALIR</button>}
                    </div>
                </header>

                {!pin ? (
                    <form className="panel login" onSubmit={entrar}>
                        <h2>PIN <span className="jp">{JP.acceso}</span></h2>
                        <input
                            type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={64}
                            aria-label="PIN de acceso" value={pinTxt} onChange={(e) => setPinTxt(e.target.value)}
                        />
                        <button type="submit" className="btn-primary btn-big" disabled={!pinTxt.trim()}>ENTRAR</button>
                        <p className="login-err" role="alert">{authErr}</p>
                    </form>
                ) : (
                    <section className="panel main">
                        <div className="lista" ref={listaRef} aria-label="Mensajes">
                            {!msgs.length && (
                                <p className="vacio">
                                    Sin mensajes<br />
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
                            <button type="button" className="btn-secondary adj" title="Adjuntar archivo de texto" aria-label="Adjuntar archivo de texto" onClick={() => fileRef.current && fileRef.current.click()}>
                                +
                            </button>
                            <textarea
                                ref={taRef} rows={1} spellCheck={false} autoFocus
                                aria-label="Mensaje" value={texto}
                                placeholder="Pega un comando o texto... (Enter env&iacute;a)"
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

            {arrastrando && pin && <div className="chat-drop">Suelta los archivos de texto</div>}

            <div className={'toast' + (toastState ? ' show ' + toastState.kind : '')} role="status" aria-live="polite">
                {toastState ? toastState.msg : ''}
            </div>
        </div>
    )
}