/**
 * @file main.ts
 * @brief MyLibrary application entry point
 * @description Modular architecture with component-based pages
 */

import './style.css';
import { Router } from './lib/core/Router';
import { eventBus, Events } from './lib/core/EventBus';
import { AuthPage } from './lib/pages/AuthPage';
import { LibraryPage } from './lib/pages/LibraryPage';
import { AdminPage } from './lib/pages/AdminPage';

/**
 * Main application class
 */
class MyLibraryApp {
  private router: Router;

  constructor() {
    const appElement = document.querySelector<HTMLDivElement>('#app')!;
    this.router = new Router(appElement);
    this.setupRoutes();
    this.setupEventListeners();
    
    // Start router after routes are configured
    this.router.start();
    
    console.log('[APP] MyLibrary initialized successfully');
  }

  /**
   * Configure application routes
   */
  private setupRoutes(): void {
    this.router.register('/', AuthPage);
    this.router.register('/library', LibraryPage, true);
    this.router.register('/admin', AdminPage, true);
    
    // Set authentication check
    this.router.setAuthCheck(() => {
      return localStorage.getItem('sessionToken') !== null;
    });
  }

  /**
   * Setup global event listeners
   */
  private setupEventListeners(): void {
    // Navigation events
    eventBus.on(Events.NAVIGATE, (path: string) => {
      this.router.navigate(path);
    });

    // Authentication events
    eventBus.on(Events.AUTH_LOGOUT, () => {
      localStorage.removeItem('sessionToken');
      this.router.navigate('/');
    });

    // Status message events
    eventBus.on(Events.STATUS_MESSAGE, ({ message, type }) => {
      console.log(`[STATUS] ${type.toUpperCase()}: ${message}`);
    });

    // Books refresh events
    eventBus.on(Events.BOOKS_REFRESH, () => {
      console.log('[APP] Books refresh requested');
    });
  }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new MyLibraryApp());
} else {
  new MyLibraryApp();
}