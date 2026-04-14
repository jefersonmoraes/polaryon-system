const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SessionStore {
    constructor() {
        this.path = path.join(app.getPath('userData'), 'active_sessions.json');
    }

    save(sessions) {
        try {
            const data = {};
            for (const [id, session] of sessions.entries()) {
                // We don't save the intervalId nor the full vault (for security)
                // but we save the necessary crumbs to restart
                data[id] = {
                    uasg: session.uasg,
                    numero: session.numero,
                    vault: {
                        // We ONLY save configs, not the certificate data!
                        itemsConfig: session.vault.itemsConfig,
                        simulationMode: session.vault.simulationMode,
                        alias: session.vault.alias,
                        credentialId: session.vault.credentialId 
                    }
                };
            }
            fs.writeFileSync(this.path, JSON.stringify(data));
        } catch (e) {
            console.error('[SESSION_STORE] Failed to save sessions:', e);
        }
    }

    load() {
        try {
            if (fs.existsSync(this.path)) {
                return JSON.parse(fs.readFileSync(this.path, 'utf8'));
            }
        } catch (e) {
            console.error('[SESSION_STORE] Failed to load sessions:', e);
        }
        return {};
    }

    clear() {
        try {
            if (fs.existsSync(this.path)) {
                fs.unlinkSync(this.path);
            }
        } catch (e) {}
    }
}

module.exports = new SessionStore();
