/**
 * @file lib/core/BaseComponent.ts
 * @brief Base class for all UI components with lifecycle management
 */

import type { ComponentState } from './types';

/**
 * Base component class providing common functionality for all UI components
 */
export abstract class BaseComponent<T extends ComponentState = ComponentState> {
  protected container: HTMLElement | null = null;
  protected element: HTMLElement | null = null;
  protected state: T;
  protected eventListeners: Array<{
    element: Element;
    event: string;
    handler: EventListener;
  }> = [];

  constructor(initialState?: Partial<T>) {
    this.state = (initialState || {}) as T;
  }

  /**
   * Abstract method to generate component HTML template
   */
  abstract render(): string;

  /**
   * Abstract method to bind event handlers after mount
   */
  abstract bindEvents(): void;

  /**
   * Mount component to DOM container
   */
  mount(container: HTMLElement): void {
    this.container = container;
    this.unmount(); // Clean up previous mount if exists
    
    container.innerHTML = this.render();
    this.element = container.firstElementChild as HTMLElement;
    
    if (this.element) {
      this.bindEvents();
      this.onMounted();
    }
  }

  /**
   * Unmount component and clean up resources
   */
  unmount(): void {
    this.onBeforeUnmount();
    
    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    
    this.element = null;
    this.onUnmounted();
  }

  /**
   * Update component state and re-render if needed
   */
  protected setState(newState: Partial<T>, shouldRerender = true): void {
    this.state = { ...this.state, ...newState };
    
    if (shouldRerender && this.container) {
      this.rerender();
    }
  }

  /**
   * Re-render component without full remount
   */
  private rerender(): void {
    if (!this.container) return;
    
    // Clean up event listeners but keep component mounted
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    
    // Update DOM content
    this.container.innerHTML = this.render();
    this.element = this.container.firstElementChild as HTMLElement;
    
    // Re-bind events only
    if (this.element) {
      this.bindEvents();
    }
  }

  /**
   * Get current component state
   */
  protected getState(): T {
    return { ...this.state };
  }

  /**
   * Add event listener with automatic cleanup tracking
   */
  protected addEventListener<K extends keyof HTMLElementEventMap>(
    selector: string | Element,
    event: K,
    handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void {
    const element = typeof selector === 'string' 
      ? this.element?.querySelector(selector) 
      : selector;
    
    if (element) {
      const eventListener = handler as EventListener;
      element.addEventListener(event, eventListener, options);
      
      this.eventListeners.push({
        element,
        event: event as string,
        handler: eventListener
      });
    }
  }

  /**
   * Find element within component scope
   */
  protected querySelector<T extends Element = Element>(selector: string): T | null {
    return this.element?.querySelector<T>(selector) || null;
  }

  /**
   * Find multiple elements within component scope
   */
  protected querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> {
    return this.element?.querySelectorAll<T>(selector) || document.querySelectorAll<T>('nothing');
  }

  /**
   * Lifecycle hook: called after component is mounted
   */
  protected onMounted(): void {}

  /**
   * Lifecycle hook: called before component is unmounted
   */
  protected onBeforeUnmount(): void {}

  /**
   * Lifecycle hook: called after component is unmounted
   */
  protected onUnmounted(): void {}

  /**
   * Emit custom event from component
   */
  protected emit(eventName: string, detail?: any): void {
    if (this.element) {
      const event = new CustomEvent(`component:${eventName}`, {
        detail,
        bubbles: true
      });
      this.element.dispatchEvent(event);
    }
  }

  /**
   * Listen for custom component events
   */
  protected on(eventName: string, handler: (event: CustomEvent) => void): void {
    if (this.element) {
      this.addEventListener(this.element, `component:${eventName}` as any, handler as any);
    }
  }
}