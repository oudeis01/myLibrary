/**
 * @file lib/pages/AuthPage.ts
 * @brief Authentication page component (login/register)
 */

import { BaseComponent } from '../core/BaseComponent';
import type { ComponentState } from '../core/types';
import { eventBus, Events } from '../core/EventBus';

interface AuthState extends ComponentState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Authentication page component handling login and registration
 */
export class AuthPage extends BaseComponent<AuthState> {
  constructor() {
    super({
      isLoading: false,
      error: null
    });
  }

  render(): string {
    return `
      <div class="auth-container">
        <h1>⚡ MyLibrary</h1>
        <form id="auth-form" class="auth-form">
          <input type="text" id="username" placeholder="Username" required>
          <input type="password" id="password" placeholder="Password" required>
          <button type="submit" id="login-btn" ${this.state.isLoading ? 'disabled' : ''}>
            ${this.state.isLoading ? '⠋ Logging in...' : 'Login'}
          </button>
          <button type="button" id="register-btn" ${this.state.isLoading ? 'disabled' : ''}>
            ${this.state.isLoading ? '⠋ Registering...' : 'Register'}
          </button>
        </form>
        <div id="status" class="status ${this.state.error ? 'error' : ''}">
          ${this.state.error || ''}
        </div>
      </div>
    `;
  }

  bindEvents(): void {
    // Login form submission
    this.addEventListener('#auth-form', 'submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });

    // Register button click
    this.addEventListener('#register-btn', 'click', async () => {
      await this.handleRegister();
    });
  }

  /**
   * Handle login attempt
   */
  private async handleLogin(): Promise<void> {
    const username = this.getInputValue('#username');
    const password = this.getInputValue('#password');

    if (!username || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    this.setState({ isLoading: true, error: null });

    try {
      const response = await fetch('http://localhost:8080/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      console.log('[AUTH] Login response received:', result.success ? 'SUCCESS' : 'FAILED');

      const sessionToken = result.data?.session_token || result.session_token;

      if (response.ok && sessionToken) {
        localStorage.setItem('sessionToken', sessionToken);
        eventBus.emit(Events.AUTH_LOGIN, { username, sessionToken });
        eventBus.emit(Events.NAVIGATE, '/library');
      } else {
        this.showError(`Login failed: ${result.error || result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AUTH] Login failed:', error);
      this.showError(`Connection error: ${error}`);
    }

    this.setState({ isLoading: false });
  }

  /**
   * Handle registration attempt
   */
  private async handleRegister(): Promise<void> {
    const username = this.getInputValue('#username');
    const password = this.getInputValue('#password');

    if (!username || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    this.setState({ isLoading: true, error: null });

    try {
      const response = await fetch('http://localhost:8080/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      console.log('[AUTH] Register response received:', result.success ? 'SUCCESS' : 'FAILED');

      const sessionToken = result.data?.session_token || result.session_token;

      if (response.ok && sessionToken) {
        localStorage.setItem('sessionToken', sessionToken);
        eventBus.emit(Events.AUTH_REGISTER, { username, sessionToken });
        eventBus.emit(Events.NAVIGATE, '/library');
      } else {
        this.showError(`Registration failed: ${result.error || result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AUTH] Register failed:', error);
      this.showError(`Connection error: ${error}`);
    }

    this.setState({ isLoading: false });
  }

  /**
   * Get input value by selector
   */
  private getInputValue(selector: string): string {
    const input = this.querySelector<HTMLInputElement>(selector);
    return input?.value.trim() || '';
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.setState({ error: message });
    eventBus.emit(Events.STATUS_MESSAGE, { message, type: 'error' });
  }

  /**
   * Check if user is already authenticated
   */
  protected onMounted(): void {
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
      // User is already authenticated, redirect to library
      eventBus.emit(Events.NAVIGATE, '/library');
    }
  }
}