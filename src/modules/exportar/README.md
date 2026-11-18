# Modulo Exportar proyecto

Herramienta integrada al portafolio para convertir un proyecto en un unico texto.

Estructura:

    src/modules/exportar/
        ExportarProyecto.jsx   Interfaz (React)
        lib.js                 Escaneo, clasificacion, deteccion de secretos y generacion
        exportar.css           Estilos aislados bajo .exp-root

Uso:

    1. Pulsa "Exportar proyecto" (arriba a la derecha) en el portafolio.
    2. Selecciona la carpeta del proyecto.
    3. Elige tipos de archivo y excluye lo que no quieras.
    4. Genera el texto, copialo o descargalo como .txt.

Todo se procesa en el navegador. Nunca se leen .env, claves privadas ni credenciales.