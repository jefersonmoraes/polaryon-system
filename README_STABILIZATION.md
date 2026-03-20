# Estabilização do Sistema Polaryon (Pós-Rebranding)

O sistema passou por reformulações de nomes (**Kunbun -> Kanban**) e adições de funcionalidades no Banco de Dados. Se você estiver enfrentando erros de "Não foi salvo no servidor" ou dados que não carregam na VPS, siga estes passos para sincronizar tudo.

## Como Estabilizar a VPS

Acesse o terminal da sua VPS e execute os seguintes comandos na pasta raiz do projeto:

```bash
# 1. Entre na pasta do backend
cd backend

# 2. Instale dependências e regenere o Prisma (Necessário para os novos nomes de campos)
npm install
npx prisma generate

# 3. Sincronize o Banco de Dados (Adiciona as novas colunas como 'color' nas listas)
npx prisma db push --accept-data-loss

# 4. Saia da pasta backend e atualize o frontend
cd ..
npm install
npm run build

# 5. Reinicie o sistema
# Se estiver usando PM2:
pm2 restart all
```

## O que foi corrigido nestas atualizações:
1. **Persistência de Imagens**: Pastas e Quadros agora mantém suas miniaturas e backgrounds mesmo após o refresh da página.
2. **Rebranding Kanban**: Todos os caminhos internos foram unificados para evitar erros 404.
3. **Filtro JJCorporation**: A conta de manutenção está oculta conforme solicitado.
4. **Cores Hex**: Melhorado o suporte para copiar e colar cores hexadecimais.

---
*Caso o erro persista após rodar os comandos acima, verifique os logs do servidor (`pm2 logs`).*
