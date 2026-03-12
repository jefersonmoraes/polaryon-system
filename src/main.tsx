import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// --- EMERGENCY LOCAL STORAGE GARBAGE COLLECTION ---
// Free up domain quota from legacy heavy base64 payloads abandoned by key migrations
try {
  const keysToNuke = [
    'jj-kanban', 'jj-kanban-store', 'kanban-store', 'polaryon-kanban', 
    'polaryon-auth', 'polaryon-auth-storage'
  ];
  for (const key of keysToNuke) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
} catch (e) {
  console.error("Failed to execute emergency garbage collection", e);
}

createRoot(document.getElementById("root")!).render(<App />);
