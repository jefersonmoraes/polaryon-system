@echo off
echo [POLARYON] Destravando sistema e iniciando Deploy v3.5.9 (CASCADE MODE)...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
npm run full-deploy
echo [POLARYON] Deploy v3.5.9 finalizado! Inteligência em Cascata Ativada.
pause
