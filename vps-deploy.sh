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
# Garante que dist_electron não é um symlink para evitar que o build escreva direto em dist
[ -L dist_electron ] && unlink dist_electron || rm -rf dist_electron
rm -rf dist_electron_build_tmp

npm install --no-audit --no-fund
npm run build

# Agora dist_electron é um diretório real com o novo build. Movemos para o tmp.
mv dist_electron dist_electron_build_tmp

if [ -d "dist_electron_build_tmp" ]; then
    # Remove dist anterior de forma segura (seja link ou dir)
    [ -L dist ] && rm -f dist || true
    rm -rf dist_old
    [ -d dist ] && mv dist dist_old || true

    # Ativar novo build
    mv dist_electron_build_tmp dist
    rm -rf dist_old

    # Symlink dist_electron -> dist para compatibilidade
    rm -f dist_electron
    ln -s dist dist_electron

    # Garante o diretório de download real
    mkdir -p /var/www/polaryon/storage/download

    # Cria o symlink dist/download -> storage/download
    rm -rf dist/download
    ln -sf /var/www/polaryon/storage/download dist/download

    echo "✔ Frontend (Web & Desktop) atualizado com sucesso."
else
    echo "❌ FALHA CRÍTICA: dist_electron_build_tmp não encontrada."
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
