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
                className="btn-neon fixed right-4 top-4 z-50"
            >
                <span className="text-neon-purple">エクスポート</span>
                {' // '}
                Exportar proyecto
            </button>
        </>
    )
}