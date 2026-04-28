@echo off
echo [POLARYON] Iniciando Processo de Atualizacao v3.5.13 (O JUSTICEIRO)...

echo [POLARYON] 1/4 - Salvando no Git...
git add .
git commit -m "v3.5.13 - O Justiceiro: Erros de Referencia Exterminados"
git push

echo [POLARYON] 2/4 - Reconstruindo Interface (Build)...
call npm run build

echo [POLARYON] 3/4 - Destravando PowerShell...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"

echo [POLARYON] 4/4 - Enviando para VPS...
call npm run full-deploy

echo [POLARYON] ATUALIZACAO v3.5.13 CONCLUIDA!
echo Reinicie o robo para ver as mudancas.
pause
