# Estética y usabilidad: menos pantalla, más memoria

Complemento obligatorio de `docs/ESTETICA.md`. La estética cyberpunk no es solo color: también es una forma de diseñar para que todo se entienda de un vistazo y se recuerde sin esfuerzo.

## Principios

    1. Nada de scroll en la página entera
    2. Nada de cards innecesarias
    3. Nada de texto innecesario
    4. Diseñar para recordar, no para releer
    5. Letras gruesas, nunca finas

## 1. Nada de scroll en la página entera

Cada módulo debe caber en una sola pantalla (altura de la ventana menos la barra superior).

    - El contenedor raíz ocupa todo el alto disponible y usa overflow hidden o flex con min-height 0.
    - Solo una zona interna puede desplazarse: la lista de mensajes, el árbol de archivos, una columna del tablero.
    - Lo que no cabe se mueve a un modal o a un panel lateral, no se apila hacia abajo.
    - Las acciones principales (enviar, generar, copiar) siempre quedan visibles, nunca al final de una página larga.

Por qué: cada scroll obliga a buscar, perder el hilo y volver a ubicarse. Si todo está en pantalla, la mano ya sabe dónde ir.

## 2. Nada de cards innecesarias

Una card (panel con borde y esquinas) se usa solo cuando agrupa algo que realmente es una unidad: la lista de mensajes, el formulario de acceso, una columna del tablero.

    - No poner una card dentro de otra card.
    - No envolver un solo botón o una sola línea en una card.
    - Si dos cosas van juntas, comparten panel. Si no hace falta separarlas, no se separan.

## 3. Nada de texto innecesario

    - Sin párrafos explicativos dentro de la interfaz: las explicaciones viven en los .md.
    - Etiquetas cortas y en mayúsculas: ENVIAR, COPIAR ÚLTIMO, VOLVER.
    - Los estados se muestran con color y un punto (verde = en línea), no con frases.
    - Un estado vacío lleva una palabra o dos, no instrucciones largas.
    - El japonés es decoración y nunca reemplaza la acción en español.

## 4. Pensado para recordar, no para releer

    - Atajos de teclado consistentes: Alt + 1, 2, 3 cambian de módulo.
    - Posiciones fijas: el mismo botón siempre en el mismo lugar.
    - Acciones de un solo gesto: un clic sobre un mensaje lo copia.
    - Lo importante usa brillo neón; lo secundario, el color apagado. El ojo aprende rápido a dónde mirar.
    - Cada pantalla tiene pocas acciones. Si hay muchas, se agrupan o se esconden detrás de una sola.

## 5. Letras gruesas

    - Orbitron solo en pesos 600, 700 u 800.
    - El cuerpo usa font-weight 500 y el trazo fino global (text-stroke) definido en src/index.css.
    - Tamaño mínimo 0.75rem en etiquetas y 0.95rem en texto de lectura.
    - Evitar gris sobre fondo oscuro con poco contraste: usar --color-dim o el blanco verdoso.

## Lista de revisión (se suma a la de ESTETICA.md)

    [ ] La página no tiene scroll vertical a 1080p ni en móvil
    [ ] Solo una zona interna se desplaza
    [ ] No hay cards dentro de cards ni cards de un solo elemento
    [ ] No hay párrafos de instrucciones en la interfaz
    [ ] Las acciones principales están siempre visibles
    [ ] Ninguna letra fina
    [ ] Hay atajo o gesto rápido para la acción más repetida
## Pantallas de acceso

    - Un solo campo y un solo botón (ENTRAR). Errores de una o dos palabras.
    - La sesión se recuerda en el navegador: la clave se escribe una vez, no a cada rato.
    - La consulta periódica se pausa con la pestaña oculta y se reanuda al volver.
    - Letras gruesas también en botones pequeños: tamaño mínimo 0.75rem.
