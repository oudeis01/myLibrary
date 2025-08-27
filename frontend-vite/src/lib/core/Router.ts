/**
 * @file lib/core/Router.ts
 * @brief Simple SPA router for managing page navigation
 */

import { BaseComponent } from './BaseComponent';

export interface RouteConfig {
    path: string;
    component: new (...args: any[]) => BaseComponent;
    requiresAuth?: boolean;
}

/**
 * Simple client-side router for single page application
 */
export class Router {
    private routes: Map<string, RouteConfig> = new Map();
    private currentComponent: BaseComponent | null = null;
    private container: HTMLElement;
    private isAuthenticatedCallback: () => boolean = () => false;

    constructor(container: HTMLElement) {
        this.container = container;
        this.init();
    }

    /**
     * Initialize router with popstate listener
     */
    private init(): void {
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });

        // Initial route will be handled after routes are registered
    }

    /**
     * Start router after routes are configured
     */
    start(): void {
        this.handleRoute();
    }

    /**
     * Register route with component
     */
    register(path: string, component: new (...args: any[]) => BaseComponent, requiresAuth = false): void {
        this.routes.set(path, {
            path,
            component,
            requiresAuth
        });
    }

    /**
     * Navigate to specified path
     */
    navigate(path: string): void {
        if (window.location.pathname !== path) {
            history.pushState({}, '', path);
        }
        this.handleRoute();
    }

    /**
     * Replace current history entry
     */
    replace(path: string): void {
        history.replaceState({}, '', path);
        this.handleRoute();
    }

    /**
     * Go back in history
     */
    back(): void {
        history.back();
    }

    /**
     * Set authentication check callback
     */
    setAuthCheck(callback: () => boolean): void {
        this.isAuthenticatedCallback = callback;
    }

    /**
     * Handle current route
     */
    private handleRoute(): void {
        const currentPath = window.location.pathname;

        // Find matching route (exact match first, then patterns)
        let matchedRoute = this.routes.get(currentPath);

        if (!matchedRoute) {
            // Try to find pattern matches (for future use with parameters)
            for (const [path, config] of this.routes) {
                if (this.matchPath(path, currentPath)) {
                    matchedRoute = config;
                    break;
                }
            }
        }

        if (!matchedRoute) {
            // Default to root if no match found
            if (currentPath !== '/') {
                history.replaceState({}, '', '/');
                this.handleRoute();
            }
            return;
        }

        // Check authentication requirement
        if (matchedRoute.requiresAuth && !this.isAuthenticatedCallback()) {
            if (currentPath !== '/') {
                history.replaceState({}, '', '/');
                this.handleRoute();
            }
            return;
        }

        this.loadComponent(matchedRoute.component);
    }

    /**
     * Load and mount component
     */
    private loadComponent(ComponentClass: new (...args: any[]) => BaseComponent): void {
        // Unmount current component
        if (this.currentComponent) {
            this.currentComponent.unmount();
        }

        // Create and mount new component
        this.currentComponent = new ComponentClass();
        this.currentComponent.mount(this.container);
    }

    /**
     * Simple path matching (exact match for now, can be extended)
     */
    private matchPath(pattern: string, path: string): boolean {
        return pattern === path;
    }

    /**
     * Get current route path
     */
    getCurrentPath(): string {
        return window.location.pathname;
    }

    /**
     * Check if current path matches given path
     */
    isCurrentPath(path: string): boolean {
        return this.getCurrentPath() === path;
    }
}