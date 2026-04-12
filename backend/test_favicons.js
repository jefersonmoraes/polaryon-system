const axios = require('axios');

const testFavicon = async (url) => {
    const tryFetch = async (targetUrl) => {
        try {
            console.log(`Trying ${targetUrl}...`);
            const response = await axios({
                method: 'get',
                url: targetUrl,
                responseType: 'arraybuffer',
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            console.log(`  Success! Status: ${response.status}, Content-Type: ${response.headers['content-type']}`);
            return true;
        } catch (e) {
            console.log(`  Failed: ${e.message}`);
            return false;
        }
    };

    console.log(`\nTesting domain: ${url}`);
    let result = await tryFetch(`https://icons.duckduckgo.com/ip3/${url}.ico`);
    if (!result) {
        result = await tryFetch(`https://www.google.com/s2/favicons?domain=${url}&sz=64`);
    }
    
    if (result) {
        console.log(`Result: ICON FOUND`);
    } else {
        console.log(`Result: FALLBACK TO GLOBE`);
    }
};

const domains = [
    'omni.com.br',
    'domboscoatacado.com.br',
    'aloformpapeis.com.br',
    'www.minasplaca.com.br',
    'www.3tecinfor.com.br',
    'embalagenspontual.com.br'
];

(async () => {
    for (const d of domains) {
        await testFavicon(d);
    }
})();
