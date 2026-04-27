@echo off
echo [POLARYON] Destravando sistema e iniciando Deploy v3.5.7 (PRECISAO TOTAL)...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
npm run full-deploy
echo [POLARYON] Deploy v3.5.7 finalizado! UASG 160057 liberada.
pause
