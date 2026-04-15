# 📜 PROTOCOLO OPERACIONAL DE INTELIGÊNCIA ARTIFICIAL (POLARYON)

Este arquivo define as **DIRETRIZES PRIMORDIAIS** que devem ser seguidas por qualquer IA ou desenvolvedor ao realizar alterações no Bot de Lances Polaryon. Estas instruções são de caráter **OBRIGATÓRIO** e não devem ser ignoradas sob nenhuma circunstância.

---

## 🚨 REGRA DE OURO: O Ciclo de Lançamento Triplo
Toda alteração de funcionalidade no robô **DEVE** terminar com a execução dos 3 passos abaixo, de forma atômica e sem falhas:

### 1. Atualizar o Link Web (Versionamento UI)
- O desenvolvedor/IA **DEVE** realizar o bump da versão no `package.json`.
- A versão deve ser refletida nos arquivos de interface: 
    - `AppSidebar.tsx`
    - `DesktopDownloadPage.tsx`
    - `DesktopCombatTerminal.tsx`

### 2. Atualizar o Robô dos Usuários (Auto-Update)
- O desenvolvedor/IA **DEVE** rodar o build do terminal desktop localmente: `npm run electron:build:terminal`.
- Após o build, os arquivos `Polaryon-v*-Setup.exe` e `latest.yml` **DEVEM** ser enviados via SCP para a VPS na pasta: `/var/www/polaryon/storage/download/`.

### 3. Sincronia de GIT e Deploy Automático
- O desenvolvedor/IA **DEVE** realizar o `git push` de todas as alterações.
- O desenvolvedor/IA **DEVE** disparar o script `vps-deploy.sh` no servidor via SSH para garantir que a versão WEB e o backend estejam em sincronia com o instalador recém-subido.

---

## 🛠️ Comandos de Execução Padrão (Sem Falhas)

```powershell
# Passo A: Build Local
npm run electron:build:terminal

# Passo B: Upload para VPS (Storage Download)
scp dist_desktop\Polaryon-v*-Setup.exe root@204.168.151.231:/var/www/polaryon/storage/download/
scp dist_desktop\latest.yml root@204.168.151.231:/var/www/polaryon/storage/download/

# Passo C: Sincronia Git
git add .
git commit -m "feat(scope): nova funcionalidade vX.X.X"
git push origin main

# Passo D: Deploy Final VPS
ssh root@204.168.151.231 "cd /var/www/polaryon && bash vps-deploy.sh"
```

## ⚠️ Nota para IAs:
**NUNCA** finalize uma tarefa dizendo "concluído" sem ter verificado se o link de download está ativo e a versão no `latest.yml` condiz com a versão atual no repositório.

---
*Assinado: Protocolo de Estabilidade Polaryon v1.0*
