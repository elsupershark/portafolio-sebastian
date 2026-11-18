import { useCallback, useEffect, useState } from 'react'
import Portafolio from './Portafolio.jsx'
import ExportarProyecto from './modules/exportar/ExportarProyecto.jsx'
import TareasSemana from './modules/tareas/TareasSemana.jsx'

const VISTAS = [
    { id: 'portafolio', etiqueta: 'Portafolio', jp: '\u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa', Comp: Portafolio },
    { id: 'tareas', etiqueta: 'Tareas', jp: '\u30bf\u30b9\u30af', Comp: TareasSemana },
    { id: 'exportar', etiqueta: 'Exportar', jp: '\u30a8\u30af\u30b9\u30dd\u30fc\u30c8', Comp: ExportarProyecto },
]
const KEY = 'portafolio-vista-v1'

function vistaInicial() {
    try {
        const v = localStorage.getItem(KEY)
        if (VISTAS.some((x) => x.id === v)) return v
    } catch (e) {
        /* almacenamiento no disponible */
    }
    return 'portafolio'
}

export default function App() {
    const [vista, setVista] = useState(vistaInicial)
    /* Una vista, una vez abierta, queda montada: se oculta pero conserva todo su estado en memoria */
    const [montadas, setMontadas] = useState(() => new Set([vistaInicial()]))

    const ir = useCallback((id) => {
        setVista(id)
        setMontadas((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
        try {
            localStorage.setItem(KEY, id)
        } catch (e) {
            /* se ignora */
        }
    }, [])

    useEffect(() => {
        const onKey = (e) => {
            if (!e.altKey || e.ctrlKey || e.metaKey) return
            const i = Number(e.key) - 1
            if (i >= 0 && i < VISTAS.length) {
                e.preventDefault()
                ir(VISTAS[i].id)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [ir])

    return (
        <div className="app-shell">
            <nav className="topnav" aria-label="M&oacute;dulos">
                <span className="topnav-brand">{'SEBASTI\u00c1N // SYS'}</span>
                <div className="topnav-tabs" role="tablist">
                    {VISTAS.map((v, i) => (
                        <button
                            key={v.id}
                            type="button"
                            role="tab"
                            aria-selected={v.id === vista}
                            className={'topnav-tab' + (v.id === vista ? ' on' : '')}
                            title={'Alt + ' + (i + 1)}
                            onClick={() => ir(v.id)}
                        >
                            <span className="jp">{v.jp}</span>
                            <span>{v.etiqueta}</span>
                            <kbd>{i + 1}</kbd>
                        </button>
                    ))}
                </div>
            </nav>
            {VISTAS.map((v) =>
                montadas.has(v.id) ? (
                    <div key={v.id} className="app-view" role="tabpanel" style={v.id === vista ? undefined : { display: 'none' }}>
                        <v.Comp />
                    </div>
                ) : null
            )}
        </div>
    )
}