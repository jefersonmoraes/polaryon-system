@echo off
echo ========================================================
echo   POLARYON DEPLOYMENT RESCUE TOOL
echo   Version: v3.5.18
echo   Feature: Fix Critical Budget Companies and Items State Sync
echo ========================================================
echo.
echo Adicionando todos os arquivos modificados...
git add .
echo.
echo Criando commit do sistema v3.5.18...
git commit -m "v3.5.18: Fix Bug in BudgetModal empty Suppliers and missing Quote items on creation"
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
