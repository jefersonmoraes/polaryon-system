#!/bin/bash

# Script de Estabilização Polaryon (VPS)
# Este script garante que o Banco de Dados e o Cliente Prisma estejam sincronizados com o novo código (Rebranding Kanban)

echo "🚀 Iniciando estabilização do sistema..."

# 1. Navegar para a pasta do backend
cd backend

# 2. Instalar dependências (caso novas tenham sido adicionadas)
echo "📦 Instalando dependências do backend..."
npm install

# 3. Gerar o Prisma Client com os novos nomes de campos (ex: kanbanCardId)
echo "🧬 Gerando Prisma Client..."
npx prisma generate

# 4. Sincronizar o Schema com o Banco de Dados (Adicionar colunas como 'color' em KanbanList se faltarem)
echo "🗄️ Sincronizando Banco de Dados..."
npx prisma db push --accept-data-loss

# 5. Voltar para a raiz e rebuildar o frontend (opcional se não quiser rodar dev)
cd ..
echo "🏗️ Rebuildando o Frontend..."
npm install
npm run build

echo "✅ Sistema estabilizado! Reinicie o serviço do backend (pm2 restart all ou similar)."
