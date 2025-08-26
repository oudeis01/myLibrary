import type { Book, AuthResponse, ReadingProgress } from './types';

const API_BASE = 'http://localhost:8080/api';

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sessionToken');
}

export function setSessionToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sessionToken', token);
}

export function removeSessionToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('sessionToken');
}

function getAuthHeaders(): HeadersInit {
  const token = getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'X-Session-Token': token }),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
  
  const jsonResponse = await response.json();
  
  if (jsonResponse.success && jsonResponse.data) {
    return jsonResponse.data;
  }
  
  return jsonResponse;
}

export const authApi = {
  register: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await handleResponse<AuthResponse>(response);
    
    if (result.session_token) {
      setSessionToken(result.session_token);
    }
    
    return result;
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    const result = await handleResponse<AuthResponse>(response);
    
    if (result.session_token) {
      setSessionToken(result.session_token);
    }
    
    return result;
  },

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

export const bookApi = {
  getBooks: async (): Promise<Book[]> => {
    const response = await fetch(`${API_BASE}/books`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Book[]>(response);
  },

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

  getBookFileUrl: (bookId: number): string => {
    return `${API_BASE}/books/${bookId}/file`;
  },

  downloadFile: async (bookId: number): Promise<ArrayBuffer> => {
    const token = getSessionToken();
    const response = await fetch(`${API_BASE}/books/${bookId}/file`, {
      headers: {
        ...(token && { 'X-Session-Token': token }),
      },
    });
    
    if (!response.ok) {
      throw new Error(`파일 다운로드 실패: ${response.status} ${response.statusText}`);
    }
    
    return response.arrayBuffer();
  },
};

export const progressApi = {
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