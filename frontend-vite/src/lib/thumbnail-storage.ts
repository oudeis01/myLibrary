/**
 * @file thumbnail-storage.ts
 * @brief PWA용 오프라인 썸네일 저장소
 * @author MyLibrary Development Team
 * @version 1.0
 * @date 2025-08-26
 */

/**
 * @interface ThumbnailCacheEntry
 * @brief 썸네일 캐시 엔트리 구조
 */
interface ThumbnailCacheEntry {
    bookId: string;
    blob: Blob;
    timestamp: number;
    contentType: string;
    size: number;
}

/**
 * @class ThumbnailStorage
 * @brief PWA용 오프라인 썸네일 저장소
 */
export class ThumbnailStorage {
    private dbName = 'MyLibraryThumbnails';
    private version = 1;
    private storeName = 'thumbnails';
    private db: IDBDatabase | null = null;
    private maxCacheSize = 100 * 1024 * 1024; // 100MB
    private maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7일

    /**
     * @brief 데이터베이스 초기화
     */
    async init(): Promise<void> {
        if (this.db) return; // 이미 초기화됨
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('IndexedDB 오픈 실패:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('ThumbnailStorage 초기화 완료');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                
                // 기존 스토어가 있으면 삭제
                if (db.objectStoreNames.contains(this.storeName)) {
                    db.deleteObjectStore(this.storeName);
                }
                
                // 새로운 스토어 생성
                const store = db.createObjectStore(this.storeName, { keyPath: 'bookId' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('size', 'size', { unique: false });
                
                console.log('ThumbnailStorage 스키마 업그레이드 완료');
            };
        });
    }

    /**
     * @brief 썸네일 저장
     * @param bookId 도서 ID
     * @param blob 썸네일 이미지 데이터
     */
    async storeThumbnail(bookId: string, blob: Blob): Promise<void> {
        if (!this.db) {
            await this.init();
        }
        
        if (!this.db) {
            throw new Error('데이터베이스가 초기화되지 않았습니다');
        }

        // 캐시 크기 체크 및 정리
        await this.cleanupIfNeeded();

        const entry: ThumbnailCacheEntry = {
            bookId,
            blob,
            timestamp: Date.now(),
            contentType: blob.type || 'image/jpeg',
            size: blob.size
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.put(entry);
            
            request.onsuccess = () => {
                console.log(`썸네일 캐시 저장: ${bookId} (${(blob.size / 1024).toFixed(1)}KB)`);
                resolve();
            };
            
            request.onerror = () => {
                console.error('썸네일 저장 실패:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * @brief 썸네일 조회
     * @param bookId 도서 ID
     * @return 캐시된 썸네일 Blob 또는 null
     */
    async getThumbnail(bookId: string): Promise<Blob | null> {
        if (!this.db) {
            await this.init();
        }
        
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.get(bookId);
            
            request.onsuccess = () => {
                const result = request.result as ThumbnailCacheEntry;
                
                if (!result) {
                    resolve(null);
                    return;
                }
                
                // 만료된 캐시 확인
                const now = Date.now();
                if (now - result.timestamp > this.maxCacheAge) {
                    console.log(`만료된 썸네일 캐시: ${bookId}`);
                    this.deleteThumbnail(bookId); // 백그라운드에서 삭제
                    resolve(null);
                    return;
                }
                
                console.log(`썸네일 캐시 히트: ${bookId}`);
                resolve(result.blob);
            };
            
            request.onerror = () => {
                console.error('썸네일 조회 실패:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * @brief 특정 썸네일 삭제
     * @param bookId 도서 ID
     */
    async deleteThumbnail(bookId: string): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.delete(bookId);
            
            request.onsuccess = () => {
                console.log(`썸네일 캐시 삭제: ${bookId}`);
                resolve();
            };
            
            request.onerror = () => {
                console.error('썸네일 삭제 실패:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * @brief 캐시 크기 확인 및 필요시 정리
     */
    private async cleanupIfNeeded(): Promise<void> {
        if (!this.db) return;

        const stats = await this.getCacheStats();
        
        if (stats.totalSize > this.maxCacheSize) {
            console.log(`캐시 크기 초과: ${(stats.totalSize / 1024 / 1024).toFixed(1)}MB`);
            await this.cleanupOldest(Math.ceil(stats.count * 0.3)); // 30% 정리
        }
    }

    /**
     * @brief 캐시 통계 정보 조회
     */
    async getCacheStats(): Promise<{ count: number; totalSize: number }> {
        if (!this.db) {
            await this.init();
        }
        
        if (!this.db) return { count: 0, totalSize: 0 };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.getAll();
            
            request.onsuccess = () => {
                const entries = request.result as ThumbnailCacheEntry[];
                const count = entries.length;
                const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
                
                resolve({ count, totalSize });
            };
            
            request.onerror = () => {
                console.error('캐시 통계 조회 실패:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * @brief 오래된 캐시 엔트리 정리
     * @param deleteCount 삭제할 엔트리 수
     */
    private async cleanupOldest(deleteCount: number): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('timestamp');
            
            const request = index.openCursor(); // 오래된 것부터 정렬
            let deleted = 0;
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                
                if (cursor && deleted < deleteCount) {
                    const deleteReq = cursor.delete();
                    deleteReq.onsuccess = () => {
                        deleted++;
                        console.log(`오래된 썸네일 캐시 삭제: ${cursor.value.bookId}`);
                    };
                    cursor.continue();
                } else {
                    console.log(`총 ${deleted}개 오래된 캐시 엔트리 정리 완료`);
                    resolve();
                }
            };
            
            request.onerror = () => {
                console.error('캐시 정리 실패:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * @brief 만료된 캐시 정리
     */
    async clearExpired(): Promise<void> {
        if (!this.db) return;

        const now = Date.now();
        let deletedCount = 0;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('timestamp');
            
            const range = IDBKeyRange.upperBound(now - this.maxCacheAge);
            const request = index.openCursor(range);
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`만료된 썸네일 캐시 ${deletedCount}개 정리 완료`);
                    resolve();
                }
            };
            
            request.onerror = () => {
                console.error('만료된 캐시 정리 실패:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * @brief 모든 캐시 삭제
     */
    async clearAll(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log('모든 썸네일 캐시 삭제 완료');
                resolve();
            };
            
            request.onerror = () => {
                console.error('캐시 전체 삭제 실패:', request.error);
                reject(request.error);
            };
        });
    }
}

// 싱글톤 인스턴스 생성
export const thumbnailStorage = new ThumbnailStorage();