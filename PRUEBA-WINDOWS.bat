@echo off
chcp 65001 >nul
echo Solaris Client - Verificacion de Windows
ver
if not exist "%~dp0dist\Solaris-Client-BETA-Installer-0.2.2-beta.1.exe" (
 echo No se encuentra el instalador. Ejecuta CREAR-INSTALLER.bat primero.
 pause
 exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f=Get-Item -LiteralPath '%~dp0dist\Solaris-Client-BETA-Installer-0.2.2-beta.1.exe'; Write-Host ('Archivo: '+$f.Name); Write-Host ('Tamano: '+[math]::Round($f.Length/1MB,2)+' MB'); Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256 | Format-List"
echo.
echo COMPROBACION MANUAL:
echo 1. Ejecuta el EXE e instala el programa.
echo 2. Confirma que abre y que aparece en Aplicaciones instaladas.
echo 3. Comprueba el acceso directo del escritorio.
echo 4. Prueba desinstalarlo y volver a instalarlo.
echo 5. Prueba Minecraft con una cuenta oficial y Java compatible.
echo 6. Repite en Windows 10 y Windows 11 (64 bits).
echo.
echo ATENCION: este script no prueba el arranque de Minecraft automaticamente.
pause
