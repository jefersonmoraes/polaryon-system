# SESSION SUMMARY — Ranking/Classificação do Robô Polaryon

## Objetivo
Fazer o ranking (classificação) de cada item na sala de disputa do ComprasNet funcionar no robô Electron, exibindo a posição de cada participante com seu melhor valor (proposta ou lance) em tempo real.

## Data: 22/05/2026
## Versão atual: 3.8.26

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
| **propostas-iniciais** ⚠️ fallback | `/comprasnet-fase-externa/v1/compras/{id}/itens/{itemId}/propostas-iniciais` | NÃO | Apenas propostas iniciais (sem lances atualizados) |
| **classificacao** ❌ não usado | `/comprasnet/classificacao` | SIM | Desconhecido (provavelmente redireciona para lances/) |

---

## PROBLEMAS ENCONTRADOS E SOLUÇÕES

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
| `electron/portal-preload.js` | 11-22, 420-425, 440, 454, 500-525, 656-658, 693-700, 728-736 | captchaToken state, parse propostas, captcha intercept, get-captcha-token IPC |
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

## COMO TESTAR

1. Abra o robô (após auto-update para 3.8.26+)
2. Entre na sala de disputa
3. Aguarde ~5s — o loop de ranking deve buscar `/lances/por-participante` com captcha do Siga
4. Se não aparecer, clique **1 vez** no botão "Classificação" do portal — o captcha é interceptado
5. O ranking mostra cada participante com seu melhor valor (P = proposta, L = lance)
6. Abra DevTools (F12) → console → procure `[POLARYON RANKING LOOP]` para debug

## PRÓXIMOS PASSOS SUGERIDOS

1. **Auto-bidding inteligente**: Quando o ranking estiver estável, implementar:
   - Identificar a posição do usuário
   - Se o valor mínimo do usuário for menor que o líder, não precisa dar lance
   - Se for maior, calcular o lance mínimo necessário para vencer (líder - margem)
   - Disparar lance automático nos últimos 30s

2. **Campo "desconto"**: O usuário mencionou um campo de desconto/margem que deve ser usado para calcular o valor do lance competitivo

3. **Polling mais frequente**: Nos últimos 30s da disputa, aumentar frequência do ranking poll de 5s para 1s

4. **Agrupar por participante**: O frontend `buildRankingPorParticipante()` já agrupa, mas como não temos `participanteId`, cada entrada fica separada. Ideal seria ter consistência entre chamadas.

## OBSERVAÇÕES TÉCNICAS

- O captcha do Siga (`capgen.sigapregao.com.br`) pode expirar — renovado a cada 3min pelo CaptchaManager
- A resposta do `/lances/por-participante` NÃO tem `participanteId` nem `eMeuLance`
- O `eMeuLance` é inferido por matching de valor: `Math.abs(r.valor - meuValor) < 0.001`
- O portal-preload.js tem DUAS definições de `processSerproData()` (linhas ~202 e ~530) — a segunda sobrescreve a primeira
- O `secure-proxy.js` cria um proxy HTTP em porta dinâmica para redirecionar tráfego com certificado A1
- O `shared` state é compartilhado entre frames via `window.top._polaryonSharedState`
