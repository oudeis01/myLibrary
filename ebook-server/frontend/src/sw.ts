/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// App Shell: SvelteKit 빌드 결과물 precache
precacheAndRoute(self.__WB_MANIFEST);

// API 응답: NetworkFirst (3s timeout → 캐시 fallback, TTL 1h)
// 책 파일(/download, /epub)은 대용량이므로 캐싱 제외 — IndexedDB에 명시적 저장
registerRoute(
  ({ url }: { url: URL }) =>
    url.pathname.startsWith('/api/') &&
    !url.pathname.includes('/download') &&
    !url.pathname.includes('/epub') &&
    !url.pathname.includes('/cover'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxAgeSeconds: 60 * 60 }), // 1h
    ],
  })
);
