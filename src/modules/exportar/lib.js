/* Logica pura del modulo Exportar proyecto (sin dependencias, todo local en el navegador) */

export const DEFAULT_IGNORE =
    '.git, __pycache__, venv, .venv, env, node_modules, dist, dist-ssr, build, .mypy_cache, .pytest_cache, .ruff_cache, .tox, .nox, .eggs, site-packages, .idea, .vscode, .ipynb_checkpoints, htmlcov, .cache, coverage, .next, .vite'

export const DEFAULT_EXTS = ['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'txt', 'toml', 'yaml', 'yml', 'cfg', 'ini', 'sql', 'sh', 'log', '@names']
export const DEFAULT_SELECTED = ['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'txt', 'toml', 'yaml', 'yml', 'cfg', 'ini', 'sql', 'sh', '@names']

const LANG = {
    py: 'python', pyi: 'python', pyw: 'python', html: 'html', htm: 'html', json: 'json', jsonc: 'jsonc',
    log: 'text', txt: 'text', md: 'md', rst: 'rst', toml: 'toml', yaml: 'yaml', yml: 'yaml',
    cfg: 'ini', ini: 'ini', css: 'css', scss: 'scss', js: 'js', mjs: 'js', cjs: 'js', ts: 'ts', tsx: 'tsx', jsx: 'jsx',
    sql: 'sql', sh: 'bash', bash: 'bash', java: 'java', xml: 'xml', csv: 'csv', c: 'c', cpp: 'cpp', h: 'c',
    go: 'go', rs: 'rust', rb: 'ruby', php: 'php', kt: 'kotlin', cs: 'csharp', ipynb: 'json', gd: 'gdscript'
}

const NAMES_LANG = {
    'dockerfile': 'dockerfile', 'makefile': 'makefile', 'procfile': '', 'pipfile': 'toml',
    'manifest.in': '', '.gitignore': 'gitignore', '.gitattributes': '', '.dockerignore': 'gitignore',
    '.editorconfig': 'ini', '.flake8': 'ini', '.pylintrc': 'ini', '.python-version': '',
    '.coveragerc': 'ini', '.isort.cfg': 'ini', '.prettierrc': 'json', '.eslintrc': 'json'
}

const LOCK_FILES = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock', 'npm-shrinkwrap.json',
    'poetry.lock', 'pipfile.lock', 'uv.lock', 'pdm.lock', 'composer.lock', 'cargo.lock'
])

export const BINARY_EXT = new Set(['pyc', 'pyo', 'pyd', 'so', 'dll', 'exe', 'bin', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg',
    'pdf', 'zip', 'gz', 'tar', 'tgz', 'whl', 'egg', 'db', 'sqlite', 'sqlite3', 'pkl', 'pickle', 'npy', 'npz', 'h5', 'parquet',
    'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'mp4', 'wav', 'avi', 'mov', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'class', 'jar', 'o', 'a'])

export const REASONS = {
    ext: 'Sin extensi\u00f3n reconocida',
    lock: 'Archivo de bloqueo (lockfile)',
    temp: 'Archivo temporal o generado',
    secret: 'Posible secreto o credencial (no le\u00eddo por seguridad)',
    empty: 'Archivo vac\u00edo',
    read: 'Error de lectura o archivo inaccesible'
}

const SECRET_PATTERNS = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
    /\bsk-(?:live-|proj-|ant-)?[A-Za-z0-9_-]{32,}/,
    /\bsk_live_[0-9A-Za-z]{16,}/,
    /\bAIza[0-9A-Za-z_-]{35}\b/
]
const ASSIGN_SECRET = /(?:password|passwd|secret|secret_key|api_key|apikey|access_token|auth_token|private_key)\s*[:=]\s*['"]([A-Za-z0-9+/_=.-]{16,})['"]/gi
const PLACEHOLDER = /your|example|changeme|change_me|xxx|placeholder|replace|dummy|test|insecure|sample|todo|none|null/i

export const cmp = (a, b) => {
    const la = a.toLowerCase()
    const lb = b.toLowerCase()
    if (la < lb) return -1
    if (la > lb) return 1
    return a < b ? -1 : a > b ? 1 : 0
}
export const fmtNum = (n) => n.toLocaleString('es')
export const fmtBytes = (b) =>
    b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB'
export const extLabel = (k) => (k === '@names' ? 'Dockerfile, .gitignore...' : '.' + k)

let lastYield = 0
export async function yieldIfNeeded() {
    if (performance.now() - lastYield > 12) {
        await new Promise((r) => setTimeout(r, 0))
        lastYield = performance.now()
    }
}

/* ---------- Clasificacion ---------- */

const ENV_EXAMPLE = /^\.env(\.[\w-]+)*\.(example|sample|template|dist)$/i
const isEnvLike = (l) => l === '.env' || l.startsWith('.env.') || l.endsWith('.env')
const extOf = (l) => {
    const i = l.lastIndexOf('.')
    return i > 0 ? l.slice(i + 1) : ''
}

export function classify(path) {
    const name = path.split('/').pop()
    const lower = name.toLowerCase()
    const ext = extOf(lower)

    if (isEnvLike(lower)) {
        return ENV_EXAMPLE.test(name) ? { key: '@names', lang: 'bash', isEnvExample: true } : { skip: 'secret' }
    }
    if (/\.(pem|key|p12|pfx|cer|crt|jks|keystore|ppk|kdbx)$/.test(lower)) return { skip: 'secret' }
    if (/^id_(rsa|dsa|ecdsa|ed25519)/.test(lower) || ['.npmrc', '.netrc', '.htpasswd', '.pypirc'].includes(lower)) {
        return { skip: 'secret' }
    }
    if (['json', 'jsonc', 'yaml', 'yml', 'toml', 'cfg', 'ini'].includes(ext) &&
        /(secret|credential|service-?account|private[-_]?key)/.test(lower)) {
        return { skip: 'secret' }
    }
    if (LOCK_FILES.has(lower)) return { skip: 'lock' }
    if (['.ds_store', 'thumbs.db', 'desktop.ini'].includes(lower) ||
        /(\.(tmp|temp|swp|swo|bak|orig|map)|~)$/.test(lower) || /\.min\.(js|css)$/.test(lower)) {
        return { skip: 'temp' }
    }
    if (Object.prototype.hasOwnProperty.call(NAMES_LANG, lower)) return { key: '@names', lang: NAMES_LANG[lower] }
    if (ext) return { key: ext, lang: LANG[ext] || ext }
    return { skip: 'ext' }
}

export function containsSecret(text, isEnvExample) {
    if (SECRET_PATTERNS.some((re) => re.test(text))) return true
    ASSIGN_SECRET.lastIndex = 0
    let m
    while ((m = ASSIGN_SECRET.exec(text))) {
        if (!PLACEHOLDER.test(m[1])) return true
    }
    if (isEnvExample) {
        return text.split(/\r?\n/).some((line) => {
            const mm = line.match(/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$/)
            if (!mm) return false
            const v = mm[1].trim().replace(/^['"]|['"]$/g, '')
            return v.length >= 16 &&
                !/your|example|changeme|xxx|placeholder|replace|<|\.\.\.|\$\{|localhost|^https?:\/\//i.test(v) &&
                /^[A-Za-z0-9+/_=.-]+$/.test(v)
        })
    }
    return false
}

/* ---------- Escaneo ---------- */

function parseIgnore(text) {
    const set = new Set(text.split(/[,\n;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))
    return (name) => {
        const l = name.toLowerCase()
        return set.has(l) || l.endsWith('.egg-info')
    }
}

async function walkHandle(dirHandle, prefix, acc, isIgnored, onProgress) {
    const children = []
    try {
        for await (const [name, handle] of dirHandle.entries()) children.push([name, handle])
    } catch (e) {
        acc.errors.push({ path: prefix || '/', reason: 'read' })
        return
    }
    children.sort((a, b) => cmp(a[0], b[0]))
    for (const [name, handle] of children) {
        await yieldIfNeeded()
        const path = prefix + name
        if (handle.kind === 'directory') {
            if (isIgnored(name)) {
                acc.ignoredDirs.add(path + '/')
                continue
            }
            await walkHandle(handle, path + '/', acc, isIgnored, onProgress)
        } else if (!acc.seen.has(path)) {
            acc.seen.add(path)
            acc.raw.push({ path, getFile: () => handle.getFile() })
            if (acc.raw.length % 50 === 0) onProgress('Explorando... ' + fmtNum(acc.raw.length) + ' archivos', null)
        }
    }
}

async function collectFromFileList(files, isIgnored) {
    const acc = { raw: [], ignoredDirs: new Set(), errors: [], seen: new Set() }
    for (const f of files) {
        await yieldIfNeeded()
        const parts = (f.webkitRelativePath || f.name).split('/').slice(1)
        if (!parts.length) continue
        const dirs = parts.slice(0, -1)
        const idx = dirs.findIndex((d) => isIgnored(d))
        if (idx !== -1) {
            acc.ignoredDirs.add(dirs.slice(0, idx + 1).join('/') + '/')
            continue
        }
        const path = parts.join('/')
        if (acc.seen.has(path)) continue
        acc.seen.add(path)
        acc.raw.push({ path, getFile: async () => f })
    }
    return acc
}

export async function scanSource(source, ignoreText, onProgress) {
    lastYield = performance.now()
    const isIgnored = parseIgnore(ignoreText)
    let acc
    if (source.type === 'handle') {
        acc = { raw: [], ignoredDirs: new Set(), errors: [], seen: new Set() }
        onProgress('Explorando carpetas...', null)
        await walkHandle(source.handle, '', acc, isIgnored, onProgress)
    } else {
        acc = await collectFromFileList(source.files, isIgnored)
    }

    const entries = []
    const auto = []
    acc.errors.forEach((e) => auto.push({ path: e.path, reason: e.reason }))
    acc.raw.sort((a, b) => cmp(a.path, b.path))
    for (let i = 0; i < acc.raw.length; i++) {
        await yieldIfNeeded()
        const r = acc.raw[i]
        if (i % 25 === 0) onProgress('Analizando ' + (i + 1) + '/' + acc.raw.length + ' | ' + r.path, (i + 1) / acc.raw.length)
        const c = classify(r.path)
        if (c.skip) {
            auto.push({ path: r.path, reason: c.skip })
            continue
        }
        let file
        try {
            file = await r.getFile()
        } catch (e) {
            auto.push({ path: r.path, reason: 'read' })
            continue
        }
        if (file.size === 0) {
            auto.push({ path: r.path, reason: 'empty' })
            continue
        }
        entries.push({
            path: r.path, name: r.path.split('/').pop(), size: file.size,
            key: c.key, lang: c.lang, isEnvExample: !!c.isEnvExample, file
        })
    }
    return { entries, auto, ignoredDirs: Array.from(acc.ignoredDirs).sort(cmp) }
}

/* ---------- Generacion ---------- */

const fenceFor = (text) => {
    const runs = text.match(/`+/g)
    return '`'.repeat(Math.max(3, (runs ? Math.max(...runs.map((r) => r.length)) : 0) + 1))
}

function buildOutput(name, files) {
    const blocks = files.map((f) => {
        const fence = fenceFor(f.text)
        const body = f.text.endsWith('\n') ? f.text : f.text + '\n'
        return 'archivo: ' + f.path + '\n' + fence + f.lang + '\n' + body + fence + '\n'
    })
    return 'proyecto: ' + name + '\n\n' + blocks.join('\n============\n\n')
}

export async function generateText({ name, chosen, maxFileKB, maxTotalMB, detect, onProgress }) {
    lastYield = performance.now()
    const maxFile = Math.max(1, Number(maxFileKB) || 300) * 1024
    const maxTotal = Math.max(1, Number(maxTotalMB) || 5) * 1048576
    const included = []
    const skipped = []
    const warnings = []
    let total = 0
    let limitHit = false

    for (let i = 0; i < chosen.length; i++) {
        await yieldIfNeeded()
        const c = chosen[i]
        onProgress('Leyendo ' + (i + 1) + '/' + chosen.length + ' | ' + c.path, (i + 1) / chosen.length)
        if (limitHit) { skipped.push(c.path); continue }
        if (c.size > maxFile) {
            warnings.push('"' + c.path + '" (' + fmtBytes(c.size) + ') supera el l\u00edmite por archivo de ' + fmtBytes(maxFile) + ' y no se incluy\u00f3.')
            skipped.push(c.path)
            continue
        }
        if (total + c.size > maxTotal) {
            limitHit = true
            warnings.push('Se alcanz\u00f3 el l\u00edmite total de ' + fmtBytes(maxTotal) + '. Los archivos restantes (por orden alfab\u00e9tico) no se incluyeron.')
            skipped.push(c.path)
            continue
        }
        let text
        try {
            text = await c.file.text()
        } catch (e) {
            warnings.push('No se pudo leer "' + c.path + '".')
            skipped.push(c.path)
            continue
        }
        if (text.indexOf('\u0000') !== -1) { warnings.push('"' + c.path + '" es binario y se omiti\u00f3.'); skipped.push(c.path); continue }
        if (text.trim() === '') { skipped.push(c.path); continue }
        if (detect && containsSecret(text, c.isEnvExample)) {
            warnings.push('"' + c.path + '" parece contener un secreto real y se excluy\u00f3 por seguridad.')
            skipped.push(c.path)
            continue
        }
        total += c.size
        included.push({ path: c.path, lang: c.lang, text })
    }

    const output = included.length ? buildOutput(name || 'proyecto', included) : ''
    return { output, included: included.length, skipped: skipped.length, warnings, total }
}