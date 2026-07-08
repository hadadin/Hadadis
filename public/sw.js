// Minimal service worker — installability only (no offline caching in Phase 1;
// the dashboard never needs to work offline, per PRD, so we keep this simple).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // no-op: always hit the network. Present so the app is installable as a PWA.
});
