import fs from 'fs';

const harPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\importar\\disputas.sigapregao.com.br.har';
const outputPath = 'e:\\POLARYON SYSTEM\\POLARYON KUNBUN\\polaryon-system\\scratch\\captcha_report.txt';

function generateCaptchaReport() {
    if (!fs.existsSync(harPath)) {
        fs.writeFileSync(outputPath, 'Erro: Arquivo HAR não encontrado!');
        return;
    }

    const harData = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    const entries = harData.log.entries;
    let report = '=== POLARYON ELITE - CAPTCHA RESEARCH REPORT ===\n\n';

    entries.forEach((entry, idx) => {
        const req = entry.request;
        const resp = entry.response;
        const url = req.url;

        if (url.includes('captcha') || url.includes('capgen') || url.includes('127.0.0.1')) {
            report += `--------------------------------------------------\n`;
            report += `[REGISTRO ${idx + 1}] ${req.method} ${url}\n`;
            report += `HTTP STATUS: ${resp.status}\n\n`;
            
            report += `REQ HEADERS:\n`;
            req.headers.forEach(h => {
                if (h.name.toLowerCase().startsWith('origin') || h.name.toLowerCase().startsWith('referer')) {
                    report += `  ${h.name}: ${h.value}\n`;
                }
            });
            report += `\n`;

            if (req.postData && req.postData.text) {
                report += `REQ POST DATA:\n`;
                report += `${req.postData.text}\n\n`;
            }

            if (resp.content && resp.content.text) {
                report += `RESP CONTENT:\n`;
                report += `${resp.content.text}\n\n`;
            }
        }
    });

    fs.writeFileSync(outputPath, report);
    console.log('✅ Relatório gerado com sucesso em scratch/captcha_report.txt');
}

generateCaptchaReport();
