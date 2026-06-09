import express from 'express';
import axios from 'axios';

const router = express.Router();

let cachedQuotes: { usd: string; eur: string } | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1h cache

async function fetchFromPrimary(): Promise<{ usd: string; eur: string } | null> {
    try {
        const res = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL', {
            timeout: 8000,
            headers: { 'Accept': 'application/json' }
        });
        if (res.data?.USDBRL?.bid && res.data?.EURBRL?.bid) {
            return {
                usd: parseFloat(res.data.USDBRL.bid).toFixed(2),
                eur: parseFloat(res.data.EURBRL.bid).toFixed(2)
            };
        }
    } catch { /* fallback */ }
    return null;
}

async function fetchFromFallback(): Promise<{ usd: string; eur: string } | null> {
    try {
        const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 8000 });
        if (res.data?.rates?.BRL) {
            // rates.BRL = how many BRL for 1 USD
            // rates.EUR = how many EUR for 1 USD
            return {
                usd: res.data.rates.BRL.toFixed(2),
                eur: (res.data.rates.BRL / res.data.rates.EUR).toFixed(2)
            };
        }
    } catch { /* fallback */ }
    return null;
}

router.get('/quotes', async (req, res) => {
    const now = Date.now();

    // Try primary (awesomeapi)
    let quotes = await fetchFromPrimary();

    // Fallback if primary fails
    if (!quotes) {
        quotes = await fetchFromFallback();
    }

    // Use cache if both failed
    if (!quotes) {
        if (cachedQuotes && (now - cacheTime) < CACHE_TTL) {
            return res.json(cachedQuotes);
        }
        return res.status(502).json({ error: 'Unavailable' });
    }

    // Update cache
    cachedQuotes = quotes;
    cacheTime = now;

    res.json(quotes);
});

export default router;
