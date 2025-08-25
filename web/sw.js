/**
 * @file sw.js
 * @brief Service Worker for MyLibrary PWA offline functionality
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

const CACHE_NAME = 'mylibrary-v1';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline functionality
const CACHE_URLS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    OFFLINE_URL
];

/**
 * Service Worker installation event
 * Caches essential files for offline functionality
 */
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app shell files');
                return cache.addAll(CACHE_URLS);
            })
            .then(() => {
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
    );
});

/**
 * Service Worker activation event
 * Cleans up old caches and takes control of all clients
 */
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Take control of all clients
                return self.clients.claim();
            })
    );
});

/**
 * Service Worker fetch event
 * Implements cache-first strategy for static files and network-first for API calls
 */
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extension requests
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    const requestUrl = new URL(event.request.url);
    
    // Handle API requests with network-first strategy
    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }
    
    // Handle static files with cache-first strategy
    event.respondWith(cacheFirstStrategy(event.request));
});

/**
 * Cache-first strategy: Check cache first, then network
 * Good for static files that don't change often
 */
async function cacheFirstStrategy(request) {
    try {
        // Try to get from cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // Cache the response for future use (only for GET requests)
        if (request.method === 'GET' && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Cache-first strategy failed:', error);
        
        // If both cache and network fail, try to serve offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
        }
        
        // For other requests, return a basic error response
        return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * Network-first strategy: Try network first, fall back to cache
 * Good for API calls and dynamic content
 */
async function networkFirstStrategy(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200 && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('Network request failed, trying cache:', error);
        
        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If both fail, return error response
        return new Response(JSON.stringify({
            success: false,
            error: 'Offline - Network request failed and no cached response available'
        }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

/**
 * Background sync event (for future implementation)
 * Can be used to sync data when connection is restored
 */
self.addEventListener('sync', event => {
    console.log('Background sync event:', event.tag);
    
    if (event.tag === 'progress-sync') {
        event.waitUntil(syncProgress());
    }
});

/**
 * Sync reading progress when connection is restored
 * This is a placeholder for future implementation
 */
async function syncProgress() {
    console.log('Syncing reading progress...');
    // Implementation would sync any cached progress updates
    // that failed to send while offline
}

/**
 * Message event listener for communication with main thread
 */
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('Service Worker loaded successfully');
