# Sessão — Home Assistant fix

## Problema
`Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"` ao acessar `https://polaryon.com.br/hass-4d151307e73ccfb9b7b84ff31e9a2f6c/`

## Root Cause
HA setava `Cache-Control: public, max-age=2678400` (31 DIAS). Browser cacheou onboarding.html **antes** do sub_filter existir. Toda visita subsequente usava a versão cacheada sem paths reescritos → JS import sem prefixo → nginx servia SPA index.html (text/html).

## Fix (v3.8.205)
Adicionado `expires epoch;` + `add_header Cache-Control "no-store, no-cache, must-revalidate" always;` em **todos** os locations do HA:
- `/hass-xxx/` (proxy principal)
- `/hass-xxx/frontend_latest/`
- `/hass-xxx/frontend_es5/`
- `/hass-xxx/static/`
- `/hass-xxx/manifest.json`

Também:
- `proxy_set_header X-Forwarded-For` reativado
- Removido `sub_filter_once on` redundante
- Arquivos JS/CSS estáticos com sub_filter próprio para `/api/onboarding`

## Paths na VPS
- Config: `/etc/nginx/sites-enabled/default` (instalado via `hass-nocache.cjs`)
- Scripts locais: `scripts/hass-nocache.cjs`
