// Service worker do Bolso: guarda o app para abrir sem internet.
// A cada nova versão, VERSION muda (igual a APP_VERSION em app.js) e o app oferece "Atualizar".
const VERSION = "1.4.6";
const CACHE = "bolso-" + VERSION;
const SHELL = ["./", "./index.html", "./app.js", "./app.css", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./logo-128.png"];

// cache: "reload" garante que a versão nova baixe os arquivos novos (sem passar pelo cache HTTP).
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("bolso-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return; // Google e Drive nunca passam pelo cache
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))));
});
