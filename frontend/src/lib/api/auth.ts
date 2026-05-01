import { api, setAccessToken } from './client';

export interface LoginResponse {
  access_token: string;
}

export async function login(username: string, password: string): Promise<void> {
  const data = await api.post('auth/login', { json: { username, password } }).json<LoginResponse>();
  setAccessToken(data.access_token);
}

export async function logout(): Promise<void> {
  try {
    await api.post('auth/logout');
  } finally {
    setAccessToken(null);
  }
}
