self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body, tag, url } = event.data;
  event.waitUntil(self.registration.showNotification(title || "LOGIPAY", {
    body: body || "",
    tag: tag || "logipay-notification",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: url || "/" },
  }));
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(payload.title || "LOGIPAY", {
    body: payload.body || "",
    tag: payload.tag || "logipay-push",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: payload.url || "/?section=notifications" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
