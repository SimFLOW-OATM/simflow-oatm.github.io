const cacheName = "organisation-vacation-v159";
const appShell = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/tesseract/tesseract.min.js",
  "./vendor/tesseract/worker.min.js",
  "./vendor/tesseract/tesseract-core.wasm.js",
  "./vendor/tesseract/tesseract-core-simd.wasm.js",
  "./vendor/tesseract/tesseract-core-relaxedsimd.wasm.js",
  "./vendor/tesseract/tesseract-core-lstm.wasm.js",
  "./vendor/tesseract/tesseract-core-simd-lstm.wasm.js",
  "./vendor/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js",
  "./vendor/tesseract/lang/eng.traineddata.gz"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => cache.addAll(appShell))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => (
        cached || caches.match("./index.html")
      )))
  );
});
