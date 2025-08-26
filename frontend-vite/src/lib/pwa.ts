export class PWAManager {
  private swRegistration: ServiceWorkerRegistration | null = null;

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
    let deferredPrompt: any;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      deferredPrompt = null;
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
    const deferredPrompt = (window as any).deferredPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      (window as any).deferredPrompt = null;
    }
  }

  async updateApp(): Promise<boolean> {
    if (this.swRegistration) {
      const registration = await this.swRegistration.update();
      return registration.waiting !== null;
    }
    return false;
  }
}