import type { Book, ReadingProgress } from '../types';
import { StorageManager } from '../storage';
import { EpubReader } from './epub-reader';
import { PdfReader } from './pdf-reader';
import { ComicReader } from './comic-reader';

export class ReaderManager {
  private storage: StorageManager;
  private currentReader: EpubReader | PdfReader | ComicReader | null = null;
  
  public onProgressUpdate?: (progress: Partial<ReadingProgress>) => void;

  constructor(storage: StorageManager) {
    this.storage = storage;
  }

  async openBook(
    book: Book, 
    data: ArrayBuffer, 
    container: HTMLElement, 
    progress?: ReadingProgress | null
  ): Promise<void> {
    this.closeCurrentReader();

    switch (book.format) {
      case 'epub':
        this.currentReader = new EpubReader();
        break;
      case 'pdf':
        this.currentReader = new PdfReader();
        break;
      case 'comic':
        this.currentReader = new ComicReader();
        break;
      default:
        throw new Error(`Unsupported format: ${book.format}`);
    }

    if (this.currentReader && this.onProgressUpdate) {
      this.currentReader.onProgressUpdate = this.onProgressUpdate;
    }

    await this.currentReader.open(data, container, progress);
    this.setupReaderUI(container);
  }

  private closeCurrentReader(): void {
    if (this.currentReader) {
      this.currentReader.close();
      this.currentReader = null;
    }
  }

  private setupReaderUI(container: HTMLElement): void {
    const readerControls = document.createElement('div');
    readerControls.className = 'reader-controls';
    readerControls.innerHTML = `
      <button id="reader-close">✕</button>
      <button id="reader-prev">←</button>
      <button id="reader-next">→</button>
      <button id="reader-toc">☰</button>
      <div id="reader-progress" class="reader-progress"></div>
    `;

    container.appendChild(readerControls);

    readerControls.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      switch (target.id) {
        case 'reader-close':
          this.closeReader(container);
          break;
        case 'reader-prev':
          this.currentReader?.previousPage();
          break;
        case 'reader-next':
          this.currentReader?.nextPage();
          break;
        case 'reader-toc':
          this.currentReader?.toggleToc();
          break;
      }
    });
  }

  private closeReader(container: HTMLElement): void {
    container.classList.add('hidden');
    container.innerHTML = '';
    this.closeCurrentReader();
  }
}