import ePub from 'epubjs';
import type { ReadingProgress } from '../types';

export class EpubReader {
  private book: any;
  private rendition: any;
  public onProgressUpdate?: (progress: Partial<ReadingProgress>) => void;

  async open(data: ArrayBuffer, container: HTMLElement, progress?: ReadingProgress | null): Promise<void> {
    this.book = ePub(data);
    
    const readerArea = document.createElement('div');
    readerArea.className = 'epub-reader';
    container.appendChild(readerArea);

    this.rendition = this.book.renderTo(readerArea, {
      width: '100%',
      height: '100%',
      spread: 'none'
    });

    if (progress?.current_location) {
      await this.rendition.display(progress.current_location);
    } else {
      await this.rendition.display();
    }

    this.setupProgressTracking();
    this.setupKeyboardNavigation();
  }

  private setupProgressTracking(): void {
    this.rendition.on('relocated', (location: any) => {
      if (this.onProgressUpdate) {
        const progress = Math.round(this.book.locations.percentageFromCfi(location.start.cfi) * 100);
        
        this.onProgressUpdate({
          current_location: location.start.cfi,
          progress_percent: progress,
          updated_at: new Date().toISOString()
        });
      }
    });
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
    if (this.rendition) {
      this.rendition.prev();
    }
  }

  nextPage(): void {
    if (this.rendition) {
      this.rendition.next();
    }
  }

  toggleToc(): void {
    console.log('TOC not implemented for EPUB reader');
  }

  close(): void {
    if (this.rendition) {
      this.rendition.destroy();
    }
  }
}