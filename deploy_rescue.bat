@echo off
echo [POLARYON] Destravando sistema e iniciando Deploy v3.5.6 (ELITE)...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
npm run full-deploy
echo [POLARYON] Deploy v3.5.6 finalizado com sucesso!
pause
