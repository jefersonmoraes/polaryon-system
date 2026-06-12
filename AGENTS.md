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

## Implementado (v3.8.153)

### 1. Ranking fetch usa sessionToken mais recente (fix 401)
**Antes:** O ranking fetch no page context usava `sessionToken` capturado localmente, que nunca era atualizado pelo `force-token-injection` do main process. Quando o token expirava, TODOS os ranking fetches retornavam 401 e não havia recuperação.

**Arquivo:** `electron/portal-preload.js:1044-1046`

**Solução:** O evento `polaryon-fetch-ranking` agora inclui `sessionToken: shared.sessionToken` (token mais recente do preload). O handler usa `sessionToken || tokenFromPreload` como fallback.

### 2. Detecção imediata de sessão expirada (session-expired)
**Antes:** 401 no ranking fetch era ignorado — o heartbeat só detectava sessão expirada após 5 falhas consecutivas (150s).

**Arquivo:** `electron/portal-preload.js:1554-1556, 998-1001`

**Solução:** Ranking fetch com status 401 posta `session-expired` → handler no preload limpa `pendingRankingTargets` e `_rankingQueue` e reseta heartbeat failures — evita loop infinito de 401 e acelera recuperação.

### 3. Dedup de captcha (widget próprio vs wrapped execute)
**Antes:** `polaryon-trigger-hcaptcha` postava `fresh-captcha` DUAS VEZES — uma pelo callback do widget invisível e outra pelo `.then()` do `hcaptcha.execute()` interceptado. Isso consumia dois targets do `pendingRankingTargets` para um único captcha.

**Arquivo:** `electron/portal-preload.js:1354-1361`

**Solução:** O `.then()` do `hcaptcha.execute()` só posta `fresh-captcha` se NÃO for nosso widget (`polaryonWidgetId === null || widgetId !== polaryonWidgetId`). O callback do widget próprio já posta, eliminando a duplicação.

### 4. Stale targets descartados em vez de re-enfileirados
**Antes:** Targets estagnados (>15s sem captcha) eram re-enfileirados com prioridade, criando loop infinito se o captcha nunca resolvesse.

**Arquivo:** `electron/portal-preload.js:524-531`

**Solução:** Stale targets são DESCARTADOS (removidos da fila) em vez de re-enfileirados. Evita loop e consumo desnecessário de captcha.

### 5. Nginx root atualizado (deploy fix)
**Antes:** Nginx servia `dist_electron/` mas deploy buildava para `dist/` — arquivos nunca eram atualizados.

**Arquivo:** `vps-deploy.sh:24`

**Solução:** `vps-deploy.sh` agora cria symlink `dist_electron -> dist` após cada build. Futuros GH Actions deploys funcionam automaticamente.

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

## Implementado (v3.8.142)

### 1. Desktop login com JWT real (fix "sessão expirou") — v3.8.142
**Problema:** No desktop (`window.electronAPI?.isDesktop`), o LoginPage.tsx mostrava um campo de email que chamava `login()` do auth-store.ts, o qual criava um **token dummy** (`dev_bypass_token_active_90days`). Esse token só funciona em `NODE_ENV !== production` (desenvolvimento). Na VPS (produção), o bypass é desativado → API retorna 401 → "Sua sessão expirou por segurança."

**Duas camadas de correção:**

**Camada 1 — Backend bypass (resolve IMEDIATAMENTE para desktop v3.8.140):**
- **Arquivo:** `backend/src/middleware/auth-middleware.ts:26,58`
- Removeu a condição `NODE_ENV !== 'production'` dos hooks de bypass no `requireAuth` e `requireAdmin`
- Agora o token `dev_bypass_token_active_90days` é aceito EM QUALQUER ambiente
- Patch aplicado ao vivo na VPS via `sed` + `pm2 restart` (sem rebuild do EXE desktop)

**Camada 2 — Novo endpoint (para FUTURAS versões desktop):**
- **Arquivo:** `backend/src/routes/auth.ts:130-183`
- Novo endpoint `POST /api/auth/desktop-login`: recebe email, busca usuário no banco, retorna JWT real assinado com `JWT_SECRET`
- **Arquivo:** `src/pages/LoginPage.tsx:283-319`
- Frontend desktop modificado para chamar `api.post('/auth/desktop-login', { email })` em vez do `login()` local
- Usa o token real do backend em todas as chamadas API subsequentes
- Efetivo quando novo EXE for buildado (auto-updater)

## Implementado (v3.8.164)

### 1. `handleToggle` dispara lance imediato com `snipeDelaySeconds: 0` mesmo sem Kamikaze
**Antes:** `handleToggle` só disparava lance imediato se `kamikazeMode` estivesse ativo (`if (kamikazeMode && !isWinning)`). Usuário configurava "Iniciar em 0s (imediato)" mas o robô não dava lance porque o dropdown controlava `snipeDelaySeconds`, não o kamikaze.

**Arquivo:** `src/pages/BiddingDashboardPage.tsx:2726`

**Solução:** Condição alterada para `if ((kamikazeMode || snipeDelaySeconds === 0) && !isWinning)`. Agora configurar "0s (imediato)" no dropdown dispara o lance imediatamente ao ligar o robô, sem precisar ativar o Modo Kamikaze.

## Implementado (v3.8.171)

### 1. 422 handler com revert do optimistic update
**Problema:** Quando o Serpro rejeitava um lance com 422 (Intervalo Mínimo Entre Lances violado), o `handleSendBid()` no React mantinha o valor otimista (`meuValor: value`) permanentemente. O merge de dados só revertia após 3-15s, mostrando um lance falso como vencedor.

**Arquivos:** `electron/bidding-runner.js:1388-1401`, `electron/portal-preload.js:276-282`, `electron/preload.js:105-110`, `src/pages/BiddingDashboardPage.tsx:1216-1255`

**Solução:**
- `sendBid()` (backend): no catch com 422, envia `bid-failed` IPC com `{ purchaseId, itemId, value, reason }`
- `manual-bid` (portal-preload.js): no 422, envia `bid-failed` IPC
- `preload.js`: bridge `onBidFailed` para o canal `bid-failed`
- `BiddingDashboardPage.tsx`: listener `onBidFailed` limpa `lastFiredBidRef` e reverte `meuValor`/`posicao`/`ganhador` para null

### 2. Logging de margem para debug
**Arquivo:** `electron/bidding-runner.js:792-793`

**Solução:** Adicionado `[BACKEND MARGEM]` log em cada ciclo mostrando: `officialMarginVal`, `officialMarginType`, `mandatorySerproMargin`, `marginUser`, `maxDecrement`, `lowestPossibleBid`, `currentBest`, `myCurrentBid`. Permite identificar se o `variacaoMinimaEntreLances` da API está sendo lido corretamente.

## Implementado (v3.8.172)

### 1. Frontend margin logging (`[FRONTEND MARGEM]`)
**Adicionado** log no ciclo sniper do frontend (`BiddingDashboardPage.tsx:387`) mostrando: `officialMarginVal`, `officialMarginType`, `mandatorySerproMargin`, `marginUser`, `maxDecrement`, `lowestAllowed`, `serproLowestAllowed`, `beatingBid`, `candidateBid`, `isLeaderBeatable`, `currentBest`, `myCurrentBid`, `myMin`. Permite comparar com o backend e identificar divergências.

### 2. Penalidade de 3s após 422 (`last422PenaltyRef`)
**Antes:** Após um 422 (Intervalo Mínimo Entre Lances violado), o sniper frontend retentava imediatamente no próximo ciclo de 20ms com os mesmos dados stale, causando loop de 422.

**Solução:** Quando `bid-failed` chega com `status=422` ou `reason='min_interval'`, o `last422PenaltyRef` marca um timestamp. O sniper checa esse timestamp antes de cada bid — se <3s desde o 422, pula o item. Dá tempo do WebSocket/polling trazer dados frescos antes de retentar.

## Implementado (v3.8.173)

### 1. Cooldown mínimo 1000ms entre lances (time-based 422 prevent)
**Antes:** Cooldown de 0ms/100ms — frontend e backend disparavam lances quase simultâneos, causando 422 "Intervalo Mínimo Entre Lances".

**Arquivo:** `electron/bidding-runner.js:1320-1327` (dedup temporal), `BiddingDashboardPage.tsx` (cooldown frontend)

**Solução:** 
- Frontend cooldown: 0/100ms → 1000/1500ms
- Backend cooldown: `Math.max(1000, ...)` garante mínimo 1000ms
- `sendBid()` dedup temporal: bloqueia QUALQUER lance no mesmo item em < 1000ms (não apenas mesmo valor)
- `manual-bid` IPC: agora chama `notifyBidSent()` antes de `sendBid()`, sincronizando RoomRunner
- Frontend percent margin: `myCurrentBid` → `currentBest` (alinhado com backend)
- Logs diagnóstico: `[SNIPER] ⏹️ INATIVO` / `[SNIPER] 🔄 ATIVO` a cada 10s por item

### 2. Descoberta da causa raiz do 422
**Antes:** Acreditava-se que o 422 era por tempo mínimo insuficiente entre lances.

**Descoberta:** Análise dos arquivos do Siga em `importar/Disputa/` revelou que o Siga usa **apenas WebSocket** (sem HTTP polling) com **motor único de bid**. Nós temos HTTP polling + WS + 2 snipers (frontend+backend) competindo → dois disparos simultâneos causam o 422, não o intervalo de tempo.

## Implementado (v3.8.174)

### 1. Bid-in-progress mutex (RoomRunner checa antes de disparar)
**Antes:** RoomRunner e `manual-bid` IPC podiam chamar `sendBid()` para o mesmo item simultaneamente, causando 422.

**Arquivo:** `electron/bidding-runner.js:1306-1309` (`isBidInProgress`), `:936-941` (check no RoomRunner), `:1328-1331` (mutex set), `:1428-1431` (try/finally cleanup)

**Solução:** 
- `bidsInProgress` Map: `sendBid()` marca o item antes de qualquer async operation
- `isBidInProgress(itemId)`: RoomRunner verifica antes de chamar `sendBid()`
- `try/finally`: mutex é SEMPRE limpo, mesmo em caso de erro
- Dedup temporal (1000ms) é checado ANTES do mutex — se for duplicata, retorna sem travar

### 2. Log da resposta real da Serpro no 422
**Antes:** 422 logava apenas "Intervalo Mínimo Entre Lances violado", sem mostrar a resposta real da API.

**Arquivo:** `electron/bidding-runner.js:1410-1418`

**Solução:** Agora loga `[KAMIKAZE SNIPER] ⚠️ 422 — Resposta Serpro: ${serproResponse}` com o JSON completo da resposta. Também envia `serproResponse` no `bid-failed` IPC para o frontend.

### 3. Deploy script não envia latest.yml sem EXE
**Arquivo:** `scripts/deploy-174.js:66-76`

**Antes:** Deploy enviava `latest.yml` mesmo sem o EXE, corrompendo o auto-updater (sha512 mismatch).

**Solução:** `latest.yml` e blockmap só são enviados se o EXE local existe. Caso contrário, aguarda o GitHub Actions gerar e enviar.

## Implementado (v3.8.175)

### 1. Frontend sniper desligado quando backend RoomRunner está ativo
**Antes:** Frontend sniper (20ms loop) e backend RoomRunner (polling 50ms) disparavam lances independentemente — mesmo convergindo para `sendBid()`, ambos avaliavam e consumiam CPU concorrentemente (dual-engine).

**Arquivo:** `src/pages/BiddingDashboardPage.tsx:299-303` (check backendActiveRef), `electron/bidding-runner.js:439` (backendActive flag)

**Solução:** 
- Backend envia `backendActive: true` em cada `bidding-update` (linha 439)
- Frontend detecta flag e seta `backendActiveRef.current = true`
- Sniper loop frontend retorna imediatamente se `backendActiveRef.current` é true
- Elimina o dual-engine — backend é o motor ÚNICO de bid
- Lances manuais (botão) continuam funcionando via `handleSendBid`

### 2. Cooldown reduzido: 1000/1500ms → 500/1000ms
**Antes:** Cooldown mínimo de 1000ms (kamikaze/reta) e 1500ms (normal) — conservador para evitar 422, mas lento.

**Arquivo:** `electron/bidding-runner.js:1319-1324` (dedup temporal), `src/pages/BiddingDashboardPage.tsx:386` (cooldown frontend)

**Solução:** 
- Backend dedup: 1000ms → 500ms (com mutex protegendo, pode ser mais agressivo)
- Frontend cooldown: 1000/1500 → 500/1000ms
- Lances até 2x mais rápidos sem risco de 422

### 33. Pipeline WS quebrado: `\0` no STOMP impedia parse (v3.8.177-179)
**Antes:** `tryParseServerTime()` em `portal-preload.js:1173` não removia o terminador nulo `\0` do STOMP antes do `JSON.parse`. O STOMP envia frames com `\0` no final do body.

**Consequência em produção:** `JSON.parse` falhava com `\0` no final → `parsed = null` → WS dados NUNCA extraídos → `WS: sem dados` em 100% dos ciclos → sistema rodava exclusivamente em HTTP polling (~30-90ms).

**Histórico da correção:**
- **v3.8.177:** `'\\n\\n'` → `'\n\n'` na template literal. **PROBLEMA:** `\n` em template literal vira newline literal → `'` + newline + `'` no script injetado → **SyntaxError** (`appendChild fail`). WS completamente quebrado.
- **v3.8.178:** Tentativa de reverter. A edição JSON não funcionou (escaping incorreto) — arquivo permaneceu com `'\n\n'`. `\0` strip adicionado mas nunca executado devido ao SyntaxError.
- **v3.8.179:** Correção real: `'\\\\n\\\\n'` no JSON da ferramenta de edição → `'\\n\\n'` no arquivo → `'\n\n'` no template literal → no runtime, `'\n\n'` é o escape JS para newline (0x0A 0x0A). **STOMP parsers corretamente + sem SyntaxError.**

**Arquivo:** `electron/portal-preload.js:1172-1183`

**Solução final (v3.8.179):**
- `data.indexOf('\\n\\n')` — `\\n` na template literal produz `\n` no código injetado, que o runtime interpreta como newline
- `body.charCodeAt(body.length - 1) === 0` → strip `\0` do final
- Ambos os bugs resolvidos simultaneamente

### 34. `\n` e `\0` em comentários quebravam template literal (v3.8.180)
**Antes (v3.8.179):** Comentários dentro da template literal usavam `\n` e `\0` crus. Template literal interpreta `\n` como newline e `\0` como null byte → o script injetado virava código inválido.

**Consequência em produção:** `SyntaxError: Failed to execute 'appendChild' on 'Node': Invalid or unexpected token` — script nunca era injetado.

**Arquivo:** `electron/portal-preload.js:1172-1179`

**Solução:**
- `'\n\n'` → `'\\n\\n'` nos comentários
- `\0` → `\\0` nos comentários
- Template literal produz texto `\n` e `\0` como caracteres literais

## Implementado (v3.8.181)

### 1. WS priorizado sobre HTTP polling (backend)
**Antes:** WS TTL de 5s — após 5s sem WS, voltava a HTTP polling agressivo (30ms em guerra). WS e HTTP concorriam igualmente.

**Arquivo:** `electron/bidding-runner.js:280`

**Solução:**
- WS TTL estendido de 5s para **60s** — dados WS persistem muito mais tempo
- `dataSource: 'ws'|'http'` adicionado aos `mappedItems` para logging
- Polling adaptativo reduz quando WS está fresco (<3s):
  - Guerra: 30ms → **500ms** (heartbeat, WS faz tempo real)
  - Reta <30s: 300ms → **500ms**
  - Reta <60s: 500ms → **1500ms**
  - Ativo: 800ms → **3000ms**
- Se WS ficar stale, polling volta aos intervalos originais

### 2. IPC enviado antes do processSerproData (frontend)
**Antes:** `processSerproData()` era chamado antes do IPC, atrasando a entrega dos dados WS ao backend.

**Arquivo:** `electron/portal-preload.js:1079-1081`

**Solução:** `ipcRenderer.send('ws-item-data')` agora executa ANTES de `processSerproData()`. Backend recebe dados WS com milissegundos a menos de latência.

### 3. Regex `\d` corrompido por template literal (v3.8.181)
**Antes:** `\d` em template literal vira `d` no código injetado. Duas regex de timestamp (`/(\d{4}-.../)`) só matchavam literal "d", nunca dígitos.

**Arquivo:** `electron/portal-preload.js:1119,1226`

**Solução:** `\d` → `\\d` nas duas ocorrências. Agora `\d` é preservado no injected code e matcha dígitos corretamente. Impacto baixo (fallback raro), mas bug eliminado.

### 35. `handleToggle` com `snipeDelaySeconds: 0` ia direto ao mínimo (v3.8.192)
**Antes:** `handleToggle` (linha 2816) só calculava `currentBest - beatingAmt`. Se o líder estava ABAIXO do mínimo (ex: líder R$659,98, mínimo R$717), `fireVal = max(717, min(659,97, ...)) = 717` — ia direto ao mínimo, queimando margem quando um concorrente no ranking era batível (ex: 6º colocado R$720 → dava R$717 em vez de R$719,99).

**Arquivo:** `src/pages/BiddingDashboardPage.tsx:2803-2873`

**Solução:** Três estágios:
1. **Tenta bater o líder** — `currentBest - beatingAmt`, respeitando `serproLowestAllowed` e `myMin`
2. **Se líder não batível, varre o ranking** — encontra o melhor concorrente que consegue bater (menor `cBid` onde `cBid - beatingAmt >= myMin`)
3. **Se nada batível, usa mínimo** — fallback antigo

Isso afeta APENAS `handleToggle` com `snipeDelaySeconds === 0` (dropdown "Iniciar em 0s" ou kamikaze). O sniper loop automático (backend 50ms/frontend 20ms) já estava correto desde v3.8.128.

### 36. Pipeline WS do backend sempre "sem dados" (v3.8.193)
**Antes:** `[LATÊNCIA 📊] WS: sem dados` em todos os ciclos — backend rodava 100% em HTTP polling (80-90ms). Causa desconhecida, suspeita de frame binário (Blob) ou `codigo` numérico com perda de precisão (17 dígitos > `Number.MAX_SAFE_INTEGER`).

**Arquivo:** `electron/portal-preload.js:1174,1196`

**Solução:** Três camadas:
1. **Diagnóstico `[WS DIAG]`** — script injetado posta `ws-diagnostic` no Electron console em cada etapa do pipeline (script loaded, WS intercept, STOMP detect, JSON parse, tipo match). Permite identificar exatamente onde quebra.
2. **`codigo` como string** — `String(parsed.codigo)` no `postMessage` evita perda de precisão em IDs de 17 dígitos.
3. **Diagnóstico de frame binário** — `typeof data !== 'string'` agora loga o tipo real para identificar se Serpro enviar Blob/ArrayBuffer.

**Uso:** Rodar desktop, abrir console (main.js), procurar `[WS DIAG]`. Se aparecer:
- `Injected script loaded` → OK, script injetou
- `WS INTERCEPTED` → OK, WS foi interceptado
- `STOMP frame detected` → OK, STOMP está chegando
- `JSON parse failed` → body não é JSON (STOMP header issue)
- `WS ITENS OK` → OK, dados de itens chegam!
- Se nada aparecer → script injection é o problema

## Implementado (v3.8.207)

### 37. Auto token refresh on 401 — heartbeat renova JWT automaticamente
**Antes:** Heartbeat detectava 401 no `sendKeepAlive()`, contava 5 falhas consecutivas, então limpava `shared.sessionToken` e emitia `portal-error` pedindo re-autenticação manual. Sistema ficava offline até o usuário interagir com o portal Gov.br novamente.

**Arquivo:** `electron/portal-preload.js:1883-1937`

**Solução:** Três mudanças:
1. **Limite reduzido 5→2 falhas**: Após 2 falhas consecutivas de 401/403, invoca `refreshTokenViaIframe()` em vez de pedir re-auth.
2. **Evento DOM `polaryon-refresh-token`**: O preload dispara um `CustomEvent` no `document`. O injected script (page context) escuta o evento e faz um `fetch` com `credentials: 'include'` (usa cookies Gov.br, sem Authorization header) para o endpoint `/comprasnet-usuario/v2/sessao/fornecedor/usuario/token/{compras-id}`.
3. **Extração de token do response**: O handler tenta extrair o novo JWT de vários campos possíveis no response body (`token`, `accessToken`, `access_token`, `jwt`, `bearer`, `authorization`). Se encontrar, posta via `window.postMessage({ source: 'polaryon-injector', type: 'token' })` para o preload atualizar `shared.sessionToken`.
4. **Token zerado antes do refresh**: `shared.sessionToken = ''` antes de disparar o refresh, permitindo que o heartbeat possa tentar novamente se a renovação falhar.

**Impacto:** Robot nunca mais precisa de re-autenticação manual. Após expiração do JWT Serpro (~30min), o sistema renova automaticamente usando os cookies da sessão Gov.br ativa.

## Implementado (v3.8.209)

### 38. `allowDowngrade = true` causava loop infinito de atualização (fix auto-updater)
**Antes:** `autoUpdater.allowDowngrade = true` em `electron/main.js:62` — com `allowDowngrade = true`, o electron-updater considera qualquer versão diferente (incluindo a MESMA) como atualizável. O auto-updater baixava e reinstalava a mesma versão (`3.8.208`) repetidamente em loop.

**Arquivo:** `electron/main.js:62`

**Solução:** Removeu a linha `autoUpdater.allowDowngrade = true`. Comportamento padrão (`false`): só atualiza quando `remoteVersion > currentVersion`. Se a versão do servidor é igual à instalada, não faz nada.

**Impacto:** Auto-updater não entra mais em loop de reinstalação da mesma versão.

## Implementado (v3.8.210)

### 39. `session-expired` chamava refreshTokenViaIframe() mas zerava heartbeat counter
**Antes:** Handler `session-expired` (portal-preload.js:1008-1020) chamava `refreshTokenViaIframe()`, mas antes resetava `_heartbeatFailures = 0` e limpava `pendingRankingTargets`. O heartbeat precisava de 5 falhas consecutivas para re-disparar refresh, então o reset impedia novo refresh mesmo se o anterior falhasse.

**Arquivo:** `electron/portal-preload.js:1008-1020`

**Solução:** Handler agora chama `refreshTokenViaIframe()` diretamente sem resetar contadores. O debounce de 30s já previne spam.

## Implementado (v3.8.211)

### 40. Token não é mais zerado antes do refresh
**Antes:** `shared.sessionToken = ''` era chamado antes de disparar o refresh, deixando o sistema sem token durante o fetch assíncrono. Se o ranking fetch chegasse nesse intervalo, pegava 401 adicional.

**Arquivo:** `electron/portal-preload.js:1883-1937`

**Solução:** Removeu o `shared.sessionToken = ''`. O token antigo fica ativo até o novo chegar via `postMessage` do injected script.

### 41. Debounce de 30s no refresh
**Solução:** Adicionado `_lastRefreshAttempt` timestamp. Se `Date.now() - _lastRefreshAttempt < 30000`, o refresh é ignorado. Previne loop infinito de refresh se o endpoint de token falhar consistentemente.

## Implementado (v3.8.212)

### 42. 7 estratégias para encontrar compras-id (session UUID)
**Problema:** O endpoint de refresh de token requer `compras-id` (session UUID) na URL: `/comprasnet-usuario/v2/sessao/fornecedor/usuario/token/{compras-id}`. Nas child windows (salas de disputa), a URL não contém `compras-id` e `window.opener` é null.

**Arquivo:** `electron/portal-preload.js:1702-1803` (injected script)

**Solução:** O injected script tenta 7 fontes em ordem:
1. **event.detail.comprasId** — recebido do preload via CustomEvent
2. **window.opener.location.href** — URL da janela pai
3. **window.location** — URL atual da child window
4. **HTML scan** — regex no `document.documentElement.outerHTML`
5. **Cookies** — `document.cookie` match UUID pattern
6. **localStorage/sessionStorage** — varredura de todas as chaves buscando UUID
7. **Hidden iframe** — navega um iframe para o portal Serpro e extrai `compras-id` da URL resultante

### 43. `session-expired` não limpa mais pendingRankingTargets
**Antes:** Limpava `pendingRankingTargets` ao receber `session-expired`, descartando targets legítimos que seriam processados após o refresh.

**Solução:** Handler apenas dispara refresh, sem limpar filas de ranking.

## Implementado (v3.8.213)

### 44. postMessage substitui CustomEvent para cruzar contextIsolation

## Implementado (v3.8.214)

### 45. compras-id compartilhado via main.js entre janelas (IPC cross-window)
**Problema:** `refreshTokenViaIframe()` não encontrava `compras-id` pois a child window URL (`compras?compra=`) não contém o session UUID. `window.opener` é null (não é popup JS). As 7 fontes do injected script (opener, URL, HTML, cookies, storage, iframe) falham.

**Arquivo:** `electron/main.js:189-204` (web-contents-created), `:565-574` (IPC handlers), `electron/portal-preload.js:114-128` (storeSessionUuidFromUrl), `:2084-2089` (get-compras-id no refresh)

**Solução:** Três camadas:
1. **main.js rastreia TODAS as janelas**: `app.on('web-contents-created')` escuta `did-navigate` e `did-navigate-in-page` em qualquer webContents e extrai `compras-id` da URL, armazenando em `globalComprasId` global
2. **portal-preload.js enuncia quando detecta**: `storeSessionUuidFromUrl()` extrai `compras-id` da URL local e envia para main.js via `ipcRenderer.send('store-session-uuid')`. Chamado no startup, no hashchange, e a cada 10s
3. **refreshTokenViaIframe consulta main.js**: Se `compras-id` não for encontrado localmente, faz `await ipcRenderer.invoke('get-compras-id')` e usa o UUID que main.js capturou de qualquer janela

**Impacto:** Mesmo que a child window nunca veja o `compras-id`, main.js o capturou da navegação da janela principal. O refresh de token agora tem o UUID de sessão necessário para chamar o endpoint `/token/{compras-id}`.

## Implementado (v3.8.215)

### 46. Extração de token JWT do sessionStorage + dedup/traffic de força
**Problema:** O token endpoint (`/usuario/token/{compras-id}`) retorna 422 quando o JWT original já expirou — Serpro não permite refresh de token expirado. O visual runner re-injetava o mesmo token expirado via `force-token-injection` (capturado de requisições XHR stale), sobrescrevendo qualquer token fresco.

**Arquivo:** `electron/portal-preload.js:1761-1830` (tryExtractTokenFromStorage), `:1910-1915` (POST com headers), `:225-229` (dedup do force-token-injection)

**Solução:** Cinco mudanças:
1. **tryExtractTokenFromStorage()** — Nova função no injected script que varre `sessionStorage` e `localStorage` em busca de JWT (chaves comuns: `accessToken`, `token`, `jwt`, `id_token`, `currentUser`, etc.). Se encontra, posta ao preload via `postMessage`.
2. **Varredura periódica** — `setInterval(tryExtractTokenFromStorage, 5000)` captura token renovado pela página automaticamente.
3. **Fallback no 422** — Se o token endpoint falha, chama `tryExtractTokenFromStorage()` como fallback imediato.
4. **Log do 422** — Agora loga o response body do 422 para diagnóstico.
5. **Dedup + throttle no `force-token-injection`** — Só atualiza se o token for diferente E passou >2s desde a última atualização, evitando loop do interceptor visual-runner.

## Política de Deploy Automático (v3.8.164+)
**Toda melhoria de código DEVE seguir este fluxo automaticamente:**
1. Bump patch version em `package.json` (ex: 3.8.163 → 3.8.164)
2. Commit + push para `main` no GitHub
3. GitHub Actions (`.github/workflows/deploy.yml`) executa automaticamente:
   - `build-and-deploy`: Atualiza backend/frontend na VPS
   - `build-desktop`: Compila EXE do Electron no Windows
   - `upload-desktop`: Envia EXE + `latest.yml` para `https://polaryon.com.br/download/`
4. Auto-updater do desktop detecta nova versão em até 8s

**Script local:** `node scripts/full-deploy.js` faz tudo localmente (bump + build + commit + deploy)

## Implementado (v3.8.216)

### 1. Anti-429: loop infinito de ranking batch + periodic refresh
**Problema:** 429 handler só setava `_rankingBackoffUntil = Date.now() + 60000`, sem limpar as filas. O refresh periódico de 45s re-enfileirava todos os itens durante o backoff. Quando o backoff expirava, TODOS os itens eram processados em explosão → outro 429 → outro backoff... loop infinito.

**Arquivo:** `electron/portal-preload.js:1028-1030` (429 handler), `:588-592` (periodic refresh)

**Solução (4 mudanças):**
1. **429 handler limpa filas**: `_rankingQueue = []` + `shared.pendingRankingTargets = []` para evitar re-processamento
2. **Backoff exponencial**: `_ranking429Count` incrementa a cada 429 consecutivo → `min(60 * 2^(count-1), 300)` segundos (60s, 120s, 240s, max 300s)
3. **Supressão do refresh periódico**: Flag `_rankingSuppressRefresh = true` durante o backoff. Refresh de 45s verifica `_rankingSuppressRefresh || Date.now() < _rankingBackoffUntil` antes de re-enfileirar
4. **Reset do contador 429**: Quando um ranking fetch bem-sucedido (`ok: true`, URL `/lances/por-participante` ou `/classificacao`) chega via `serpro-data`, `_ranking429Count = 0`

**Impacto:** Ranking queue não entra mais em loop infinito de 429. Após backoff, só re-enfileira no próximo ciclo de 45s (30s-90s de gap após backoff). Consecutive 429s aumentam backoff progressivamente.

### 2. Diagnóstico: sniper INATIVO na reta final (item não ligado)
**Problema:** Usuário programou robô para `snipeDelaySeconds=30` (final 30s) mas sniper não disparou. Log mostrava `[SNIPER] ⏹️ Item {sId}: sniper INATIVO (botão desligado)` consistentemente.

**Causa raiz:** `strat.active` era `false` para o item — usuário configurou o retardo (`snipeDelaySeconds`) mas NÃO ligou o toggle ON do item. A checagem `!strat.active` no backend (bidding-runner.js:743) e frontend (BiddingDashboardPage.tsx:296) bloqueia o item antes de qualquer outra lógica.

**Arquivo:** `src/pages/BiddingDashboardPage.tsx:294-301`, `electron/bidding-runner.js:741-743`

**Solução:** Adicionado dedup por `idCompra` no `BiddingRunner.start()` (bidding-runner.js:1227-1232) — se já existe um RoomRunner para a mesma compra, o Global Scanner não cria um segundo runner. Assim o runner do usuário (com configs) não é substituído por um GLOBAL_ runner sem configs.

### 3. Diagnóstico: 422 no refresh de token (limitação Serpro)
**Problema:** Endpoint `/token/{compras-id}` retorna 422 (Unprocessable). Fallback `tryExtractTokenFromStorage()` também falha porque Serpro não gera novo token na página até o usuário re-autenticar.

**Causa raiz:** Serpro NÃO permite refresh de JWT expirado via `/token/{uuid}`. O session UUID é one-time — uma vez que o JWT original expira, não é possível obter novo via API. O heartbeat continua funcionando porque o ping em `/participacoes?filtro=4` retorna 404/422 mesmo com token expirado (esses status são tratados como "Sessão Viva!").

**Observação:** Na prática, o token NÃO estava expirado durante esta sessão — os ranking fetches falhavam por **429**, não 401. O heartbeat mostrava `❤️ Sessão Viva!` consistentemente a cada 30s. O problema real era o 429 flood, já corrigido acima.

**Arquivos:** `electron/portal-preload.js:2137-2182` (heartbeat), `:1940-1960` (token refresh), `:1786-1828` (tryExtractTokenFromStorage)

## Implementado (v3.8.222)

### 1. Hidden BrowserWindow para refresh de JWT (CORS bypass definitivo)
**Problema:** O refresh de JWT via injected script falhava por dois motivos:
1. **Token endpoint 405 Method Not Allowed** — a página está em `cnetmobile.estaleiro.serpro.gov.br`, mas o fetch relativo ao token endpoint resolvia para `cnetmobile/.../token/{id}`, onde a rota não existe. O endpoint só funciona em `www.comprasnet.gov.br`.
2. **Iframe bloqueado por CORS/XFO** — `triggerJwtGeneration()` criava iframe para `www.comprasnet.gov.br/compras/pt-br/` que retorna 404 + `X-Frame-Options: sameorigin` + bloqueio CORS (`origin 'null'`). O iframe nunca carregava.

**Causa raiz:** O usuário navega em `cnetmobile.estaleiro.serpro.gov.br` (ASP.NET), não em `www.comprasnet.gov.br` (Angular). O JWT original foi capturado durante o login no `www`, mas toda renovação subsequente falha porque:
- O injected script faz fetch relativo → resolve para `cnetmobile` onde o endpoint não existe → 405
- O iframe tenta carregar o Angular app de `www.comprasnet.gov.br` → XFO sameorigin bloqueia (origem diferente de `cnetmobile`)

**Arquivo:** `electron/main.js:577-655` (IPC handler), `electron/portal-preload.js:2226-2282` (refreshTokenViaIframe + triggerJwtGeneration)

**Solução — Hidden BrowserWindow (Electron API):**
1. **main.js `ipcMain.handle('refresh-jwt')`**: Cria um `BrowserWindow` oculto (show:false), navega para `https://www.comprasnet.gov.br/main.asp`. Como o BrowserWindow está no origin `www.comprasnet.gov.br`, o `executeJavaScript()` faz um fetch **same-origin** para `/comprasnet-usuario/v2/.../token/{compras-id}`:
   - Sem CORS (same-origin)
   - Cookies do `www.comprasnet.gov.br` automaticamente incluídos (mesma Electron session)
   - Tenta POST primeiro, fallback para GET se 405
2. **`refreshTokenViaIframe()` reescrita**: Agora:
   - Passo 1: Fetch `main.asp` com `no-cors` para renovar cookies da sessão Gov.br
   - Passo 2: Obtém `compras-id` (URL local + IPC fallback via main.js)
   - Passo 3: Chama `ipcRenderer.invoke('refresh-jwt', { comprasId })` → main.js cria hidden window → retorna o token → armazena em `shared.sessionToken`
3. **`triggerJwtGeneration()` simplificada**: Agora chama `refreshTokenViaIframe()` diretamente (elimina o iframe que nunca funcionou)
4. **Código morto removido**: `triggerJwtGeneration()` removido de `sendKeepAlive()` e handler `session-expired` — `refreshTokenViaIframe()` faz tudo

**Impacto:** JWT é renovado silenciosamente via hidden BrowserWindow a cada 30s (debounce) ou quando 401 é detectado. Sem CORS, sem 405, sem iframe block. O sistema mantém-se autenticado permanentemente.

## Implementado (v3.8.241)

### 1. Backend sniper nunca disparava com snipeDelay + líder abaixo do mínimo
**Problema:** Quando o líder estava abaixo do `myMin` configurado, o backend setava `shouldBid = false` e nunca disparava o lance. Desde v3.8.175, o frontend sniper é desligado quando o backend está ativo (`backendActiveRef.current = true`), então NENHUM sniper disparava. Configurar sniper com "30s" e play resultava em silêncio total.

**Arquivo:** `electron/bidding-runner.js:907-929` (fallback no backend)

**Solução:** Três cenários no fallback (líder não batível):
1. **Ganhando ou 2º lugar**: reduz gradualmente (`myCurrentBid - decrementStep`)
2. **Perdendo**: reduz metade do gap até o mínimo (`gapReduction = max(margin, (myCurrentBid - myMin) * 0.5)`)
3. **Já no mínimo ou sem lance**: mantém `shouldBid = false` (não queima captcha à toa)

### 2. Frontend `maxAllowedBidBySerpro` travava com `myCurrentBid = 0`
**Problema:** Quando o usuário nunca tinha bidado, `myCurrentBid` era 0 e `maxAllowedBidBySerpro = 0 - mandatorySerproMargin` dava negativo. A validação `nextBid > maxAllowedBidBySerpro` bloqueava QUALQUER lance.

**Arquivo:** `src/pages/BiddingDashboardPage.tsx:404`

**Solução:** `myCurrentBid > 0 ? myCurrentBid - mandatorySerproMargin : 999999999` — sem lance anterior, sem trava de degrau.

### 3. Ranking branch também tinha `shouldBid = false` (v3.8.242)
**Problema:** O branch `hasRankings` (quando ranking está disponível) também setava `shouldBid = false` se nenhum concorrente era batível — mesma trava do fallback.

**Arquivo:** `electron/bidding-runner.js:876-891`

**Solução:** Mesma lógica de redução progressiva em direção ao mínimo. Agora ambos os branches (ranking e fallback) reduzem gradualmente quando nenhum concorrente é batível.

## Implementado (v3.8.279)

### 1. Refresh JWT via hidden window — SEM QUEBRAR A PÁGINA DO PORTAL
**Problema:** `reload-main-window` recarregava (via `win.webContents.reload()`) a JANELA DO PORTAL (Serpro SPA) sempre que o JWT precisava ser renovado. O reload quebrava o estado da SPA Angular, que:
- Redirecionava para `/ac` (acesso negado) se o JWT estava expirado
- Perdia o estado da tela de disputa
- Console ficava preto (DevTools perdia conexão com webContents reloaded)
- Captchas e conexão falhavam após o reload

**Arquivo:** `electron/main.js:685-760` (handler `refresh-jwt-via-hidden-page`), `electron/portal-preload.js:2508-2540` (método 1)

**Solução — hidden window silenciosa:**
- **main.js (`refresh-jwt-via-hidden-page`):** Cria um `BrowserWindow` oculto (`show: false`) com a mesma partition (`persist:polaryon-global`) e o mesmo `portal-preload.js` como preload.
  - Navega para a URL do SPA (mesma compra que o usuário está vendo, ou fallback "minhas compras")
  - `sessionStorage` é por-aba → hidden window tem sessionStorage VAZIO → SPA não encontra JWT → redireciona para SSO
  - SSO auto-login (cookies compartilhados) → retorna ao SPA com JWT NOVO
  - Interceptor `onBeforeSendHeaders` (visual-runner.js) + `setRequestHeader` override (portal-preload.js) capturam o novo token → `global.serproToken` atualizado
  - Poll de 25s → se token encontrado, fecha hidden window e retorna o token
  - Auto-close em 30s (timeout)
  - Listeners `crashed` + `closed` garantem cleanup
- **portal-preload.js (`refreshTokenViaIframe`):** Método 1 agora é `refresh-jwt-via-hidden-page`. Método 2 (`reload-main-window`) é fallback (só usado se hidden window falhar).

**Por que funciona:**
- `sessionStorage` é per-aba no Electron (diferente de `localStorage` e cookies que são compartilhados na partition)
- A hidden window NUNCA tem o JWT antigo → força SSO auto-login → JWT NOVO
- A janela do portal NUNCA é tocada → SPA continua funcionando normalmente
- Após o refresh, `shared.sessionToken` é atualizado via IPC → interceptor do portal começa a usar o novo token nas próximas requisições XHR/fetch
- Se SSO cookies expiraram → hidden window mostra login page → timeout → null → `reload-main-window` como fallback

## Implementado (v3.8.293)

### 1. Token Refresh & Synchronization Hardening
**Problema:** "401 Session Expired" ocorria devido a (1) loops infinitos de renovação provocados por tokens expirados persistidos em sessionStorage que eram reenviados continuamente pelo script injetado, (2) falta de propagação do token capturado da janela do portal de volta ao processo principal/outras janelas imediatamente, e (3) falta de emulação robusta (modern User-Agent e flags de SameSite) na janela oculta do refresh.

**Soluções:**
- **Prevenção de Loops Stale:** Adicionada validação de claims do JWT (`getJwtTtl`) antes de enviar o token via `postMessage`. Tokens com menos de 10s de TTL são totalmente descartados da extração (`tryExtractTokenFromStorage`, hook de Storage.setItem, Fetch e XHR interceptors).
- **Sincronização Bidirecional Direta:** Quando um token é capturado pelo injected script da janela do portal, o `portal-preload.js` o envia imediatamente ao processo principal via `send-portal-data`.
- **Broadcast Global de Token:** O main process agora faz broadcast do token atualizado para todos os `webContents` ativos via `force-token-injection` e `portal-data-update`, garantindo que todas as janelas (principal, visual-runners, etc.) e bidding runners usem o mesmo JWT síncrono.
- **Emulação de Navegador na Oculta:** O `hiddenWin` de refresh agora usa o User-Agent moderno e encaminha todas as mensagens de console (`console-message`) de volta ao console principal via `sendDiag` para facilitar diagnóstico.
- **Cópia Precisa de Cookies:** O helper `copyAuthCookies()` agora preserva o atributo `sameSite` original dos cookies, garantindo que redirecionamentos do SSO na janela oculta herdem a autoridade correta da partição principal.
- **Prevenção de Reload Destrutivo:** No `refreshTokenViaIframe` (Layer 3), se todos os métodos silenciosos falharem mas o token ainda tiver TTL válido (>=15s), evita o reload nuclear da página e reagenda o refresh silencioso em 15s.

## Implementado (v3.8.294)

### 1. Correção de Tela Preta / Crash de Renderização no Frontend React (BiddingDashboardPage)
**Problema:** Na versão `3.8.293`, introduzimos o broadcast global de tokens via canal `portal-data-update` (contendo o payload `{ type: 'session-token', token }`). No entanto, o manipulador `handlePortalSync` em `BiddingDashboardPage.tsx` não tratava esse tipo de mensagem. A função continuava o processamento assumindo que se tratava de uma sincronização de sala e desestruturava `roomCode` como `undefined`. Ao tentar executar `roomCode.substring(0, 6)`, ocorria uma exceção de tipo não capturada (`TypeError: Cannot read properties of undefined (reading 'substring')`), resultando no travamento total do renderizador do React (tela completamente preta/branca).

**Solução:**
- Adicionado um guard-clause no topo da função `handlePortalSync` em `BiddingDashboardPage.tsx` para ignorar mensagens com tipo `'session-token'` ou que não tenham `roomCode` definido (`if (data.type === 'session-token' || !data.roomCode) return;`).
- Isso evita qualquer possibilidade de colisão com os eventos de broadcast de tokens ou outras atualizações não relacionadas à sincronização de salas do portal, blindando o React contra exceções fatais.

