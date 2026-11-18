# Instrucciones para asistentes de IA

Antes de crear o modificar cualquier interfaz (componentes, módulos, estilos), lee
`docs/ESTETICA.md` y síguelo al pie de la letra.

Resumen: estética cyberpunk / Tokio de noche. Fondo void (#05020d), neón verde (#00ff9c),
morado (#b026ff) y azul (#00d4ff). Orbitron + Share Tech Mono. Cuadrícula Tron, scanlines CRT,
glitch en títulos y toques en japonés. Nada de modo claro ni colores fuera del sistema.

Los tokens de color y las clases globales (.grid-bg, .scanlines, .glitch, .cursor, .btn-neon)
están en `src/index.css`.

Stack: React 19 + Vite + Tailwind CSS 4. Indentación de 4 espacios en los módulos nuevos.
Los textos de la interfaz van en español.

Antes de crear interfaces lee también `docs/ESTETICA_USABILIDAD.md` (sin scroll de página, sin cards ni texto innecesarios, letras gruesas).
El módulo del chat secreto está documentado en `docs/CHAT.md`. No aparece en la navegación: se abre con Alt + 4 o con #chat.
El chat también tiene versión para Vercel (`api/`, `vercel.json`, Upstash Redis), documentada en `docs/CHAT_VERCEL.md`. Las claves (CHAT_SECRET, CHAT_SESSION_KEY) solo van en variables de entorno de Vercel, nunca en el código ni en el repositorio. El chat se carga con React.lazy y la versión local (servidor Python) se mantiene intacta.
