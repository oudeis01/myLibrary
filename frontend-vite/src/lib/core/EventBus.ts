/**
 * @file lib/core/EventBus.ts
 * @brief Event bus for component communication
 */

export type EventHandler<T = any> = (data: T) => void;

/**
 * Global event bus for component communication
 */
export class EventBus {
  private events: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    
    this.events.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event once
   */
  once<T = any>(event: string, handler: EventHandler<T>): () => void {
    const wrapper: EventHandler<T> = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   */
  off<T = any>(event: string, handler: EventHandler<T>): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T = any>(event: string, data?: T): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Get list of all registered events
   */
  getEvents(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get number of handlers for an event
   */
  getHandlerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }

  /**
   * Clear all event handlers
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * Clear handlers for a specific event
   */
  clearEvent(event: string): void {
    this.events.delete(event);
  }
}

// Global event bus instance
export const eventBus = new EventBus();

// Common event types
export const Events = {
  // Authentication events
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_REGISTER: 'auth:register',
  
  // Book events
  BOOK_UPLOAD: 'book:upload',
  BOOK_DELETE: 'book:delete',
  BOOK_UPDATE: 'book:update',
  BOOKS_REFRESH: 'books:refresh',
  
  // Navigation events
  NAVIGATE: 'router:navigate',
  PAGE_CHANGE: 'router:page-change',
  
  // Status events
  STATUS_MESSAGE: 'status:message',
  STATUS_CLEAR: 'status:clear',
  
  // Admin events
  ADMIN_SCAN_START: 'admin:scan-start',
  ADMIN_SCAN_COMPLETE: 'admin:scan-complete',
  
  // Theme events
  THEME_CHANGE: 'theme:change',
} as const;