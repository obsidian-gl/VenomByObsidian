/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = 'venom-obsidian-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/admin-manifest.json',
  'https://img.icons8.com/nolan/256/shield.png',
  'https://img.icons8.com/nolan/512/shield.png'
];

// Install service worker and cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate worker and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate strategy for reliable, offline-capable speed
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip Chrome extensions and non-HTTP/HTTPS sources
  if (!url.protocol.startsWith('http')) return;

  // Skip API endpoints - bypass service worker cache
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => { /* Ignore background fetch errors */ });
        
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for document pages when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ============================================================================
// SYSTEM DISPATCH & PUSH NOTIFICATIONS INTEGRATION
// ============================================================================
self.addEventListener('push', (event) => {
  let data = { title: 'VENOM NETWORK', body: 'New secure dispatch received.' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'VENOM NETWORK', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png',
    badge: data.badge || 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png',
    image: data.image || undefined,
    timestamp: data.timestamp || Date.now(),
    vibrate: [200, 100, 200],
    actions: data.actions || [],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let targetUrl = event.notification.data?.url || '/';
  
  // Append action details to the target URL query string if an action button was selected
  if (event.action) {
    if (targetUrl.includes('?')) {
      targetUrl += `&action=${encodeURIComponent(event.action)}`;
    } else {
      targetUrl += `?action=${encodeURIComponent(event.action)}`;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find a client tab that matches the destination path
      for (const client of clientList) {
        try {
          const clientPath = new URL(client.url).pathname;
          const targetPath = new URL(targetUrl, self.location.origin).pathname;
          
          if (clientPath === targetPath && 'focus' in client) {
            return client.focus();
          }
        } catch (e) {
          console.error('Error parsing client URL inside notificationclick:', e);
        }
      }
      
      // Open a brand-new browser tab if no matching tab is currently active
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
