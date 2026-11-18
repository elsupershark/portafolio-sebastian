# portafolio-sebastian

Portafolio personal con estética cyberpunk / Tokio de noche.

**Regla de diseño:** toda la app mantiene la misma estética neón (oscuro, verde, morado, azul, toques japoneses).
Guía completa en [`docs/ESTETICA.md`](docs/ESTETICA.md).

## Stack

- React 19
- Vite
- Tailwind CSS 4

## Comandos

    npm install
    npm run dev
    npm run build
    npm run lint

## Estructura

    src/
        main.jsx                    Punto de entrada
        index.css                   Tokens de color, fuentes y efectos globales
        App.jsx                     Selector de vista (portafolio / exportar)
        Portafolio.jsx              Pantalla principal
        modules/
            exportar/               Modulo "Exportar proyecto"
                ExportarProyecto.jsx
                lib.js
                exportar.css
    docs/
        ESTETICA.md                 Guía de estilo obligatoria
    CLAUDE.md                       Instrucciones para asistentes de IA

## Módulo Exportar proyecto

Convierte un proyecto completo en un único texto (para pegarlo en una IA, por ejemplo).
Todo se procesa en el navegador; nunca se leen `.env`, claves privadas ni credenciales.
