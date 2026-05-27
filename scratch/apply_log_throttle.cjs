const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/BiddingDashboardPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

// ─── 1. Adicionar lastLogRef após lastIntermediateBidRef ───────────────────
const target1 = `    const lastIntermediateBidRef = useRef<Record<string, { value: number; timestamp: number; duration?: number }>>({});`;
const replacement1 = `    const lastIntermediateBidRef = useRef<Record<string, { value: number; timestamp: number; duration?: number }>>({});
    // 🔇 THROTTLE DE LOGS (v4.3.0): Limita logs de estado a 1x/seg por item para evitar spam no console (lentidão visual)
    const lastLogRef = useRef<Record<string, number>>({});`;

if (content.includes(target1)) {
    content = content.replace(target1, replacement1);
    console.log("Substituição 1 (lastLogRef) aplicada.");
} else {
    console.log("ERRO: target 1 não encontrado.");
}

// ─── 2. Substituir log de "Posição ideal já garantida" com throttle ────────
const target2 = `                                    if (myCurrentBid <= idealBid) {
                                        console.log(\`[SNIPER] Posição ideal já garantida para o orçamento. Mantendo R$ \${myCurrentBid} (Lance ideal seria R$ \${idealBid} para bater concorrente de R$ \${targetCompetitorBid}).\`);
                                        return; // Pula este ciclo para economizar margem e CPU!`;
const replacement2 = `                                    if (myCurrentBid <= idealBid) {
                                        // 🔇 Throttle de log: só loga 1x por segundo por item para evitar spam no console
                                        const lastLogTime = lastLogRef.current[\`pos_\${sId}\`] || 0;
                                        if (Date.now() - lastLogTime >= 1000) {
                                            console.log(\`[SNIPER] Posição ideal já garantida para o orçamento. Mantendo R$ \${myCurrentBid} (Lance ideal seria R$ \${idealBid} para bater concorrente de R$ \${targetCompetitorBid}).\`);
                                            lastLogRef.current[\`pos_\${sId}\`] = Date.now();
                                        }
                                        return; // Pula este ciclo para economizar margem e CPU!`;

if (content.includes(target2)) {
    content = content.replace(target2, replacement2);
    console.log("Substituição 2 (throttle log 'Posição ideal') aplicada.");
} else {
    console.log("ERRO: target 2 não encontrado.");
}

// ─── 3. Substituir log de "Congelado por" com throttle ────────────────────
const target3 = `                                        console.debug(\`[SNIPER] Aguardando propagação do bid intermediário de R$ \${lastInter.value} (\${Math.round((Date.now() - lastInter.timestamp)/1000)}s atrás). Congelado por \${currentDuration/1000}s.\`);`;
const replacement3 = `                                        // 🔇 Throttle de log: só loga 1x por segundo por item para evitar spam no console
                                        const lastFreezeLog = lastLogRef.current[\`freeze_\${sId}\`] || 0;
                                        if (Date.now() - lastFreezeLog >= 1000) {
                                            const elapsed = Math.round((Date.now() - lastInter.timestamp)/1000);
                                            console.debug(\`[SNIPER] Aguardando propagação do bid intermediário de R$ \${lastInter.value} (\${elapsed}s atrás). Congelado por \${currentDuration/1000}s.\`);
                                            lastLogRef.current[\`freeze_\${sId}\`] = Date.now();
                                        }`;

if (content.includes(target3)) {
    content = content.replace(target3, replacement3);
    console.log("Substituição 3 (throttle log 'Congelado') aplicada.");
} else {
    console.log("ERRO: target 3 não encontrado.");
}

// ─── 4. Substituir log "[SNIPER BRAIN]" com throttle ─────────────────────
const target4 = `                if (currentTimeLeft <= 40 && currentTimeLeft > 0) {
                    console.debug(\`[SNIPER BRAIN] Item \${sId}: Tempo \${currentTimeLeft}s | Perdedor: \${item.posicao !== '1'}\`);
                }`;
const replacement4 = `                if (currentTimeLeft <= 40 && currentTimeLeft > 0) {
                    // 🔇 Throttle: só loga 1x por segundo por item
                    const lastBrainLog = lastLogRef.current[\`brain_\${sId}\`] || 0;
                    if (Date.now() - lastBrainLog >= 1000) {
                        console.debug(\`[SNIPER BRAIN] Item \${sId}: Tempo \${currentTimeLeft}s | Perdedor: \${item.posicao !== '1'}\`);
                        lastLogRef.current[\`brain_\${sId}\`] = Date.now();
                    }
                }`;

if (content.includes(target4)) {
    content = content.replace(target4, replacement4);
    console.log("Substituição 4 (throttle log 'SNIPER BRAIN') aplicada.");
} else {
    console.log("ERRO: target 4 não encontrado.");
}

// ─── 5. Substituir log "Nenhum concorrente batível" com throttle ──────────
const target5 = `                                        console.log(\`[SNIPER] Nenhum concorrente batível acima do mínimo R$ \${myMin}. Mantendo lance atual de R$ \${myCurrentBid} para economizar margem.\`);`;
const replacement5 = `                                        const lastNobeatLog = lastLogRef.current[\`nobeat_\${sId}\`] || 0;
                                        if (Date.now() - lastNobeatLog >= 2000) {
                                            console.log(\`[SNIPER] Nenhum concorrente batível acima do mínimo R$ \${myMin}. Mantendo lance atual de R$ \${myCurrentBid} para economizar margem.\`);
                                            lastLogRef.current[\`nobeat_\${sId}\`] = Date.now();
                                        }`;

if (content.includes(target5)) {
    content = content.replace(target5, replacement5);
    console.log("Substituição 5 (throttle log 'Nenhum concorrente') aplicada.");
} else {
    console.log("ERRO: target 5 não encontrado.");
}

// ─── 6. Adicionar telemetria de latência no disparo ───────────────────────
const target6 = `                                lastFiredBidRef.current[sId] = { value: nextBid, timestamp: Date.now() };`;
const replacement6 = `                                const bidFiredAt = Date.now();
                                lastFiredBidRef.current[sId] = { value: nextBid, timestamp: bidFiredAt };
                                // ⏱️ TELEMETRIA: mede latência desde o tick até o disparo
                                const tickLatency = bidFiredAt - (activeServerTime - currentServerOffset);
                                console.log(\`%c[SNIPER ⏱️ LATÊNCIA] Tick→Disparo: ~\${tickLatency > 0 && tickLatency < 5000 ? tickLatency : '<1'}ms | Item \${sId} | R$ \${nextBid}\`, 'color:#a855f7;font-weight:bold;');\`;`;

// Não vamos mexer no disparo para não quebrar nada, apenas garantimos que o log de disparo já existe e é claro
console.log("Substituição 6 (telemetria de latência) omitida - o log de disparo já é claro e não é spam.");

// Reconverte para CRLF
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log("\n✅ Otimizações de throttle de log aplicadas com sucesso!");
