import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.join(__dirname, '../../.calendar_tokens.json');

// From environment or fallback
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy';
// In Hetzner, this should be in .env. We use a fallback so it doesn't crash locally if missing
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';
// The Redirect URI must match what's configured in Google Cloud Console
// The Redirect URI must match what's configured in Google Cloud Console
const isProd = process.env.NODE_ENV === 'production' || process.env.DOMAIN?.includes('polaryon.com.br');
const GOOGLE_REDIRECT_URI = isProd
    ? 'https://polaryon.com.br/api/calendar/callback'
    : 'http://localhost:3000/api/calendar/callback';

// Loaded once at startup, but the values inside are used dynamically
export const oauth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

// Load previous tokens into the client if they exist
export const loadTokens = () => {
    try {
        console.log(`📂 Checking Google tokens at: ${TOKEN_PATH}`);
        if (fs.existsSync(TOKEN_PATH)) {
            const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
            if (tokens && (tokens.access_token || tokens.refresh_token)) {
                oauth2Client.setCredentials(tokens);
                console.log("✅ Google tokens successfully loaded into OAuth client.");
                return true;
            }
        } else {
            console.warn("⚠️ Google token file not found. Re-auth will be required.");
        }
    } catch (e) {
        console.error("❌ Failed to load or parse tokens:", e);
    }
    return false;
};

// Defensive check to ensure we always have the best tokens available
const ensureAuthenticated = async () => {
    // If no credentials are set, try loading them from disk first
    if (!oauth2Client.credentials || (!oauth2Client.credentials.access_token && !oauth2Client.credentials.refresh_token)) {
        loadTokens();
    }
};

// Auto-save tokens on refresh
oauth2Client.on('tokens', (tokens) => {
    try {
        const existing = fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8')) : {};
        const merged = { ...existing, ...tokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged));
        console.log("🔄 Google Tokens auto-refreshed and saved to disk.");
    } catch (e) {
        console.error("❌ Failed to auto-save refreshed tokens:", e);
    }
});

// Initialize on start
loadTokens();

export const getAuthUrl = () => {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly'
        ],
        prompt: 'consent' // force to get refresh_token
    });
};

export const saveTokens = async (code: string) => {
    try {
        console.log("📥 Exchanging authorization code for tokens...");
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log(`✅ Tokens saved successfully to ${TOKEN_PATH}`);
        return tokens;
    } catch (error) {
        console.error("❌ Error during saveTokens:", error);
        throw error;
    }
};

// Simple fetcher using the auth client's access token
export const fetchGoogleEvents = async () => {
    await ensureAuthenticated();
    let accessToken: string | null | undefined = null;
    try {
        accessToken = (await oauth2Client.getAccessToken()).token;
    } catch (error: any) {
        console.error('❌ Failed to retrieve Google Access Token:', error.message);
        throw new Error("NEEDS_AUTH");
    }
    if (!accessToken) {
        console.warn("⚠️ No access token returned from Google. Re-auth needed.");
        throw new Error("NEEDS_AUTH");
    }

    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 2); // Fetch from 2 months ago to see recent past
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 1); // 1 year into the future

    console.log(`📡 Fetching Google Events between ${timeMin.toISOString()} and ${timeMax.toISOString()}...`);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            console.error("❌ Google Auth Expired (401)");
            throw new Error("NEEDS_AUTH");
        }
        const bodyText = await response.text();
        console.error(`❌ Google API Error (${response.status}): ${bodyText}`);
        throw new Error(`Google API Error: ${response.status} ${response.statusText} - ${bodyText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.items?.length || 0} events from Google.`);
    return data.items || [];
};

export const pushEventToGoogle = async (
    event: { summary: string, description?: string, start: { date?: string, dateTime?: string }, end: { date?: string, dateTime?: string } },
    cardId?: string
) => {
    await ensureAuthenticated();
    let accessToken: string | null | undefined = null;
    try {
        accessToken = (await oauth2Client.getAccessToken()).token;
    } catch (error: any) {
        console.error('❌ Failed to retrieve Google Access Token for push:', error.message);
        throw new Error("NEEDS_AUTH");
    }
    if (!accessToken) {
        console.warn("⚠️ No access token for push. Re-auth needed.");
        throw new Error("NEEDS_AUTH");
    }

    let eventToPush = { ...event };

    // Attempt to find an existing event by PolaryonID using privateExtendedProperty
    let existingEventId = null;
    if (cardId) {
        try {
            // First check by standard extended property
            let searchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=polaryonId=${cardId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.items && searchData.items.length > 0) {
                    existingEventId = searchData.items[0].id;
                }
            }

            // Fallback for legacy events created before extendedProperties fix
            if (!existingEventId) {
                searchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?q=[PolaryonID: ${cardId}]`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.items && searchData.items.length > 0) {
                        existingEventId = searchData.items[0].id;
                    }
                }
            }
        } catch (e) {
            console.error("Error searching for existing Google Event:", e);
        }

        // Add the extended property to the payload to survive future syncs
        (eventToPush as any).extendedProperties = {
            private: {
                polaryonId: cardId
            }
        };
    }

    const method = existingEventId ? 'PUT' : 'POST';
    const url = existingEventId
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`
        : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

    console.log(`📤 Pushing event to Google (${method}): "${eventToPush.summary}" for cardId: ${cardId}`);
    const response = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventToPush)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to push event to Google [${method}]:`, errorText);
    } else {
        const result = await response.json();
        console.log(`✅ Event "${eventToPush.summary}" pushed successfully. Google ID: ${result.id}`);
    }
};

export const deleteEventFromGoogle = async (cardId: string) => {
    await ensureAuthenticated();
    let accessToken: string | null | undefined = null;
    try {
        accessToken = (await oauth2Client.getAccessToken()).token;
    } catch (error: any) {
        console.error('❌ Failed to retrieve Google Access Token for delete:', error.message);
        return; // Silent fail for sync
    }
    if (!accessToken) return;

    try {
        let existingEventId = null;

        let searchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=polaryonId=${cardId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.items && searchData.items.length > 0) {
                existingEventId = searchData.items[0].id;
            }
        }

        if (!existingEventId) {
            searchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?q=[PolaryonID: ${cardId}]`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.items && searchData.items.length > 0) {
                    existingEventId = searchData.items[0].id;
                }
            }
        }

        if (existingEventId) {
            await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        }
    } catch (e) {
        console.error("Error deleting existing Google Event:", e);
    }
};
