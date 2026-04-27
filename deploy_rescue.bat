@echo off
echo [POLARYON] Destravando sistema e iniciando Deploy v3.5.4...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
npm run full-deploy
echo [POLARYON] Deploy finalizado!
pause
