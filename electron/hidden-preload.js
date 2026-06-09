// 🕵️ Hidden window preload — intercepta fetch/XHR para capturar Bearer token
// das chamadas HTTP que a SPA Angular do cnetmobile faz durante a inicialização.
// O token fica em window.__polaryonBearer para o main.js ler via executeJavaScript.

const code = `
(function() {
  // Já interceptamos antes?
  if (window.__polaryonBearerPatched) return;
  window.__polaryonBearerPatched = true;

  // Intercepta fetch
  var origFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    var req = args[0];
    try {
      if (typeof req === 'string' || req instanceof String) {
        // fetch(url, options)
        if (args[1] && args[1].headers) {
          var h = args[1].headers;
          var auth = h.Authorization || h.authorization || h.get && h.get('Authorization') || h.get && h.get('authorization');
          if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer')) {
            window.__polaryonBearer = auth;
          }
        }
      } else if (req && req.headers) {
        var auth = req.headers.get('Authorization') || req.headers.get('authorization');
        if (auth && auth.toLowerCase().startsWith('bearer')) {
          window.__polaryonBearer = auth;
        }
      }
    } catch(e) {}
    return origFetch.apply(this, args);
  };

  // Intercepta XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  var origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function() {
    this.__polaryonMethod = arguments[0];
    this.__polaryonUrl = arguments[1];
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (header && typeof header === 'string' && header.toLowerCase() === 'authorization' &&
        typeof value === 'string' && value.toLowerCase().startsWith('bearer')) {
      window.__polaryonBearer = value;
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  console.log('[POLARYON HIDDEN] 🕵️ Interceptor de Bearer instalado!');
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
