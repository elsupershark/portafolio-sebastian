import { useState } from 'react'
import Portafolio from './Portafolio.jsx'
import ExportarProyecto from './modules/exportar/ExportarProyecto.jsx'
import TareasSemana from './modules/tareas/TareasSemana.jsx'

export default function App() {
    const [vista, setVista] = useState('portafolio')

    if (vista === 'exportar') {
        return <ExportarProyecto onVolver={() => setVista('portafolio')} />
    }

    if (vista === 'tareas') {
        return <TareasSemana onVolver={() => setVista('portafolio')} />
    }

    return (
        <>
            <Portafolio />
            <div className="fixed right-4 top-4 z-50 flex flex-col items-end gap-2 sm:flex-row">
                <button
                    type="button"
                    onClick={() => setVista('tareas')}
                    className="btn-neon"
                >
                    <span className="text-neon-purple">{'\u30bf\u30b9\u30af'}</span>
                    {' // '}
                    Tareas semanales
                </button>
                <button
                    type="button"
                    onClick={() => setVista('exportar')}
                    className="btn-neon"
                >
                    <span className="text-neon-purple">エクスポート</span>
                    {' // '}
                    Exportar proyecto
                </button>
            </div>
        </>
    )
}
