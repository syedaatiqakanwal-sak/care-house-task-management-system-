import api from "../api";

const VAPID_CACHE_KEY = "lca_vapid_public_key";
const PERMISSION_ASKED_KEY = "lca_notif_permission_asked";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function notificationSupport() {
  return {
    supported: typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator,
    permission: typeof Notification !== "undefined" ? Notification.permission : "denied"
  };
}

export async function registerMessageServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("SW register failed", err);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  localStorage.setItem(PERMISSION_ASKED_KEY, "1");
  return result;
}

export function hasAskedNotificationPermission() {
  return localStorage.getItem(PERMISSION_ASKED_KEY) === "1";
}

export async function ensurePushSubscription(userPrefs = {}) {
  if (userPrefs.desktop_notifications_enabled === false) return null;
  const { supported } = notificationSupport();
  if (!supported) return null;

  const permission =
    Notification.permission === "default" && !hasAskedNotificationPermission()
      ? await requestNotificationPermission()
      : Notification.permission;

  if (permission !== "granted") return null;

  const reg = await registerMessageServiceWorker();
  if (!reg?.pushManager) return null;

  let publicKey = sessionStorage.getItem(VAPID_CACHE_KEY);
  if (!publicKey) {
    const res = await api.get("/messages/push/vapid-public-key");
    publicKey = res.data?.publicKey;
    if (publicKey) sessionStorage.setItem(VAPID_CACHE_KEY, publicKey);
  }
  if (!publicKey) return null;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  await api.post("/messages/push/subscribe", { subscription });
  return subscription;
}

export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager?.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    try {
      await api.post("/messages/push/unsubscribe", { endpoint });
    } catch {
      /* ignore */
    }
  }
}

export function showDesktopNotification({ title, body, conversationId, tag }) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  try {
    const n = new Notification(title || "New Message", {
      body: body || "You have a new message",
      icon: "/letscare-logo.png",
      tag: tag || `conversation-${conversationId || "general"}`,
      renotify: true,
      data: { conversationId, url: conversationId ? `/messages?conversation=${conversationId}` : "/messages" }
    });
    n.onclick = () => {
      window.focus();
      if (conversationId) {
        window.dispatchEvent(
          new CustomEvent("messages:open-conversation", { detail: { conversationId: Number(conversationId) } })
        );
      }
      n.close();
    };
  } catch {
    /* ignore */
  }
}
