export class PWAManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private deferredPrompt: any = null;

  async init(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', this.swRegistration);
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    }

    this.setupInstallPrompt();
  }

  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.deferredPrompt = null;
    });
  }

  private showInstallButton(): void {
    const installBtn = document.createElement('button');
    installBtn.textContent = 'Install App';
    installBtn.className = 'install-btn';
    installBtn.onclick = () => this.promptInstall();
    
    document.body.appendChild(installBtn);
  }

  private async promptInstall(): Promise<void> {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      this.deferredPrompt = null;
    }
  }

  async updateApp(): Promise<boolean> {
    if (this.swRegistration) {
      await this.swRegistration.update();
      return this.swRegistration.waiting !== null;
    }
    return false;
  }
}