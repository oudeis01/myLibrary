import * as pdfjsLib from 'pdfjs-dist';
import type { ReadingProgress } from '../types';

export class PdfReader {
  private pdfDoc: any = null;
  private currentPage = 1;
  private totalPages = 0;
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLElement | null = null;
  public onProgressUpdate?: (progress: Partial<ReadingProgress>) => void;

  async open(data: ArrayBuffer, container: HTMLElement, progress?: ReadingProgress | null): Promise<void> {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    this.container = container;
    this.pdfDoc = await pdfjsLib.getDocument(data).promise;
    this.totalPages = this.pdfDoc.numPages;
    
    if (progress?.current_page) {
      this.currentPage = progress.current_page;
    }

    const readerArea = document.createElement('div');
    readerArea.className = 'pdf-reader';
    
    this.canvas = document.createElement('canvas');
    readerArea.appendChild(this.canvas);
    container.appendChild(readerArea);

    await this.renderPage();
    this.setupKeyboardNavigation();
  }

  private async renderPage(): Promise<void> {
    if (!this.pdfDoc || !this.canvas) return;

    const page = await this.pdfDoc.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: 1.5 });

    this.canvas.width = viewport.width;
    this.canvas.height = viewport.height;

    const ctx = this.canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    this.updateProgress();
  }

  private updateProgress(): void {
    if (this.onProgressUpdate) {
      const progress = Math.round((this.currentPage / this.totalPages) * 100);
      
      this.onProgressUpdate({
        current_page: this.currentPage,
        total_pages: this.totalPages,
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
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderPage();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.renderPage();
    }
  }

  toggleToc(): void {
    console.log('TOC not implemented for PDF reader');
  }

  close(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}