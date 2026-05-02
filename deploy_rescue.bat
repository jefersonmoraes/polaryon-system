@echo off
echo =======================================================
echo POLARYON RESCUE DEPLOY - BLL COMPRAS INTEGRATION
echo =======================================================
echo.
echo Adicionando arquivos modificados...
git add .
echo.
echo Realizando o commit...
git commit -m "feat: Integrar BLL Compras ao hub PNCP e Oportunidades"
echo.
echo Enviando para o repositorio (Push)...
git push
echo.
echo =======================================================
echo DEPLOY CONCLUIDO!
echo =======================================================
pause
