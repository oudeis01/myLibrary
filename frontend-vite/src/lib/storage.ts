import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { OfflineBook, SyncProgress } from './types';

export class StorageManager {
  private db: IDBPDatabase | null = null;
  private dbName = 'MyLibraryDB';
  private version = 1;

  async init(): Promise<void> {
    this.db = await openDB(this.dbName, this.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('progress')) {
          const progressStore = db.createObjectStore('progress', { keyPath: 'bookId' });
          progressStore.createIndex('needsSync', 'needsSync');
        }
      },
    });
  }

  async saveBookForOffline(book: OfflineBook): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('books', book);
  }

  async getOfflineBook(bookId: number): Promise<OfflineBook | null> {
    if (!this.db) return null;
    return (await this.db.get('books', bookId)) || null;
  }

  async removeOfflineBook(bookId: number): Promise<void> {
    if (!this.db) return;
    await this.db.delete('books', bookId);
  }

  async getAllOfflineBooks(): Promise<OfflineBook[]> {
    if (!this.db) return [];
    return await this.db.getAll('books');
  }

  async saveProgress(syncProgress: SyncProgress): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('progress', syncProgress);
  }

  async getProgress(bookId: number): Promise<SyncProgress | null> {
    if (!this.db) return null;
    return (await this.db.get('progress', bookId)) || null;
  }

  async getPendingSyncProgress(): Promise<SyncProgress[]> {
    if (!this.db) return [];
    const allProgress = await this.db.getAll('progress');
    return allProgress.filter(p => p.needsSync);
  }

  async markProgressSynced(bookId: number): Promise<void> {
    if (!this.db) return;
    const progress = await this.getProgress(bookId);
    if (progress) {
      progress.needsSync = false;
      progress.syncedAt = new Date().toISOString();
      await this.db.put('progress', progress);
    }
  }

  async isOnline(): Promise<boolean> {
    return navigator.onLine;
  }

  setupOnlineListener(callback: (online: boolean) => void): void {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  }
}