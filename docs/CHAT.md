# Chat secreto: cómo funciona

Guía para cualquier persona, no solo programadores.

## Para qué sirve

Pasar texto de un computador a otro: comandos, código, archivos de texto completos. Se escribe o se pega en un computador y en el otro se copia con un solo clic.

Es un chat privado de un solo usuario (yo, Sebastián Ruiz). No hay cuentas ni registro: quien conozca la dirección y el PIN puede entrar, así que el PIN es la llave.

## La idea en una analogía

Imagina un buzón con cerradura en la entrada de mi casa.

    - El servidor es el buzón. Vive en un computador y guarda los mensajes.
    - El PIN es la llave del buzón.
    - Cada computador es una persona que se acerca, abre con la llave, deja una nota o lee las que hay.
    - Las notas se rompen solas después de un rato (por defecto 60 minutos).

## Cómo se usa

    1. En el computador que hace de servidor (generalmente el mío):
        npm run chat
       Muestra en pantalla la dirección y el PIN.
    2. En ese mismo computador abre: http://localhost:8080/#chat
    3. En el otro computador, con la dirección que mostró la consola:
        http://IP-DEL-SERVIDOR:8080/#chat
    4. Escribe el PIN una sola vez. El navegador lo recuerda.
    5. Pega o escribe el texto y pulsa Enter. En el otro computador haz clic sobre el mensaje: queda copiado y listo para pegar.

Atajos útiles:

    Clic en un mensaje        Copia su contenido
    COPIAR ÚLTIMO            Copia el último mensaje del otro computador
    Botón +                  Adjunta archivos de texto (hasta 1 MB cada uno)
    Arrastrar un archivo      Lo envía como mensaje
    Enter / Shift + Enter     Enviar / nueva línea

## Cómo entro sin que se vea

El chat no aparece en la barra del portafolio. Se abre de tres formas:

    - Atajo Alt + 4 (otra vez Alt + 4 para volver).
    - Escribiendo #chat al final de la dirección.
    - Haciendo tres clics rápidos sobre la marca SEBASTIÁN // SYS.

Al salir del chat, los mensajes desaparecen de la pantalla del navegador. SALIR además olvida el PIN guardado en ese computador.

## Las piezas

    servidor/chat_servidor.py       El buzón: recibe, guarda y entrega mensajes
    servidor/pin.txt                El PIN (se crea solo y no se sube a Git)
    src/modules/chat/ChatSecreto.jsx   La pantalla del chat
    src/modules/chat/lib.js         Utilidades: comunicación, copiar, identificador
    src/modules/chat/chat.css       El aspecto (estilo cyberpunk)
    src/App.jsx                     Esconde y abre el chat (Alt + 4)
    dist/                           El portafolio ya compilado, que el servidor entrega

## Qué pasa por dentro

    1. La pantalla pregunta al servidor cada 1,5 segundos: "^¿Hay algo nuevo?"
    2. Cada pregunta lleva el PIN. Si no coincide, el servidor responde que no.
    3. Si no hay cambios, el servidor contesta "sin cambios" y la pantalla no se redibuja.
    4. Al enviar, la pantalla manda el texto al servidor, que lo guarda en memoria.
    5. El otro computador lo recibe en su siguiente consulta.

El servidor también entrega la página del portafolio, así el computador de la empresa solo necesita un navegador (y el servidor se ejecuta en el mío).

## Seguridad: qué protege y qué no

Qué protege:

    - PIN en cada petición; la comparación es de tiempo constante.
    - Tras 5 PIN incorrectos, esa dirección queda bloqueada 60 segundos.
    - Los mensajes viven solo en memoria: al detener el servidor se pierden.
    - Caducan solos (CHAT_TTL_MIN, por defecto 60 minutos) y se guardan como máximo 200.
    - Solo puedes borrar tus propios mensajes (cada navegador tiene un identificador aleatorio).
    - El servidor no responde nada útil a rutas desconocidas y evita salirse de su carpeta.
    - El chat no aparece en la navegación ni queda abierto en segundo plano.

Qué NO protege:

    - El tráfico va por HTTP sin cifrar: cualquiera dentro de la misma red con las herramientas adecuadas podría verlo. Usarlo solo en redes de confianza.
    - No pegues contraseñas, claves ni datos personales sensibles.
    - Un PIN de 8 dígitos evita accesos casuales, pero no reemplaza un cifrado real.

## Configuración opcional

Variables de entorno (PowerShell):

    $env:CHAT_PIN = "12345678"       PIN fijo (si no, se usa servidor/pin.txt)
    $env:CHAT_PORT = "9090"          Puerto (por defecto 8080)
    $env:CHAT_TTL_MIN = "15"         Minutos hasta que un mensaje se borra (0 = nunca)
    $env:CHAT_HOST = "127.0.0.1"     Solo este equipo (por defecto 0.0.0.0 = toda la red)

## Uso responsable

Este chat solo intercambia texto. No transfiere archivos binarios ni está pensado para eludir controles de seguridad. Si la política de la empresa no permite usarlo, usa un método aprobado o consulta a soporte.
## Versión en Vercel

Existe una segunda versión del chat que corre en Vercel (funciones serverless + Upstash Redis), con clave larga, sesión firmada y límite de intentos. Está explicada, con los pasos de despliegue y la sección de seguridad, en `docs/CHAT_VERCEL.md`.

La versión local (servidor Python y PIN) sigue intacta. La pantalla del chat detecta sola con cuál habla: si el servidor no tiene /api/chat/login, usa el PIN como antes.
