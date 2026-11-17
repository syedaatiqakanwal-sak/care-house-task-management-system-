/* Lets Care All messaging service worker */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "New Message", body: "You have a new message", url: "/messages" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      data.body = event.data?.text() || data.body;
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "New Message", {
      body: data.body || "You have a new message",
      icon: "/letscare-logo.png",
      badge: "/letscare-logo.png",
      tag: data.tag || "letscare-message",
      renotify: true,
      data: {
        url: data.url || "/messages",
        conversationId: data.conversationId || null
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/messages";
  const conversationId = event.notification?.data?.conversationId;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          await client.focus();
          client.postMessage({
            type: "NOTIFICATION_CLICK",
            url: targetUrl,
            conversationId
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        const url = conversationId ? `/messages?conversation=${conversationId}` : targetUrl;
        await self.clients.openWindow(url);
      }
    })()
  );
});
