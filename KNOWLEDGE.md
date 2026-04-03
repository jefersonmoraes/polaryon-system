# Guia de Acesso e Segurança do Servidor

Este arquivo serve como base de conhecimento para desenvolvedores e IAs que trabalharem neste repositório.

## 🛡️ Segurança do Servidor
O servidor principal (`204.168.151.231`) segue uma política de **zero exposição externa** para serviços críticos.

### 🚫 Portas Bloqueadas Externamente (UFW)
*   **Porta 5432 (PostgreSQL)**: Bloqueada. O serviço está configurado para ouvir apenas em `127.0.0.1`.
*   **Porta 3000 (Backend Express)**: Bloqueada (`ufw deny 3000`). Todo tráfego deve passar pelo Nginx (porta 80/443).
*   **Porta 6379 (Redis)**: Bloqueada.

### 🔑 Como Acessar o Banco de Dados
Para acessar o banco de dados via aplicativos locais (ex: DBeaver, pgAdmin), você **DEVE** utilizar um túnel SSH.

**Comando para Terminal:**
```bash
ssh -L 5432:localhost:5432 root@204.168.151.231
```
Após executar este comando, conecte seu cliente de banco de dados em `localhost:5432`.

---
## 🛡️ Políticas de Desenvolvimento Seguro

### 🌐 Backend (Express)
*   **CORS**: Restrito apenas aos domínios `polaryon.com.br`. Nunca use `*` em produção.
*   **Rate Limiting**: Ativo em todas as rotas `/api/`. Limite de 200 requisições a cada 15 minutos por IP.
*   **Segurança HTTP**: Uso mandatório de `helmet` e `hpp` (Pollution Prevention).
*   **Sanitização**: A sanitização de entrada deve ser feita manualmente nos controladores ou via validadores (`express-validator`), pois `xss-clean` é incompatível com o Express 5 (req.query getter).
*   **X-Powered-By**: Deve permanecer desabilitado para evitar fingerprinting.

### 🧪 Arquivos de Teste e Scripts
*   **PROIBIDO**: Manter arquivos `test_*.js` ou scripts de debug no diretório `/var/www/polaryon/backend/`.
*   **BACKUP**: Scripts de manutenção e teste devem ser movidos para `/root/polaryon_backup_tests/` após o uso.

---
## 🤖 Instrução para IA (Antigravity/Cursor/Gemini)
> [!IMPORTANT]
> **REGRA MANDATÓRIA:** 
> 1. Nunca abra a porta 3000 ou 5432 no firewall (`ufw`) para acesso externo.
> 2. Ao implementar novas rotas, garanta que elas passem pelo middleware de `audit` (`src/audit.ts`).
> 3. Nunca remova o `rateLimit` ou as restrições de `cors` sem autorização expressa do usuário.
> 4. Se encontrar arquivos de teste soltos no servidor, mova-os imediatamente para o diretório de backup seguro.
