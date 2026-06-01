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

## Estado Atual (v3.8.137)
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
- Latência medida e exibida no console VM15 (`[LATÊNCIA 📊]` a cada 30s no portal-preload.js)

## Para Vencer o Item
O **Valor Mínimo** (myMin) precisa ser **menor que o líder atual**. Se o líder está R$22.400 e o mínimo é R$27.300, o robô não consegue vencer — precisa abaixar o mínimo para < R$22.400.

## Por Que Ainda Perdemos para o Siga
Mesmo com as melhorias acima, o Siga tem vantagens estruturais:
1. **Latência de rede** — Se o servidor deles está mais perto do Serpro, ganham milissegundos
2. **Conexão persistente na API de lance** — Se mantêm um socket HTTP aberto para o endpoint de envio de lance, eliminam o handshake
3. **Polling pode ser ainda mais agressivo** — Alguns bots fazem polling a cada 10-20ms
4. **Processamento em kernel level** — Bot concorrente pode rodar em C/Go/Rust com latência menor que Node.js

A única garantia de vencer é ter **preço menor** — velocidade ajuda, mas não vence quem tem mínimo mais alto.

## Implementado (v3.8.132)

### 1. Pool de conexões HTTP para endpoint de lance (`bidding-runner.js`)
**Antes:** `sendBid()` usava o mesmo `this.agent` do polling (maxSockets=8, compartilhado). Conexões de polling podiam ocupar todos os sockets, atrasando o envio de lances.

**Solução:** Criado `this.bidAgent` dedicado com `maxSockets: 4, keepAliveMsecs: 60000`. `sendBid()` usa `this.bidAgent || this.agent`. Frontend `fetch()` em `portal-preload.js` ganhou `keepalive: true`.

### 2. Validação de campos WebSocket vs REST API (`bidding-runner.js`)
Adicionada verificação runtime em `injectRealtimeItems()`: confere 8 campos críticos (`identificador`, `situacaoParticipanteDisputa`, `melhorValorGeral`, `melhorValorFornecedor`, `segundosParaEncerramento`, `dataHoraFimContagem`, `fase`, `variacaoMinimaEntreLances`). Se algum faltar, loga warning + lista completa de campos presentes no WebSocket para comparação.

### 3. Monitor de latência WebSocket vs HTTP fetch (`bidding-runner.js`)
Adicionado `_trackLatency()` + `_logLatencyStats()` no `RoomRunner`. Cada ciclo registra latência (WS=0ms, HTTP=real). A cada 30s loga min/avg/max/count de cada tipo: `[LATÊNCIA 📊] WS: 0.0ms (0-0, 45 amostras) | HTTP: 127.3ms (45-892, 12 amostras)`.

## Implementado (v3.8.133)

### 1. Retry automático com captcha fresco em caso de HTTP 400 (`portal-preload.js`, `bidding-runner.js`)
**Antes:** Lance rejeitado com 400 (captcha expirado) era logado e abortado. Sem retry.

**Arquivo:** `electron/portal-preload.js:216-251` (frontend), `electron/bidding-runner.js:1241-1294` (backend)

**Solução:**
- **Frontend:** Loop de até 2 tentativas. Na 1ª usa captcha do pool. Na 2ª (se 400), busca captchas ao vivo (ignora pool) e retenta.
- **Backend:** Loop de até 2 tentativas. Na 1ª usa captcha do `captchaManager`. Na 2ª (se 400), força `lastFetch=0` + limpa tokens para renovação forçada e retenta.
- Pool de captcha do frontend reduziu TTL de 20s→10s para diminuir chance de usar captcha expirado.
- `captchaManager` do backend renovava a cada 3 minutos — agora renova a cada 30 segundos.

### 2. Pool de captcha mais conservador (`portal-preload.js`)
**Antes:** TTL de 20s no pool — captchas podiam expirar no Serpro antes de serem usados.
**Solução:** TTL reduzido para 10s.

### 3. Refresh de captcha do backend mais frequente (`bidding-runner.js`)
**Antes:** `captchaManager` renovava tokens a cada 180s (3 min) — muito tempo para captchas que expiram rápido.
**Solução:** Renova a cada 30s, reduzindo drasticamente a janela de captcha expirado.

## Implementado (v3.8.134)

### 1. Filtro de `codigo` no WebSocket (bidding-runner.js:1186-1192)
**Antes:** `BiddingRunner.injectRealtimeItems(items)` injetava dados do WS em **todos** os RoomRunners ativos, independente do `codigo` (purchase ID). Se o usuário tivesse 2 compras abertas, dados da compra A contaminavam a compra B.

**Solução:** Agora aceita `(codigo, items)` e só entrega para runners cujo `idCompra === String(codigo)`.

### 2. IPC relay com `codigo` (main.js:299-304)
**Antes:** `ipcMain.on('ws-item-data')` passava `items` sem `codigo`.
**Solução:** O handler agora destrutura `{ codigo, items }` e repassa ambos.

### 3. Debounce de WebSocket no portal-preload (portal-preload.js:1015-1020)
**Antes:** Cada mensagem WS gerava um `ipcRenderer.send('ws-item-data')` — até 10+ msg/s em modo guerra.
**Solução:** Só repassa ao backend se passou ≥200ms desde o último envio, reduzindo drasticamente o tráfego IPC.

## Implementado (v3.8.137)

### 1. Latência no console VM15 (portal-preload.js)
**Antes:** `[LATÊNCIA 📊]` só existia no backend (`_logLatencyStats()`), que nunca gerava relatório porque `_latencySamples` ficava vazio (timer global `bb.lastLatencyLog` era resetado pelo primeiro RoomRunner antes de acumular amostras).

**Solução:** Adicionado `_latencySamples[]` + `setInterval(30s)` no escopo do `portal-preload.js`. Cada chamada de `processSerproData()` registra `tEnd - tStart` no array. A cada 30s o console VM15 exibe: `[LATÊNCIA 📊] avg ms (min=x max=y, N amostras — 30s)`.

## Estado Atual (v3.8.140)
- Polling adaptativo: Guerra 250ms (antes 80ms) | Reta 30s 150ms | Reta 60s 300ms | Ativo 500ms (backend)
- Frontend adaptive loop: guerra 300ms (antes 50ms) com detecção de 429 e backoff automático
- Anti-429 completo: sliding window + backoff automático global (bidding-runner.js)
- Rate limiter global de requisições por segundo (bidding-runner.js)
- Visual bug corrigido: override otimista TTL 15s→3s (BiddingDashboardPage.tsx)
- RANKING_RATE_MS 2000ms + batch por purchaseId (portal-preload.js)
- Filas de ranking processadas em paralelo por compra (antes serial por item)
- Latência VPS Finlândia→Serpro: ~1000ms (HTTPS)
- Latência frontend (portal-preload.js): ~50ms (HTTP)
- Latência de processamento interno: ~1ms
- 18+ salas monitoradas simultaneamente
- Ranking queue: batches paralelos por purchaseId reduzem ciclo total de 26s para ~6s

## Próximos Passos Possíveis
- [ ] Migrar VPS da Finlândia para Locaweb SP (Brasil) para reduzir latência de 1000ms para ~10-50ms
- [ ] Contratar Locaweb VPS 2GB (2 vCPUs, 60GB SSD, R$47,90/mês) ou VPS 4GB (R$115,90/mês)
- [ ] Backup completo da VPS atual antes da migração
- [ ] Após migração: reduzir war polling de 250ms para 80-100ms (sem risco de 429 no Brasil)
- [ ] Remover redundant `_adaptiveLoop` do frontend portal-preload.js
- [ ] Avaliar se 2GB RAM é suficiente para PostgreSQL + backend antes de migrar

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

## Implementado (v3.8.140)

### 1. Ranking queue em BATCH por purchaseId (`portal-preload.js`)
**Antes:** `_rankingQueue` processava 1 item a cada 2000ms. Com 13 itens em 18 salas, um ciclo completo levava ~26s. Cada item disparava captcha + API call sequencialmente.

**Arquivo:** `electron/portal-preload.js:514-543`

**Solução:** 
- `pendingRankingTarget` (single) → `pendingRankingTargets[]` (array) — suporta múltiplos targets simultâneos
- Queue processor agora agrupa TODOS os itens da mesma compra e processa o lote em paralelo
- `triggerRankingFetch()` faz `push` ao array; fresh-captcha handler consome via `.shift()`
- Um captcha por item, todos disparados simultaneamente
- Rate limit de 2000ms é **entre lotes** (compras diferentes), não entre itens
- Limpeza automática de targets órfãos se captcha falhar

**Impacto:** 13 itens em 3 compras → ~6s (antes 26s). 4x mais rápido.

### 2. Limpeza de versões antigas na VPS (v3.8.140)
**Antes:** 1.6GB de versões acumuladas (v3.8.126 a v3.8.139) em `/var/www/polaryon/storage/download/`.

**Solução:** Mantido apenas v3.8.139 (fallback) + v3.8.140 (atual). 1.36GB liberados.

### 3. VPS Finlândia → Locaweb SP (CONCLUÍDO v3.8.140-141)
- Nova VPS Locaweb SP (191.252.93.79) ativa com Node.js 20.20.2, PostgreSQL 16, Nginx 1.24, PM2, HTTPS (Let's Encrypt)
- DNS polaryon.com.br atualizado e propagado
- Google OAuth corrigido (clientId real no .env)
- VPS Finlândia (204.168.151.231) offline/inatingível

**Latência medida (Locaweb SP → Serpro HTTS):**
- Média: **78ms** (min 69ms, max 89ms, 5 amostras)
- Antiga Finlândia: ~1000ms
- **Melhoria: ~13x mais rápido**

## Implementado (v3.8.141)

### 1. `_adaptiveLoop` redundante removido (`portal-preload.js`)
**Antes:** Loop de polling adaptativo no frontend (guerra 300ms, normal 3s) fazia HTTP direto ao Serpro, duplicando o trabalho do backend.

**Arquivo:** `electron/portal-preload.js:1703-1817`

**Solução:** Removido. Dados chegam via WebSocket em tempo real + XHR interceptor. Backend (bidding-runner.js) já faz polling adaptativo completo com detecção de guerra.

### 2. War polling reduzido: 250ms → 80ms (`bidding-runner.js`)
**Antes:** `nextInterval = 250` (Anti-429 conservador para Finlândia com ~1000ms de latência).

**Arquivo:** `electron/bidding-runner.js:977`

**Solução:** `nextInterval = 80` — Agora que a VPS está no Brasil (Locaweb SP, ~78ms de latência), o risco de 429 é muito menor. Polling mais agressivo = reação mais rápida a lances concorrentes.

### 3. War polling agressivo: 80ms → 50ms (`bidding-runner.js:977`)
**Solução:** Reduzido para 50ms em modo guerra. Locaweb SP + ~78ms latência → risco 429 baixo.

### 4. Debounce WS removido (`portal-preload.js:1051`)
**Antes:** Debounce de 200ms no repasse de dados WebSocket para o backend (para reduzir IPC traffic).

**Solução:** Removido completamente. Cada mensagem WS é repassada instantaneamente. IPC é rápido (<1ms), 200ms de latência não se justifica.

### 5. bidAgent turbinado (`bidding-runner.js:1189-1206`)
**Antes:** `maxSockets=4, keepAliveMsecs=60000` — socket esfriava após 60s sem lance.

**Solução:** `maxSockets=6, keepAliveMsecs=600000` + ping periódico GET a cada 30s no host Serpro para manter socket aquecido. Elimina ~90ms de handshake TCP+TLS em lances esporádicos.

### 6. Captcha refresh mais frequente (`bidding-runner.js:18`)
**Antes:** Renovava captchas a cada 30s.

**Solução:** Reduzido para 15s — menos chance de captcha expirado em modo guerra.

### 7. Frontend loop 50ms → 20ms (`BiddingDashboardPage.tsx:533`)
**Antes:** Loop de decisão do sniper frontend a cada 50ms.

**Solução:** Reduzido para 20ms — decisões mais rápidas, ~25ms a menos de latência por ciclo.
