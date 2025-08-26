import JSZip from 'jszip';
import type { ReadingProgress } from '../types';

export class ComicReader {
  private images: string[] = [];
  private currentPage = 0;
  private container: HTMLElement | null = null;
  public onProgressUpdate?: (progress: Partial<ReadingProgress>) => void;

  async open(data: ArrayBuffer, container: HTMLElement, progress?: ReadingProgress | null): Promise<void> {
    this.container = container;
    
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(data);
      
      const imageFiles = Object.keys(zipContent.files)
        .filter(name => /\.(jpg|jpeg|png|gif|webp)$/i.test(name))
        .sort();
      
      for (const fileName of imageFiles) {
        const file = zipContent.files[fileName];
        const blob = await file.async('blob');
        const url = URL.createObjectURL(blob);
        this.images.push(url);
      }
      
      if (progress?.current_page) {
        this.currentPage = Math.max(0, progress.current_page - 1);
      }
      
      const readerArea = document.createElement('div');
      readerArea.className = 'comic-reader';
      container.appendChild(readerArea);
      
      this.renderPage();
      this.setupKeyboardNavigation();
    } catch (error) {
      console.error('Failed to load comic:', error);
      throw error;
    }
  }

  private renderPage(): void {
    if (!this.container || this.images.length === 0) return;
    
    const readerArea = this.container.querySelector('.comic-reader') as HTMLElement;
    if (!readerArea) return;
    
    readerArea.innerHTML = `
      <img src="${this.images[this.currentPage]}" 
           alt="Page ${this.currentPage + 1}" 
           class="comic-page" />
    `;
    
    this.updateProgress();
  }

  private updateProgress(): void {
    if (this.onProgressUpdate) {
      const progress = Math.round(((this.currentPage + 1) / this.images.length) * 100);
      
      this.onProgressUpdate({
        current_page: this.currentPage + 1,
        total_pages: this.images.length,
        progress_percent: progress,
        updated_at: new Date().toISOString()
      });
    }
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          this.previousPage();
          break;
        case 'ArrowRight':
          this.nextPage();
          break;
      }
    });
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.renderPage();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.images.length - 1) {
      this.currentPage++;
      this.renderPage();
    }
  }

  toggleToc(): void {
    console.log('TOC not implemented for comic reader');
  }

  close(): void {
    this.images.forEach(url => URL.revokeObjectURL(url));
    this.images = [];
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}