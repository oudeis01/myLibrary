export class Router {
  private routes: Map<string, () => void> = new Map();

  addRoute(path: string, handler: () => void): void {
    this.routes.set(path, handler);
  }

  navigate(path: string): void {
    window.history.pushState(null, '', path);
    this.handleRoute();
  }

  private handleRoute(): void {
    const path = window.location.pathname;
    const handler = this.routes.get(path) || this.routes.get('/');
    if (handler) {
      handler();
    }
  }

  init(): void {
    window.addEventListener('popstate', () => this.handleRoute());
    this.handleRoute();
  }
}