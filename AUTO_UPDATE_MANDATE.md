# 🚨 MANDATO SAGRADO: ATUALIZAÇÃO AUTOMÁTICA (NÃO ESQUECER!)

Este documento é a **MEMÓRIA PERMANENTE** do robô Polaryon. Nenhuma atualização deve ser terminada sem que o Auto-Update esteja funcionando.

---

## 💎 A REGRA DE OURO (GOLDEN RULE)

Sempre que você (IA ou Desenvolvedor) for subir uma nova versão, você **DEVE** seguir estes passos sem pular nenhum:

### 1. Sincronia de Versão (Zero-Touch)
- **NÃO HARDCODE VERSÕES**: Use sempre `app.getVersion()` (Backend) ou o Hook `appVersion` (Frontend) que busca do Electron API. Isso evita que o robô mostre "v3.5.95" quando já está na "v3.5.98".

### 2. O Caminho do Servidor (Storage)
- O instalador (`.exe`) e o arquivo `latest.yml` DEVEM ser enviados para:
    - VPS Path: `/var/www/polaryon/storage/download/`
- **BARRA PARA LINUX**: Se estiver desenvolvendo no Windows, **NUNCA** use `path.join` para caminhos remotos. Use sempre strings manuais com barras normais `/`. O Windows usa `\` e isso cria arquivos "fantasmas" no servidor Linux.

### 3. A URL de Busca (Bússola)
- O robô sempre deve olhar para: `https://polaryon.com.br/download/`
- NUNCA use o IP diretamente no código final, use o domínio com HTTPS para evitar bloqueios de segurança do Windows.

---

## 🛠️ CHECKLIST DE DEPLOY (Obrigatório)

1. [ ] Bump da versão no `package.json`.
2. [ ] Rodar o build: `npm run electron:build:terminal`.
3. [ ] Rodar o deploy: `node scripts/deploy.js` (ou o script seguro de deploy).
4. [ ] **PERMISSÕES**: Garanta que o comando `chown www-data:www-data` e `chmod 755` seja executado na pasta de download do VPS após o upload.
5. [ ] **VERIFICAÇÃO FINAL:** Abrir `https://polaryon.com.br/download/latest.yml` no navegador e ver se a versão bate com a que você acabou de subir.

---
**AVISO PARA IAs:** O erro das barras invertidas (`\`) causou uma falha de atualização crítica em Maio/2026. Respeite as barras `/` para o Linux! 🐯🛡️
