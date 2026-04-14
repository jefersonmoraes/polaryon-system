import { createRoot } from "react-dom/client";
import AppDesktop from "./AppDesktop.tsx";
import "./index.css";

// No Desktop, limpamos o storage de módulos pesados que não usaremos
try {
  const keysToNuke = ['jj-kanban', 'jj-kanban-store', 'kanban-store', 'polaryon-kanban'];
  for (const key of keysToNuke) {
    localStorage.removeItem(key);
  }
} catch (e) {
  console.error("Desktop Clean failed", e);
}

createRoot(document.getElementById("root")!).render(<AppDesktop />);
