/* Logica pura del modulo Tareas semanales (persistencia en localStorage, todo local en el navegador) */

export const STORAGE_KEY = 'portafolio-tareas-v1'
export const XP_POR_TAREA = 10
export const XP_POR_NIVEL = 100

export const DIAS = [
    { corto: 'LUN', largo: 'Lunes', kanji: '\u6708' },
    { corto: 'MAR', largo: 'Martes', kanji: '\u706b' },
    { corto: 'MI\u00c9', largo: 'Mi\u00e9rcoles', kanji: '\u6c34' },
    { corto: 'JUE', largo: 'Jueves', kanji: '\u6728' },
    { corto: 'VIE', largo: 'Viernes', kanji: '\u91d1' },
]

export const JP = {
    tareas: '\u30bf\u30b9\u30af',
    semana: '\u4eca\u9031',
    registro: '\u8a18\u9332',
    racha: '\u9023\u7d9a',
    nivel: '\u30ec\u30d9\u30eb',
    completado: '\u5b8c\u4e86',
    volver: '\u623b\u308b',
    sistema: '\u30b7\u30b9\u30c6\u30e0\u6b63\u5e38',
    actividad: '\u6d3b\u52d5',
}

/* ---------- Fechas (siempre en hora local, formato YYYY-MM-DD) ---------- */

const pad = (n) => String(n).padStart(2, '0')
export const toKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
export const fromKey = (k) => {
    const [y, m, d] = k.split('-').map(Number)
    return new Date(y, m - 1, d)
}
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7))
const esFinDeSemana = (d) => d.getDay() === 0 || d.getDay() === 6

/* Hoy si es dia habil; si es sabado o domingo, el lunes siguiente */
export function hoyHabil() {
    let d = new Date()
    while (esFinDeSemana(d)) d = addDays(d, 1)
    return d
}

export function diaHabilAnterior(d) {
    let r = addDays(d, -1)
    while (esFinDeSemana(r)) r = addDays(r, -1)
    return r
}

export function diaHabilSiguienteKey(key) {
    let r = addDays(fromKey(key), 1)
    while (esFinDeSemana(r)) r = addDays(r, 1)
    return toKey(r)
}

export const weekKeys = (monday) => [0, 1, 2, 3, 4].map((i) => toKey(addDays(monday, i)))

export const fmtCorto = (key) => fromKey(key).toLocaleDateString('es', { day: 'numeric', month: 'short' })
export const fmtLargo = (key) => fromKey(key).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })

/* ---------- Texto -> tareas ---------- */

export function parseLines(text) {
    return text
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^(?:[-*\u2022]|\d+[.)])\s+/, '').trim())
        .filter(Boolean)
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

/* ---------- Persistencia ---------- */

export function loadTasks() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const data = JSON.parse(raw)
        if (!Array.isArray(data)) return []
        return data.filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string' && typeof t.date === 'string')
    } catch (e) {
        return []
    }
}

export function saveTasks(tasks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch (e) {
        /* almacenamiento no disponible: se ignora */
    }
}

/* ---------- Gamificacion ---------- */

export function calcStats(tasks) {
    const hechas = tasks.filter((t) => t.done)
    const xp = hechas.length * XP_POR_TAREA
    const nivel = Math.floor(xp / XP_POR_NIVEL) + 1
    const xpNivel = xp % XP_POR_NIVEL
    const dias = new Set(hechas.map((t) => t.doneKey).filter(Boolean))

    let d = new Date()
    while (esFinDeSemana(d)) d = addDays(d, -1)
    if (!dias.has(toKey(d))) d = diaHabilAnterior(d)
    let racha = 0
    while (dias.has(toKey(d))) {
        racha++
        d = diaHabilAnterior(d)
    }
    return { xp, nivel, xpNivel, racha, totalHechas: hechas.length }
}

export function nivelCelda(n) {
    if (n <= 0) return 0
    if (n <= 2) return 1
    if (n <= 4) return 2
    if (n <= 6) return 3
    return 4
}

/* ---------- Resumen para la daily ---------- */

export function resumenSemana(tasks, keys, titulo) {
    const out = [titulo]
    keys.forEach((k, i) => {
        const del = tasks.filter((t) => t.date === k)
        if (!del.length) return
        out.push('', DIAS[i].largo + ' ' + fromKey(k).getDate())
        del.forEach((t) => out.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text))
    })
    return out.join('\n')
}
