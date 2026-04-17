import fs from 'fs';
const path = 'e:/-JEFÃO-/APLICATIVOS/POLARYON KUNBUN/polaryon-system/electron/portal-preload.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Injetar startDomoCrawler() antes de pollingLoop()
content = content.replace('pollingLoop();\n};', 'startDomoCrawler();\n    pollingLoop();\n};');

// 2. Adicionar a função startDomoCrawler no final de startHybridEngine
const crawlerCode = `
    const startDomoCrawler = () => {
        setInterval(() => {
            try {
                const chevrons = Array.from(document.querySelectorAll('.mat-icon, i, button')).filter(el => {
                    const txt = (el.innerText || el.getAttribute('class') || "").toLowerCase();
                    return txt.includes('chevron_right') || txt.includes('keyboard_arrow_right') || txt.includes('fa-chevron-right');
                });
                chevrons.forEach(chevron => {
                    if (chevron.offsetParent !== null) {
                        const parentRow = chevron.closest('.mat-row, tr, mat-card');
                        if (parentRow && !parentRow.getAttribute('data-expanded')) {
                            console.log("🦾 [POLARYON DOMO] Auto-Expandindo Grupo...");
                            chevron.click();
                            parentRow.setAttribute('data-expanded', 'true');
                        }
                    }
                });
            } catch(e) {}
        }, 4000);
    };
`;

content = content.replace('pollingLoop();\n};', crawlerCode + '\n    pollingLoop();\n};');

fs.writeFileSync(path, content);
console.log('✅ portal-preload.js atualizado com sucesso!');
