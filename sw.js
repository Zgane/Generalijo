/* Lupina PWA. Ob spremembi predpomnjenih datotek povečaj VERSION. */
const VERSION = "v2";
const SHELL_CACHE = `generali-mail-${VERSION}`;
const SHARE_CACHE = "generali-share";

const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/pdf.js",
  "./lib/config.js",
  "./lib/mask.js",
  "./lib/email.js",
  "./lib/money.js",
  "./lib/validate.js",
  "./lib/files.js",
  "./lib/fields.js",
  "./lib/polja.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== SHELL_CACHE && key !== SHARE_CACHE).map((key) => caches.delete(key)),
  )));
  self.clients.claim();
});

function scopeUrl(path) {
  return new URL(path, self.registration.scope);
}

async function handleShare(request) {
  const form = await request.formData();
  let file = form.get("pdf");
  if (!file || typeof file === "string") {
    for (const value of form.values()) {
      if (value && typeof value !== "string" && value.size) {
        file = value;
        break;
      }
    }
  }
  if (!file || typeof file === "string") {
    return Response.redirect(scopeUrl("./?shared=0"), 303);
  }
  const cache = await caches.open(SHARE_CACHE);
  const name = file.name || "polica.pdf";
  await cache.put(scopeUrl("shared-pdf"), new Response(file, {
    headers: { "Content-Type": file.type || "application/pdf" },
  }));
  await cache.put(scopeUrl("shared-pdf-name"), new Response(name, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  }));
  return Response.redirect(scopeUrl("./?shared=1"), 303);
}

async function serveShared(path) {
  const cache = await caches.open(SHARE_CACHE);
  const url = scopeUrl(path);
  const hit = await cache.match(url);
  if (!hit) return new Response("Ni datoteke.", { status: 404 });
  await cache.delete(url);
  return hit;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (event.request.method === "POST" && (path === "/share" || path.endsWith("/share"))) {
    event.respondWith(handleShare(event.request));
    return;
  }
  if (event.request.method === "GET" && path.endsWith("/shared-pdf")) {
    event.respondWith(serveShared("shared-pdf"));
    return;
  }
  if (event.request.method === "GET" && path.endsWith("/shared-pdf-name")) {
    event.respondWith(serveShared("shared-pdf-name"));
    return;
  }
  if (event.request.method !== "GET") return;

  /* Klici modela gredo vedno v omrežje in se ne shranjujejo. */
  if (path.startsWith("/api/") || path.startsWith("/.netlify/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const fresh = await fetch(event.request);
      if (fresh.ok) cache.put(event.request, fresh.clone());
      return fresh;
    } catch {
      const hit = await cache.match(event.request) || await cache.match("./index.html");
      if (hit) return hit;
      return new Response("Brez povezave.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
