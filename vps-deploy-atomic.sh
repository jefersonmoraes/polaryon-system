#!/bin/bash
set -e
echo "=== [1/5] Atualizando código (Git) ==="
cd /var/www/polaryon
git fetch origin main
git reset --hard origin/main

echo "=== [2/5] Build Frontend Atômico ==="
rm -rf dist_new
npm install --no-audit --no-fund
npm run build -- --outDir dist_new
# Swap frontend files
[ -d dist ] && mv dist dist_old
mv dist_new dist
rm -rf dist_old

echo "=== [3/5] Build Backend Atômico ==="
cd /var/www/polaryon/backend
npm install --no-audit --no-fund
npx prisma generate
rm -rf dist_new
npm run build -- --outDir dist_new
# Swap backend files
[ -d dist_prod ] && mv dist_prod dist_old_backend
mv dist_new dist_prod
rm -rf dist_old_backend

echo "=== [4/5] Reiniciando Servidor (PM2) ==="
# Restart pointing to the STABLE dist_prod directory
pm2 restart polaryon-backend || pm2 start dist_prod/server.js --name polaryon-backend
pm2 save

echo "=== [5/5] DEPLOY CONCLUÍDO (ESTABILIDADE TOTAL) ==="
