import { StateStorage } from 'zustand/middleware';

/**
 * Custom IndexedDB Storage for Zustand
 * This allows us to exceed the 5MB limit of localStorage, supporting large datasets.
 */
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('polaryon_db', 1);
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('keyvaluepairs')) {
          db.createObjectStore('keyvaluepairs');
        }
      };

      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction('keyvaluepairs', 'readonly');
        const store = transaction.objectStore('keyvaluepairs');
        const getRequest = store.get(name);
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };
        
        getRequest.onerror = () => {
          console.error('IDBStorage - Error getting item:', name);
          resolve(null);
        };
      };
      
      request.onerror = (error) => {
        console.error('IDBStorage - Error opening DB:', error);
        resolve(null);
      };
    });
  },

  setItem: async (name: string, value: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('polaryon_db', 1);
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('keyvaluepairs')) {
          db.createObjectStore('keyvaluepairs');
        }
      };

      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction('keyvaluepairs', 'readwrite');
        const store = transaction.objectStore('keyvaluepairs');
        
        try {
          store.put(value, name);
          transaction.oncomplete = () => resolve();
          transaction.onerror = (err) => {
            console.error('IDBStorage - Transaction error setting item:', name, err);
            reject(err);
          };
        } catch (e) {
          console.error('IDBStorage - Exception setting item:', name, e);
          reject(e);
        }
      };
      
      request.onerror = (error) => {
        console.error('IDBStorage - Error opening DB for setItem:', error);
        reject(error);
      };
    });
  },

  removeItem: async (name: string): Promise<void> => {
    return new Promise((resolve) => {
      const request = indexedDB.open('polaryon_db', 1);
      
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction('keyvaluepairs', 'readwrite');
        const store = transaction.objectStore('keyvaluepairs');
        store.delete(name);
        transaction.oncomplete = () => resolve();
      };
      
      request.onerror = () => resolve();
    });
  },
};

export default idbStorage;
