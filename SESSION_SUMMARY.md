# SESSION SUMMARY — Ranking/Classificação do Robô Polaryon

## Objetivo
Fazer o ranking (classificação) de cada item na sala de disputa do ComprasNet funcionar no robô Electron, exibindo a posição de cada participante com seu melhor valor (proposta ou lance) em tempo real, **sem depender de clique manual do usuário em "Classificação"**.

## Data: 22/05/2026
## Última sessão: 22/05/2026
## Versão atual: 3.8.26+

---

## ARQUITETURA DO RANKING

### Fluxo de Dados (3 caminhos paralelos)

```
CAMINHO A: Browser intercept (portal-preload.js)
  Portal JS → fetch/XHR interceptado → processSerproData() → processRankingData() → IPC 'portal-ranking-data'
  → visual-runner.js → 'bidding-ranking-update' → preload.js bridge → BiddingDashboardPage.tsx

CAMINHO B: Backend polling (bidding-runner.js)
  RoomRunner.run() → fetch lances/por-participante (com captcha do Siga) → parse → IPC 'bidding-ranking-update'
  → preload.js bridge → BiddingDashboardPage.tsx

CAMINHO C: Socket (modo web)
  socketService.on('biddingRankingUpdate') → BiddingDashboardPage.tsx
```

### Endpoints SERPRO

| Endpoint | URL | Precisa Captcha | Retorna |
|----------|-----|-----------------|---------|
| **lances/por-participante** ✅ | `/comprasnet-disputa/v1/compras/{id}/itens/{itemId}/lances/por-participante` | SIM (`?captcha=P1_...`) | Ranking com propostas (P) e lances (L) atuais de cada participante |
| **propostas-iniciais** ❌ REMOVIDO | `/comprasnet-fase-externa/v1/compras/{id}/itens/{itemId}/propostas-iniciais` | NÃO | Apenas propostas iniciais (sem lances atualizados) — NÃO USAR, formato de dados errado |
| **classificacao** ❌ não usado | `/comprasnet/classificacao` | SIM | Desconhecido (provavelmente redireciona para lances/) |

---

## 🔴 PROBLEMA ATUAL (NÃO RESOLVIDO) — Ranking loop retorna 204

### Contexto
O ranking loop em `portal-preload.js` (preload context) faz `fetch()` para `/lances/por-participante?captcha=P1_...` e **sempre recebe 204 No Content**, mesmo quando:
- O captcha P1_... foi interceptado com sucesso do portal (log `🔓 Captcha P1_... interceptado!`)
- O interceptor captura 10 lances reais quando o usuário clica "Classificação" (log `🏆 Enviando 10 lances para sessionId=virtual_...`)
- O Siga captcha NÃO funciona neste endpoint (também retorna 204)

### Causa Raiz Identificada
O `fetch()` do preload script roda no **contexto isolado do Electron** (preload context) e NÃO inclui:
1. **Cookies de sessão** — sem `credentials: 'include'`
2. **Headers específicos** — `X-XSRF-TOKEN` (lido do cookie `XSRF-TOKEN`), `X-Requested-With: XMLHttpRequest`, `Origin`, `Referer`
3. **Contexto da página** — o servidor SERPRO valida a sessão via cookies + token CSRF, não apenas via `Authorization: Bearer`

A prova: quando o **portal Angular** faz a mesma request (ao clicar "Classificação"), o servidor retorna **200 com dados**. O interceptor captura essa resposta. A diferença é que a request do portal:
- Usa `XMLHttpRequest` do Angular (não `fetch()` isolado)
- Inclui `X-XSRF-TOKEN` lido do cookie
- Inclui cookies automaticamente (mesma origem)
- Possivelmente inclui `X-Requested-With`, `Origin`, `Referer`

### Hipótese não confirmada: Captcha de uso único
O token P1_... pode ser consumido na primeira request. Se o portal usar um token P1_... fresco (obtido via hCaptcha ao clicar na aba), o loop não conseguiria reutilizar o mesmo token. Mas isso é secundário ao problema de cookies.

### SOLUÇÃO IMPLEMENTADA NESTA SESSÃO (patch ASAR manual)
Em vez do `fetch()` isolado do preload, o ranking loop agora:
1. **Dispara um evento DOM** `CustomEvent('polaryon-fetch-ranking')` com `{ url, purchaseId, itemId, captcha }`
2. O **injected script** (page context, linha ~756) escuta o evento e faz a request usando `originalFetch` (o `window.fetch` verdadeiro da página) com:
   - `credentials: 'include'` (envia cookies)
   - `X-XSRF-TOKEN` lido de `document.cookie`
   - `X-Requested-With: XMLHttpRequest`
3. A resposta volta via `window.postMessage` → message handler do preload → `processSerproData()` → `processRankingData()`

**Arquivo alterado**: `electron/portal-preload.js`
- Linha ~517: substituído `fetch()` do preload por `document.dispatchEvent(new CustomEvent('polaryon-fetch-ranking', ...))`
- Linha ~756: adicionado `document.addEventListener('polaryon-fetch-ranking', ...)` no injected script

### Como testar (após abrir o app)
1. Entre na sala de disputa
2. Abra DevTools (F12) → console
3. Procure pelos logs:
   - `[POLARYON RANKING LOOP] 🎯 Delegando fetch para page context: ...` — loop disparou o evento
   - `[POLARYON INJECTED] 🌐 Fetch ranking (page context): ...` — injected script recebeu e fez fetch
   - `[POLARYON INJECTED] ✅ Ranking response: status=200 body(NNNB)` — **sucesso!**
   - Ou `status=204 body(0B)` — ainda falha (provável: captcha expirado/consumido)

### Se ainda falhar (204 mesmo com page-context fetch)
A causa será o **captcha P1_... de uso único**. Estratégias possíveis:

**Opção 1 (recomendada): Disparar clique programático na aba "Classificação"**
- Quando o loop precisar de ranking, ao invés de fazer fetch próprio:
  1. Encontrar o botão/aba "Classificação" no DOM
  2. Clicar nele (dispara hCaptcha + request do portal)
  3. Interceptor captura a resposta (já funciona)
  4. Clicar de volta na aba anterior (ex: "Itens")
- Vantagem: usa o fluxo legítimo do portal, captcha sempre fresco
- Desvantagem: muda a UI visível (mas o portal fica em janela oculta?)

**Opção 2: Resolver hCaptcha programaticamente**
- Complexo, requer integração com serviço de resolução de captcha (2captcha, capsolver)
- O portal usa hCaptcha, não reCAPTCHA

### Pontos importantes
- **NUNCA** cair no fallback `/propostas-iniciais` — os dados são de formato diferente (sem lances atualizados) e já causaram confusão. Foi removido.
- **Só aceitar P1_...** — captcha do Siga retorna 204 no endpoint de ranking. O handler de mensagens (linha ~678) só armazena tokens que começam com `P1_`.
- O `shared.captchaToken` é populado pelo interceptor (captura `?captcha=` ou `&captcha=` de qualquer URL interceptada via fetch ou XHR)
- O `processSerproData()` (linha ~532) está DUPLICADO no arquivo (~200 e ~532). A segunda definição sobrescreve a primeira. Qualquer alteração precisa ser feita na segunda (linha 532+).

---

## PROBLEMAS RESOLVIDOS EM SESSÕES ANTERIORES

### 🔴 Problema 1: Ranking vazio — `participanteId` ausente na resposta

**Causa**: A resposta do `/lances/por-participante` NÃO contém `participanteId` nem `fornecedorId`. O código usava `String(valor)` como fallback em `buildRankingPorParticipante()`. Com 5 participantes de R$ 26,97, eles viravam 1 só (agrupados pelo valor).

**Arquivos alterados**:
- `electron/bidding-runner.js:437` — `participanteId: partId ? String(partId) : `__PARTICIPANTE__${idx}``
- `electron/portal-preload.js:454` — mesmo fallback
- `electron/bidding-runner.js:393` — `entry.sequencial` como participanteId (propostas-iniciais)

**Solução**: Usar o índice do array (`__PARTICIPANTE__${idx}`) como identificador único quando nenhum `participanteId` é fornecido. Cada entrada do array vira um participante distinto no ranking.

### 🔴 Problema 2: Captcha inválido/expirado

**Causa**: O endpoint `/lances/por-participante` exige captcha `P1_...` (obtido via hCaptcha). O `captchaManager` do `bidding-runner.js` busca tokens em:
1. `https://capgen.sigapregao.com.br/capgen/captcha-dispensas` (Siga Pregão)
2. `https://polaryon.com.br/api/bidding/captcha-pool` (fallback Polaryon)
3. `getFreshToken()` → tenta `captcha-dispensas` + fallback

Mas o `portal-preload.js` (roda no renderer do portal) NÃO tinha acesso a esses tokens.

**Arquivos alterados**:
- `electron/bidding-runner.js:972-974` — exportou `getCaptchaTokens()` e `getFreshCaptchaToken()`
- `electron/main.js:308-321` — `ipcMain.handle('get-captcha-token')` que chama o bidding-runner
- `electron/portal-preload.js:500-510` — `ipcRenderer.invoke('get-captcha-token')` no loop de ranking

**Solução**: `portal-preload.js` invoca `ipcRenderer.invoke('get-captcha-token')` que o `main.js` trata chamando `BiddingRunner.getCaptchaTokens()`.

### 🔴 Problema 3: Captcha não interceptado do portal

**Causa**: Quando o usuário clica "Classificação" no portal, a página resolve o hCaptcha e obtém um token `P1_...`. Esse token é usado na URL de `/lances/por-participante?captcha=P1_...`. O robô não estava capturando esse token.

**Arquivos alterados**:
- `electron/portal-preload.js:656-658` — handler `type: 'captcha'` que salva em `shared.captchaToken`
- `electron/portal-preload.js:693-700` — fetch interceptor extrai `captcha=...` da URL
- `electron/portal-preload.js:728-736` — XHR interceptor extrai `captcha=...` da URL
- `electron/portal-preload.js:11-22` — adicionou `captchaToken: ''` ao shared state

**Solução**: O injected script extrai `?captcha=` ou `&captcha=` de QUALQUER URL interceptada (fetch ou XHR) e envia pro preload, que armazena em `shared.captchaToken`. O loop de ranking usa esse token prioritariamente.

### 🔴 Problema 4: Parse do formato `/propostas-iniciais`

**Causa**: O endpoint `/propostas-iniciais` retorna formato diferente:
```json
{"valores":{"valorPropostaInicial":{"valorInformado":26.00,"valorCalculado":{"valorUnitario":26.00}}}}
```

O código existente não extraía valor desse formato aninhado.

**Arquivos alterados**:
- `electron/portal-preload.js:420-425` — extração de `entry.valores.valorPropostaInicial`
- `electron/bidding-runner.js:360-365` — mesma extração

**Solução**: Antes de tentar `valObj.valor`, verifica se `entry.valores?.valorPropostaInicial?.valorInformado` existe.

### 🔴 Problema 5: sessionId com prefixos diferentes

**Causa**: `portal-preload.js` cria `sessionId = virtual_{compraId}`, `bidding-runner.js` usa `GLOBAL_{compraId}`. O frontend `BiddingDashboardPage.tsx` precisa casar esses IDs.

**Arquivo alterado**: `src/pages/BiddingDashboardPage.tsx:823-825`
```js
if (sid.startsWith('GLOBAL_') || sid.startsWith('virtual_') || sid.startsWith('HYBRID_')) {
    compraIdFromSid = sid.replace(/^(GLOBAL_|virtual_|HYBRID_)/, '');
}
```

### 🔴 Problema 6: Fallback para /classificacao

**Causa**: Quando `lances/por-participante` falha (captcha inválido), o robão não tentava alternativas.

**Arquivos alterados**:
- `electron/bidding-runner.js:291-309` — adicionou `/classificacao` como fallback com múltiplas variações de URL
- `electron/portal-preload.js` — adicionou `/propostas-iniciais` como fallback (sem captcha)

---

## ARQUIVOS MODIFICADOS (resumo)

| Arquivo | Linhas alteradas | O que faz |
|---------|-----------------|-----------|
| `electron/bidding-runner.js` | 275, 291-309, 360-365, 393, 437, 972-974 | URLs fallback, parse propostas-iniciais, sequencial como ID, export captcha |
| `electron/portal-preload.js` | 11-22, 420-425, 440, 454, 500-525, 656-658, 693-700, 728-736, 756-780, 517-525 (refeito) | captchaToken state, parse propostas, captcha intercept, get-captcha-token IPC, **event-based ranking fetch** |
| `electron/main.js` | 308-321 | IPC handler get-captcha-token |
| `electron/preload.js` | 26 | onBiddingRankingUpdate bridge (já existia) |
| `electron/visual-runner.js` | 33-43 | Relé do portal-ranking-data (já existia) |
| `src/pages/BiddingDashboardPage.tsx` | 823-825 | compraIdFromSid com virtual_/HYBRID_ prefix |
| `package.json` | version | bumps sucessivos |

---

## VERSÕES PUBLICADAS

| Versão | O que mudou | Status |
|--------|-------------|--------|
| 3.8.22 | Fix sessionId prefix + fallback lances/por-participante | ✅ Deploy |
| 3.8.23 | Array index como participanteId + /classificacao fallback | ✅ Deploy |
| 3.8.24 | Bump version (sem mudanças funcionais) | ✅ Deploy |
| 3.8.25 | Intercepta captcha do portal + /propostas-iniciais fallback | ✅ Deploy |
| 3.8.26 | Captcha via IPC do Siga para portal-preload | ✅ Deploy |

---

## COMO TESTAR (após patch manual do ASAR)

1. Abra o robô
2. Entre na sala de disputa
3. Aguarde ~5s — o loop de ranking deve disparar o evento `polaryon-fetch-ranking`
4. Abra DevTools (F12) → console → procure:
   - `🎯 Delegando fetch para page context` — loop ok
   - `🌐 Fetch ranking (page context)` — injected script fez a request
   - `✅ Ranking response: status=200` — **sucesso!**
   - Se aparecer `status=204` — captcha expirado/consumido, tentar Opção 1 (clicar aba Classificação)
5. Se só funcionar após clique manual em "Classificação" no portal, confirmado: captcha é de uso único
6. Se funcionar automaticamente (200 sem clique): problema resolvido

---

## PRÓXIMOS PASSOS PRIORITÁRIOS

### 1. (AGORA) Verificar se o patch resolveu o 204
- Abrir app, ver logs. Se `status=200`: sucesso, fazer build + deploy oficial.
- Se `status=204`: confirmado captcha de uso único → implementar **Opção 1** abaixo.

### 2. Se captcha for de uso único: Clique programático na aba "Classificação"
Estratégia correta:
- O loop de ranking não faz fetch próprio
- Em vez disso, encontra o elemento DOM da aba "Classificação" e clica
- O portal resolve hCaptcha fresco, faz a request, interceptor captura
- O loop precisa esperar a resposta (usando um callback/promise)
- Opcional: clicar de volta na aba anterior para não alterar UI visível

### 3. Se patch funcionar: Build oficial e deploy
- Bump versão no `package.json`
- Rodar `npm run electron:build:terminal`
- SCP para VPS
- Git push

---

## OBSERVAÇÕES TÉCNICAS

- **Context Isolation**: Electron com `contextIsolation: true` isola JS globals entre preload e page, mas DOM events são compartilhados. `CustomEvent` com `detail` (structured clone) funciona para comunicação preload → page.
- **Cookies vs Authorization**: O servidor SERPRO parece exigir cookies de sessão (não apenas `Authorization: Bearer`) para retornar dados de `/lances/por-participante`. O Angular do portal manda ambos.
- **`originalFetch`**: No injected script, `originalFetch = window.fetch` é salvo ANTES do override. Usar `originalFetch` com `credentials: 'include'` equivale à request do navegador puro, com cookies e headers padrão.
- **Removido `/propostas-iniciais`**: O fallback foi removido porque retorna dados em formato diferente (apenas propostas, sem lances) e atrapalhava o parsing.
- **Duplicação de `processSerproData()`**: Existem duas definições no `portal-preload.js` (~linha 200 e ~linha 532). A segunda sobrescreve a primeira. Alterar sempre a segunda.
- **Captcha do Siga**: `capgen.sigapregao.com.br` retorna tokens que NÃO funcionam em `/lances/por-participante` (retorna 204). Só o hCaptcha do portal (P1_...) funciona.
- **ASAR patch manual**: Usar `npx asar extract` + substituir arquivo + `npx asar pack` para patchear o instalado. Backup salvo em `app.asar.backup`.
