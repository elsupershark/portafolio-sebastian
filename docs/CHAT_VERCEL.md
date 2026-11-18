# Chat secreto en Vercel: cómo funciona

Guía para cualquier profesional, no solo programadores.

## Para qué sirve

Pasar texto de un computador a otro: comandos, código, archivos de texto completos. Se pega en un computador y en el otro se copia con un solo clic.

A diferencia de la versión local (ver docs/CHAT.md), esta no necesita un computador encendido en mi red: vive en internet y se abre desde cualquier navegador. Es de un solo usuario (Sebastián Ruiz) y no tiene cuentas ni registro.

## La idea en una analogía

Imagina una consigna de equipaje en una estación, con un recepcionista.

    - La consigna (Upstash Redis) guarda los papeles. Los papeles se autodestruyen solos (por defecto a los 30 minutos).
    - El recepcionista (las funciones de Vercel) te pide una frase secreta. Si es correcta, te pone una pulsera (la sesión) que dura 12 horas. Con la pulsera ya no hace falta repetir la frase.
    - Si alguien se equivoca varias veces con la frase, el recepcionista lo hace esperar cada vez más tiempo.
    - Si llegas sin pulsera, el recepcionista responde que ese mostrador no existe. No confirma que hay una consigna detrás.

## Las piezas

    api/_lib.js                     Lo compartido: sesión firmada, Redis, límite de intentos
    api/chat/login.js               Valida la clave y entrega la sesión
    api/chat/logout.js              Cierra la sesión (borra la cookie)
    api/chat/messages.js            Lista mensajes (o responde "sin cambios")
    api/chat/send.js                Guarda un mensaje nuevo
    api/chat/delete.js              Borra un mensaje propio
    api/chat/clear.js               Borra todos los mensajes
    src/modules/chat/               La pantalla del chat (se carga solo al abrirla)
    vercel.json                     Cabeceras de seguridad
    public/robots.txt               Pide a los buscadores no indexar nada
    .env.example                    Nombres de las variables (con valores falsos)

## Cómo se usa

    1. Abre https://TU-PROYECTO.vercel.app/#chat
    2. Escribe la clave una sola vez. El navegador recuerda la sesión 12 horas.
    3. Pega o escribe el texto y pulsa Enter. En el otro computador haz clic en el mensaje: queda copiado.

Atajos:

    Clic en un mensaje        Copia su contenido
    COPIAR ÚLTIMO            Copia el último mensaje del otro computador
    Botón +                  Adjunta archivos de texto (hasta 1 MB cada uno)
    Arrastrar un archivo      Lo envía como mensaje
    Enter / Shift + Enter     Enviar / nueva línea
    SALIR                     Cierra la sesión en este navegador

Cómo entrar sin que se vea: el chat no aparece en la barra. Se abre con Alt + 4, escribiendo #chat al final de la dirección o con tres clics rápidos sobre la marca SEBASTIÁN // SYS.

## Despliegue paso a paso

    1. Sube el proyecto a un repositorio privado de GitHub.
    2. En vercel.com: Add New > Project > importa el repositorio. Vercel detecta Vite solo. Pulsa Deploy.
    3. En el proyecto, pestaña Storage (o Marketplace): agrega Upstash Redis, crea la base de datos y conéctala al proyecto. Vercel inyecta solo las variables de acceso a Redis.
    4. En Settings > Environment Variables define:

        CHAT_SECRET         Frase larga de acceso (mínimo 12 caracteres; mejor 5 palabras o más)
        CHAT_SESSION_KEY    Cadena aleatoria de 32 caracteres o más para firmar la sesión
        CHAT_TTL_MIN        Minutos que dura un mensaje (opcional, por defecto 30)

       Para generar CHAT_SESSION_KEY en PowerShell:

        $b = New-Object byte[] 48
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
        [Convert]::ToBase64String($b)

       Marca las dos primeras como Sensitive. Nunca las pongas en el código ni en el repositorio.
    5. Deployments > último despliegue > Redeploy (las variables solo se aplican a despliegues nuevos).
    6. Abre https://TU-PROYECTO.vercel.app/#chat y entra con tu frase.

Para rotar las claves: cambia CHAT_SECRET o CHAT_SESSION_KEY y haz Redeploy. Todas las sesiones abiertas dejan de valer.

## Probar en local con vercel dev

    1. npm install
    2. npm install -g vercel
    3. vercel link
    4. vercel env pull .env.local
    5. npm run chat:vercel
    6. Abre http://localhost:3000/#chat

"vercel dev" ejecuta las funciones de api/ y la página juntas, así que no se usa el servidor Python. En http para localhost la cookie no lleva Secure; en Vercel (https) siempre la lleva. El archivo .env.local está en .gitignore.

## Qué hace el sistema por dentro

    1. Al escribir la clave, el servidor la compara en tiempo constante. Si coincide, entrega una cookie HttpOnly, Secure y SameSite=Strict, firmada con HMAC.
    2. Desde entonces la clave no viaja más. Cada petición lleva la cookie, que el servidor verifica sin consultar nada.
    3. La pantalla pregunta cada 2 segundos si hay algo nuevo, solo mientras la pestaña está visible. Si no hay cambios, el servidor responde "sin cambios" y no se redibuja. Con la pestaña oculta no se hace ninguna consulta (ahorra invocaciones).
    4. Los mensajes viven en Redis, con caducidad automática y un máximo de 200. Cada mensaje admite hasta 1 MB y solo texto.
    5. Cada navegador tiene un identificador aleatorio: solo puede borrar sus propios mensajes.

## Seguridad: qué protege y qué no

Qué protege:

    - La clave larga vive en una variable de entorno de Vercel, nunca en el código.
    - Comparación de tiempo constante y sesión firmada que caduca a las 12 horas.
    - Límite de intentos por IP guardado en Redis: desde el 5.ó fallo, bloqueo de 60 s que se duplica en cada nuevo fallo (hasta 24 h). Respuestas de error genéricas.
    - Sin sesión válida, todas las rutas responden 404, como si no existieran (salvo el login).
    - Cabeceras de seguridad, noindex y robots.txt: los buscadores no deberían indexarlo.
    - El código del chat no va en el paquete principal: se descarga solo al abrirlo.
    - Al salir, el chat se desmonta y no quedan mensajes en la memoria del navegador.

Qué NO protege:

    - El código del frontend es público: cualquiera puede descargarlo y ver cómo funciona. No hay secretos ahí. La única protección real es la clave larga, la sesión y el límite de intentos. Si la clave es corta, la protección es débil.
    - Los textos pasan por servidores de terceros (Vercel y Upstash) y allí existen sin cifrar de extremo a extremo, aunque el viaje por internet es cifrado (https).
    - El límite por IP frena ataques simples, no ataques repartidos entre muchas direcciones. Por eso la clave debe ser larga.
    - No pegues contraseñas, claves de acceso ni datos personales sensibles.
    - Quien tenga acceso a tu cuenta de Vercel o Upstash puede ver los mensajes mientras existan.

Capa extra: si tu plan de Vercel la incluye, activa Deployment Protection (Vercel Authentication o Password Protection) en Settings > Deployment Protection. Así hay que pasar una puerta de Vercel antes de llegar siquiera a la página.

## Uso responsable

    - Solo texto: no se transfieren archivos binarios.
    - Respeta las políticas de la empresa. Si no permiten este tipo de herramienta, usa un método aprobado o consulta a soporte.
    - No lo uses para eludir controles de seguridad, ni para sacar información confidencial o datos de terceros.

## Si algo falla

    ERROR al entrar         Faltan variables de entorno o Redis no está conectado. Revisa y haz Redeploy.
    ESPERA UN MOMENTO       Demasiados intentos fallidos: espera el bloqueo temporal.
    Vuelve a pedir la clave La sesión caducó (12 horas) o cambiaste las claves.
    SIN CONEXIÓN           Revisa internet; en cuanto vuelva, el chat se reanuda solo.
