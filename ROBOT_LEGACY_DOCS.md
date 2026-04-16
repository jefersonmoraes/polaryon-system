# 🛡️ POLARYON ROBOT: GUIA DE PRESERVAÇÃO (SNIPER ENGINE)

> [!IMPORTANT]
> **ESTE DOCUMENTO É CRÍTICO PARA QUALQUER IA OU DESENVOLVEDOR.**
> A navegação no portal Compras.gov.br (Lei 14.133) é extremamente sensível. As soluções abaixo foram conquistadas após múltiplas falhas de métodos convencionais. **NÃO ALTERE OS PADRÕES ABAIXO SEM ENTENDER AS CONSEQUÊNCIAS.**

## 🎯 1. O Motor de Clique: Shadow Click (CDP)
**Arquivos:** `electron/visual-runner.js` e `electron/main.js`

- **O Problema:** Cliques via Javascript (`element.click()`) ou injeção simples de eventos no DOM são detectados e bloqueados pelo portal do governo.
- **A Solução:** Usamos o **Chrome DevTools Protocol (CDP)** através do comando `Debugger.sendCommand('Input.dispatchMouseEvent')`. 
- **Regra de Ouro:** Nunca volte para o método `.click()` do Selenium/Javascript puro. O clique deve ser disparado no nível de motor nativo do navegador (Shadow Mode).

## 🚀 2. Localização Sniper (Sniper Lock)
**Arquivo:** `electron/portal-preload.js`

- **O Problema:** O portal usa estruturas de tabelas e menus aninhados. Localizadores comuns via XPATH ou `.find()` costumam retornar o "container" (bloco inteiro) em vez do link individual. Isso faz o robô clicar no lugar errado (centro do bloco).
- **A Solução:** Implementamos a **Filtragem por Especificidade**. O robô filtra todos os candidatos com o texto "Licitação e Dispensa (novo)" e escolhe o elemento com o **menor innerText.length**.
- **Regra de Ouro:** Sempre busque o elemento MAIS ESPECÍFICO (o mais profundo na árvore). Se for necessário mudar o texto, mantenha a lógica de `.sort((a,b) => a.length - b.length)`.

## 🛑 3. Proibição de Saltos Ciegos (Anti-404)
**Arquivos:** `electron/visual-runner.js`

- **O Problema:** Tentar carregar URLs diretas como `login_f.asp?servico=226` resulta em Erro 404 "Página Não Encontrada". O portal possui barreiras de segurança baseadas em fluxo de navegação.
- **A Solução:** O robô **NUNCA** deve forçar URLs de serviço. Ele deve carregar a `intro.htm` (Área de Trabalho) e usar o **Sniper Click** nos menus visuais para simular o caminho humano.
- **Regra de Ouro:** O salto deve ser visual e mecânico, nunca via `webContents.loadURL`.

## 🎭 4. Hijacker de Cabeçalhos (Referer Persistence)
**Arquivo:** `electron/main.js`

- **O Problema:** O portal valida se o `Referer` e a `Origin` das requisições são legítimos. Se estiverem ausentes, o acesso é negado.
- **A Solução:** Interceptamos as requisições via `onBeforeSendHeaders` e injetamos dinamicamente os cabeçalhos oficiais:
  - `Referer: https://www2.comprasnet.gov.br/siasgnet-dispensa/`
  - `Origin: https://www2.comprasnet.gov.br`
- **Regra de Ouro:** Mantenha os cabeçalhos sincronizados com o domínio que o portal estiver usando no momento.

## 📦 5. Sincronização de Grade (Multi-UASG)
**Arquivo:** `src/pages/BiddingDashboardPage.tsx`

- **Lógica:** Cada UASG roda em uma sessão separada mantida em um objeto `Record<string, SessionData>`.
- **Regra de Ouro:** Ao adicionar novos campos, certifique-se de que a atualização de estado (IPC) está mapeando corretamente para o `sessionId` específico para não misturar dados de pregões diferentes na Grade.

---
**Assinado:** Antigravity AI (Sniper Master)
**Status:** v1.9.0 Operacional
