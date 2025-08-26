import type { Book, OfflineBook, ReadingProgress, SyncProgress } from './types';
import { bookApi, progressApi } from './api';
import { AuthManager } from './auth';
import { StorageManager } from './storage';
import { ReaderManager } from './readers/reader-manager';

export class BookManager {
  private auth: AuthManager;
  private storage: StorageManager;
  private reader: ReaderManager;

  constructor(auth: AuthManager, storage: StorageManager) {
    this.auth = auth;
    this.storage = storage;
    this.reader = new ReaderManager(this.storage);
    
    this.setupSyncListener();
  }

  async getBooks(): Promise<Book[]> {
    try {
      return await bookApi.getBooks();
    } catch (error) {
      console.error('Failed to fetch books:', error);
      const offlineBooks = await this.storage.getAllOfflineBooks();
      return offlineBooks.map(book => book.metadata);
    }
  }

  async uploadBook(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    
    await bookApi.uploadBook(formData);
  }

  async downloadForOffline(bookId: number): Promise<void> {
    try {
      const books = await this.getBooks();
      const bookMeta = books.find(b => b.id === bookId);
      if (!bookMeta) throw new Error('Book not found');

      const data = await bookApi.downloadFile(bookId);
      
      const offlineBook: OfflineBook = {
        id: bookId,
        data,
        metadata: bookMeta,
        downloadedAt: new Date().toISOString()
      };
      
      await this.storage.saveBookForOffline(offlineBook);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  async openReader(bookId: number, container: HTMLElement): Promise<void> {
    let bookData: ArrayBuffer;
    let bookMeta: Book;

    const offlineBook = await this.storage.getOfflineBook(bookId);
    if (offlineBook) {
      bookData = offlineBook.data;
      bookMeta = offlineBook.metadata;
    } else {
      const books = await this.getBooks();
      bookMeta = books.find(b => b.id === bookId)!;
      bookData = await bookApi.downloadFile(bookId);
    }

    const progress = await this.getReadingProgress(bookId);
    await this.reader.openBook(bookMeta, bookData, container, progress);
    
    this.reader.onProgressUpdate = (newProgress) => {
      this.saveReadingProgress(bookId, newProgress);
    };
  }

  async getReadingProgress(bookId: number): Promise<ReadingProgress | null> {
    const localProgress = await this.storage.getProgress(bookId);
    
    if (await this.storage.isOnline()) {
      try {
        const serverProgress = await progressApi.getProgress(bookId);
        if (serverProgress && localProgress) {
          if (new Date(serverProgress.updated_at) > new Date(localProgress.progress.updated_at)) {
            return serverProgress;
          }
        }
        return serverProgress || localProgress?.progress || null;
      } catch (error) {
        console.error('Failed to get server progress:', error);
        return localProgress?.progress || null;
      }
    }
    
    return localProgress?.progress || null;
  }

  async saveReadingProgress(bookId: number, progress: Partial<ReadingProgress>): Promise<void> {
    const fullProgress: ReadingProgress = {
      book_id: bookId,
      user_id: 1,
      updated_at: new Date().toISOString(),
      ...progress
    };

    const syncProgress: SyncProgress = {
      bookId,
      progress: fullProgress,
      needsSync: true
    };

    await this.storage.saveProgress(syncProgress);

    if (await this.storage.isOnline()) {
      try {
        await progressApi.updateProgress(bookId, fullProgress);
        await this.storage.markProgressSynced(bookId);
      } catch (error) {
        console.error('Failed to sync progress:', error);
      }
    }
  }

  private setupSyncListener(): void {
    this.storage.setupOnlineListener(async (online) => {
      if (online) {
        await this.syncPendingProgress();
      }
    });
  }

  private async syncPendingProgress(): Promise<void> {
    const pendingProgress = await this.storage.getPendingSyncProgress();
    
    for (const syncItem of pendingProgress) {
      try {
        await progressApi.updateProgress(syncItem.bookId, syncItem.progress);
        await this.storage.markProgressSynced(syncItem.bookId);
        console.log(`Synced progress for book ${syncItem.bookId}`);
      } catch (error) {
        console.error(`Failed to sync progress for book ${syncItem.bookId}:`, error);
      }
    }
  }
}