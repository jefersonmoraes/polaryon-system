@echo off
title Polaryon - Forçar Atualizacao
echo ============================================
echo  POLARYON - FORCAR ATUALIZACAO v3.8.263
echo ============================================
echo.
echo Este script vai:
echo  1. Fechar o Polaryon a força
echo  2. Instalar a versao mais recente
echo  3. Reiniciar o Polaryon
echo.
echo Pressione qualquer tecla para continuar...
pause >nul

echo.
echo [1/4] Fechando Polaryon...
taskkill /F /IM Polaryon.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo [2/4] Procurando instalador baixado...
set INSTALLER=
for /f "delims=" %%i in ('dir /s /b "%LOCALAPPDATA%\electron-updater\pending\*.exe" 2^>nul') do set INSTALLER=%%i
if "%INSTALLER%"=="" for /f "delims=" %%i in ('dir /s /b "%APPDATA%\electron-updater\pending\*.exe" 2^>nul') do set INSTALLER=%%i
if "%INSTALLER%"=="" for /f "delims=" %%i in ('dir /s /b "%APPDATA%\Polaryon\electron-updater\pending\*.exe" 2^>nul') do set INSTALLER=%%i

if not "%INSTALLER%"=="" (
    echo   Instalador encontrado: %INSTALLER%
    echo [3/4] Instalando...
    start /wait "" "%INSTALLER%" /S
) else (
    echo   Instalador nao encontrado na cache.
    echo   Baixando do servidor...
    echo [3/4] Instalando...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://polaryon.com.br/download/Polaryon-v3.8.263-Setup.exe' -OutFile '%TEMP%\Polaryon-v3.8.263-Setup.exe'}"
    start /wait "" "%TEMP%\Polaryon-v3.8.263-Setup.exe" /S
)

echo [4/4] Iniciando Polaryon...
timeout /t 2 /nobreak >nul
start "" "%LOCALAPPDATA%\Programs\polaryon\Polaryon.exe"

echo.
echo ============================================
echo  INSTALACAO CONCLUIDA!
echo  Se o Polaryon nao abrir, inicie manualmente.
echo ============================================
pause
