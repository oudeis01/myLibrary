import ky, { type KyInstance } from 'ky';

let accessToken: string | null = null;
let onTokenChange: ((t: string | null) => void) | null = null;

export function setTokenChangeCallback(cb: (t: string | null) => void) {
  onTokenChange = cb;
}

export function setAccessToken(token: string | null) {
  if (token === accessToken) return; // break store ↔ client update loop
  accessToken = token;
  onTokenChange?.(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api: KyInstance = ky.create({
  prefixUrl: '/api',
  hooks: {
    beforeRequest: [
      (request) => {
        if (accessToken) {
          request.headers.set('Authorization', `Bearer ${accessToken}`);
        }
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status === 401 && !request.url.includes('/auth/')) {
          const refreshed = await tryRefresh();
          if (refreshed) {
            request.headers.set('Authorization', `Bearer ${accessToken}`);
            return ky(request);
          }
        }
        return response;
      },
    ],
  },
});

async function tryRefresh(): Promise<boolean> {
  try {
    const data = await ky.post('/api/auth/refresh').json<{ access_token: string }>();
    setAccessToken(data.access_token); // propagates to Svelte store via onTokenChange
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}
