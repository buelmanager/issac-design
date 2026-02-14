const CACHE_VERSION = 'issac-design-v5';
const PRECACHE_URLS = [
  '/',
  '/shop',
  '/shop/simulator',
  '/favicon.svg',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Cache names for different strategies
const CACHES = {
  precache: CACHE_VERSION,
  images: `${CACHE_VERSION}-images`,
  fonts: `${CACHE_VERSION}-fonts`,
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHES.precache).then((cache) =>
      // addAll은 하나라도 실패하면 전체 reject → 개별 캐싱으로 안정화
      Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url).then((response) => {
            if (response.ok) return cache.put(url, response);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !Object.values(CACHES).includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external APIs and tracking
  if (url.hostname !== self.location.hostname) return;

  // Skip Vite dev server requests
  if (url.pathname.startsWith('/.vite/') || url.pathname.includes('/node_modules/.vite/')) return;

  // Cache-first: Astro bundles (content-hashed, immutable)
  if (url.pathname.startsWith('/_astro/')) {
    return event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHES.precache).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
  }

  // Cache-first: Fonts (long-lived)
  if (url.pathname.startsWith('/fonts/')) {
    return event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHES.fonts).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
  }

  // Stale-while-revalidate: Images
  if (/\.(webp|avif|jpg|jpeg|png|svg|gif)$/i.test(url.pathname)) {
    return event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHES.images).then((cache) => {
            cache.put(request, clone);
            trimCache(CACHES.images, 100);
          });
          return response;
        });
        return cached || fetchPromise;
      })
    );
  }

  // Network-first: HTML pages (navigation requests)
  if (request.mode === 'navigate') {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHES.precache).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  }

  // Network-first: Everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHES.precache).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Trim cache to max entries (FIFO)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxEntries);
  }
}
