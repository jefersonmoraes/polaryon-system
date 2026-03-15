#!/bin/bash
set -e
echo "=== Atualizando código do repositório ==="
cd /var/www/polaryon
git reset --hard HEAD
git pull origin main

echo "=== Instalando dependências do frontend (root) ==="
npm install

echo "=== Compilando frontend (Vite) ==="
npm run build

echo "=== Instalando dependências do backend ==="
cd /var/www/polaryon/backend
npm install

echo "=== Gerando Prisma Client ==="
npx prisma generate

echo "=== Sincronizando schema do banco de dados ==="
npx prisma db push --accept-data-loss

echo "=== Reiniciando backend ==="
pm2 restart polaryon-backend

echo "=== Deploy concluído com sucesso! ==="
