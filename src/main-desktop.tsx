import { createRoot } from "react-dom/client";
import AppDesktop from "./AppDesktop.tsx";
import "./index.css";

console.log("%c[POLARYON BOOT] Iniciando Hardware do Terminal...", "color: #10b981; font-weight: bold; font-size: 14px;");

// Manipulador de Erro Global Tático
window.onerror = function(message, source, lineno, colno, error) {
  console.error("FATAL ERROR DETECTED:", { message, source, lineno, colno, error });
  const rootErr = document.getElementById("root");
  if (rootErr) {
    rootErr.innerHTML = `
      <div style="background: #020817; color: #ef4444; padding: 20px; font-family: monospace; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
        <h1 style="font-size: 24px;">⚠️ ERRO CRÍTICO DE SISTEMA</h1>
        <p style="color: #94a3b8; max-width: 500px; margin: 10px 0;">Ocorreu uma falha na inicialização do Terminal Polaryon. Este erro foi registrado.</p>
        <pre style="background: #0f172a; padding: 15px; border-radius: 8px; border: 1px solid #ef444433; text-align: left; overflow: auto; max-width: 90vw;">${message}</pre>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">REINICIAR TERMINAL</button>
      </div>
    `;
  }
};

// No Desktop, limpamos o storage de módulos pesados que não usaremos
try {
  console.log("[POLARYON] Executando Garbage Collection...");
  const keysToNuke = ['jj-kanban', 'jj-kanban-store', 'kanban-store', 'polaryon-kanban'];
  for (const key of keysToNuke) {
    localStorage.removeItem(key);
  }
} catch (e) {
  console.error("Desktop Clean failed", e);
}

console.log("[POLARYON] Montando Árvore React...");
createRoot(document.getElementById("root")!).render(<AppDesktop />);
