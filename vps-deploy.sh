#!/bin/bash
set -e

echo "=== [1/5] Atualizando Código (Git) ==="
cd /var/www/polaryon
git fetch origin main
git reset --hard origin/main

echo "=== [2/5] Build Frontend Atômico ==="
rm -rf dist_new
npm install --no-audit --no-fund
npm run build -- --outDir dist_new

if [ -d "dist_new" ]; then
    rm -rf dist_old
    [ -d "dist" ] && mv -T dist dist_old || true
    mv -T dist_new dist
    
    # GARANTE O LINK DE DOWNLOAD (Sempre em cada deploy)
    mkdir -p /var/www/polaryon/storage/download
    rm -rf /var/www/polaryon/dist/download
    ln -s /var/www/polaryon/storage/download /var/www/polaryon/dist/download
    
    rm -rf dist_old
    echo "✔ Frontend (Web & Desktop) atualizado com sucesso."
else
    echo "❌ FALHA CRÍTICA: dist_new não encontrada."
    exit 1
fi

echo "=== [3/5] Build Backend Atômico ==="
cd backend
rm -rf dist_new
npm install --no-audit --no-fund
npx prisma generate
npm run build -- --outDir dist_new || (npm run build && mv dist dist_new)

if [ -d "dist_new" ]; then
    rm -rf dist_old_backend
    [ -d "dist_prod" ] && mv -T dist_prod dist_old_backend || true
    mv -T dist_new dist_prod
    rm -rf dist_old_backend
    echo "✔ Backend atualizado com sucesso."
else
    echo "❌ FALHA CRÍTICA: Build do backend falhou."
    exit 1
fi

echo "=== [4/5] Reiniciando Servidor (PM2) ==="
pm2 restart polaryon-backend || pm2 start dist_prod/server.js --name polaryon-backend
pm2 save

echo "=== [5/5] DEPLOY CONCLUÍDO (ESTABILIDADE TOTAL v1.2.28) ==="
