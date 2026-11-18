import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import Portafolio from './Portafolio.jsx'
import ExportarProyecto from './modules/exportar/ExportarProyecto.jsx'
import TareasSemana from './modules/tareas/TareasSemana.jsx'

/* El chat se carga solo cuando se abre: su codigo no va en el bundle principal */
const ChatSecreto = lazy(() => import('./modules/chat/ChatSecreto.jsx'))

const VISTAS = [
    { id: 'portafolio', etiqueta: 'Portafolio', jp: '\u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa', Comp: Portafolio },
    { id: 'tareas', etiqueta: 'Tareas', jp: '\u30bf\u30b9\u30af', Comp: TareasSemana },
    { id: 'exportar', etiqueta: 'Exportar', jp: '\u30a8\u30af\u30b9\u30dd\u30fc\u30c8', Comp: ExportarProyecto },
]
const KEY = 'portafolio-vista-v1'
const ATAJO_CHAT = '4'

function vistaInicial() {
    try {
        const v = localStorage.getItem(KEY)
        if (VISTAS.some((x) => x.id === v)) return v
    } catch (e) {
        /* almacenamiento no disponible */
    }
    return 'portafolio'
}

/* El chat no aparece en la barra: se abre con Alt + 4, con #chat en la direccion o con 3 clics en la marca */
export default function App() {
    const [vista, setVista] = useState(vistaInicial)
    const [chat, setChat] = useState(() => window.location.hash === '#chat')
    /* Una vista, una vez abierta, queda montada: se oculta pero conserva todo su estado en memoria */
    const [montadas, setMontadas] = useState(() => new Set([vistaInicial()]))
    const clicks = useRef([])

    const ir = useCallback((id) => {
        setChat(false)
        setVista(id)
        setMontadas((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
        try {
            localStorage.setItem(KEY, id)
        } catch (e) {
            /* se ignora */
        }
    }, [])

    const alternarChat = useCallback(() => setChat((c) => !c), [])

    /* La direccion refleja si el chat esta abierto (sin recargar ni ensuciar el historial) */
    useEffect(() => {
        const h = chat ? '#chat' : ''
        if (window.location.hash !== h) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search + h)
        }
    }, [chat])

    useEffect(() => {
        const onKey = (e) => {
            if (!e.altKey || e.ctrlKey || e.metaKey) return
            if (e.key === ATAJO_CHAT) {
                e.preventDefault()
                alternarChat()
                return
            }
            const i = Number(e.key) - 1
            if (i >= 0 && i < VISTAS.length) {
                e.preventDefault()
                ir(VISTAS[i].id)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [ir, alternarChat])

    function clicMarca() {
        const ahora = Date.now()
        clicks.current = [...clicks.current.filter((t) => ahora - t < 900), ahora]
        if (clicks.current.length >= 3) {
            clicks.current = []
            alternarChat()
        }
    }

    return (
        <div className="app-shell">
            <nav className="topnav" aria-label="M&oacute;dulos">
                <span className="topnav-brand" onClick={clicMarca} style={{ userSelect: 'none' }}>{'SEBASTI\u00c1N // SYS'}</span>
                <div className="topnav-tabs" role="tablist">
                    {VISTAS.map((v, i) => (
                        <button
                            key={v.id}
                            type="button"
                            role="tab"
                            aria-selected={!chat && v.id === vista}
                            className={'topnav-tab' + (!chat && v.id === vista ? ' on' : '')}
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
                    <div key={v.id} className="app-view" role="tabpanel" style={!chat && v.id === vista ? undefined : { display: 'none' }}>
                        <v.Comp />
                    </div>
                ) : null
            )}
            {/* El chat se desmonta al salir: no deja mensajes en memoria del navegador */}
            {chat && (
                <div className="app-view" role="tabpanel">
                    <Suspense fallback={null}>
                        <ChatSecreto onVolver={() => setChat(false)} />
                    </Suspense>
                </div>
            )}
        </div>
    )
}
