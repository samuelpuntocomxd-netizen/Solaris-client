# Solaris Client — Guía del dueño

Esta carpeta es tu **copia maestra editable**. No necesitas un ZIP nuevo para cambiar Solaris.

## Editar
1. Haz doble clic en `EDITAR SOLARIS.bat` (recomendado: Visual Studio Code).
2. Cambia HTML/CSS/JavaScript.
3. Prueba con `PROBAR SOLARIS.bat` o `npm start`.
4. Antes de publicar usa `npm test` y `npm run check`.

## Activar actualizaciones automáticas
1. Crea un repositorio público en GitHub para Solaris Client.
2. En `updater-config.json`, cambia `TU_USUARIO_GITHUB` por tu usuario, `repo` por el nombre exacto del repositorio y `enabled` a `true`.
3. En `package.json` > `build.publish`, pon los mismos valores de `owner` y `repo`.
4. Incrementa `version` en `package.json` cada vez que publiques, por ejemplo `0.5.2`, `0.5.3`, etc. Nunca publiques dos builds distintos con la misma versión.
5. Para publicar desde tu PC define temporalmente `GH_TOKEN` con un token de GitHub que tenga permiso para crear Releases y ejecuta `npm run publish:win`. No metas el token en el código ni en Git.

Los usuarios con una versión instalada comprobarán GitHub al abrir Solaris. Si existe una versión superior, se descargará y Solaris mostrará **Reiniciar y actualizar**. También se puede comprobar manualmente desde Ajustes.

## Importante
El updater funciona en la app instalada/empacada. En `npm start` se mantiene desactivado para evitar modificar tu copia de desarrollo. Para la primera instalación, el usuario todavía necesita el Installer; después podrá recibir nuevas versiones mediante el updater.
