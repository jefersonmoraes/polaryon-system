#!/bin/bash
set -e

# Carregar variáveis de ambiente do sistema e NVM
[ -f ~/.bashrc ] && source ~/.bashrc
[ -f ~/.nvm/nvm.sh ] && source ~/.nvm/nvm.sh
[ -f ~/.profile ] && source ~/.profile

echo "=== [1/9] Atualizando código do repositório ==="
cd /var/www/polaryon
git reset --hard HEAD
git pull origin main

echo "=== [2/9] Instalando dependências do frontend ==="
npm install --no-audit --no-fund

echo "=== [3/9] Compilando frontend (Vite) ==="
npm run build || { echo "ERRO: Falha no build do frontend"; exit 1; }

echo "=== [4/9] Entrando na pasta do backend ==="
cd /var/www/polaryon/backend

echo "=== [5/9] Instalando dependências do backend ==="
npm install --no-audit --no-fund

echo "=== [6/9] Gerando Prisma Client ==="
npx prisma generate || { echo "ERRO: Falha no prisma generate"; exit 1; }

echo "=== [7/9] Compilando backend (TypeScript) ==="
npm run build || { echo "ERRO: Falha no build do backend (tsc)"; exit 1; }

echo "=== [8/9] Sincronizando schema do banco de dados ==="
npx prisma db push --accept-data-loss || { echo "ERRO: Falha no prisma db push"; exit 1; }

echo "=== [9/9] Reiniciando processos no PM2 ==="
pm2 restart polaryon-backend || pm2 start dist/server.js --name polaryon-backend

echo "=== DEPLOY CONCLUÍDO COM SUCESSO! ==="
