@echo off
cd /d "%~dp0"
where code >nul 2>nul
if %errorlevel%==0 (code .) else (start "" explorer.exe "%cd%" & echo Instala Visual Studio Code para editar el proyecto mas facilmente. & pause)
