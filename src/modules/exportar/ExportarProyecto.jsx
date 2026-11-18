import { useMemo, useRef, useState } from 'react'
import './exportar.css'
import {
    DEFAULT_IGNORE, DEFAULT_EXTS, DEFAULT_SELECTED, BINARY_EXT, REASONS,
    cmp, fmtNum, fmtBytes, extLabel, scanSource, generateText,
} from './lib.js'

function buildTree(files) {
    const root = { dirs: new Map(), files: [], all: [] }
    for (const f of files) {
        const parts = f.path.split('/')
        let n = root
        n.all.push(f)
        for (let i = 0; i < parts.length - 1; i++) {
            const d = parts[i]
            if (!n.dirs.has(d)) {
                n.dirs.set(d, { name: d, path: parts.slice(0, i + 1).join('/'), dirs: new Map(), files: [], all: [] })
            }
            n = n.dirs.get(d)
            n.all.push(f)
        }
        n.files.push(f)
    }
    return root
}

export default function ExportarProyecto({ onVolver }) {
    const [name, setName] = useState('')
    const [source, setSource] = useState(null)
    const [entries, setEntries] = useState([])
    const [auto, setAuto] = useState([])
    const [ignoredDirs, setIgnoredDirs] = useState([])
    const [scanned, setScanned] = useState(false)
    const [extKnown, setExtKnown] = useState(DEFAULT_EXTS)
    const [extSel, setExtSel] = useState(() => new Set(DEFAULT_SELECTED))
    const [excluded, setExcluded] = useState(() => new Set())
    const [expanded, setExpanded] = useState(() => new Set())
    const [view, setView] = useState('tree')
    const [query, setQuery] = useState('')
    const [busy, setBusy] = useState(false)
    const [progress, setProgress] = useState(null)
    const [ignoreText, setIgnoreText] = useState(DEFAULT_IGNORE)
    const [maxFile, setMaxFile] = useState(300)
    const [maxTotal, setMaxTotal] = useState(5)
    const [detect, setDetect] = useState(true)
    const [newExt, setNewExt] = useState('')
    const [result, setResult] = useState(null)
    const [toastState, setToastState] = useState(null)
    const fallbackRef = useRef(null)
    const outputRef = useRef(null)
    const timer = useRef(0)

    const toast = (msg, kind = '') => {
        setToastState({ msg, kind })
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setToastState(null), 2600)
    }

    /* ---------- Derivados ---------- */

    const counts = useMemo(() => {
        const c = {}
        entries.forEach((e) => { c[e.key] = (c[e.key] || 0) + 1 })
        return c
    }, [entries])

    const detected = useMemo(
        () => Object.keys(counts)
            .filter((k) => !extKnown.includes(k) && !BINARY_EXT.has(k))
            .sort((a, b) => counts[b] - counts[a] || cmp(a, b))
            .slice(0, 24),
        [counts, extKnown]
    )

    const extSelected = useMemo(() => entries.filter((e) => extSel.has(e.key)), [entries, extSel])
    const included = useMemo(() => extSelected.filter((e) => !excluded.has(e.path)), [extSelected, excluded])
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return extSelected.filter((e) => !q || e.path.toLowerCase().includes(q))
    }, [extSelected, query])
    const includedSize = useMemo(() => included.reduce((s, e) => s + e.size, 0), [included])

    const sig = useMemo(
        () => [...extSel].sort().join(',') + '|' + [...excluded].sort().join(','),
        [extSel, excluded]
    )
    const stale = !!(result && result.output && result.sig !== sig)

    /* ---------- Escaneo ---------- */

    async function runScan(src) {
        if (busy || !src) return
        setBusy(true)
        setResult(null)
        try {
            const r = await scanSource(src, ignoreText, (text, ratio) => setProgress({ text, ratio }))
            setEntries(r.entries)
            setAuto(r.auto)
            setIgnoredDirs(r.ignoredDirs)
            setExcluded(new Set())
            setQuery('')
            setExpanded(new Set(r.entries.filter((e) => e.path.includes('/')).map((e) => e.path.split('/')[0])))
            setScanned(true)
            toast('Escaneo listo: ' + fmtNum(r.entries.length) + ' archivos de texto candidatos', 'ok')
        } catch (err) {
            console.error(err)
            toast('Error al escanear: ' + (err && err.message ? err.message : 'desconocido'), 'err')
        } finally {
            setProgress(null)
            setBusy(false)
        }
    }

    function adopt(nombre, src) {
        setName(nombre)
        setSource(src)
        runScan(src)
    }

    async function onSelect() {
        if (busy) return
        if (typeof window.showDirectoryPicker === 'function') {
            let handle
            try {
                handle = await window.showDirectoryPicker({ mode: 'read' })
            } catch (err) {
                if (err && err.name === 'AbortError') { toast('Selecci\u00f3n cancelada'); return }
                if (err && err.name === 'NotAllowedError') { toast('Permiso denegado para leer la carpeta', 'err'); return }
                if (fallbackRef.current) { toast('Usando el selector alternativo...'); fallbackRef.current.click(); return }
                toast('No se pudo abrir el selector de carpetas', 'err')
                return
            }
            adopt(handle.name, { type: 'handle', handle })
        } else if (fallbackRef.current) {
            fallbackRef.current.click()
        } else {
            toast('Tu navegador no permite seleccionar carpetas', 'err')
        }
    }

    function onFallback(ev) {
        const files = ev.target.files
        if (!files || !files.length) return
        const nombre = (files[0].webkitRelativePath || '').split('/')[0] || 'proyecto'
        const list = Array.from(files)
        ev.target.value = ''
        adopt(nombre, { type: 'files', files: list })
    }

    /* ---------- Tipos ---------- */

    function toggleExt(k, on) {
        setExtSel((prev) => {
            const n = new Set(prev)
            if (on) n.add(k)
            else n.delete(k)
            return n
        })
    }

    function addExtensions(raw) {
        const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase().replace(/^\*?\./, '')).filter(Boolean)
        if (!parts.length) { toast('Escribe una extensi\u00f3n, por ejemplo .java', 'err'); return false }
        const nuevas = []
        for (const p of parts) {
            if (!/^[a-z0-9_+-]+$/.test(p)) { toast('Extensi\u00f3n no v\u00e1lida: ' + p, 'err'); continue }
            nuevas.push(p)
        }
        if (!nuevas.length) return false
        setExtKnown((prev) => [...prev, ...nuevas.filter((p) => !prev.includes(p))])
        setExtSel((prev) => {
            const n = new Set(prev)
            nuevas.forEach((p) => n.add(p))
            return n
        })
        return true
    }

    /* ---------- Arbol ---------- */

    function toggleFile(path, on) {
        setExcluded((prev) => {
            const n = new Set(prev)
            if (on) n.delete(path)
            else n.add(path)
            return n
        })
    }

    function toggleDir(path, state) {
        const prefix = path + '/'
        setExcluded((prev) => {
            const n = new Set(prev)
            entries.filter((e) => e.path.startsWith(prefix)).forEach((e) => {
                if (state === 'all') n.add(e.path)
                else n.delete(e.path)
            })
            return n
        })
    }

    function toggleOpen(path) {
        setExpanded((prev) => {
            const n = new Set(prev)
            if (n.has(path)) n.delete(path)
            else n.add(path)
            return n
        })
    }

    function expandAll() {
        setExpanded((prev) => {
            const n = new Set(prev)
            visible.forEach((e) => {
                const parts = e.path.split('/')
                for (let i = 1; i < parts.length; i++) n.add(parts.slice(0, i).join('/'))
            })
            return n
        })
    }

    function setVisible(on) {
        setExcluded((prev) => {
            const n = new Set(prev)
            visible.forEach((e) => {
                if (on) n.delete(e.path)
                else n.add(e.path)
            })
            return n
        })
    }

    function treeRows(n, depth, out, forceOpen) {
        ;[...n.dirs.values()].sort((a, b) => cmp(a.name, b.name)).forEach((d) => {
            const total = d.all.length
            const incl = d.all.filter((f) => !excluded.has(f.path))
            const state = incl.length === total ? 'all' : incl.length === 0 ? 'none' : 'some'
            const open = forceOpen || expanded.has(d.path)
            const size = incl.reduce((s, f) => s + f.size, 0)
            out.push(
                <div key={'d:' + d.path} className={'tr dir' + (state === 'none' ? ' off' : '')} style={{ paddingLeft: 10 + depth * 18 }}>
                    <button type="button" className="tg" onClick={() => toggleOpen(d.path)} aria-label={(open ? 'Contraer ' : 'Expandir ') + d.name}>
                        {open ? '\u25be' : '\u25b8'}
                    </button>
                    <input
                        type="checkbox"
                        checked={state === 'all'}
                        ref={(el) => { if (el) el.indeterminate = state === 'some' }}
                        onChange={() => toggleDir(d.path, state)}
                        aria-label={'Incluir carpeta ' + d.path}
                    />
                    <span className="nm" title={d.path + '/'}>{d.name}/</span>
                    <span className="meta">{incl.length}/{total} &middot; {fmtBytes(size)}</span>
                </div>
            )
            if (open) treeRows(d, depth + 1, out, forceOpen)
        })
        n.files.slice().sort((a, b) => cmp(a.name, b.name)).forEach((f) => {
            const off = excluded.has(f.path)
            out.push(
                <div key={'f:' + f.path} className={'tr' + (off ? ' off' : '')} style={{ paddingLeft: 10 + depth * 18 + 26 }}>
                    <input type="checkbox" checked={!off} onChange={(e) => toggleFile(f.path, e.target.checked)} aria-label={'Incluir ' + f.path} />
                    <span className="nm" title={f.path}>{f.name}</span>
                    <span className="meta">{fmtBytes(f.size)}</span>
                </div>
            )
        })
    }

    function renderFiles() {
        if (!entries.length) return <div className="empty-msg">No se encontr&oacute; ning&uacute;n archivo de texto en esta carpeta.</div>
        if (!visible.length) {
            return (
                <div className="empty-msg">
                    {extSel.size ? 'Ning\u00fan archivo coincide con los tipos y el filtro actuales.' : 'Marca al menos un tipo de archivo arriba.'}
                </div>
            )
        }
        if (view === 'tree') {
            const out = []
            treeRows(buildTree(visible), 0, out, !!query.trim())
            return out
        }
        const LIMIT = 3000
        const rows = visible.slice(0, LIMIT).map((f) => {
            const off = excluded.has(f.path)
            const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1) : './'
            return (
                <div key={f.path} className={'tr' + (off ? ' off' : '')}>
                    <input type="checkbox" checked={!off} onChange={(e) => toggleFile(f.path, e.target.checked)} aria-label={'Incluir ' + f.path} />
                    <span className="nm">{f.name}</span>
                    <span className="pth" title={f.path}>{dir}</span>
                    <span className="meta">{fmtBytes(f.size)}</span>
                </div>
            )
        })
        if (visible.length > LIMIT) {
            rows.push(<div key="more" className="empty-msg">Mostrando {fmtNum(LIMIT)} de {fmtNum(visible.length)}. Usa el filtro para acotar.</div>)
        }
        return rows
    }

    function renderAuto() {
        if (!auto.length && !ignoredDirs.length) return null
        const groups = {}
        auto.forEach((e) => { (groups[e.reason] = groups[e.reason] || []).push(e.path) })
        const sec = (title, items) => (
            <div key={title}>
                <h3>{title} ({fmtNum(items.length)})</h3>
                <ul>
                    {items.slice(0, 300).map((t) => <li key={t}>{t}</li>)}
                    {items.length > 300 && <li>... y {fmtNum(items.length - 300)} m&aacute;s</li>}
                </ul>
            </div>
        )
        return (
            <details>
                <summary>Ver exclusiones autom&aacute;ticas ({fmtNum(auto.length)} archivos &middot; {fmtNum(ignoredDirs.length)} carpetas)</summary>
                <div className="details-body">
                    {ignoredDirs.length > 0 && sec('Carpetas ignoradas', ignoredDirs)}
                    {Object.keys(groups).map((r) => sec(REASONS[r] || r, groups[r].slice().sort(cmp)))}
                </div>
            </details>
        )
    }

    /* ---------- Resultado ---------- */

    async function generate() {
        if (busy || !included.length) return
        setBusy(true)
        setResult(null)
        try {
            const chosen = included.slice().sort((a, b) => cmp(a.path, b.path))
            const r = await generateText({
                name, chosen, maxFileKB: maxFile, maxTotalMB: maxTotal, detect,
                onProgress: (text, ratio) => setProgress({ text, ratio }),
            })
            setResult({
                output: r.output, sig, included: r.included, skipped: r.skipped,
                manual: extSelected.length - included.length, total: r.total, warnings: r.warnings,
            })
            if (r.output) toast('Listo: ' + r.included + ' archivos incluidos', 'ok')
        } catch (err) {
            console.error(err)
            setResult({
                output: '', sig, included: 0, skipped: 0, manual: 0, total: 0,
                warnings: [], error: 'Ocurri\u00f3 un error al generar el texto: ' + (err && err.message ? err.message : 'error desconocido') + '.',
            })
        } finally {
            setProgress(null)
            setBusy(false)
        }
    }

    async function copyAll() {
        const text = result && result.output
        if (!text) return
        try {
            if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard API no disponible')
            await navigator.clipboard.writeText(text)
            toast('COPIADO AL PORTAPAPELES', 'ok')
        } catch (err) {
            try {
                const ta = outputRef.current
                if (ta) { ta.focus(); ta.select() }
                if (document.execCommand('copy')) { toast('COPIADO AL PORTAPAPELES', 'ok'); return }
            } catch (e) { /* continua */ }
            if (outputRef.current) { outputRef.current.focus(); outputRef.current.select() }
            toast('NO SE PUDO COPIAR: el texto est\u00e1 seleccionado, pulsa Ctrl + C', 'err')
        }
    }

    function download() {
        const text = result && result.output
        if (!text) return
        const safe = (name || 'proyecto').replace(/[^\w.-]+/g, '_') || 'proyecto'
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
        const a = document.createElement('a')
        a.href = url
        a.download = safe + '_codigo.txt'
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
        toast('ARCHIVO DESCARGADO', 'ok')
    }

    const hasEntries = entries.length > 0
    const hasFallback = typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input')
    const hasPicker = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'

    return (
        <div className="exp-root">
            {/* Fondo cyberpunk: cuadricula, resplandores y scanlines */}
            <div className="exp-bg-grid" aria-hidden="true" />
            <div className="exp-glow exp-glow-a" aria-hidden="true" />
            <div className="exp-glow exp-glow-b" aria-hidden="true" />
            <div className="exp-scan" aria-hidden="true" />

            <div className="wrap">
                <header>
                    <div className="logo">&lt;/&gt;</div>
                    <div className="grow">
                        <p className="eyebrow">{'// エクスポート · MÓDULO EN LÍNEA'}</p>
                        <h1 className="glitch" data-text="Exportar proyecto">Exportar proyecto</h1>
                        <p className="sub">Elige tipos de archivo, descarta lo que no quieras y copia todo el c&oacute;digo en un &uacute;nico texto. Todo se procesa en tu navegador.</p>
                    </div>
                    {onVolver && <button type="button" className="btn-ghost btn-sm" onClick={onVolver}>&larr; VOLVER &middot; 戻る</button>}
                </header>

                {/* 1. Proyecto */}
                <section className="panel">
                    <h2>1 &middot; Proyecto <span className="jp">プロジェクト</span></h2>
                    <div className="row">
                        <button type="button" className="btn-primary btn-big" onClick={onSelect} disabled={busy}>SELECCIONAR PROYECTO</button>
                        <button type="button" className="btn-secondary" onClick={() => runScan(source)} disabled={busy || !source}>ESCANEAR DE NUEVO</button>
                        <div className="project grow">
                            <span className="label">Nombre</span>
                            <span className={'name' + (name ? '' : ' empty')}>{name || '\u2014 ninguno \u2014'}</span>
                        </div>
                    </div>
                    {hasPicker && hasFallback && (
                        <div className="hint">
                            &iquest;Problemas con el selector?{' '}
                            <button type="button" className="link-btn" disabled={busy} onClick={() => fallbackRef.current && fallbackRef.current.click()}>
                                Usar selector alternativo
                            </button>
                        </div>
                    )}
                    <input ref={fallbackRef} type="file" webkitdirectory="" multiple hidden onChange={onFallback} />

                    <div className="opts">
                        <div className="field">
                            <label htmlFor="inIgnore">Carpetas a ignorar al escanear (separadas por coma)</label>
                            <input id="inIgnore" type="text" spellCheck={false} value={ignoreText} onChange={(e) => setIgnoreText(e.target.value)} />
                        </div>
                        <div className="field">
                            <label htmlFor="inMaxFile">M&aacute;x. por archivo (KB)</label>
                            <input id="inMaxFile" type="number" min="1" value={maxFile} onChange={(e) => setMaxFile(e.target.value)} />
                        </div>
                        <div className="field">
                            <label htmlFor="inMaxTotal">M&aacute;x. total (MB)</label>
                            <input id="inMaxTotal" type="number" min="1" value={maxTotal} onChange={(e) => setMaxTotal(e.target.value)} />
                        </div>
                    </div>
                    <p className="hint" style={{ marginTop: 12 }}>
                        <label className="check">
                            <input type="checkbox" checked={detect} onChange={(e) => setDetect(e.target.checked)} />
                            Detectar y excluir secretos dentro del contenido (claves, tokens, contrase&ntilde;as)
                        </label>
                    </p>
                    <p className="hint">
                        Nunca se leen <b>.env</b>, claves privadas ni credenciales. Cambia las carpetas ignoradas y pulsa <b>ESCANEAR DE NUEVO</b> para aplicarlas.
                    </p>

                    {progress && (
                        <div className="progress">
                            <div className={'bar' + (progress.ratio == null ? ' indeterminate' : '')}>
                                <i style={progress.ratio == null ? undefined : { width: Math.round(progress.ratio * 100) + '%' }} />
                            </div>
                            <div className="progress-text">{progress.text}</div>
                        </div>
                    )}
                </section>

                {scanned && (
                    <>
                        {/* 2. Tipos */}
                        <section className="panel">
                            <h2>2 &middot; Tipos de archivo <span className="jp">ファイル形式</span></h2>
                            <div className="toolbar">
                                <button type="button" className="btn-ghost btn-sm" disabled={!hasEntries} onClick={() => setExtSel(new Set(extKnown))}>MARCAR TODOS</button>
                                <button type="button" className="btn-ghost btn-sm" disabled={!hasEntries} onClick={() => setExtSel(new Set())}>QUITAR TODOS</button>
                            </div>
                            <div className="chips" role="group" aria-label="Extensiones a incluir">
                                {extKnown.map((k) => {
                                    const n = counts[k] || 0
                                    return (
                                        <label key={k} className={'chip' + (n ? '' : ' zero')}>
                                            <input type="checkbox" checked={extSel.has(k)} onChange={(e) => toggleExt(k, e.target.checked)} />
                                            <span>{extLabel(k)} <small>{fmtNum(n)}</small></span>
                                        </label>
                                    )
                                })}
                            </div>
                            {detected.length > 0 && (
                                <>
                                    <div className="sub-h">Detectadas en el proyecto (pulsa para a&ntilde;adir)</div>
                                    <div className="chips">
                                        {detected.map((k) => (
                                            <button key={k} type="button" className="chip-add" onClick={() => addExtensions(k)}>
                                                + .{k} &middot; {fmtNum(counts[k])}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                            <div className="add-row">
                                <input
                                    type="text" placeholder="A&ntilde;adir extensi&oacute;n: .java, .xml, .csv..." spellCheck={false} aria-label="A&ntilde;adir extensi&oacute;n"
                                    value={newExt} onChange={(e) => setNewExt(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (addExtensions(newExt)) setNewExt('') } }}
                                />
                                <button type="button" className="btn-secondary" onClick={() => { if (addExtensions(newExt)) setNewExt('') }}>A&Ntilde;ADIR</button>
                            </div>
                        </section>

                        {/* 3. Archivos */}
                        <section className="panel">
                            <h2>3 &middot; Archivos encontrados <span className="jp">ファイル</span></h2>
                            <div className="toolbar">
                                <input type="search" placeholder="Filtrar por nombre o ruta..." aria-label="Filtrar archivos" value={query} onChange={(e) => setQuery(e.target.value)} />
                                <div className="seg" role="group" aria-label="Vista">
                                    <button type="button" aria-pressed={view === 'tree'} onClick={() => setView('tree')}>&Aacute;RBOL</button>
                                    <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>LISTA</button>
                                </div>
                            </div>
                            <div className="toolbar">
                                <button type="button" className="btn-ghost btn-sm" disabled={!hasEntries} onClick={() => setVisible(true)}>MARCAR VISIBLES</button>
                                <button type="button" className="btn-ghost btn-sm" disabled={!hasEntries} onClick={() => setVisible(false)}>DESMARCAR VISIBLES</button>
                                {view === 'tree' && (
                                    <>
                                        <button type="button" className="btn-ghost btn-sm" disabled={!hasEntries} onClick={expandAll}>EXPANDIR TODO</button>
                                        <button type="button" className="btn-ghost btn-sm" disabled={!hasEntries} onClick={() => setExpanded(new Set())}>CONTRAER TODO</button>
                                    </>
                                )}
                                <button type="button" className="btn-ghost btn-sm" disabled={!hasEntries} onClick={() => setExcluded(new Set())}>RESTABLECER EXCLUSIONES</button>
                            </div>
                            <p className="counter">
                                Seleccionados: <b>{fmtNum(included.length)}</b> archivos &middot; <b>{fmtBytes(includedSize)}</b>
                                {' '}({fmtNum(extSelected.length)} coinciden con los tipos elegidos &middot; {fmtNum(extSelected.length - included.length)} excluidos a mano)
                            </p>
                            <div className="tree" aria-label="Archivos encontrados">{renderFiles()}</div>
                            <p className="hint">Desmarca un archivo o una carpeta para excluirlo del resultado. Las carpetas marcan o desmarcan todo su contenido.</p>
                            {renderAuto()}
                        </section>

                        {/* 4. Resultado */}
                        <section className="panel">
                            <h2>4 &middot; Resultado <span className="jp">結果</span></h2>
                            <div className="toolbar">
                                <button type="button" className="btn-primary" disabled={busy || !included.length} onClick={generate}>GENERAR TEXTO</button>
                                <button type="button" className="btn-secondary" disabled={busy || !(result && result.output)} onClick={copyAll}>COPIAR TODO</button>
                                <button type="button" className="btn-secondary" disabled={busy || !(result && result.output)} onClick={download}>DESCARGAR TXT</button>
                                <button type="button" className="btn-ghost" disabled={busy || !result} onClick={() => setResult(null)}>LIMPIAR</button>
                            </div>
                            {stale && (
                                <div className="alert info" style={{ marginBottom: 12 }}>
                                    La selecci&oacute;n cambi&oacute; desde la &uacute;ltima generaci&oacute;n. Pulsa GENERAR TEXTO para actualizar el resultado.
                                </div>
                            )}
                            {result && (
                                <>
                                    <div className="stats">
                                        <div className="stat ok"><div className="v">{fmtNum(result.included)}</div><div className="k">Incluidos</div></div>
                                        <div className="stat"><div className="v">{fmtNum(result.skipped)}</div><div className="k">Omitidos al leer</div></div>
                                        <div className="stat"><div className="v">{fmtNum(result.manual)}</div><div className="k">Excluidos a mano</div></div>
                                        <div className="stat"><div className="v">{fmtBytes(result.total)}</div><div className="k">Tama&ntilde;o</div></div>
                                        <div className="stat"><div className="v">{fmtNum(result.output.length)}</div><div className="k">Caracteres</div></div>
                                    </div>
                                    <div className="alerts">
                                        {result.error && <div className="alert error">{result.error}</div>}
                                        {!result.error && !result.included && <div className="alert error">No qued&oacute; ning&uacute;n archivo para exportar con la selecci&oacute;n actual.</div>}
                                        {result.warnings.map((w, i) => <div key={i} className="alert warn">{w}</div>)}
                                        {result.output.length > 400000 && (
                                            <div className="alert warn">
                                                El texto es muy grande ({fmtNum(result.output.length)} caracteres, aprox. {fmtNum(Math.round(result.output.length / 4))} tokens). Puede superar el l&iacute;mite de algunas IA; considera excluir carpetas o tipos.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            <textarea
                                ref={outputRef} readOnly spellCheck={false} aria-label="Texto generado"
                                value={result ? result.output : ''}
                                placeholder="Aqu&iacute; aparecer&aacute; el texto generado cuando pulses GENERAR TEXTO..."
                            />
                        </section>
                    </>
                )}

                <p className="footer">
                    <span className="jp">システム正常</span>
                    Sin servidores &middot; sin dependencias &middot; <b>nada sale de tu equipo</b>
                </p>
            </div>
            <div className={'toast' + (toastState ? ' show ' + toastState.kind : '')} role="status" aria-live="polite">
                {toastState ? toastState.msg : ''}
            </div>
        </div>
    )
}