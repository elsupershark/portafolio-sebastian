import { useState } from 'react'
import Portafolio from './Portafolio.jsx'
import ExportarProyecto from './modules/exportar/ExportarProyecto.jsx'

export default function App() {
    const [vista, setVista] = useState('portafolio')

    if (vista === 'exportar') {
        return <ExportarProyecto onVolver={() => setVista('portafolio')} />
    }

    return (
        <>
            <Portafolio />
            <button
                type="button"
                onClick={() => setVista('exportar')}
                className="fixed right-4 top-4 z-50 cursor-pointer border border-neon-green bg-void/70 px-3 py-2 font-mono text-xs uppercase tracking-widest text-neon-green backdrop-blur transition hover:bg-neon-green/10"
            >
                Exportar proyecto
            </button>
        </>
    )
}