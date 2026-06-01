# Sniper Inteligente — Contexto do Projeto

## Objetivo Principal
Vencer disputas de **menor preço** (licitações eletrônicas) fazendo o robô reduzir agressivamente o lance até o **mínimo configurado**, sem queimar margem desnecessariamente.

## Problemas Resolvidos

### 1. `isGanhando` congelava o lance (v3.8.127)
**Antes:** Quando o usuário estava em 1º lugar, o código dava `continue` e nunca mais reduzia o lance, mesmo estando muito acima do mínimo.

**Arquivo:** `electron/bidding-runner.js:646-650`

**Solução:** Removeu o `continue`. Agora mesmo ganhando, o fluxo continua para avaliar redução.

### 2. Fallback sem ranking reduzia só R$1 por ciclo (v3.8.127)
**Antes:** `nextBid = myCurrentBid - decrementToUse` (margin geralmente R$1) — levava horas para reduzir de R$110k para R$27k.

**Arquivo:** `electron/bidding-runner.js:766-769`

**Solução:** Quando `isGanhando` no fallback, vai direto para `myMin`.

### 3. Nenhum concorrente batível → protegia lance alto (v3.8.127)
**Antes:** No frontend (`BiddingDashboardPage.tsx:440-449`), quando nenhum concorrente era batível (todos abaixo do mínimo), dava `return` e mantinha o lance alto.

**Solução:** Agora reduz pela metade do gap a cada ciclo (`gapReduction = max(margin, (myCurrentBid - myMin) * 0.5)`).

### 4. Margem descontada do concorrente em vez do próprio lance (v3.8.128)
**Antes:** `nextBid = competitorBid - margin` — desperdiçava margem. Ex: líder R$22.400, margem R$1 → R$22.399, mesmo se o lance anterior fosse R$110k e o degrau real fosse R$87.601 (>> R$1).

**Arquivo (backend):** `electron/bidding-runner.js:704-724` (ranking) e `:736-745` (fallback)
**Arquivo (frontend):** `BiddingDashboardPage.tsx:362-371` (líder) e `:420-446` (ranking)

**Solução:** 
```
beatingAmount = allow4 ? 0.0001 : 0.01
maxDecrement = max(margin, mandatorySerproMargin)  
lowestAllowed = myCurrentBid - maxDecrement
nextBid = max(myMin, min(competitorBid - beatingAmount, lowestAllowed))
```
A margem valida o degrau entre o MEU lance anterior e o novo lance. Do concorrente, só tira o mínimo para vencer (R$0,01 ou R$0,0001).

### 5. WebSocket consumido diretamente sem HTTP fetch (v3.8.130)
**Antes:** O handler `ws-item-update` no portal-preload.js fazia um HTTP fetch para a API Serpro mesmo já tendo os dados do WebSocket.

**Arquivo:** `electron/portal-preload.js:985-994`

**Solução:** Agora usa os dados do WebSocket diretamente e passa pelo `processSerproData` sem fetch adicional.

### 6. Backend também consome WebSocket em tempo real (v3.8.130)
**Antes:** O backend (`bidding-runner.js`) só recebia dados via polling HTTP a cada 80-500ms.

**Arquivo:** `electron/bidding-runner.js:164-192` (injectRealtimeItems), `:202-227` (run com WebSocket), `:1088-1100` (BiddingRunner.injectRealtimeItems)
**Arquivo:** `electron/main.js:298-304` (IPC handler ws-item-data)
**Arquivo:** `electron/portal-preload.js:993-994` (envio ws-item-data via IPC)

**Solução:** WebSocket data é enviada do portal-preload → main.js → BiddingRunner → RoomRunners. O RoomRunner usa os dados no lugar do HTTP fetch, eliminando latência de polling.

### 7. Lances duplicados entre frontend e backend (v3.8.130)
**Antes:** Frontend e backend disparavam lances independentemente, sem coordenação. Ambos podiam enviar o mesmo valor para o mesmo item em milissegundos de diferença.

**Arquivo:** `electron/portal-preload.js:239-241` (bid-sent IPC após lance do frontend)
**Arquivo:** `electron/main.js:298-304` (IPC handler bid-sent)
**Arquivo:** `electron/bidding-runner.js:164-165` (lastBidValues Map), `:832-838` (dedup check), `:1101-1110` (notifyBidSent), `:1142-1150` (dedup global recentBids + sendBid)

**Solução:** Três camadas de proteção:
1. **notifyBidSent**: frontend notifica backend após cada lance → backend atualiza cooldown
2. **dedup por valor**: backend verifica se o mesmo valor já foi enviado nos últimos 5s para o mesmo item
3. **dedup global (`recentBids`)**: `sendBid()` checa se o mesmo valor+item foi enviado nos últimos 2s antes de chamar a API Serpro

### 8. Frontend ignorava snipeDelaySeconds (v3.8.130)
**Antes:** O frontend (`BiddingDashboardPage.tsx:277-517`) disparava lances imediatamente ao detectar posição perdedora, ignorando a config `snipeDelaySeconds`.

**Arquivo:** `src/pages/BiddingDashboardPage.tsx:309-317`

**Solução:** Adicionado `if (snipeDelay > 0 && currentTimeLeft > snipeDelay) return;` — frontend espera o timer chegar no limite configurado.

### 9. War mode visível no frontend (v3.8.130)
**Antes:** A detecção de guerra de lances só existia no backend (`warModeCycles`), sem indicador visual.

**Arquivo:** `electron/bidding-runner.js:342-357` (inWarMode adicionado a cada mappedItem)
**Arquivo:** `src/pages/BiddingDashboardPage.tsx:2776-2781` (badge ⚔️ GUERRA com animação)

**Solução:** Backend adiciona `inWarMode` aos itens do `bidding-update`. Frontend exibe badge laranja pulsante nos itens em guerra.

## Estado Atual (v3.8.130)
- `snipeDelaySeconds` respeitado por frontend e backend
- `isGanhando` não trava mais o leilão
- Margem é calculada corretamente (valida degrau próprio, não desconta do concorrente)
- Com 4 casas decimais: economia de até R$0,9999 por lance
- Build e deploy automáticos via `scripts/deploy.js`
- Detecção de `posicao` uniformizada entre backend e frontend
- HTTP keep-alive ativado no `https.Agent`
- Polling adaptativo reduzido: Guerra 80ms | Reta 30s 150ms | Reta 60s 300ms | Ativo 500ms
- Cooldown entre lances adaptativo: Guerra 100ms | Sniper 100ms | Kamikaze 200ms | Final 300ms | Normal 1000ms
- War mode detecta no 1º ciclo e é visível no frontend (badge ⚔️)
- Backend consome dados do WebSocket em tempo real (sem HTTP fetch)
- Lances frontend+backend coordenados (3 camadas de dedup)
- Frontend respeita `snipeDelaySeconds` (igual ao backend)

## Para Vencer o Item
O **Valor Mínimo** (myMin) precisa ser **menor que o líder atual**. Se o líder está R$22.400 e o mínimo é R$27.300, o robô não consegue vencer — precisa abaixar o mínimo para < R$22.400.

## Por Que Ainda Perdemos para o Siga
Mesmo com as melhorias acima, o Siga tem vantagens estruturais:
1. **Latência de rede** — Se o servidor deles está mais perto do Serpro, ganham milissegundos
2. **Conexão persistente na API de lance** — Se mantêm um socket HTTP aberto para o endpoint de envio de lance, eliminam o handshake
3. **Polling pode ser ainda mais agressivo** — Alguns bots fazem polling a cada 10-20ms
4. **Processamento em kernel level** — Bot concorrente pode rodar em C/Go/Rust com latência menor que Node.js

A única garantia de vencer é ter **preço menor** — velocidade ajuda, mas não vence quem tem mínimo mais alto.

## Próximos Passos Possíveis
- [ ] Pool de conexões HTTP para endpoint de lance (enviar lance via keep-alive)
- [ ] Testar se WebSocket data tem mesmos campos da REST API em produção
- [ ] Monitorar latência real do pipeline WebSocket vs HTTP fetch

## Bugs de `posicao` Corrigidos (v3.8.129)
### 1. `isLosingPos` no sniper frontend (`BiddingDashboardPage.tsx:330`)
**Antes:** Usava `!==` sem `String()` (falhava se `posicao` fosse número `1`), e não reconhecia `'G'` nem `'GANHANDO'` como posição vencedora.
**Solução:** `const pos = String(item.posicao || '').toUpperCase().trim(); const isLosingPos = !(pos === '1' || pos === '1º' || pos === '1°' || pos === 'G' || pos === 'V' || pos === 'GANHANDO' || pos === 'VENCEDOR');`

### 2. `isWinning` no display (`BiddingDashboardPage.tsx:2486`)
**Antes:** Faltava `'V'` na lista de valores vencedores.
**Solução:** Adicionado `String(item.posicao).toUpperCase() === 'V'`.

### 3. `ganhador` no backend (`electron/bidding-runner.js:242`)
**Antes:** Só reconhecia `'1'` e `'GANHANDO'` como `'Você'`, ignorando `'1º'`, `'1°'`, `'G'`, `'V'`, `'VENCEDOR'`.
**Solução:** Mesma lista completa do `isGanhando`.

### 4. Ordenação de sessões (`BiddingDashboardPage.tsx:747-756`)
**Antes:** Só verificava `'1'`, `'1º'`, `'1°'` para ordenar sessões vencedoras primeiro.
**Solução:** Normalização com `String().toUpperCase().trim()` + todos os valores vencedores.

### 5. Correção de falsos positivos (`BiddingDashboardPage.tsx:888-900`)
**Antes:** `isPortalPosWinning` não incluía `'G'` nem `'GANHANDO'`, e o `mergedPosicao` também ignorava esses valores.
**Solução:** `mergedPosNorm` e `isPortalPosWinning` agora usam a lista completa normalizada.

## Bug de Margem Queimada no Sniper Corrigido (v3.8.131)

### Comparação incorreta contra `idealBid` (`BiddingDashboardPage.tsx:448`)
**Problema:** O sniper queimava R$0,10 a cada 30s desnecessariamente. Após disparar um lance intermediário (ex: R$ 45.309,9999), o freeze de 30s expirava e o código comparava `myCurrentBid <= idealBid`. Como `idealBid` é limitado por `lowestAllowed = myCurrentBid - maxDecrement`, essa condição era **sempre falsa** (ex: 45309.9999 <= 45309.8999 = false), fazendo o robô disparar outro lance R$0,10 abaixo.

**Solução:** `myCurrentBid <= beatingThreshold` (onde `beatingThreshold = targetCompetitorBid - beatingAmount`). Agora o sniper verifica se o lance já vence o concorrente alvo diretamente, parando de reduzir assim que a posição está garantida. Se o concorrente reduzir, o sniper reage corretamente.
