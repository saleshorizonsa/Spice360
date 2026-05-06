// Offline Storage Utility for Critical Data Caching

const DB_NAME = 'erp_offline_db';
const DB_VERSION = 1;

// Initialize IndexedDB
export const initOfflineDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create stores for offline data
            if (!db.objectStoreNames.contains('approvals')) {
                db.createObjectStore('approvals', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('notifications')) {
                db.createObjectStore('notifications', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('pendingActions')) {
                db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('dashboardData')) {
                db.createObjectStore('dashboardData', { keyPath: 'key' });
            }
        };
    });
};

// Save data to offline storage
export const saveOfflineData = async (storeName, data) => {
    try {
        const db = await initOfflineDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        if (Array.isArray(data)) {
            data.forEach(item => store.put(item));
        } else {
            store.put(data);
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Error saving offline data:', error);
        return false;
    }
};

// Get data from offline storage
export const getOfflineData = async (storeName) => {
    try {
        const db = await initOfflineDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting offline data:', error);
        return [];
    }
};

// Queue action for sync when online
export const queueOfflineAction = async (action) => {
    try {
        const db = await initOfflineDB();
        const transaction = db.transaction('pendingActions', 'readwrite');
        const store = transaction.objectStore('pendingActions');
        
        store.add({
            ...action,
            timestamp: new Date().toISOString(),
            synced: false
        });

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Error queuing offline action:', error);
        return false;
    }
};

// Get pending actions to sync
export const getPendingActions = async () => {
    return getOfflineData('pendingActions');
};

// Clear pending actions after sync
export const clearPendingActions = async () => {
    try {
        const db = await initOfflineDB();
        const transaction = db.transaction('pendingActions', 'readwrite');
        const store = transaction.objectStore('pendingActions');
        store.clear();

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Error clearing pending actions:', error);
        return false;
    }
};

// Save dashboard KPIs for offline access
export const saveDashboardKPIs = async (kpis) => {
    return saveOfflineData('dashboardData', { key: 'kpis', data: kpis, updatedAt: new Date().toISOString() });
};

// Get cached dashboard KPIs
export const getCachedDashboardKPIs = async () => {
    const data = await getOfflineData('dashboardData');
    const kpiData = data.find(d => d.key === 'kpis');
    return kpiData?.data || null;
};

// Check if data is stale (older than specified minutes)
export const isDataStale = (updatedAt, maxAgeMinutes = 30) => {
    if (!updatedAt) return true;
    const dataAge = (new Date() - new Date(updatedAt)) / (1000 * 60);
    return dataAge > maxAgeMinutes;
};

// Sync pending actions when online
export const syncPendingActions = async (syncFunction) => {
    if (!navigator.onLine) return { synced: 0, failed: 0 };

    const pendingActions = await getPendingActions();
    let synced = 0;
    let failed = 0;

    for (const action of pendingActions) {
        try {
            await syncFunction(action);
            synced++;
        } catch (error) {
            console.error('Failed to sync action:', action, error);
            failed++;
        }
    }

    if (synced > 0) {
        await clearPendingActions();
    }

    return { synced, failed };
};