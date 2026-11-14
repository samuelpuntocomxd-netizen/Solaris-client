# Solaris Client

Launcher de Minecraft: Java Edition, gratuito y de código abierto. Solaris está construido con Electron y JavaScript, con una interfaz ligera, autenticación Microsoft y descarga de archivos oficiales del juego.

> Solaris no distribuye Minecraft ni permite jugar sin una licencia válida. Para iniciar el juego necesitas una cuenta Microsoft con acceso a Minecraft: Java Edition.

## Características

- Inicio de sesión oficial mediante Microsoft/Xbox.
- Descarga de archivos y lanzamiento de versiones release de Minecraft Java.
- Instalación y búsqueda de mods en Modrinth y CurseForge.
- Ajuste de memoria RAM y ruta de Java.
- Modo ligero que reduce animaciones y efectos visuales del launcher.
- Interfaz en español con tema morado.

## Requisitos

- Windows 10/11, macOS o una distribución Linux compatible con Electron.
- Node.js LTS y npm para ejecutar desde el código fuente.
- Conexión a Internet durante el primer inicio de una versión.
- Java se gestiona automáticamente en Windows x64: Solaris usa una instalación compatible existente o descarga su propio runtime cuando hace falta.
- Cuenta Microsoft con licencia de Minecraft: Java Edition.

Minecraft puede necesitar más memoria y una GPU compatible según la versión, los mods y el mundo. El modo ligero reduce el trabajo visual de Solaris, pero no puede garantizar FPS altos en todos los equipos.

## Ejecutar desde el código

1. Instala Node.js LTS.
2. Clona este repositorio.
3. Abre una terminal dentro de la carpeta del proyecto.
4. Instala las dependencias: `npm install`.
5. Inicia Solaris: `npm start`.
6. Inicia sesión con Microsoft y selecciona una versión.

Para revisar la sintaxis de los archivos principales: `npm run check`.

## Código abierto y contribuciones

Solaris Client se distribuye bajo la licencia MIT. Puedes estudiar, modificar y redistribuir el código respetando los términos de `LICENSE`.

Antes de publicar un fork, cambia el enlace de `repository` en `package.json` por la URL de tu repositorio. Consulta `CONTRIBUTING.md` para proponer cambios y `SECURITY.md` para reportar vulnerabilidades.

## Dependencias principales

- [Electron](https://www.electronjs.org/) — aplicación de escritorio.
- [minecraft-launcher-core](https://www.npmjs.com/package/minecraft-launcher-core) — descarga y lanzamiento de Minecraft.
- [MSMC](https://www.npmjs.com/package/msmc) — autenticación Microsoft/Xbox/Minecraft.
- [Modrinth](https://modrinth.com/) y [CurseForge](https://www.curseforge.com/) — catálogos de mods.

## Privacidad y seguridad

- Las credenciales de Microsoft se introducen en la ventana de autenticación de MSMC; Solaris no solicita ni almacena tu contraseña.
- La clave API de CurseForge, si decides usarla, se guarda en el almacenamiento local del navegador de la aplicación. No la compartas ni subas tu perfil de usuario al repositorio.
- No publiques tokens, claves API, archivos personales ni datos de tu carpeta de Minecraft en reportes públicos.

## Aviso de marcas

Minecraft es una marca de Mojang Studios/Microsoft. Solaris Client no está afiliado, respaldado ni patrocinado por Mojang Studios, Microsoft, Modrinth o CurseForge. Sus nombres y marcas pertenecen a sus respectivos titulares.


## Rendimiento en equipos modestos

Solaris calcula un límite conservador de RAM usando la memoria total y la memoria libre del sistema. El perfil gráfico ligero es opcional: al activarlo, ajusta `options.txt` al iniciar Minecraft (distancia de renderizado 6, distancia de simulación 4, gráficos rápidos, nubes y sombras desactivadas, entre otros). Los ajustes no relacionados se conservan.

La versión mínima de Java se comprueba antes de lanzar el juego: Java 8 para versiones antiguas, 16 para Minecraft 1.17, 17 para 1.18–1.20.4, 21 para 1.20.5–1.x recientes y 25 para la serie 26.x. Revisa los requisitos de cada versión futura antes de publicar una actualización.

## Comprobaciones locales

```bash
npm run check
npm test
```

Las pruebas unitarias no sustituyen una prueba de integración con dependencias instaladas, cuenta Microsoft válida y descarga real de Minecraft.

## Solaris Client BETA 0.4.0

Esta beta integra el launcher Vanilla existente con perfiles independientes, mods por instancia, Solaris Boost, carpetas de mundos/capturas/resource packs/shaders, estadísticas locales, servidores favoritos, perfil Microsoft y branding Solaris. El instalador NSIS está configurado para Windows 10/11 x64.

### Estado real de compatibilidad
- Vanilla: implementado mediante `minecraft-launcher-core`; Solaris prepara automáticamente un runtime Java compatible cuando es necesario. Requiere prueba final en Windows con una cuenta de Minecraft Java.
- Microsoft: implementado mediante `msmc`; requiere prueba interactiva final.
- Fabric / Forge: se pueden crear y administrar como tipos de instancia y filtrar mods, pero la instalación/arranque del loader sigue marcada como experimental/no verificada y Solaris no la presenta como funcional todavía.
- Installer.exe: configuración incluida; la compilación requiere instalar las dependencias de Node/Electron en Windows o CI.

Solaris no incluye imágenes generadas por IA como recursos del producto. El logo incluido es SVG/vectorial del proyecto; los avatares se cargan a partir del nombre del perfil y los resultados de mods usan imágenes devueltas por sus fuentes.
