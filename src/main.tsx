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

  // Also nuke corrupted auth sessions ONLY if they hold a massive JWT (Base64 image injected) 
  // that breaks Nginx 8KB Header Limits and causes infinite F5 data loss
  const checkAndClearCorruptedAuth = (storage: Storage) => {
      const authData = storage.getItem('polaryon-auth-v2');
      if (authData) {
          try {
              const parsed = JSON.parse(authData);
              if (parsed?.state?.jwtToken && parsed.state.jwtToken.length > 4000) {
                  console.warn("Detected corrupted massive JWT token. Purging session to restore sync...");
                  storage.removeItem('polaryon-auth-v2');
              }
          } catch(e) {}
      }
  };
  checkAndClearCorruptedAuth(localStorage);
  checkAndClearCorruptedAuth(sessionStorage);

} catch (e) {
  console.error("Failed to execute emergency garbage collection", e);
}

createRoot(document.getElementById("root")!).render(<App />);
