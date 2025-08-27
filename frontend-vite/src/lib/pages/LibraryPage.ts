/**
 * @file lib/pages/LibraryPage.ts
 * @brief Main library page component showing book collection
 */

import { BaseComponent } from '../core/BaseComponent';
import type { ComponentState } from '../core/types';
import { eventBus, Events } from '../core/EventBus';
import type { Book } from '../types';

interface LibraryState extends ComponentState {
  books: Book[];
  isLoading: boolean;
  error: string | null;
  showUploadModal: boolean;
}

/**
 * Library page component displaying user's book collection
 */
export class LibraryPage extends BaseComponent<LibraryState> {
  private eventUnsubscribers: Array<() => void> = [];
  private thumbnailsLoaded: Set<string> = new Set();

  constructor() {
    super({
      books: [],
      isLoading: true,
      error: null,
      showUploadModal: false
    });
  }

  render(): string {
    return `
      <div class="library-container">
        <header class="library-header">
          <h1>📚 My Library</h1>
          <div class="header-actions">
            <button id="upload-btn">Upload Book</button>
            <button id="admin-btn" title="Server Administration">⚙️ Admin</button>
            <button id="logout-btn">Logout</button>
          </div>
        </header>
        
        <div id="books-grid" class="books-grid">
          ${this.renderBooksGrid()}
        </div>
        
        <div id="status" class="status ${this.state.error ? 'error' : ''}">
          ${this.state.error || ''}
        </div>

        ${this.state.showUploadModal ? this.renderUploadModal() : ''}
      </div>
    `;
  }

  bindEvents(): void {
    // Header button events
    this.addEventListener('#upload-btn', 'click', () => {
      this.setState({ showUploadModal: true });
    });

    this.addEventListener('#admin-btn', 'click', () => {
      eventBus.emit(Events.NAVIGATE, '/admin');
    });

    this.addEventListener('#logout-btn', 'click', () => {
      this.handleLogout();
    });

    // Book interaction events
    this.addEventListener('.read-btn', 'click', (e) => {
      const button = e.target as HTMLButtonElement;
      const bookId = button.dataset.bookId;
      if (bookId) {
        this.openBookReader(parseInt(bookId));
      }
    });

    this.addEventListener('.download-btn', 'click', (e) => {
      const button = e.target as HTMLButtonElement;
      const bookId = button.dataset.bookId;
      if (bookId) {
        this.downloadBookForOffline(parseInt(bookId), button);
      }
    });

    // Upload modal events
    if (this.state.showUploadModal) {
      this.addEventListener('#upload-modal .modal-close', 'click', () => {
        this.setState({ showUploadModal: false });
      });

      this.addEventListener('#cancel-upload', 'click', () => {
        this.setState({ showUploadModal: false });
      });

      this.addEventListener('#upload-form', 'submit', async (e) => {
        e.preventDefault();
        await this.handleFileUpload();
      });
    }
  }

  /**
   * Render books grid based on current state
   */
  private renderBooksGrid(): string {
    if (this.state.isLoading) {
      return `
        <div class="no-books">
          <h3>⠋ Loading books...</h3>
        </div>
      `;
    }

    if (this.state.books.length === 0) {
      return `
        <div class="no-books">
          <h3>No books found</h3>
          <p>Upload your first book to get started!</p>
        </div>
      `;
    }

    return this.state.books.map((book, index) => this.renderBookCard(book, index)).join('');
  }

  /**
   * Render individual book card
   */
  private renderBookCard(book: any, index: number): string {
    const displayTitle = this.getDisplayTitle(book.title, book.file_path, index);
    const displayAuthor = book.author || 'Unknown Author';
    const fileSizeKB = Math.round((book.file_size || 0) / 1024);
    
    return `
      <div class="book-card" data-book-id="${book.id}">
        <div class="book-cover" id="cover-${book.id}">
          <div class="thumbnail-loading" id="loading-${book.id}">⠋</div>
          <img class="thumbnail-image" id="thumb-${book.id}" style="display:none;" 
               alt="${displayTitle}" 
               onerror="this.style.display='none'; document.querySelector('#placeholder-${book.id}').style.display='flex'">
          <div class="cover-placeholder" id="placeholder-${book.id}" style="display:none">📖</div>
        </div>
        <div class="book-info">
          <h3 class="book-title">${displayTitle}</h3>
          <p class="book-author">${displayAuthor}</p>
          <p class="book-meta">${book.file_type?.toUpperCase() || 'Unknown'} • ${fileSizeKB} KB</p>
        </div>
        <div class="book-actions">
          <button class="read-btn" data-book-id="${book.id}">Read</button>
          <button class="download-btn" data-book-id="${book.id}" title="Download for offline reading">⬇</button>
        </div>
      </div>
    `;
  }

  /**
   * Render upload modal
   */
  private renderUploadModal(): string {
    return `
      <div class="modal-overlay" id="upload-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Upload Book</h2>
            <button class="modal-close">&times;</button>
          </div>
          <form id="upload-form" class="upload-form">
            <div class="file-input-container">
              <input type="file" id="book-file" accept=".epub,.pdf,.cbz,.cbr" required>
              <label for="book-file" class="file-input-label">
                <span class="file-icon">📁</span>
                <span>Choose file or drag & drop</span>
                <small>Supported: EPUB, PDF, CBZ, CBR</small>
              </label>
            </div>
            <div class="modal-actions">
              <button type="button" id="cancel-upload">Cancel</button>
              <button type="submit" id="upload-submit">Upload</button>
            </div>
          </form>
          <div id="upload-status" class="status"></div>
        </div>
      </div>
    `;
  }

  /**
   * Load books from server
   */
  private async loadBooks(): Promise<void> {
    this.setState({ isLoading: true, error: null });

    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch('http://localhost:8080/api/books', {
        headers: { 'X-Session-Token': token || '' }
      });

      if (!response.ok) {
        throw new Error(`Failed to load books: ${response.statusText}`);
      }

      const result = await response.json();
      const books = result.success ? (result.data || result) : [];

      console.log(`[LIBRARY] Loaded ${books.length} books`);
      this.setState({ books, isLoading: false });

      // Load thumbnails after books are rendered
      if (books.length > 0) {
        setTimeout(() => this.loadThumbnailsForBooks(books), 100);
      }

    } catch (error) {
      console.error('[LIBRARY] Failed to load books:', error);
      this.setState({ 
        error: `Failed to load books: ${error}`, 
        isLoading: false 
      });
    }
  }

  /**
   * Load thumbnails for all books
   */
  private async loadThumbnailsForBooks(books: any[]): Promise<void> {
    for (const book of books) {
      this.loadThumbnailForBook(book.id.toString(), book.thumbnail_path);
    }
  }

  /**
   * Load thumbnail for a specific book
   */
  private async loadThumbnailForBook(bookId: string, thumbnailPath?: string): Promise<void> {
    // Prevent duplicate loading
    if (this.thumbnailsLoaded.has(bookId)) return;
    this.thumbnailsLoaded.add(bookId);

    const loadingEl = this.querySelector(`#loading-${bookId}`) as HTMLElement;
    const imgEl = this.querySelector(`#thumb-${bookId}`) as HTMLImageElement;
    const placeholderEl = this.querySelector(`#placeholder-${bookId}`) as HTMLElement;

    if (!loadingEl || !imgEl || !placeholderEl) {
      this.thumbnailsLoaded.delete(bookId);
      return;
    }

    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(`http://localhost:8080/api/books/${bookId}/thumbnail`, {
        headers: { 'X-Session-Token': token || '' }
      });

      if (response.ok) {
        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);
        
        imgEl.src = objectURL;
        imgEl.onload = () => {
          loadingEl.style.display = 'none';
          imgEl.style.display = 'block';
        };
      } else {
        this.showPlaceholder(loadingEl, placeholderEl);
      }
    } catch (error) {
      console.warn(`Failed to load thumbnail for book ${bookId}:`, error);
      this.showPlaceholder(loadingEl, placeholderEl);
    }
  }

  /**
   * Show placeholder when thumbnail fails to load
   */
  private showPlaceholder(loadingEl: HTMLElement, placeholderEl: HTMLElement): void {
    loadingEl.style.display = 'none';
    placeholderEl.style.display = 'flex';
  }

  /**
   * Handle file upload
   */
  private async handleFileUpload(): Promise<void> {
    const fileInput = this.querySelector<HTMLInputElement>('#book-file');
    const statusDiv = this.querySelector('#upload-status') as HTMLElement;
    
    if (!fileInput?.files?.[0]) {
      statusDiv.textContent = 'Please select a file';
      statusDiv.className = 'status error';
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    statusDiv.textContent = '⠋ Uploading...';
    statusDiv.className = 'status';

    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch('http://localhost:8080/api/books/upload', {
        method: 'POST',
        headers: { 'X-Session-Token': token || '' },
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        statusDiv.textContent = 'Upload successful!';
        statusDiv.className = 'status success';
        
        // Refresh books and close modal
        setTimeout(() => {
          this.setState({ showUploadModal: false });
          this.loadBooks();
        }, 1000);
      } else {
        statusDiv.textContent = `Upload failed: ${result.error || 'Unknown error'}`;
        statusDiv.className = 'status error';
      }
    } catch (error) {
      statusDiv.textContent = `Upload error: ${error}`;
      statusDiv.className = 'status error';
    }
  }

  /**
   * Open book reader
   */
  private async openBookReader(bookId: number): Promise<void> {
    console.log(`[LIBRARY] Opening reader for book ID: ${bookId}`);
    // TODO: Implement reader integration
    eventBus.emit(Events.STATUS_MESSAGE, { 
      message: 'Reader functionality will be implemented next', 
      type: 'info' 
    });
  }

  /**
   * Download book for offline reading
   */
  private async downloadBookForOffline(bookId: number, button: HTMLButtonElement): Promise<void> {
    const originalText = button.textContent;
    button.textContent = '⠋';
    button.disabled = true;

    try {
      // TODO: Implement offline download
      setTimeout(() => {
        button.textContent = '✓';
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1000);
      }, 2000);
    } catch (error) {
      button.textContent = originalText;
      button.disabled = false;
      console.error('Download failed:', error);
    }
  }

  /**
   * Handle user logout
   */
  private handleLogout(): void {
    localStorage.removeItem('sessionToken');
    eventBus.emit(Events.AUTH_LOGOUT);
    eventBus.emit(Events.NAVIGATE, '/');
  }

  /**
   * Get display title for book
   */
  private getDisplayTitle(title: string, filePath: string, index: number): string {
    if (title && title.trim() && title !== 'Unknown Title') {
      return title;
    }
    
    if (filePath) {
      const filename = filePath.split('/').pop() || filePath;
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      return nameWithoutExt || `Book ${index + 1}`;
    }
    
    return `Book ${index + 1}`;
  }

  /**
   * Component mounted lifecycle
   */
  protected onMounted(): void {
    // Check authentication
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
      eventBus.emit(Events.NAVIGATE, '/');
      return;
    }

    // Only setup EventBus listeners once
    if (this.eventUnsubscribers.length === 0) {
      const unsubscribe = eventBus.on(Events.BOOKS_REFRESH, () => {
        this.loadBooks();
      });
      this.eventUnsubscribers.push(unsubscribe);
    }

    // Load books
    this.loadBooks();
  }

  /**
   * Cleanup EventBus listeners
   */
  protected onBeforeUnmount(): void {
    this.eventUnsubscribers.forEach(unsubscribe => unsubscribe());
    this.eventUnsubscribers = [];
  }
}