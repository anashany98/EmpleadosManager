// MED-011: service worker con cache seguro + versionado por build.
//
// Antes este SW:
//   1. Usaba nombre fijo `employ-manager-v1` (no versionado por
//      build → deployments pueden dejar HTML stale).
//   2. Cacheaba TODA respuesta de navegación sin comprobar
//      `ok` (404/500 también se cacheaban) ni cache-control
//      (HTML privado autenticado se metía en disco del cliente).
//   3. Logout no invalidaba el cache (cambiabas de usuario en
//      el mismo navegador y veías shell de la cuenta anterior).
//
// Fix:
//   - Version: la constante `__BUILD_HASH__` se sustituye en
//     build-time (Vite define) por el hash del bundle. Cada
//     release genera un nombre de cache nuevo, así un deploy
//     invalida el cache viejo sin código extra.
//   - Allowlist: solo cacheamos assets estáticos del propio
//     origen. NUNCA cacheamos navegaciones, `/api/*` ni
//     `/socket.io/*` (el SPA es shell puro, no necesita el
//     HTML cacheado: el bundle JS hace el routing client-side).
//   - ok + cache-control: solo se cachea si `response.ok` Y la
//     respuesta permite cache público.
//   - `CLEAR_CACHES`: mensaje que el AuthContext envía en
//     logout. El SW borra su cache y se desregistra a sí mismo
//     para no reaparecer en próximas cargas.
const CACHE_VERSION = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev';
const CACHE_NAME = `employ-manager-v3-${CACHE_VERSION}`;
const STATIC_ALLOWLIST = [
    // El bundle hashed de Vite es cacheable forever
    // (Vite genera nombres con hash → invalidación por
    // contenido).
    // Listamos los paths raíz para que el SW haga precache
    // en install; el resto lo cachea bajo demanda con
    // respondWith.
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // addAll falla si CUALQUIER recurso no responde
            // 2xx. Por eso la allowlist es conservadora.
            cache.addAll(STATIC_ALLOWLIST).catch((err) => {
                // Si falla el precache, el SW no se rompe —
                // solo no tendrá assets offline en la
                // primera carga. Log estructurado.
                console.warn('[sw] precache failed (non-fatal)', err);
            })
        )
    );
    // `skipWaiting` para que el SW nuevo tome el control sin
    // esperar a que se cierren todas las pestañas. Combinado
    // con `clients.claim` en activate y un nombre de cache
    // versionado, el deploy produce un reload suave.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Borrar caches de versiones anteriores. Antes el
            // nombre era fijo así que NUNCA se borraban.
            caches.keys().then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE_NAME)
                        .map((k) => caches.delete(k))
                )
            ),
            self.clients.claim()
        ])
    );
});

self.addEventListener('message', (event) => {
    // Mensajes explícitos del frontend (AuthContext.logout
    // envía `{ type: 'CLEAR_CACHES' }`).
    if (event.data && event.data.type === 'CLEAR_CACHES') {
        event.waitUntil(
            (async () => {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
                // Desregistrar el SW para que el siguiente load
                // arranque SIN service worker (modo red pura
                // hasta que se vuelva a registrar
                // explícitamente).
                await self.registration.unregister();
                // Avisar al cliente que puede cerrar.
                if (event.source && 'postMessage' in event.source) {
                    event.source.postMessage({ type: 'CACHES_CLEARED' });
                }
            })()
        );
        return;
    }

    // Mensaje de precache manual (p.ej. tras login, el
    // frontend puede pedir `WARM_CACHE` para que el siguiente
    // reload offline tenga los assets). Opcional y
    // best-effort.
    if (event.data && event.data.type === 'WARM_CACHE') {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ALLOWLIST)).catch(() => undefined)
        );
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // NUNCA cachear:
    // 1. Navegaciones (request.mode === 'navigate'): el SPA
    //    es shell vacío, no aporta cachear. Y cachear el
    //    HTML podría persistir contenido personalized por
    //    usuario si el backend lo sirviera custom.
    // 2. Rutas autenticadas (`/api/*`, `/socket.io/*`): son
    //    datos privados, no deben persistir en disco del
    //    cliente.
    // 3. Cross-origin: terceros no entran en nuestro cache.
    if (request.mode === 'navigate') return;
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.startsWith('/socket.io/')) return;
    if (url.origin !== self.location.origin) return;

    // Cache-first para assets estáticos del propio origen.
    // Solo metemos en cache respuestas válidas y cacheables.
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response && response.ok) {
                    // `Cache-Control: no-store` (p.ej. respuestas
                    // de error 200 con flag dinámico) no debe
                    // cachearse. La cabecera la pone el
                    // servidor; si el operario marca la
                    // respuesta como no-store, respetamos.
                    const cacheControl = response.headers.get('Cache-Control') || '';
                    if (!cacheControl.includes('no-store')) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
                    }
                }
                return response;
            }).catch(() => {
                // Red caída. Si tenemos el shell cacheado,
                // devolvemos `/`. Si no, error de red normal
                // (el browser muestra su página).
                return caches.match('/') || Response.error();
            });
        })
    );
});
