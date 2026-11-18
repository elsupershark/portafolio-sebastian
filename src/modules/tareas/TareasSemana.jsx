import { useEffect, useMemo, useRef, useState } from 'react'
import './tareas.css'
import {
    DIAS, JP, XP_POR_NIVEL, XP_POR_TAREA,
    addDays, calcStats, diaHabilSiguienteKey, fmtCorto, fmtLargo, fromKey, hoyHabil,
    loadTasks, mondayOf, newId, nivelCelda, parseLines, resumenSemana, saveTasks, toKey, weekKeys,
} from './lib.js'

function TextoTarea({ texto }) {
    const partes = texto.split(/(#[\w\u00c0-\u024f-]+)/)
    return (
        <>
            {partes.map((p, i) => (i % 2 === 1 ? <span key={i} className="tag">{p}</span> : p))}
        </>
    )
}

export default function TareasSemana({ onVolver }) {
    const [tasks, setTasks] = useState(() => loadTasks())
    const [weekStart, setWeekStart] = useState(() => mondayOf(hoyHabil()))
    const [composer, setComposer] = useState(null)
    const [editing, setEditing] = useState(null)
    const [dragOver, setDragOver] = useState(null)
    const [regTab, setRegTab] = useState('semana')
    const [toastState, setToastState] = useState(null)
    const timer = useRef(0)

    useEffect(() => {
        saveTasks(tasks)
    }, [tasks])

    const toast = (msg, kind = '') => {
        setToastState({ msg, kind })
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setToastState(null), 2600)
    }

    /* ---------- Derivados ---------- */

    const hoyKey = toKey(hoyHabil())
    const keys = useMemo(() => weekKeys(weekStart), [weekStart])
    const esSemanaActual = keys.includes(hoyKey)

    const porDia = useMemo(() => {
        const m = {}
        keys.forEach((k) => { m[k] = [] })
        tasks.forEach((t) => { if (m[t.date]) m[t.date].push(t) })
        keys.forEach((k) => {
            m[k] = [...m[k].filter((t) => !t.done), ...m[k].filter((t) => t.done)]
        })
        return m
    }, [tasks, keys])

    const totalSemana = keys.reduce((s, k) => s + porDia[k].length, 0)
    const hechasSemana = keys.reduce((s, k) => s + porDia[k].filter((t) => t.done).length, 0)
    const pctSemana = totalSemana ? Math.round((hechasSemana / totalSemana) * 100) : 0
    const hoyTotal = tasks.filter((t) => t.date === hoyKey).length
    const hoyHechas = tasks.filter((t) => t.date === hoyKey && t.done).length
    const pendientes = tasks.filter((t) => !t.done && t.date < hoyKey).length
    const stats = useMemo(() => calcStats(tasks), [tasks])

    const hechasOrden = useMemo(
        () => tasks.filter((t) => t.done && t.doneAt).sort((a, b) => b.doneAt.localeCompare(a.doneAt)),
        [tasks]
    )

    const registro = useMemo(() => {
        const lista = regTab === 'semana'
            ? hechasOrden.filter((t) => keys.includes(t.doneKey))
            : hechasOrden.slice(0, 80)
        const grupos = []
        lista.forEach((t) => {
            const g = grupos[grupos.length - 1]
            if (g && g.key === t.doneKey) g.items.push(t)
            else grupos.push({ key: t.doneKey, items: [t] })
        })
        return grupos
    }, [hechasOrden, keys, regTab])

    const actividad = useMemo(() => {
        const cont = {}
        tasks.forEach((t) => {
            if (t.done && t.doneKey) cont[t.doneKey] = (cont[t.doneKey] || 0) + 1
        })
        const base = mondayOf(hoyHabil())
        const filas = []
        for (let w = 7; w >= 0; w--) {
            const lunes = addDays(base, -7 * w)
            filas.push({ lunes: toKey(lunes), celdas: weekKeys(lunes).map((k) => ({ key: k, n: cont[k] || 0 })) })
        }
        return filas
    }, [tasks])

    /* ---------- Acciones ---------- */

    function abrirComposer(dia) {
        const def = dia || (esSemanaActual ? hoyKey : keys[0])
        setComposer((c) => ({ text: c ? c.text : '', day: def }))
    }

    function crearTareas() {
        if (!composer) return
        const lineas = parseLines(composer.text)
        if (!lineas.length) { toast('Escribe al menos una tarea', 'err'); return }
        const ahora = new Date().toISOString()
        const nuevas = lineas.map((texto) => ({
            id: newId(), text: texto, date: composer.day, done: false, doneAt: null, doneKey: null, createdAt: ahora,
        }))
        setTasks((prev) => [...prev, ...nuevas])
        const idx = keys.indexOf(composer.day)
        setComposer(null)
        toast(nuevas.length + (nuevas.length === 1 ? ' tarea creada' : ' tareas creadas') + ' \u00b7 ' + (idx >= 0 ? DIAS[idx].largo : ''), 'ok')
    }

    function alternar(id) {
        const antes = calcStats(tasks)
        const ahora = new Date()
        const next = tasks.map((t) => {
            if (t.id !== id) return t
            if (t.done) return { ...t, done: false, doneAt: null, doneKey: null }
            return { ...t, done: true, doneAt: ahora.toISOString(), doneKey: toKey(ahora) }
        })
        setTasks(next)
        const despues = calcStats(next)
        if (despues.nivel > antes.nivel) toast('NIVEL ' + despues.nivel + ' DESBLOQUEADO', 'ok')
    }

    function eliminar(id) {
        setTasks((prev) => prev.filter((t) => t.id !== id))
    }

    function mover(id, key) {
        setTasks((prev) => prev.map((t) => (t.id === id && t.date !== key ? { ...t, date: key } : t)))
    }

    function moverSiguiente(t) {
        const key = diaHabilSiguienteKey(t.date)
        mover(t.id, key)
        toast('Movida a ' + fmtLargo(key))
    }

    function iniciarEdicion(t) {
        setEditing({ id: t.id, text: t.text })
    }

    function guardarEdicion() {
        if (!editing) return
        const texto = editing.text.trim()
        const id = editing.id
        setEditing(null)
        if (!texto) return
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text: texto } : t)))
    }

    function traerPendientes() {
        const n = pendientes
        setTasks((prev) => prev.map((t) => (!t.done && t.date < hoyKey ? { ...t, date: hoyKey } : t)))
        setWeekStart(mondayOf(hoyHabil()))
        toast(n + (n === 1 ? ' pendiente movida a hoy' : ' pendientes movidas a hoy'), 'ok')
    }

    async function copiarResumen() {
        const txt = resumenSemana(tasks, keys, 'Semana ' + fmtCorto(keys[0]) + ' - ' + fmtCorto(keys[4]))
        try {
            await navigator.clipboard.writeText(txt)
            toast('RESUMEN COPIADO AL PORTAPAPELES', 'ok')
        } catch (e) {
            toast('NO SE PUDO COPIAR EL RESUMEN', 'err')
        }
    }

    const lineasComposer = composer ? parseLines(composer.text).length : 0

    return (
        <div className="tar-root">
            {/* Fondo cyberpunk: cuadricula, resplandores y scanlines */}
            <div className="tar-bg-grid" aria-hidden="true" />
            <div className="tar-glow tar-glow-a" aria-hidden="true" />
            <div className="tar-glow tar-glow-b" aria-hidden="true" />
            <div className="tar-scan" aria-hidden="true" />

            <div className="wrap">
                <header>
                    <div className="logo">{'\u2713'}</div>
                    <div className="grow">
                        <p className="eyebrow">{'// ' + JP.tareas + ' \u00b7 M\u00d3DULO EN L\u00cdNEA'}</p>
                        <h1 className="glitch" data-text="Tareas semanales">Tareas semanales</h1>
                        <p className="sub">Micro tareas de la semana, de lunes a viernes. Escribe una por l&iacute;nea, complet&aacute;las durante el d&iacute;a y mira c&oacute;mo sube tu nivel. Todo se guarda en tu navegador.</p>
                    </div>
                    {onVolver && <button type="button" className="btn-ghost btn-sm" onClick={onVolver}>{'\u2190 VOLVER \u00b7 ' + JP.volver}</button>}
                </header>

                {/* Progreso */}
                <section className="panel">
                    <h2>Progreso <span className="jp">{JP.nivel}</span></h2>
                    <div className="stats">
                        <div className="stat ok">
                            <div className="v">{stats.nivel}</div>
                            <div className="k">Nivel</div>
                            <div className="bar"><i style={{ width: Math.round((stats.xpNivel / XP_POR_NIVEL) * 100) + '%' }} /></div>
                            <div className="k sm">XP {stats.xpNivel}/{XP_POR_NIVEL} &middot; +{XP_POR_TAREA} por tarea</div>
                        </div>
                        <div className="stat">
                            <div className="v">{hoyHechas}/{hoyTotal}</div>
                            <div className="k">Hoy</div>
                        </div>
                        <div className="stat">
                            <div className="v">{hechasSemana}/{totalSemana}</div>
                            <div className="k">Esta semana</div>
                            <div className="bar"><i style={{ width: pctSemana + '%' }} /></div>
                        </div>
                        <div className="stat">
                            <div className="v">{stats.racha}</div>
                            <div className="k">{'Racha \u00b7 d\u00edas h\u00e1biles'} <span className="jp">{JP.racha}</span></div>
                        </div>
                        <div className="stat">
                            <div className="v">{stats.totalHechas}</div>
                            <div className="k">Completadas en total</div>
                        </div>
                    </div>
                </section>

                {/* Semana */}
                <section className="panel">
                    <h2>Semana <span className="jp">{JP.semana}</span></h2>
                    <div className="toolbar">
                        <button type="button" className="btn-primary" onClick={() => abrirComposer()}>+ A&Ntilde;ADIR TAREAS</button>
                        <button type="button" className="btn-secondary" onClick={() => setWeekStart((w) => addDays(w, -7))}>&larr; ANTERIOR</button>
                        <span className="range">{fmtCorto(keys[0])} &ndash; {fmtCorto(keys[4])} {weekStart.getFullYear()}</span>
                        <button type="button" className="btn-secondary" onClick={() => setWeekStart((w) => addDays(w, 7))}>SIGUIENTE &rarr;</button>
                        <button type="button" className="btn-ghost btn-sm" disabled={esSemanaActual} onClick={() => setWeekStart(mondayOf(hoyHabil()))}>IR A HOY</button>
                        <button type="button" className="btn-ghost btn-sm push" disabled={!totalSemana} onClick={copiarResumen}>COPIAR RESUMEN</button>
                    </div>
                    {pendientes > 0 && (
                        <div className="alert warn">
                            <span>Tienes {pendientes} {pendientes === 1 ? 'tarea pendiente' : 'tareas pendientes'} de d&iacute;as anteriores.</span>
                            <button type="button" className="btn-secondary btn-sm" onClick={traerPendientes}>TRAER A HOY</button>
                        </div>
                    )}
                    <p className="hint">Arrastra una tarea a otro d&iacute;a para moverla &middot; doble clic para editarla &middot; usa <b>#etiquetas</b> para marcar proyectos o tickets.</p>
                </section>

                {/* Composer */}
                {composer && (
                    <section className="panel composer">
                        <h2>A&ntilde;adir tareas <span className="jp">{JP.tareas}</span></h2>
                        <div className="chips" role="radiogroup" aria-label="D&iacute;a de las tareas">
                            {keys.map((k, i) => (
                                <label key={k} className="chip">
                                    <input type="radio" name="tar-dia" checked={composer.day === k} onChange={() => setComposer((c) => ({ ...c, day: k }))} />
                                    <span>{DIAS[i].corto} <small>{fromKey(k).getDate()}</small></span>
                                </label>
                            ))}
                        </div>
                        <textarea
                            autoFocus
                            spellCheck={false}
                            aria-label="Tareas, una por l&iacute;nea"
                            value={composer.text}
                            onChange={(e) => setComposer((c) => ({ ...c, text: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); crearTareas() }
                                if (e.key === 'Escape') setComposer(null)
                            }}
                            placeholder={'hacer informe 1\nhacer informe 7\njustificar informe 7'}
                        />
                        <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
                            <button type="button" className="btn-primary" disabled={!lineasComposer} onClick={crearTareas}>
                                CREAR {lineasComposer || ''} {lineasComposer === 1 ? 'TAREA' : 'TAREAS'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => setComposer(null)}>CANCELAR</button>
                            <span className="hint push" style={{ margin: 0 }}>Una tarea por l&iacute;nea &middot; <b>Enter</b> = salto de l&iacute;nea &middot; <b>Ctrl + Enter</b> = crear</span>
                        </div>
                    </section>
                )}

                {/* Tablero */}
                <div className="board">
                    {keys.map((k, i) => {
                        const lista = porDia[k]
                        const hechas = lista.filter((t) => t.done).length
                        const pct = lista.length ? Math.round((hechas / lista.length) * 100) : 0
                        const esHoy = k === hoyKey
                        return (
                            <section
                                key={k}
                                className={'col' + (esHoy ? ' today' : '') + (dragOver === k ? ' over' : '')}
                                onDragOver={(e) => { e.preventDefault(); if (dragOver !== k) setDragOver(k) }}
                                onDragLeave={() => setDragOver((d) => (d === k ? null : d))}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    const id = e.dataTransfer.getData('text/plain')
                                    setDragOver(null)
                                    if (id) mover(id, k)
                                }}
                            >
                                <div className="col-head">
                                    <div>
                                        <p className="col-kanji">{DIAS[i].kanji}{esHoy && <span className="badge">HOY</span>}</p>
                                        <h2>{DIAS[i].largo}</h2>
                                        <p className="col-date">{fmtCorto(k)}</p>
                                    </div>
                                    <span className="col-count">{hechas}/{lista.length}</span>
                                </div>
                                <div className="bar"><i style={{ width: pct + '%' }} /></div>

                                <div className="col-body">
                                    {!lista.length && <p className="empty-msg">Sin tareas</p>}
                                    {lista.map((t) => {
                                        const enEdicion = editing && editing.id === t.id
                                        const atrasada = !t.done && t.date < hoyKey
                                        return (
                                            <div
                                                key={t.id}
                                                className={'tk' + (t.done ? ' done' : '') + (atrasada ? ' late' : '')}
                                                draggable={!enEdicion}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', t.id)
                                                    e.dataTransfer.effectAllowed = 'move'
                                                }}
                                                onDragEnd={() => setDragOver(null)}
                                            >
                                                <button
                                                    type="button"
                                                    className="ck"
                                                    role="checkbox"
                                                    aria-checked={t.done}
                                                    aria-label={(t.done ? 'Marcar como pendiente: ' : 'Completar: ') + t.text}
                                                    onClick={() => alternar(t.id)}
                                                >
                                                    {t.done ? '\u2713' : ''}
                                                </button>
                                                {enEdicion ? (
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        spellCheck={false}
                                                        aria-label="Editar tarea"
                                                        value={editing.text}
                                                        onChange={(e) => setEditing((s) => ({ ...s, text: e.target.value }))}
                                                        onBlur={guardarEdicion}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') { e.preventDefault(); guardarEdicion() }
                                                            if (e.key === 'Escape') setEditing(null)
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="txt" onDoubleClick={() => iniciarEdicion(t)}><TextoTarea texto={t.text} /></span>
                                                )}
                                                {!enEdicion && (
                                                    <span className="tk-act">
                                                        <button type="button" className="ib" aria-label={'Editar: ' + t.text} onClick={() => iniciarEdicion(t)}>{'\u270e'}</button>
                                                        <button type="button" className="ib" aria-label={'Mover al d\u00eda siguiente: ' + t.text} onClick={() => moverSiguiente(t)}>{'\u2192'}</button>
                                                        <button type="button" className="ib del" aria-label={'Eliminar: ' + t.text} onClick={() => eliminar(t.id)}>{'\u00d7'}</button>
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <button type="button" className="chip-add" onClick={() => abrirComposer(k)}>+ A&Ntilde;ADIR</button>
                            </section>
                        )
                    })}
                </div>

                {/* Registro y actividad */}
                <div className="bottom">
                    <section className="panel">
                        <h2>Registro <span className="jp">{JP.registro}</span></h2>
                        <div className="toolbar">
                            <div className="seg" role="group" aria-label="Rango del registro">
                                <button type="button" aria-pressed={regTab === 'semana'} onClick={() => setRegTab('semana')}>ESTA SEMANA</button>
                                <button type="button" aria-pressed={regTab === 'todo'} onClick={() => setRegTab('todo')}>HISTORIAL</button>
                            </div>
                        </div>
                        <div className="log">
                            {!registro.length && <p className="empty-msg">{'Aún no hay tareas completadas en este rango.'}</p>}
                            {registro.map((g) => (
                                <div key={g.key} className="log-day">
                                    <h3>{fmtLargo(g.key)} <span className="jp">{JP.completado} {g.items.length}</span></h3>
                                    <ul>
                                        {g.items.map((t) => (
                                            <li key={t.id}>
                                                <span className="time">{new Date(t.doneAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="lt"><TextoTarea texto={t.text} /></span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="panel">
                        <h2>Actividad <span className="jp">{JP.actividad}</span></h2>
                        <div className="hm" role="img" aria-label="Mapa de actividad de las \u00faltimas 8 semanas">
                            <span />
                            {DIAS.map((d) => <span key={d.corto} className="hm-h">{d.corto.charAt(0)}</span>)}
                            {actividad.map((fila) => (
                                <FilaActividad key={fila.lunes} fila={fila} hoyKey={hoyKey} />
                            ))}
                        </div>
                        <p className="hint">&Uacute;ltimas 8 semanas. M&aacute;s brillo = m&aacute;s tareas completadas ese d&iacute;a.</p>
                    </section>
                </div>

                <p className="footer">
                    <span className="jp">{JP.sistema}</span>
                    Persistencia local &middot; <b>nada sale de tu equipo</b>
                </p>
            </div>
            <div className={'toast' + (toastState ? ' show ' + toastState.kind : '')} role="status" aria-live="polite">
                {toastState ? toastState.msg : ''}
            </div>
        </div>
    )
}

function FilaActividad({ fila, hoyKey }) {
    return (
        <>
            <span className="hm-w">{fmtCorto(fila.lunes)}</span>
            {fila.celdas.map((c) => (
                <span
                    key={c.key}
                    className={'hm-c lvl-' + nivelCelda(c.n) + (c.key === hoyKey ? ' now' : '') + (c.key > hoyKey ? ' fut' : '')}
                    title={fmtCorto(c.key) + ': ' + c.n + (c.n === 1 ? ' tarea' : ' tareas')}
                />
            ))}
        </>
    )
}
