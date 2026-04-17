const { ipcRenderer } = require('electron');

// 🛡️ MODO HÍBRIDO: INJEÇÃO DO "FANTASMA" NO MUNDO REAL (DOM)
window.addEventListener("message", (event) => {
    // Escuta as mensagens do nosso fantasma injetado na aplicação
    if (event.source === window && event.data && event.data.type === 'POLARYON_HYBRID_SPY') {
        const payload = event.data.payload;
        
        // Se capturamos um token ou dados brutos, mandamos pro Backend do Electron
        ipcRenderer.send('portal-hybrid-capture', {
            sessionId: mySessionId || 'UNKNOWN',
            action: payload.action,
            data: payload
        });
        
        // Log stealth local
        if (payload.action === 'TOKEN_GRABBED') {
             console.log("👻 [POLARYON] Token Capturado! Modo Híbrido armado.");
             window.polaryonAuthBearer = payload.token;
        }

        if (payload.action === 'API_DUMP' && payload.url) {
             // 🎯 CAPTURA DE ID UNIVERSAL (v2.1.23)
             // Tenta extrair o ID longo (10+ dígitos) de qualquer requisição à API
             const idMatch = payload.url.match(/\/v1\/(?:compras|disputas\/compras)\/(\d+)/);
             if (idMatch) {
                  const fullId = idMatch[1];
                  const yearMatch = payload.url.match(/\/v1\/(?:compras|disputas\/compras)\/\d+\/(\d{4})/);
                  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
                  
                  window.polaryonContext_PurchaseId = fullId;
                  window.polaryonContext_Year = year;

                  // Se ainda não temos a URL de itens, construímos a partir do ID capturado
                  if (!window.polaryonHybrid_ItemsUrl || window.polaryonHybrid_ItemsUrl.includes('/participacao')) {
                      // Detecta se é Dispensa ou Licitação pelo path original
                      const basePath = payload.url.includes('disputas') ? 'disputas/compras' : 'compras';
                      window.polaryonHybrid_ItemsUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa-externa/v1/${basePath}/${fullId}/${year}/itens?pagina=0&tamanhoPagina=100`;
                  }
             }

             // FILTRO CIRÚRGICO: Detecta se esta URL é a lista de itens real
             const isItemsList = (payload.url.includes('/itens') || payload.url.includes('/disputa')) && !payload.url.includes('/totalizadores');
             const isMetadata = payload.url.includes('/participacao') || payload.url.includes('/sessao') || payload.url.includes('/usuario');

             if (isItemsList && !isMetadata) {
                  // Força tamanhoPagina=100 para evitar limitação de tela
                  window.polaryonHybrid_ItemsUrl = payload.url.replace(/tamanhoPagina=\d+/, 'tamanhoPagina=100');
                  if (!window.polaryonHybrid_ItemsUrl.includes('tamanhoPagina')) {
                      window.polaryonHybrid_ItemsUrl += (window.polaryonHybrid_ItemsUrl.includes('?') ? '&' : '?') + 'tamanhoPagina=100';
                  }
                  
                  if (!window.polaryonHybrid_Active) {
                       startHybridEngine();
                  }
             }
        }
    }
}, false);

// 🚀 FASE 2: MOTOR DE TRAÇÃO FANTASMA (Adaptive Polling)
const startHybridEngine = () => {
    if (window.polaryonHybrid_Active) return;
    window.polaryonHybrid_Active = true;
    console.log("🔥 [POLARYON PHANTOM] Modo Combate Ativado! Polling adaptativo iniciado.");

    let apiHealthCounter = 0;

    const pollingLoop = async () => {
         // SCANNER DE REDE REATIVO: Se não temos URL, vasculhamos o histórico de rede do navegador
         if (!window.polaryonBadUrls) window.polaryonBadUrls = new Set();

         if (!window.polaryonHybrid_ItemsUrl) {
             try {
                 const resources = performance.getEntriesByType('resource');
                 const itemsResource = [...resources].reverse().find(r => 
                     (r.name.includes('/itens') || r.name.includes('/disputa')) && 
                     !r.name.includes('/totalizadores') &&
                     r.name.includes('/v1/compras/') &&
                     !window.polaryonBadUrls.has(r.name.split('?')[0])
                 );
                 if (itemsResource) {
                     window.polaryonHybrid_ItemsUrl = itemsResource.name;
                     console.log("👻 [POLARYON] Scanner de Rede Encontrou o Link Real:", itemsResource.name);
                 }
             } catch(e) {}
         }

         if (!window.polaryonAuthBearer || !window.polaryonHybrid_ItemsUrl) {
             setTimeout(pollingLoop, 2000);
             return;
         }

         try {
              // Navegação Camuflada: Percorre as páginas individualmente se necessário
              let allFetchedItems = [];
              let page = 0;
              let hasMore = true;
              
              // Limite de segurança para evitar loops (Máximo 5 páginas de 20 = 100 itens)
              while (hasMore && page < 5) {
                  const targetUrl = window.polaryonHybrid_ItemsUrl
                      .replace(/pagina=\d+/, `pagina=${page}`)
                      .replace(/tamanhoPagina=\d+/, 'tamanhoPagina=100');
                  
                  const res = await fetch(targetUrl, {
                       method: 'GET',
                       headers: {
                            'Authorization': window.polaryonAuthBearer,
                            'Accept': 'application/json, text/plain, */*'
                       }
                  });

                  if (!res.ok) {
                      if (res.status === 404 || res.status === 401 || res.status === 403 || res.status === 422) {
                           // Link Quebrado ou Expirado: Força re-escaneamento de rede
                           const baseBadUrl = targetUrl.split('?')[0];
                           if (!window.polaryonBadUrls) window.polaryonBadUrls = new Set();
                           if (res.status === 404) window.polaryonBadUrls.add(baseBadUrl);

                           window.polaryonHybrid_ItemsUrl = null;
                           if (res.status === 404) window.polaryonContext_PurchaseId = null;
                           window.polaryonAPIStatus = "⚠️ RE-SINCRONIZANDO...";
                           console.warn("💀 [POLARYON] Rota expirada (404/401). Scanner reativado. URL Blacklisted:", baseBadUrl);
                      }
                      break;
                  }

                  const rawText = await res.text();
                  if (!rawText || rawText.trim().length === 0) break;
                  
                  const data = JSON.parse(rawText);
                  const itemsArray = Array.isArray(data) ? data : (data.itens || data.items || []);
                  
                  if (itemsArray.length === 0) break;
                  allFetchedItems = [...allFetchedItems, ...itemsArray];

                  // Detecta se é a última página
                  const sizeMatch = targetUrl.match(/tamanhoPagina=(\d+)/);
                  const pageSize = sizeMatch ? parseInt(sizeMatch[1]) : 10;
                  if (itemsArray.length < pageSize) {
                      hasMore = false;
                  } else {
                      page++;
                      // Pequeno intervalo entre páginas para parecer humano
                      await new Promise(r => setTimeout(r, 50)); 
                  }
              }

              if (allFetchedItems.length > 0) {
                   if (!window.polaryonAllItems) window.polaryonAllItems = {};
                   allFetchedItems.forEach(item => {
                        // FILTRO INTELIGENTE (Adaptive Grooming): 
                        // Ignora itens que são apenas Títulos de Grupo (Ex: G1, G2...) para focar nos itens reais
                        const isGroupHeading = (item.identificador || "").startsWith('G') && (!item.posicaoParticipanteDisputa) && (!item.melhorValorFornecedor);
                        if (isGroupHeading) return; 

                        const melhorGeral = (item.melhorValorGeral ? (item.melhorValorGeral.valorInformado ?? item.melhorValorGeral.valorCalculado) : 0) || 0;
                        const melhorMeu = (item.melhorValorFornecedor ? (item.melhorValorFornecedor.valorInformado ?? item.melhorValorFornecedor.valorCalculado) : 0) || 0;
                        // v2.2.2: Blindagem Anti-Bug no Ranking (Prioriza posicao e corrige falsos positivos)
                        const pos = String(item.posicaoParticipanteDisputa || '').trim().toUpperCase();
                        let isWinner = false;
                        if (pos === '1' || pos === '1º' || pos === 'V' || pos === 'VENCEDOR' || pos === '1°') {
                            isWinner = true;
                        } else if (pos === '?' || pos === '') {
                            // Fallback se não vier posição: usa valor
                            if (melhorMeu > 0 && melhorMeu <= melhorGeral) isWinner = true;
                        }

                        // v2.2.1: ID Híbrido - Usa 'identificador' (ex: G1) se disponível, senão numero
                        const rawId = item.identificador || item.numero.toString();

                        window.polaryonAllItems[rawId] = {
                             itemId: rawId,
                             valorAtual: melhorGeral,
                             meuValor: melhorMeu,
                             isDispute: item.situacao === '1' || item.situacao === '2',
                             desc: item.descricao || ("Item " + (item.numero > 0 ? item.numero : rawId)),
                             ganhador: isWinner ? 'Você' : 'Outro',
                             status: item.situacao === '1' ? 'Disputa' : (item.situacao === '2' ? 'Iminência' : 'Encerrado')
                        };
                   });

                   ipcRenderer.send('portal-hybrid-capture', {
                       sessionId: mySessionId || 'UNKNOWN',
                       action: 'HYBRID_API_RESULTS',
                       data: { items: allFetchedItems }
                   });
                   
                   window.polaryonAPIStatus = "✅ ELITE (CAMUFLADO)";
              }

              // HEALTH CHECK v2.1.23: Ponto de checagem mais estável (comprasnet-sessao)
              apiHealthCounter++;
              if (apiHealthCounter >= 10) {
                  apiHealthCounter = 0;
                  try {
                      // Usar endpoint do PNCP ou Sessão como heartbeat
                      const healthRes = await fetch('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-sessao/v2/sessao/fornecedor/usuario', {
                          headers: { 'Authorization': window.polaryonAuthBearer }
                      });
                      if (healthRes.ok) window.polaryonAPIStatus = "✅ ELITE (MILITAR)";
                      else window.polaryonAPIStatus = "⚠️ TOKEN INSTÁVEL";
                  } catch(e) {
                      window.polaryonAPIStatus = "⚠️ PORTAL LENTO";
                  }
              }

         } catch(e) {
              window.polaryonAPIStatus = "❌ OFFLINE";
         }

         // ADAPTATIVE SPEED: Acelera se houver itens em disputa crítica
         const items = Object.values(window.polaryonAllItems || {});
         const hasCritical = items.some(it => it.status === 'Disputa' || it.status === 'Iminência');
         const delay = hasCritical ? 600 : 1500;
         
         setTimeout(pollingLoop, delay);
    };

    pollingLoop();
};


const injectSniffer = () => {
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            if (window.__polaryon_sniffed) return;
            window.__polaryon_sniffed = true;

            const sendToPreload = (data) => {
                window.postMessage({ type: 'POLARYON_HYBRID_SPY', payload: data }, '*');
            };

            // Intercept XHR
            const OrigXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                const xhr = new OrigXHR();
                const origOpen = xhr.open;
                const origSetReqHeader = xhr.setRequestHeader;
                
                xhr._url = '';
                
                xhr.open = function(method, url) {
                    this._url = url;
                    return origOpen.apply(this, arguments);
                };
                
                xhr.setRequestHeader = function(header, value) {
                    if (header.toLowerCase() === 'authorization' || header.toLowerCase() === 'bearer') {
                        // CAPTURA AGRESSIVA: Atualiza o token em cada pedido feito pelo portal
                        window.polaryonAuthBearer = value;
                        sendToPreload({ action: 'TOKEN_GRABBED', token: value, url: this._url });
                    }
                    return origSetReqHeader.apply(this, arguments);
                };
                
                xhr.addEventListener('load', function() {
                    const url = this._url || '';
                    if (url.includes('compras') || url.includes('disputa') || url.includes('/api/')) {
                        try {
                            const jsonContent = JSON.parse(this.responseText);
                            sendToPreload({ action: 'API_DUMP', url: url, response: jsonContent });
                        } catch(e) {}
                    }
                });
                
                return xhr;
            };

            // Intercept Fetch
            const origFetch = window.fetch;
            window.fetch = async function() {
                const url = arguments[0];
                const options = arguments[1] || {};
                
                if (options.headers) {
                    let hasToken = false;
                    try {
                        if (options.headers.get && typeof options.headers.get === 'function') {
                            const tk = options.headers.get('authorization') || options.headers.get('Authorization');
                            if (tk) { 
                                window.polaryonAuthBearer = tk; // Sincronização direta
                                sendToPreload({ action: 'TOKEN_GRABBED', token: tk, url: url }); 
                                hasToken = true; 
                            }
                        } else {
                            for (const [k, v] of Object.entries(options.headers)) {
                                if (k.toLowerCase() === 'authorization') {
                                    window.polaryonAuthBearer = v; // Sincronização direta
                                    sendToPreload({ action: 'TOKEN_GRABBED', token: v, url: url });
                                    hasToken = true;
                                }
                            }
                        }
                    } catch(e){}
                }
                
                const response = await origFetch.apply(this, arguments);
                if (url && typeof url === 'string' && (url.includes('compras') || url.includes('disputa') || url.includes('/api/'))) {
                    try {
                        const clone = response.clone();
                        clone.json().then(data => {
                             sendToPreload({ action: 'API_DUMP', url: url, response: data });
                        }).catch(e=>{});
                    } catch(e) {}
                }
                return response;
            };
            
            console.log("👻 [POLARYON] Interceptador de Rede Ativado.");
        })();
    `;
    
    // Injeta silenciosamente
    const inject = () => {
        const root = document.head || document.documentElement;
        if (root) {
            root.appendChild(script);
            script.remove();
        } else {
            setTimeout(inject, 50);
        }
    };
    inject();
};
injectSniffer();

let scrapingInterval = null;
let serverOffset = 0;

// Configuração recebida via IPC
let currentVault = {
    simulationMode: true,
    itemsConfig: {}
};
// Bidding Control Variables
let isBiddingActive = false;
let itemLimits = {}; // { "1": { price: 50.0, mode: 'follower' } }

// Inject global functions for the panel inputs
window.polaryonUpdateLimit = function(itemId, val) {
    if (!itemLimits[itemId]) itemLimits[itemId] = { price: '', mode: 'follower' };
    itemLimits[itemId].price = val;
};
window.polaryonUpdateMode = function(itemId, val) {
    if (!itemLimits[itemId]) itemLimits[itemId] = { price: '', mode: 'follower' };
    itemLimits[itemId].mode = val;
};

let mySessionId = null;
let currentConfig = {
    uasg: '',
    numero: '',
    ano: '',
    modality: '05'
};

/**
 * Esta função lê o HTML da página do Portal Comprasnet atual 
 * para identificar itens, valores e se é a sua vez de dar lance.
 */
function scrapeDisputeRoom() {
    if (!mySessionId) return; // Aguarda inicialização

    // --- SILENCIADOR DE DIÁLOGOS BLOQUEANTES ---
    window.alert = () => { console.log("[POLARYON] Alert silenciado"); };
    window.confirm = () => { console.log("[POLARYON] Confirm silenciado"); return true; };
    window.prompt = () => { console.log("[POLARYON] Prompt silenciado"); return null; };

    try {
        const bodyText = document.body.innerText || "";
        const currentUrl = window.location.href;
        
        // --- BYPASS DE AVISOS/COMUNICADOS (SICAF/GOV) ---
        if (bodyText.includes('A Secretaria de Gestão e Inovação informa') || 
            bodyText.includes('Comunicado') || 
            bodyText.includes('Aviso Importante') ||
            currentUrl.includes('AvisoPortal')) {
            
            const skipBtns = Array.from(document.querySelectorAll('button, a, input[type="button"], tr, td')).find(el => {
                const txt = (el.innerText || el.value || "").toUpperCase();
                return txt.includes('PROSSEGUIR') || txt.includes('CONTINUAR') || txt.includes('FECHAR') || 
                       txt.includes('OK') || txt.includes('ENTENDI') || txt.includes('CLIQUE AQUI');
            });

            if (skipBtns) {
                console.log("[POLARYON] Pulando Aviso de Comunicado do Governo...");
                if (typeof skipBtns.click === 'function') skipBtns.click();
                else window.location.href = skipBtns.href || window.location.href;
                return;
            }

            // v3.1: Watchdog de Recuperação Otimizado (Evita Loops em Conexões Lentas)
            if (currentUrl.includes('cnetmobile') || currentUrl.includes('comprasnet-web')) {
                const healthCheck = () => {
                    const bodyText = document.body ? document.body.innerText.toUpperCase() : "";
                    const hasContent = bodyText.length > 50; 
                    const isSystemError = bodyText.includes('INTERNAL SERVER ERROR') || bodyText.includes(' 500 ') || document.title.includes('500') || document.title.includes('404');
                    
                    if (!hasContent || isSystemError) {
                        console.warn("[POLARYON] Detetada falha real de carregamento ou Erro 500 no portal. Recuperando...");
                        setTimeout(() => window.location.reload(), 5000);
                    }
                };
                // Verifica apenas após 12s de carregamento (paciência para conexões lentas)
                setTimeout(healthCheck, 12000);
            }

            // Fallback Agressivo: Se detectamos o aviso mas não achamos o botão, 
            // tentamos saltar direto para a página pós-login (intro.htm)
            if (currentUrl.includes('Aviso') || currentUrl.includes('Comunicado')) {
                console.log("[POLARYON] Aviso detectado sem botões. Forçando salto para Intro...");
                window.location.href = 'https://www.comprasnet.gov.br/intro.htm';
                return;
            }
        }

        // --- AUTOMAÇÃO DE LOGIN E HANDOFF DIRETO (v3.0) ---
        
        // v3.0: SALTO DIRETO PARA PORTAL NOVO (Bypass de Frameset/Menus)
        // Se estamos no index.asp mas não saltamos pro portal novo ainda
        if (currentUrl.includes('index.asp') && !currentUrl.includes('servico=226') && bodyText.includes('Joelison')) {
             console.log("[POLARYON] Handoff Direto v3.0: Saltando para Portal 14.133...");
             window.location.href = 'https://www.comprasnet.gov.br/seguro/index.asp?servico=226';
             return;
        }

        // Fase 1: Tela intermediária do Comprasnet ("Acesse sua Conta" -> "Entrar com Gov.br")
        if (bodyText.includes('Acesse sua Conta') && bodyText.includes('Fornecedor Brasileiro')) {
            const entrarBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
                el.innerText.toUpperCase().includes('ENTRAR COM GOV.BR')
            );
            if (entrarBtn) {
                console.log("[POLARYON] Clicando em Entrar com Gov.br...");
                entrarBtn.click();
            }
            return;
        }

        // Fase 2: Plataforma Gov.br (SSO)
        if (bodyText.includes('Identifique-se no gov.br') || bodyText.includes('Acesso Gov.br') || bodyText.includes('Certificado digital')) {
            // Tentativa rápida e direta no botão de certificado
            const certButton = document.querySelector('button#login-certificate, .cert-login-button, [alt="Certificado Digital"], #label-certificate');
            const certLink = Array.from(document.querySelectorAll('button, a, div, span, img')).find(el => {
                const txt = (el.innerText || el.getAttribute('alt') || '').toUpperCase();
                return txt.includes('CERTIFICADO DIGITAL') || txt === 'SEU CERTIFICADO DIGITAL';
            });

            const finalBtn = certButton || certLink;

            if (finalBtn && typeof finalBtn.click === 'function') {
                console.log("[POLARYON] Executando Login Automático via Certificado...");
                finalBtn.click();
            }

            ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items: [],
                statusMessage: "Autenticando no Gov.br via A1..."
            });
            return;
        }

        // --- AUTO-NAVEGAÇÃO (ÁREA DO FORNECEDOR / INTRO.HTM COM FRAMES) ---
        // O Compras.gov.br antigo usa Framesets. Precisamos procurar em todos os frames usando recursão.
        let foundMenu = false;
        try {
            const searchAndClickMenu = (win) => {
                if (foundMenu) return;
                try {
                    const allElements = Array.from(win.document.querySelectorAll('a, td, div, span, li, button'));
                    
                    // 1. TENTA O CLIQUE DIRETO NO SUBMENU COM PRECISÃO SNIPER (v1.9.0)
                    const matches = allElements.filter(el => {
                        const txt = (el.innerText || el.textContent || "").toUpperCase().trim();
                        return txt.includes('LICITAÇÃO E DISPENSA (NOVO)');
                    });

                    // Escolhe o elemento mais específico (o que tiver o menor texto, evitando containers)
                    const submenuMatch = matches.sort((a, b) => (a.innerText?.length || 0) - (b.innerText?.length || 0))[0];

                    if (submenuMatch) {
                        const target = (submenuMatch.tagName === 'A' ? submenuMatch : submenuMatch.querySelector('a')) || submenuMatch;
                        
                        // DEBUG VISUAL: Coloca uma borda vermelha no botão detectado
                        try {
                            target.style.outline = '3px solid red';
                            target.style.boxShadow = '0 0 10px red';
                        } catch(e) {}

                        console.log(`[POLARYON] Sniper Lock (v1.9.0): "${target.innerText.split('\n')[0].trim()}"`);
                        
                        // 1. Sequência Visual de Apoio
                        const opts = { bubbles: true, cancelable: true, view: win };
                        target.dispatchEvent(new MouseEvent('mouseover', opts));
                        target.dispatchEvent(new MouseEvent('mouseenter', opts));
                        
                        // 2. Cálculo de Coordenadas Globais (Bypass de Frameset)
                        let rect = target.getBoundingClientRect();
                        let x = (rect.left + rect.right) / 2;
                        let y = (rect.top + rect.bottom) / 2;
                        
                        // Ajusta as coordenadas para a janela TOPO se estiver dentro de um frame
                        let currentWin = win;
                        try {
                            while (currentWin !== window.top) {
                                let frameEl = currentWin.frameElement;
                                if (frameEl) {
                                    let fRect = frameEl.getBoundingClientRect();
                                    x += fRect.left;
                                    y += fRect.top;
                                }
                                currentWin = currentWin.parent;
                            }
                        } catch(e) { console.warn("[POLARYON] Erro ao calcular offset de frame:", e); }

                        // 3. Disparo do Clique Nativo via IPC
                        setTimeout(() => {
                            ipcRenderer.send('portal-native-click', { sessionId: mySessionId, x, y });
                            
                            // 4. Extração de Rota de Fuga (Backup se o clique físico demorar)
                            const attrClick = target.getAttribute('onclick') || "";
                            const href = target.href || "";
                            if (href.includes('servico=226') || attrClick.includes('servico=226')) {
                                setTimeout(() => {
                                    if (window.location.href.includes('intro.htm')) {
                                        window.top.location.href = 'https://www.comprasnet.gov.br/seguro/login_f.asp?servico=226';
                                    }
                                }, 500);
                            }
                            foundMenu = true;
                        }, 100);
                        return;
                    }

                    // 2. SE NÃO ACHOU SUBMENU, TENTA ABRIR O MENU PAI "COMPRAS" NO FRAME CORRETO
                    const mainBtn = allElements.find(el => {
                        const txt = (el.innerText || el.textContent || "").toUpperCase().trim();
                        // Alguns portais usam 'MENU COMPRAS', outros apenas 'COMPRAS'
                        return txt === 'COMPRAS' || txt === 'MENU COMPRAS' || txt.includes('ABA COMPRAS');
                    });

                    if (mainBtn) {
                        console.log("[POLARYON] Drone de Navegação: Ativando Menu Compras...");
                        mainBtn.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, cancelable: true}));
                        mainBtn.click();
                        // Não marcamos foundMenu pois queremos clicar no submenu no próximo poll
                    }

                    // 3. RECURSÃO DE SEGURANÇA (BUSCA EM TODOS OS FRAMES DO PORTAL)
                    if (win.frames && win.frames.length > 0) {
                        for (let i = 0; i < win.frames.length; i++) {
                            try { searchAndClickMenu(win.frames[i]); } catch(e) {}
                        }
                    }
                } catch(err) {}
            };
            
            // BYPASS DE SEGURANÇA: Se ficarmos presos na home por mais de 10 segundos, tentamos o pulo direto ou refresh
            if (!window.polaryonJumpAttempted) {
                window.polaryonJumpAttempted = 0;
            }
            window.polaryonJumpAttempted++;

            if (window.polaryonJumpAttempted > 20 && (window.location.href.includes('intro.htm') || bodyText.includes('Área de Trabalho do Fornecedor'))) {
                 console.log("[POLARYON-WAR] Estagnação Crítica. Recarregando frameset de segurança...");
                 window.location.reload();
                 return;
            }
            
            // Só roda a busca profunda se estivermos no topo para evitar processamento duplicado
            if (window === window.top && (window.location.href.includes('intro.htm') || bodyText.includes('Área de Trabalho do Fornecedor'))) {
                searchAndClickMenu(window.top);
            }
        } catch(e) {}


        // --- AUTO-DIRECIONAMENTO DIRETO PARA A SALA LOGO APÓS O HANDOFF ---
        // v2.1.2: Correção Crítica do Jefão - Para 14.133, usar SEMPRE modalidade '06' no link de disputa.
        if (window.location.href.includes('cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/compras')) {
            const uasgStr = (currentConfig.uasg || "150002").toString().padStart(6, '0');
            const numStr = (currentConfig.numero || "67").toString().padStart(5, '0');
            const anoStr = (currentConfig.ano || "2026").toString();
            
            // Força 06 se for 14.133 (14) para garantir que o link direto funcione
            let mod = (currentConfig.modality || "06").toString();
            if (mod === "14") mod = "06"; 
            const modalityCode = mod.padStart(2, '0');
            
            const compraCode = `${uasgStr}${modalityCode}${numStr}${anoStr}`;
            const targetUrl = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/seguro/fornecedor/disputa?compra=${compraCode}`;

            console.log(`[POLARYON] Infiltrado v2.1.2: Saltando para sala com ID Corrigido: ${compraCode}`);
            window.location.href = targetUrl;
            return;
        }

        // --- AUTOMOÇÃO DE PESQUISA (MODALIDADE DISPENSA 14.133) ---
        if (bodyText.includes('Pesquisa de Dispensa') || bodyText.includes('Pesquisar Dispensa')) {
            const uasgInput = document.querySelector('input[name="uasg"], #uasg, [placeholder*="UASG"]');
            const numInput = document.querySelector('input[name="numero"], #numero, [placeholder*="Número"]');
            const searchBtn = document.querySelector('button.btn-pesquisar, #btnPesquisar, .br-button.primary');

            if (uasgInput && numInput && currentConfig?.uasg) {
                if (uasgInput.value !== currentConfig.uasg) {
                    console.log("[POLARYON] Preenchendo UASG...");
                    uasgInput.value = currentConfig.uasg;
                    uasgInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (numInput.value !== currentConfig.numero) {
                    console.log("[POLARYON] Preenchendo Número...");
                    numInput.value = currentConfig.numero;
                    numInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                if (searchBtn && uasgInput.value === currentConfig.uasg) {
                    console.log("[POLARYON] Disparando Busca...");
                    searchBtn.click();
                }
            }
        }

        // --- ENTRADA AUTOMÁTICA NA SALA ENCONTRADA ---
        if (bodyText.includes('Resultado da Pesquisa')) {
            const disputeLink = Array.from(document.querySelectorAll('a, button')).find(el => {
                const txt = el.innerText.toUpperCase();
                return txt.includes('ACESSAR SALA') || txt.includes('DETALHES') || txt.includes(currentConfig?.numero);
            });
            if (disputeLink) {
                console.log("[POLARYON] Entrando na Sala de Lances...");
                disputeLink.click();
            }
        }

        const items = [];
        let hasItemsInDispute = false;

        // Monitor de mudanças para extração instantânea (Competition Grade)
        if (!window.polaryonObserver && document.body) {
            let lastMutationTime = 0;
            window.polaryonObserver = new MutationObserver(() => {
                const now = Date.now();
                // Throttle de 250ms para evitar explosão de processamento em telas com muita animação
                if (now - lastMutationTime > 250) {
                    lastMutationTime = now;
                    scrapeDisputeRoom();
                }
            });
            window.polaryonObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
            console.log("[POLARYON] Motor de Latência Zero Ativado.");
        }

        // EXEMPLO DE INJEÇÃO V4: Motor de Identificação de Precisão "Leaf-Node" (Imune a trocas de Classes/Frameworks)
        const possibleRows = Array.from(document.querySelectorAll('div, tr, li, article, mat-expansion-panel'));
        
        let itemCards = possibleRows.filter(el => {
            const txt = (el.innerText || "").trim();
            // Verifica se o texto tem a sintaxe de dispensa de lances
            const isBiddingArea = (txt.includes('Melhor valor') || txt.includes('Meu valor') || txt.includes('Valor final')) && txt.includes('R$');
            // Verifica se começa com um número de item longo isolado ou "Item [x]" ou "GRUPO"
            const hasId = txt.match(/^\s*(\d+)\s+/) || txt.match(/(?:Item)\s*(\d+)/i) || txt.match(/(?:GRUPO)\s*(\d+)/i);
            
            // Rejeita containers enormes de página (se tiver mais de 2000 caracteres, provavelmente é o body)
            return isBiddingArea && hasId && txt.length < 3000;
        });

        // Filtragem Folha (Garante que não pegamos o pai e o filho duplicados, só o container exato do item)
        itemCards = itemCards.filter(el => {
             const children = Array.from(el.querySelectorAll('*'));
             const hasNestedCard = children.some(child => itemCards.includes(child));
             return !hasNestedCard;
        });

        // v4.0: MOTOR DE PAGINAÇÃO (MODO FANTASMA - DESATIVADO)
        // O robô agora usa 100% API-Direct, não precisamos mais ficar clicando em páginas visuais.
        // Isso economiza processamento e evita detecção por comportamento.
        if (window.polaryonPageScanState) window.polaryonPageScanState.scanning = false;


        if (itemCards.length > 0) {
            itemCards.forEach(card => {
                const text = card.innerText.trim();
                
                // Dispensa 14.133 layout
                const isDispensaItem = text.includes('Melhor valor') || text.includes('Meu valor') || text.includes('Valor final');
                const isGeneralItem = text.includes('R$');

                if (isDispensaItem || isGeneralItem) {
                    // Dispensa nova Serpro: "Fase de lances aberta" ou "Em disputa". 
                    // Se a aba é 'Em disputa', assumimos aberto.
                    const isDispute = text.toUpperCase().includes('EM DISPUTA') || 
                                     text.toUpperCase().includes('ABERTO') ||
                                     text.toUpperCase().includes('IMINÊNCIA') ||
                                     text.toUpperCase().includes('FASE DE LANCES ABERTA');

                    if (isDispute) hasItemsInDispute = true;
                    
                    let valorAtual = 0;
                    let meuValor = 0;

                    // Extração Dispensa explícita (Melhor valor unitário / global)
                    if (isDispensaItem) {
                        // Regex Sniper v2.2: Captura números com pontos facultativos (milhar) e vírgulas obrigatórias
                        const melhorMatch = text.match(/Melhor valor[^\d,]+([\d,.]+)/i);
                        const meuMatch = text.match(/Meu valor[^\d,]+([\d,.]+)/i);
                        
                        if (melhorMatch) valorAtual = parseFloat(melhorMatch[1].replace(/\./g, '').replace(',', '.'));
                        if (meuMatch) meuValor = parseFloat(meuMatch[1].replace(/\./g, '').replace(',', '.'));
                    } else {
                        // Regex genérica fallback
                        const matches = text.match(/R\$\s*([\d,.]+)/g);
                        if (matches && matches.length >= 1) {
                             valorAtual = parseFloat(matches[0].replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
                             if (matches.length >= 2) {
                                meuValor = parseFloat(matches[1].replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
                             }
                        }
                    }

                    if (valorAtual === 0 && !text.includes('R$')) return;

                    // Extração de ID e Descrição (Foco em clareza no Terminal)
                    const idMatch = text.match(/^\s*(\d+)\s+/) || text.match(/(?:Item)\s*(\d+)/i) || text.match(/(?:GRUPO)\s*(\d+)/i);
                    const isGrupo = text.toUpperCase().includes('GRUPO');
                    const itemId = idMatch ? (isGrupo ? 'G' + idMatch[1] : idMatch[1]) : "1";
                    
                    // Tenta achar a descrição (geralmente o texto longo antes do primeiro R$)
                    let desc = "";
                    try {
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
                        desc = lines.find(l => !l.includes('R$') && !l.match(/^\d+$/) && l.length > 20) || "";
                    } catch(e) {}

                    // v2.2.2: Detecção de Vencedor Visual (Prioridade pro Badge "MELHOR LANCE" ou Tumbs down da sala de dispensa)
                    const hasWinnerBadge = text.toUpperCase().includes('MELHOR LANCE') || text.toUpperCase().includes('VENCEDOR') || card.querySelector('.fa-thumbs-up, .icon-winning, [class*="thumb-up"], .br-icon.thumb-up, i[class*="up"]') !== null;
                    const hasLoserBadge = text.includes('👎') || card.querySelector('.fa-thumbs-down, .icon-losing, [class*="thumb-down"], .br-icon.thumb-down, i[class*="down"]') !== null;
                    
                    let ganhador = 'Outro';
                    if (hasWinnerBadge) {
                        ganhador = 'Você';
                    } else if (hasLoserBadge) {
                        ganhador = 'Outro';
                    } else {
                        const isWinnerPrice = meuValor > 0 && meuValor <= (valorAtual + 0.0001);
                        ganhador = isWinnerPrice ? 'Você' : 'Outro';
                    }

                    items.push({
                        itemId: itemId,
                        valorAtual: valorAtual,
                        meuValor: meuValor,
                        ganhador: ganhador,
                        descricao: desc.substring(0, 100) + (desc.length > 100 ? "..." : ""),
                        status: isDispute ? 'Disputa' : (text.toUpperCase().includes('ENCERRADO') ? 'Encerrado' : 'Aguardando'),
                        tempoRestante: -1, 
                        position: ganhador === 'Você' ? 1 : 0
                    });

                    // v4.0: Acumula no mapa global (preserva itens de outras páginas)
                    if (!window.polaryonAllItems) window.polaryonAllItems = {};
                    window.polaryonAllItems[itemId] = {
                        itemId: itemId,
                        valorAtual: valorAtual,
                        meuValor: meuValor,
                        ganhador: ganhador,
                        descricao: desc.substring(0, 100) + (desc.length > 100 ? "..." : ""),
                        status: isDispute ? 'Disputa' : (text.toUpperCase().includes('ENCERRADO') ? 'Encerrado' : 'Aguardando'),
                        tempoRestante: -1, 
                        position: ganhador === 'Você' ? 1 : 0
                    };
                }
            });
        }

        // Emite snapshot completo de TODOS os itens (multi-página)
        const allAccumulatedItems = Object.values(window.polaryonAllItems || {});
        const itemsToReport = allAccumulatedItems.length > 0 ? allAccumulatedItems : items;

        if (itemsToReport.length > 0) {
            // v2.2.2: Filtro Anti-Grupo (Não exibe e nem bida em containers de grupo, apenas nos itens)
            const biddableItems = itemsToReport.filter(it => !it.itemId.toString().toUpperCase().startsWith('G'));
            
            if (biddableItems.length > 0) {
                renderBiddingPanel(biddableItems);
            } else {
                renderBiddingPanel(itemsToReport); // Fallback: se tudo for filtrado, mostra normal para não sumir o painel
            }
            
            // Lógica Autônoma se Máquina Ativa
            if (isBiddingActive) {
                itemsToReport.forEach(it => {
                    const limit = itemLimits[it.itemId];
                    if (!limit || !limit.price) return;
                    
                    // Converte string com vírgula para float
                    const valLim = parseFloat(limit.price.replace(/\./g, '').replace(',', '.'));
                    if (isNaN(valLim)) return;

                    if (it.ganhador !== 'Você' && it.status === 'Disputa') {
                        // Anti-flood rate limit global (3 segundos)
                        if (Date.now() - (window.lastBidTime || 0) < 3000) return;
                        
                        let targetBid = it.valorAtual - 0.01; // decremento fixo de 1 centavo
                        
                        // Se for sniper, espera tempo, mas como não temos timer ainda, atira como follower mas no limite
                        if (limit.mode === 'sniper') {
                            // Sniper mode: drop directly to the minimum allowed if it beats the current
                            targetBid = valLim; 
                        }

                        if (targetBid >= valLim && targetBid < it.valorAtual) {
                            enviarLanceHibrido(it.itemId, targetBid);
                            window.lastBidTime = Date.now();
                        }
                    }
                });
            }
            
            // Emite pro Electron Master atualizar a tela do Polaryon (com snapshot completo multi-página)
            ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items: itemsToReport,
                actions: [], // Ações simuladas ou reais enviadas
                timestamp: new Date().toISOString(),
                source: 'VISUAL_AUTOMATION',
                turbo: hasItemsInDispute
            });

        } else {
             ipcRenderer.send('portal-update', {
                sessionId: mySessionId,
                items: [],
                statusMessage: "Aguardando abertura da sala de lances ou navegação para o pregão..."
            });
        }

    } catch (e) {
        console.error("Erro no Portal Injector:", e);
    }
}

window.addEventListener('load', () => {
    console.log("[POLARYON] Injetor Visual Ativado no Compras.gov.br");
    scrapingInterval = setInterval(scrapeDisputeRoom, 2000); // Scraper veloz
});

ipcRenderer.on('init-session', (event, { sessionId, config }) => {
    mySessionId = sessionId;
    currentVault = config.vault || currentVault;
    currentConfig = {
        uasg: config.uasg,
        numero: config.numero,
        ano: config.ano,
        modality: config.modality
    };
    console.log("[POLARYON] Sessão Local Inicializada:", sessionId, currentConfig);

    // SCANNER v2.1.22: Garante que o motor já inicie tentando farejar a rede
    if (window.polaryonAuthBearer && !window.polaryonHybrid_ItemsUrl) {
         // A rota agora será encontrada pelo performance scanner no pollingLoop
         if (!window.polaryonHybrid_Active) startHybridEngine();
    }
});

ipcRenderer.on('update-config', (event, config) => {
    currentVault = { ...currentVault, ...config };
    
    // Sincroniza o modo de simulação global
    if (config.simulationMode !== undefined) {
        window.isSimulationMode = config.simulationMode;
        console.log(`[POLARYON] Modo Simulação: ${window.isSimulationMode ? 'ATIVO' : 'DESATIVADO (REAL!)'}`);
    }

    if (config.itemsConfig) {
        Object.keys(config.itemsConfig).forEach(itemId => {
            const strat = config.itemsConfig[itemId];
            const priceStr = strat.minPrice.toFixed(2).replace('.', ',');
            if (!itemLimits[itemId]) {
                itemLimits[itemId] = { price: priceStr, mode: strat.mode };
            } else {
                itemLimits[itemId].price = priceStr;
                itemLimits[itemId].mode = strat.mode;
            }
            
            // Tenta atualizar a UI do Painel se existir
            try {
                const ipt = document.querySelector(`input[onchange*="'${itemId}'"]`);
                if (ipt) ipt.value = priceStr;
                const sel = document.querySelector(`select[onchange*="'${itemId}'"]`);
                if (sel) sel.value = strat.mode;
            } catch (e) { }
        });
    }
    console.log("[POLARYON] Estratégia atualizada no navegador injetado:", currentVault, itemLimits);
});

// -------------- FUNÇÕES DO PAINEL CIBERNÉTICO --------------
function renderBiddingPanel(items) {
    let panel = document.getElementById('polaryon-combat-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'polaryon-combat-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            max-height: 90vh;
            background: rgba(11, 16, 30, 0.95);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(16, 185, 129, 0.4);
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            z-index: 2147483647; /* MAX Z-INDEX */
            display: flex;
            flex-direction: column;
            color: #fff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            overflow: hidden;
            transition: all 0.3s ease;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = 'padding: 15px; border-bottom: 1px solid rgba(16,185,129,0.2); background: linear-gradient(90deg, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0) 100%); font-weight: 800; display: flex; align-items: center; justify-content: space-between; cursor: move;';
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <div id="polaryon-led" style="width:8px; height:8px; border-radius:50%; background:#eab308; box-shadow:0 0 10px #eab308;"></div>
                <span style="letter-spacing: 1px;">MÁQUINA DE LANCES</span>
            </div>
            <div style="font-size:9px; opacity:0.5; border:1px solid rgba(255,255,255,0.2); padding:2px 4px; border-radius:3px;">V3.0</div>
        `;
        
        const subHeader = document.createElement('div');
        subHeader.style.cssText = 'padding: 8px 15px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; letter-spacing: 0.5px;';
        subHeader.innerHTML = `
            <div id="polaryon-api-status" style="color: #ef4444;" title="Status de conexão com o Governo">API: OFFLINE</div>
            <div id="polaryon-items-count" style="color: #10b981; font-weight: 800;" title="Total de itens rastreados no edital (Multi-Página)">ITENS: 0</div>
            <div id="polaryon-mode-status" style="color: #eab308;" title="REAL: Lances valem dinheiro! SIMULAÇÃO: Apenas testes.">MODO: ?</div>
        `;

        const listContainer = document.createElement('div');
        listContainer.id = 'polaryon-items-list';
        listContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;';
        
        // Add scrollbar styling via injected style
        const style = document.createElement('style');
        style.innerHTML = `
            #polaryon-items-list::-webkit-scrollbar { width: 5px; }
            #polaryon-items-list::-webkit-scrollbar-track { background: transparent; }
            #polaryon-items-list::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.3); border-radius: 4px; }
        `;
        document.head.appendChild(style);
        
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 15px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.4);';
        
        
        const startBtn = document.createElement('button');
        startBtn.id = 'polaryon-combat-btn';
        startBtn.innerText = '▶ AUTORIZAR MÁQUINA DE LANCE';
        startBtn.style.cssText = 'width: 100%; padding: 14px; background: #10b981; color: #000; font-weight: 900; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; text-transform: uppercase; font-size: 12px; box-shadow: 0 0 20px rgba(16,185,129,0.3); letter-spacing: 0.5px;';
        
        startBtn.onclick = () => {
            isBiddingActive = !isBiddingActive;
            const led = document.getElementById('polaryon-led');
            if (isBiddingActive) {
                startBtn.innerText = '🛑 ABORTAR OPERAÇÃO AUTOMÁTICA';
                startBtn.style.background = '#ef4444';
                startBtn.style.color = '#fff';
                startBtn.style.boxShadow = '0 0 20px rgba(239,68,68,0.4)';
                if (led) { led.style.background = '#ef4444'; led.style.boxShadow = '0 0 10px #ef4444'; }
            } else {
                startBtn.innerText = '▶ AUTORIZAR MÁQUINA DE LANCE';
                startBtn.style.background = '#10b981';
                startBtn.style.color = '#000';
                startBtn.style.boxShadow = '0 0 20px rgba(16,185,129,0.3)';
                if (led) { led.style.background = '#eab308'; led.style.boxShadow = '0 0 10px #eab308'; }
            }
        };

        footer.appendChild(startBtn);
        panel.appendChild(header);
        panel.appendChild(subHeader);
        panel.appendChild(listContainer);
        panel.appendChild(footer);
        document.body.appendChild(panel);
    }
    
    // Atualiza Status da API e Modo no Painel
    const apiStatusEl = document.getElementById('polaryon-api-status');
    const modeStatusEl = document.getElementById('polaryon-mode-status');
    const itemsCountEl = document.getElementById('polaryon-items-count');

    if (apiStatusEl) apiStatusEl.innerText = 'API: ' + (window.polaryonAPIStatus || 'OFFLINE');
    if (itemsCountEl) itemsCountEl.innerText = `ITENS: ${items.length}`;
    if (modeStatusEl) {
        modeStatusEl.innerText = window.isSimulationMode ? 'MODO: SIMULAÇÃO' : 'MODO: REAL ⚡';
        modeStatusEl.style.color = window.isSimulationMode ? '#eab308' : '#ef4444';
    }

    
    // Update Items gracefully to avoid losing input focus
    const list = document.getElementById('polaryon-items-list');
    if (list) {
        items.forEach(it => {
            let itemDiv = document.getElementById('pol-item-' + it.itemId);
            if (!itemDiv) {
                // Monta o Card do Item pela primeira vez
                itemDiv = document.createElement('div');
                itemDiv.id = 'pol-item-' + it.itemId;
                itemDiv.style.cssText = 'background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); transition: border-color 0.3s;';
                
                const limit = itemLimits[it.itemId] || { price: '', mode: 'follower' };
                
                itemDiv.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
                        <span style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.9);">Item ${it.itemId}</span>
                        <div style="display:flex; flex-direction:column; align-items:flex-end;">
                           <span id="pol-item-status-${it.itemId}" style="font-size:8px; padding:2px 4px; border-radius:3px; background:rgba(255,255,255,0.1); margin-bottom:2px; font-weight:bold; letter-spacing:0.5px;">${it.status.toUpperCase()}</span>
                           <span id="pol-item-val-${it.itemId}" style="font-size:11px; font-weight:bold; color: #10b981;">R$ ${(it.valorAtual || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap: 6px;">
                        <div style="position:relative; flex:1;">
                           <span style="position:absolute; left:6px; top:5px; font-size:10px; color:rgba(255,255,255,0.4); font-weight:bold;">R$</span>
                           <input type="text" placeholder="Meu Limite Mínimo" value="${limit.price}" 
                            <input type="text" placeholder="Meu Limite Mínimo" value="${limit.price}" 
                               class="polaryon-limit-input"
                               style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.4); border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:6px 6px 6px 22px; color:#fff; font-size:11px; outline:none; font-weight:bold;" />
                        </div>
                        <select class="polaryon-mode-select"
                            style="width: 85px; background:rgba(0,0,0,0.4); border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:4px; color:#10b981; font-size:10px; font-weight:bold; outline:none; cursor:pointer;">
                            <option value="follower" ${limit.mode === 'follower' ? 'selected' : ''}>SEGUIDOR</option>
                            <option value="sniper" ${limit.mode === 'sniper' ? 'selected' : ''}>SNIPER</option>
                        </select>
                    </div>
                `;
                
                // Anexa os eventos via Isolated context (addEventListener funciona aqui)
                const inputEl = itemDiv.querySelector('.polaryon-limit-input');
                const selectEl = itemDiv.querySelector('.polaryon-mode-select');
                
                if (inputEl) inputEl.addEventListener('change', (e) => window.polaryonUpdateLimit(it.itemId, e.target.value));
                if (selectEl) selectEl.addEventListener('change', (e) => window.polaryonUpdateMode(it.itemId, e.target.value));
                
                list.appendChild(itemDiv);
            } else {
                // v2.2.1: Blindagem de Valores Nulos no Painel
                const valSpan = document.getElementById('pol-item-val-' + it.itemId);
                const statusSpan = document.getElementById('pol-item-status-' + it.itemId);
                if (valSpan) valSpan.innerText = 'R$ ' + (it.valorAtual || 0).toFixed(2);
                if (statusSpan) {
                    statusSpan.innerText = it.status.toUpperCase();
                    if (it.ganhador === 'Você') {
                        statusSpan.style.background = 'rgba(16,185,129,0.2)';
                        statusSpan.style.color = '#10b981';
                        statusSpan.innerText = 'Ganhando';
                    } else if (it.status === 'Disputa') {
                        statusSpan.style.background = 'rgba(239,68,68,0.2)';
                        statusSpan.style.color = '#ef4444';
                        statusSpan.innerText = 'EM DISPUTA';
                    } else {
                        statusSpan.style.background = 'rgba(255,255,255,0.1)';
                        statusSpan.style.color = '#fff';
                    }
                }
            }
        });
    }
}

// -------------- ROTINA DE DISPARO HÍBRIDO (ELITE) --------------
async function enviarLanceHibrido(itemId, valor) {
    // 0. Proteção de Simulação
    if (window.isSimulationMode) {
        console.log(`[POLARYON SIM] Simulação ativa. Lance de R$ ${valor} ignorado.`);
        return false;
    }

    // 1. Tenta o disparo via API (Velocidade Superior e Multi-Página)
    let apiSuccess = false;
    if (window.polaryonAuthBearer && window.polaryonContext_PurchaseId && window.polaryonContext_Year) {
        try {
            const uasg = window.polaryonContext_PurchaseId;
            const ano = window.polaryonContext_Year;
            const url = `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa-externa/v1/compras/${uasg}/${ano}/itens/${itemId}/lances`;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': window.polaryonAuthBearer,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    valorLance: valor
                })
            });

            if (res.ok) {
                console.log(`🚀 [POLARYON ELITE] LANCE API SUCESSO! Item ${itemId} -> R$ ${valor}`);
                apiSuccess = true;
            } else {
                const err = await res.text();
                console.warn(`[POLARYON HYBRID] API rejeitou lance (Item ${itemId}):`, err);
            }
        } catch(e) {
            console.error(`[POLARYON HYBRID] Erro no fetch de disparo:`, e);
        }
    }

    // 2. Sempre tenta o disparo Visual como reforço e feedback para o usuário
    // (Se o item estiver na tela, ele vai preencher o campo e clicar)
    enviarLanceVisual(itemId, valor);
    
    return apiSuccess;
}

function enviarLanceVisual(itemId, valor) {
    const valorStr = valor; // Passa o número direto
    try {
        const possibleRows = Array.from(document.querySelectorAll('div, tr, li, article'));
        let itemCards = possibleRows.filter(el => {
            const txt = (el.innerText || "").trim();
            const hasId = txt.match(new RegExp(`^\\s*${itemId}\\s+`)) || txt.match(new RegExp(`(?:Item)\\s*${itemId}`, 'i'));
            return hasId && txt.includes('R$') && txt.length < 3000;
        });

        itemCards = itemCards.filter(el => {
             const children = Array.from(el.querySelectorAll('*'));
             return !children.some(child => itemCards.includes(child));
        });
        
        const itemRow = itemCards.length > 0 ? itemCards[0] : null;
        
        if (itemRow) {
            // Acha todos os inputs texto dentro do Container do Item
            const inputs = Array.from(itemRow.querySelectorAll('input[type="text"], input[class*="moeda"], input[class*="valor"]'));
            // Remove inputs readonly ou desabilitados
            const activeInputs = inputs.filter(i => !i.disabled && !i.readOnly);
            
            if (activeInputs.length > 0) {
                const input = activeInputs[0];
                const cleanValue = valorStr.toFixed(2).replace('.', ',');
                
                // Set the value via object property descriptor trick for React/Angular SPAs
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(input, cleanValue);
                } else {
                    input.value = cleanValue;
                }
                
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', {'key':'Enter'}));

                // Find the submit button next to it
                const buttons = Array.from(itemRow.querySelectorAll('button, input[type="button"], a[class*="btn"]'));
                const submitBtn = buttons.find(b => b.innerText.toUpperCase().includes('LANCE') || b.innerText.toUpperCase().includes('ENVIAR') || b.title.toUpperCase().includes('LANCE'));
                
                if (submitBtn) {
                    submitBtn.click();
                    console.log(`[POLARYON VISUAL] Clique disparado: Item ${itemId} -> R$ ${cleanValue}`);
                    
                    setTimeout(() => {
                        const confirmBtns = Array.from(document.querySelectorAll('button'));
                        const btnConfirma = confirmBtns.find(b => b.innerText.toUpperCase() === 'CONFIRMAR' || b.innerText.toUpperCase() === 'SIM');
                        if (btnConfirma) {
                            btnConfirma.click();
                            console.log(`[POLARYON VISUAL] Confirmação Automática: Item ${itemId}`);
                        }
                    }, 500);
                }
            }
        }
    } catch (e) {
        console.error("Polaryon Visual Error:", e);
    }
}

// -------------- FIM DO INJETOR v1.2.50 --------------
