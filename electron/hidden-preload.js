// 🕵️ Hidden window preload — intercepta fetch/XHR para capturar Bearer token
// das chamadas HTTP que a SPA Angular do cnetmobile faz durante a inicialização.
// O token fica em window.__polaryonBearer para o main.js ler via executeJavaScript.

const code = `
(function() {
  // Já interceptamos antes?
  if (window.__polaryonBearerPatched) return;
  window.__polaryonBearerPatched = true;

  function getJwtTtl(token) {
    if (!token) return 0;
    try {
      const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
      const parts = raw.split('.');
      if (parts.length < 2) return 0;
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const payload = JSON.parse(atob(b64));
      const expSec = payload.exp;
      if (!expSec || typeof expSec !== 'number') return 0;
      return expSec - (Date.now() / 1000);
    } catch (e) {
      return 0;
    }
  }

  function trySetToken(token) {
    if (!token || typeof token !== 'string') return;
    const formatted = token.startsWith('Bearer ') ? token : 'Bearer ' + token;
    if (getJwtTtl(formatted) > 10) {
      window.__polaryonBearer = formatted;
      console.log('[POLARYON HIDDEN] Captured valid token! TTL=' + Math.floor(getJwtTtl(formatted)) + 's');
    }
  }

  // Intercepta fetch
  var origFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    var req = args[0];
    var url = '';
    if (typeof req === 'string' || req instanceof String) {
      url = req;
    } else if (req && req.url) {
      url = req.url;
    }

    try {
      if (args[1] && args[1].headers) {
        var h = args[1].headers;
        var auth = h.Authorization || h.authorization || h.get && h.get('Authorization') || h.get && h.get('authorization');
        if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer')) {
          trySetToken(auth);
        }
      } else if (req && req.headers) {
        var auth = req.headers.get('Authorization') || req.headers.get('authorization');
        if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer')) {
          trySetToken(auth);
        }
      }
    } catch(e) {}

    var promise = origFetch.apply(this, args);

    if (url && (url.indexOf('/token') !== -1 || url.indexOf('/sessao') !== -1)) {
      promise.then(function(res) {
        if (res.ok) {
          res.clone().json().then(function(body) {
            var t = body.token || body.accessToken || body.access_token || body.jwt || body.bearer || body.authorization || null;
            if (t) trySetToken(t);
          }).catch(function() {});
        }
      }).catch(function() {});
    }

    return promise;
  };

  // Intercepta XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  var origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  var origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function() {
    this.__polaryonMethod = arguments[0];
    this.__polaryonUrl = arguments[1];
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (header && typeof header === 'string' && header.toLowerCase() === 'authorization' &&
        typeof value === 'string' && value.toLowerCase().startsWith('bearer')) {
      trySetToken(value);
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    var xhr = this;
    xhr.addEventListener('load', function() {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.__polaryonUrl && 
          (xhr.__polaryonUrl.indexOf('/token') !== -1 || xhr.__polaryonUrl.indexOf('/sessao') !== -1)) {
        try {
          var body = JSON.parse(xhr.responseText);
          var t = body.token || body.accessToken || body.access_token || body.jwt || body.bearer || body.authorization || null;
          if (t) trySetToken(t);
        } catch(e) {}
      }
    });
    return origSend.apply(this, arguments);
  };

  // Storage setItem Hook
  (function() {
    var origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) {
      origSetItem.call(this, k, v);
      if (v && typeof v === 'string') {
        if (v.startsWith('eyJ') && v.length > 50) {
          trySetToken(v);
        } else if (v.startsWith('{')) {
          try {
            var p = JSON.parse(v);
            var j = p.accessToken || p.access_token || p.token || p.jwt || p.id_token || null;
            if (j) trySetToken(j);
          } catch(e) {}
        }
      }
    };
  })();

  // Periodic Storage Scanner
  function scanStorage() {
    try {
      var keysToCheck = ['accessToken', 'access_token', 'token', 'jwt', 'id_token', 'currentUser', 'auth_token', 'bearerToken', 'userToken'];
      for (var ki = 0; ki < keysToCheck.length; ki++) {
        var v = window.sessionStorage.getItem(keysToCheck[ki]) || window.localStorage.getItem(keysToCheck[ki]);
        if (v && typeof v === 'string') trySetToken(v);
      }
      for (var i = 0; i < window.sessionStorage.length; i++) {
        var k = window.sessionStorage.key(i);
        var v = window.sessionStorage.getItem(k);
        if (v && typeof v === 'string') {
          if (v.startsWith('eyJ') && v.length > 50) {
            trySetToken(v);
          } else if (v.startsWith('{')) {
            try {
              var parsed = JSON.parse(v);
              var t = parsed.accessToken || parsed.access_token || parsed.token || parsed.jwt || parsed.id_token;
              if (t) trySetToken(t);
            } catch(e) {}
          }
        }
      }
    } catch(e) {}
  }
  setInterval(scanStorage, 500);

  console.log('[POLARYON HIDDEN] 🕵️ Interceptor de Bearer completo instalado!');
})();
`;

// Injeta o script no contexto da página ANTES do Angular carregar
if (document.documentElement) {
  var el = document.createElement('script');
  el.textContent = code;
  document.documentElement.appendChild(el);
} else {
  document.addEventListener('DOMContentLoaded', function() {
    var el = document.createElement('script');
    el.textContent = code;
    document.documentElement.appendChild(el);
  });
}
