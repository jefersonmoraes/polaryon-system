@echo off
echo [POLARYON] Salvando versao v3.5.10 no Git...
git add .
git commit -m "v3.5.10 - Sonda de Diagnostico e Blindagem 14.133"
git push

echo [POLARYON] Destravando sistema e iniciando Deploy v3.5.10 (DIAGNOSTICO)...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
npm run full-deploy
echo [POLARYON] Deploy v3.5.10 finalizado com sucesso!
pause
