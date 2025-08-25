/**
 * @file lib/api.ts
 * @brief API communication utilities for MyLibrary frontend
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

import { Book, AuthResponse, ReadingProgress, ApiResponse } from '@/types';

const API_BASE = 'http://localhost:8080/api';

/**
 * Get session token from localStorage
 */
export function getSessionToken(): string | null {
  if (typeof window === 'undefined') {
    console.log('🔑 getSessionToken: window undefined (SSR)');
    return null;
  }
  
  const token = localStorage.getItem('sessionToken');
  console.log('🔑 getSessionToken:', token ? `${token.substring(0, 10)}...` : null);
  return token;
}

/**
 * Set session token in localStorage
 */
export function setSessionToken(token: string): void {
  if (typeof window === 'undefined') {
    console.log('💾 setSessionToken: window undefined (SSR)');
    return;
  }
  
  console.log('💾 setSessionToken:', token ? `${token.substring(0, 10)}...` : null);
  localStorage.setItem('sessionToken', token);
  
  // 즉시 확인
  const saved = localStorage.getItem('sessionToken');
  console.log('💾 Token saved verification:', saved ? `${saved.substring(0, 10)}...` : null);
}

/**
 * Remove session token from localStorage
 */
export function removeSessionToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('sessionToken');
}

/**
 * Get authenticated headers
 */
function getAuthHeaders(): HeadersInit {
  const token = getSessionToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'X-Session-Token': token }),
  };
  
  console.log('🔑 API Headers:', { 
    token: token ? `${token.substring(0, 10)}...` : null,
    headers 
  });
  
  return headers;
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * User authentication
 */
export const authApi = {
  /**
   * Register new user
   */
  register: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await handleResponse<AuthResponse>(response);
    
    // 회원가입 성공시 토큰 저장
    if (result.session_token) {
      setSessionToken(result.session_token);
    }
    
    return result;
  },

  /**
   * Login user
   */
  login: async (username: string, password: string): Promise<AuthResponse> => {
    console.log('🔐 Login attempt:', { username, password: '***' });
    
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    console.log('🔐 Login response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });
    
    const result = await handleResponse<AuthResponse>(response);
    console.log('🔐 Login result:', { 
      username: result.username,
      session_token: result.session_token ? `${result.session_token.substring(0, 10)}...` : null
    });
    
    // 로그인 성공시 토큰 저장
    if (result.session_token) {
      console.log('💾 Saving token to localStorage');
      setSessionToken(result.session_token);
    } else {
      console.error('❌ No session_token in response!');
    }
    
    return result;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    const response = await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      removeSessionToken();
    }
  },
};

/**
 * Book management
 */
export const bookApi = {
  /**
   * Get all user books
   */
  getBooks: async (): Promise<Book[]> => {
    console.log('📚 Requesting books...');
    const headers = getAuthHeaders();
    
    const response = await fetch(`${API_BASE}/books`, {
      headers,
    });
    
    console.log('📚 Books response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    return handleResponse<Book[]>(response);
  },

  /**
   * Upload new book
   */
  uploadBook: async (formData: FormData): Promise<Book> => {
    const token = getSessionToken();
    const response = await fetch(`${API_BASE}/books/upload`, {
      method: 'POST',
      headers: {
        ...(token && { 'X-Session-Token': token }),
      },
      body: formData,
    });
    return handleResponse<Book>(response);
  },

  /**
   * Get book file URL
   */
  getBookFileUrl: (bookId: number): string => {
    return `${API_BASE}/books/${bookId}/file`;
  },

  /**
   * Get book download URL
   */
  getBookDownloadUrl: (bookId: number): string => {
    return `${API_BASE}/books/${bookId}/download`;
  },
};

/**
 * Reading progress
 */
export const progressApi = {
  /**
   * Get reading progress for a book
   */
  getProgress: async (bookId: number): Promise<ReadingProgress | null> => {
    try {
      const response = await fetch(`${API_BASE}/books/${bookId}/progress`, {
        headers: getAuthHeaders(),
      });
      if (response.status === 404) return null;
      return handleResponse<ReadingProgress>(response);
    } catch (error) {
      console.error('Error getting progress:', error);
      return null;
    }
  },

  /**
   * Update reading progress for a book
   */
  updateProgress: async (
    bookId: number, 
    progress: Partial<ReadingProgress>
  ): Promise<void> => {
    const response = await fetch(`${API_BASE}/books/${bookId}/progress`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...progress,
        updated_at: new Date().toISOString(),
      }),
    });
    return handleResponse<void>(response);
  },
};

/**
 * Health check
 */
export const healthApi = {
  check: async (): Promise<{ status: string }> => {
    const response = await fetch(`${API_BASE}/health`);
    return handleResponse<{ status: string }>(response);
  },
};
