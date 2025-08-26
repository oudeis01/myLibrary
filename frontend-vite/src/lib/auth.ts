import { authApi, getSessionToken } from './api';

export class AuthManager {
  private currentUser: string | null = null;

  async isAuthenticated(): Promise<boolean> {
    const token = getSessionToken();
    return token !== null;
  }

  async login(username: string, password: string): Promise<void> {
    const response = await authApi.login(username, password);
    if (response.success && response.username) {
      this.currentUser = response.username;
    } else {
      throw new Error(response.message || 'Login failed');
    }
  }

  async register(username: string, password: string): Promise<void> {
    const response = await authApi.register(username, password);
    if (response.success && response.username) {
      this.currentUser = response.username;
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  }

  async logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.currentUser = null;
    }
  }

  getCurrentUser(): string | null {
    return this.currentUser;
  }
}