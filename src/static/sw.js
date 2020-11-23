// We don't need most of the thing a service worker can do for us, but the Web
// Share Target API requires a service worker be present before our app can be
// registered as a share target.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open("sw-cache").then(function (cache) {
      return;
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
