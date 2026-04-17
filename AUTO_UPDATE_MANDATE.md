# 🚨 MANDATO SAGRADO: ATUALIZAÇÃO AUTOMÁTICA (NÃO ESQUECER!)

Este documento é a **MEMÓRIA PERMANENTE** do robô Polaryon. Nenhuma atualização deve ser terminada sem que o Auto-Update esteja funcionando.

---

## 💎 A REGRA DE OURO (GOLDEN RULE)

Sempre que você (IA ou Desenvolvedor) for subir uma nova versão, você **DEVE** seguir estes passos sem pular nenhum:

### 1. Sincronia de Versão (Telas)
- O número da versão no `package.json` DEVE ser o mesmo em:
    - `AppSidebar.tsx` (Rodapé lateral)
    - `DesktopDownloadPage.tsx` (Página de download)

### 2. O Caminho do Servidor (Storage)
- O instalador (`.exe`) e o arquivo `latest.yml` DEVEM ser enviados para:
    - VPS Path: `/var/www/polaryon/storage/download/`
- **POR QUE?** Porque o servidor web (Nginx) está configurado para olhar um link simbólico que aponta especificamente para essa pasta.

### 3. A URL de Busca (Bússola)
- O robô sempre deve olhar para: `https://polaryon.com.br/download/`
- NUNCA use o IP diretamente no código final, use o domínio com HTTPS para evitar bloqueios de segurança do Windows.

---

## 🛠️ CHECKLIST DE DEPLOY (Obrigatório)

1. [ ] Bump da versão no `package.json`.
2. [ ] Atualizar versão nos arquivos de UI (`src/`).
3. [ ] Rodar o build: `npm run electron:build:terminal`.
4. [ ] Rodar o deploy: `npm run deploy:terminal`.
5. [ ] **VERIFICAÇÃO FINAL:** Abrir `https://polaryon.com.br/download/latest.yml` no navegador e ver se a versão bate com a que você acabou de subir.

---
**AVISO PARA IAs:** Se você ignorar este documento, o Jefão vai reclamar. Leia isso toda vez que for mexer no Electron! 🐯🛡️
