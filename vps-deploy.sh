#!/bin/bash
set -e

cd /var/www/polaryon
echo "=== [0/5] Limpando versões antigas de instaladores ==="
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
echo "Versão atual: $CURRENT_VERSION"
# Mantém apenas o instalador da versão atual e o anterior como fallback
if [ -d "/var/www/polaryon/storage/download" ]; then
    ls -1 /var/www/polaryon/storage/download/Polaryon-*.exe 2>/dev/null | sort -V | head -n -2 | while read f; do
        rm -f "$f" "${f}.blockmap"
        echo "🗑️ Removido: $(basename "$f")"
    done
fi

echo "=== [1/5] Atualizando Código (Git) ==="
git remote prune origin 2>/dev/null || true
rm -f .git/refs/remotes/origin/main
git fetch origin main
git reset --hard origin/main

echo "=== [2/5] Build Frontend Atômico ==="
# Remove symlink/diretório dist_electron para Vite gerar a pasta limpa
rm -rf dist_electron dist_electron_build_tmp

npm install --no-audit --no-fund
npm run build

# Vite compila para dist_electron (conforme vite.config.ts)
if [ -d "dist_electron" ]; then
    # Move a compilação recém-criada para pasta temporária
    mv dist_electron dist_electron_build_tmp

    # Remove qualquer dist ou symlink antigo de dist
    rm -rf dist_old
    rm -rf dist

    # Ativa o novo build como pasta dist real
    mv dist_electron_build_tmp dist

    # Symlink dist_electron -> /var/www/polaryon/dist (caminho absoluto)
    rm -rf dist_electron
    ln -sfn /var/www/polaryon/dist dist_electron

    # Garante o diretório de download real e cria o symlink dist/download
    mkdir -p /var/www/polaryon/storage/download
    rm -rf dist/download
    ln -sf /var/www/polaryon/storage/download dist/download

    echo "✔ Frontend (Web & Desktop) atualizado com sucesso."
else
    echo "❌ FALHA CRÍTICA: Build do frontend falhou (dist_electron não gerado)."
    exit 1
fi

echo "=== [3/5] Build Backend Atômico ==="
cd backend
npm install --no-audit --no-fund
npx prisma generate
# tsc ignora --outDir via CLI quando tsconfig.json define outDir; compilamos para dist e renomeamos
npm run build && mv dist dist_new

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

echo "=== [5/5] DEPLOY CONCLUÍDO ==="
