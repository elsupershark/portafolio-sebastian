# Guía de estética: Cyberpunk / Tokio de noche

Esta guía es obligatoria para TODA pantalla, módulo o componente del portafolio.
Si algo nuevo no parece sacado de una calle de Shibuya a las 3 a.m. bajo la lluvia, está mal.

## Concepto

Night City + Tokio Drift + yakuza. Oscuro, neón, rótulos japoneses, monitores CRT,
cuadrículas tipo Tron. Siempre de noche. Nunca hay modo claro.

## Paleta

Los colores viven como tokens en `src/index.css` (bloque `@theme static`).
No inventar colores nuevos ni escribir hex sueltos si existe el token.

    Token                   Hex        Uso
    --color-void            #05020d    Fondo base de toda la app
    --color-void-2          #0b0716    Fondos secundarios y pistas de scrollbar
    --color-panel           #120a24    Paneles, tarjetas, toasts
    --color-neon-green      #00ff9c    Color principal: texto de marca, acciones primarias, éxito
    --color-neon-blue       #00d4ff    Títulos de sección, enlaces, datos secundarios
    --color-neon-purple     #b026ff    Bordes, acentos, katakana, hover
    --color-neon-pink       #ff2a6d    Errores, glitch, peligro
    --color-dim             #8f86b3    Texto secundario o apagado

Reglas:

    - Fondo siempre void. Texto principal verde neón o blanco verdoso (#d7fff0).
    - Máximo 2 colores neón protagonistas por pantalla (verde + morado es la base).
    - Rosa solo para errores y para el glitch. Amarillo (#ffe14d) solo para advertencias.
    - Todo elemento importante lleva brillo: text-shadow o box-shadow con el mismo color.

## Tipografía

    Orbitron        Títulos, botones, números grandes (en mayúsculas, con letter-spacing)
    Share Tech Mono Cuerpo de texto, etiquetas, datos, código
    Noto Sans JP    Respaldo para katakana / kanji (ya cargadas en index.html)

Los títulos grandes llevan la clase `glitch` con `data-text` igual al contenido.

## Efectos obligatorios

    Cuadrícula Tron     Clase .grid-bg (global) o capa .exp-bg-grid (módulo exportar)
    Resplandores        Dos círculos difusos: morado arriba-izquierda, azul abajo-derecha
    Scanlines CRT       Clase .scanlines o capa .exp-scan, siempre por encima de todo
    Glitch              Clase .glitch en el título principal de cada vista
    Cursor parpadeante  Clase .cursor en frases tipo terminal ("> ようこそ_")
    Esquinas neón       Paneles con corchetes verdes en esquinas opuestas

Respetar siempre `prefers-reduced-motion` (ya contemplado en el CSS global).

## Elementos japoneses

Cada vista o panel debe tener al menos un toque japonés, en morado o azul:

    ポートフォリオ  portafolio      プロジェクト  proyecto
    エクスポート    exportar        ファイル      archivos
    結果            resultado       戻る          volver
    ようこそ        bienvenido      システム正常  sistema en línea

Se usan como decoración: nunca reemplazan al texto en español que explica la acción.

## Componentes

    Botón primario     Fondo verde neón, texto void, brillo verde
    Botón secundario   Borde morado, texto azul, fondo morado translúcido
    Botón fantasma     Borde gris violáceo; en hover pasa a verde
    Paneles            Fondo panel semitransparente, borde morado, esquinas verdes
    Inputs             Fondo casi negro, texto verde, foco con borde y brillo verdes
    Errores            Borde y texto rosa. Advertencias: amarillo
    Bordes             Rectos (radius 2px como máximo). Nada de esquinas muy redondeadas

## Cómo añadir un módulo nuevo

    1. Crear src/modules/<nombre>/ con su propio .css aislado bajo una clase raíz (.xxx-root).
    2. Usar los tokens con var(--color-neon-green), var(--color-neon-purple), etc.
    3. Incluir fondo (cuadrícula + resplandores) y scanlines.
    4. Título con .glitch y subtítulo/eyebrow con texto japonés.
    5. Botón de entrada con la clase .btn-neon (definida en src/index.css).
    6. Revisar la lista de abajo antes de dar el módulo por terminado.

## Lista de revisión

    [ ] Fondo void, sin blancos ni grises claros
    [ ] Solo colores del sistema (sin hex nuevos)
    [ ] Orbitron en títulos y botones, Share Tech Mono en el resto
    [ ] Brillo neón en elementos importantes
    [ ] Cuadrícula, resplandores y scanlines presentes
    [ ] Al menos un elemento en japonés
    [ ] Textos de interfaz en español
    [ ] Funciona en móvil (menos de 640 px)
