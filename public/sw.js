const CACHE_NAME = 'big-deal-radar-v3';
const CORE_ASSETS = ['./'];

function canCache(response) {
  return Boolean(response && response.ok);
}

async function putInCache(request, response) {
  if (!canCache(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    await putInCache(request, response);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await putInCache(request, response);
    return response;
  } catch {
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request);

  if (cached) {
    event.waitUntil(
      fetch(request)
        .then((response) => putInCache(request, response))
        .catch(() => undefined)
    );
    return cached;
  }

  try {
    const response = await fetch(request);
    await putInCache(request, response);
    return response;
  } catch {
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './'));
    return;
  }

  if (
    url.pathname.endsWith('/status.json') ||
    url.pathname.endsWith('/feed.xml')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    request.destination === 'manifest' ||
    request.destination === 'image' ||
    url.pathname.endsWith('/manifest.webmanifest') ||
    url.pathname.endsWith('/favicon.svg')
  ) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  event.respondWith(cacheFirst(request));
});
