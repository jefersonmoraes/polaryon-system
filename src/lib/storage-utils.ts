/**
 * Polaryon Storage Diagnostic Utilities
 * Helps identify and resolve 'QuotaExceededError' and other browser-specific storage issues.
 */

export const getStorageUsage = () => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            const value = localStorage.getItem(key);
            total += ((key.length + (value ? value.length : 0)) * 2); // Roughly 2 bytes per character
        }
    }
    return {
        usedBytes: total,
        usedKB: Math.round(total / 1024),
        usedMB: (total / (1024 * 1024)).toFixed(2),
        quotaApproxMB: 5 // Default for most browsers
    };
};

export const clearCorruptedStorage = () => {
    console.warn("[CRITICAL] Emergency Storage Reset Initiated");
    
    // Clear known Polaryon keys but keep non-critical ones if possible
    // Or just clear everything for a fresh start if the user is stuck
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('polaryon-') || key.startsWith('jj-kanban'))) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Also clear IndexedDB if needed (though IDB usually doesn't have the 5MB quota issue)
    const request = indexedDB.deleteDatabase('polaryon_db');
    request.onsuccess = () => {
        console.log("IndexedDB 'polaryon_db' deleted successfully.");
        window.location.reload();
    };
    request.onerror = () => {
        console.error("Error deleting IndexedDB.");
        window.location.reload();
    };
};

/**
 * Diagnostic check to see if storage is functioning
 */
export const testStorageFunctionality = (): boolean => {
    try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
    } catch (e) {
        return false;
    }
};
