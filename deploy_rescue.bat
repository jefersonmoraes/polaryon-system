@echo off
echo ========================================================
echo   POLARYON DEPLOYMENT RESCUE TOOL
echo   Version: v3.5.19
echo   Feature: Editable Resale Value with Reverse Margin Calc
echo ========================================================
echo.
echo Adicionando todos os arquivos modificados...
git add .
echo.
echo Criando commit do sistema v3.5.19...
git commit -m "v3.5.19: Implemented Reverse Margin Calculation on Unit Resale Value input"
echo.
echo Enviando para a nuvem da VPS...
git push

echo [POLARYON] 2/4 - Reconstruindo Interface (Build)...

echo [POLARYON] 3/4 - Destravando PowerShell...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"

echo [POLARYON] 4/4 - Enviando para VPS...
call npm run full-deploy

echo [POLARYON] ATUALIZACAO v3.5.17 CONCLUIDA!
echo Reinicie o robo para ver as mudancas.
pause
