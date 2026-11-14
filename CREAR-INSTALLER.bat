@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Solaris Client - Crear Installer

echo =============================================
echo          SOLARIS CLIENT - INSTALLER
echo =============================================
echo.
echo Carpeta del proyecto:
echo %CD%
echo.

if not exist "package.json" (
  echo ERROR: No se encontro package.json en esta carpeta.
  echo Extrae TODO el ZIP antes de ejecutar este archivo.
  goto failed
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js LTS y vuelve a abrir este archivo.
  goto failed
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no esta disponible.
  goto failed
)

echo [1/4] Instalando dependencias...
call npm install
if errorlevel 1 goto failed

echo.
echo [2/4] Verificando Solaris Client...
call npm run check
if errorlevel 1 goto failed

echo.
echo [3/4] Ejecutando pruebas...
call npm test
if errorlevel 1 goto failed

echo.
echo [4/4] Creando Installer de Windows x64...
call npm run dist:win
if errorlevel 1 goto failed

echo.
if exist "dist\Solaris-Client-Installer.exe" (
  echo =============================================
  echo   LISTO - INSTALLER CREADO CORRECTAMENTE
  echo =============================================
  echo.
  echo %CD%\dist\Solaris-Client-Installer.exe
  start "" explorer.exe "%CD%\dist"
  goto success
)

echo La compilacion termino, pero no encontre Solaris-Client-Installer.exe.
echo Abriendo la carpeta dist para que puedas revisar el resultado...
if exist "dist" start "" explorer.exe "%CD%\dist"
goto failed

:success
echo.
echo Puedes cerrar esta ventana.
pause
exit /b 0

:failed
echo.
echo =============================================
echo HUBO UN ERROR. No cierres esta ventana si quieres
echo enviarme una captura del mensaje que aparece arriba.
echo =============================================
pause
exit /b 1
