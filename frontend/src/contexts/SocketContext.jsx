import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import {
  ensurePushSubscription,
  registerMessageServiceWorker,
  showDesktopNotification
} from "../utils/desktopNotifications";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { accessToken, isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const listenersRef = useRef(new Map());
  const activeConversationRef = useRef(null);

  useEffect(() => {
    const onActive = (e) => {
      activeConversationRef.current = e.detail?.conversationId || null;
    };
    window.addEventListener("messages:active-conversation", onActive);
    return () => window.removeEventListener("messages:active-conversation", onActive);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return undefined;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const s = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: accessToken }
    });

    setSocket(s);
    registerMessageServiceWorker().catch(() => {});
    ensurePushSubscription(user).catch(() => {});

    const onSwMessage = (event) => {
      if (event.data?.type === "NOTIFICATION_CLICK") {
        const cid = event.data.conversationId;
        if (cid) {
          window.dispatchEvent(
            new CustomEvent("messages:open-conversation", { detail: { conversationId: Number(cid) } })
          );
          if (window.location.pathname !== "/messages") {
            window.location.href = `/messages?conversation=${cid}`;
          }
        }
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", onSwMessage);

    return () => {
      try {
        listenersRef.current.forEach((wrapped, event) => {
          s.off(event, wrapped);
        });
      } catch {
        /* ignore cleanup errors */
      }
      listenersRef.current.clear();
      navigator.serviceWorker?.removeEventListener?.("message", onSwMessage);
      s.disconnect();
      setSocket(null);
    };
  }, [accessToken, isAuthenticated, user]);

  useEffect(() => {
    if (!socket) return undefined;
    const onToastShow = ({ message, type } = {}) => {
      if (!message) return;
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: { message, type: type || "info" }
        })
      );
    };

    const onNotificationNew = (payload = {}) => {
      if (payload.type !== "message") return;
      const conversationId = payload.conversationId || null;
      const viewingSame =
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        activeConversationRef.current &&
        Number(activeConversationRef.current) === Number(conversationId);

      if (viewingSame) return;
      if (user?.desktop_notifications_enabled === false) return;

      showDesktopNotification({
        title: payload.title || "New Message",
        body: user?.notification_preview_enabled === false ? "You have a new message" : payload.body,
        conversationId,
        tag: `conversation-${conversationId || "general"}`
      });
    };

    socket.on("toast:show", onToastShow);
    socket.on("notification:new", onNotificationNew);
    return () => {
      socket.off("toast:show", onToastShow);
      socket.off("notification:new", onNotificationNew);
    };
  }, [socket, user]);

  const value = useMemo(
    () => ({
      socket,
      on(event, handler) {
        if (!socket || !event || typeof handler !== "function") return;
        socket.on(event, handler);
      },
      off(event, handler) {
        if (!socket || !event) return;
        if (handler) socket.off(event, handler);
        else socket.off(event);
      },
      emit(event, ...args) {
        if (!socket || !event) return;
        socket.emit(event, ...args);
      }
    }),
    [socket]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
