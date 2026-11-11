// Browser-local addons + the admin-controlled baseline.
//
// Players install addons ONLY in this browser's IndexedDB (never uploaded), so
// nothing a player adds is shared with another player. The gateway serves only
// the admin-controlled Keldurn baseline at /opt/benilla/addons-served; this
// worker merges that catalog with the local files and serves local bytes.
//
// Registered from index.html before the client starts; addons.html writes the DB.
const DB_NAME = 'benilla-local-addons';
const DB_VERSION = 2;
const FILE_STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readLocalFiles() {
  return openDb().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(FILE_STORE, 'readonly').objectStore(FILE_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }));
}

function readLocalFile(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(FILE_STORE, 'readonly').objectStore(FILE_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }));
}

function normalize(path) {
  return decodeURIComponent(path).replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function contentType(path) {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'lua') return 'text/plain; charset=utf-8';
  if (extension === 'toc') return 'text/plain; charset=utf-8';
  if (extension === 'xml') return 'application/xml; charset=utf-8';
  return 'application/octet-stream';
}

async function mergedCatalog(url) {
  const local = await readLocalFiles();
  const localKeys = new Set(local.map(entry => entry.key));
  let text = 'BADDONS1\n';
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) text = await response.text();
  } catch (error) {
    console.warn('local addons: gateway catalog unavailable', error);
  }
  const lines = text.split('\n').filter(line => line.trim());
  const head = lines.length && lines[0] === 'BADDONS1' ? 'BADDONS1' : 'BADDONS1';
  const body = lines
    .slice(lines.length && lines[0] === 'BADDONS1' ? 1 : 0)
    .filter(line => !localKeys.has(line.toLowerCase()));
  for (const entry of local) body.push(entry.path);
  return new Response([head, ...body].join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function localAsset(path) {
  const entry = await readLocalFile(normalize(path));
  if (!entry) return null;
  const copy = entry.bytes instanceof ArrayBuffer ? entry.bytes.slice(0) : new Uint8Array(entry.bytes);
  return new Response(copy, {
    status: 200,
    headers: {
      'Content-Type': contentType(entry.path),
      'Cache-Control': 'no-store',
    },
  });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/assets/v1/addons.bai'
      || /^\/assets\/v1\/locale\/[^/]+\/addons\.bai$/.test(url.pathname)) {
    event.respondWith(mergedCatalog(event.request.url));
    return;
  }
  const match = url.pathname.match(/^(?:\/assets\/v1\/locale\/[^/]+)?\/file\/(interface\/addons\/.+)$/i);
  if (!match) return;
  event.respondWith((async () => {
    const local = await localAsset(match[1]);
    return local || fetch(event.request);
  })());
});
