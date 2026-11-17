import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

function decodeJwtPayload(accessToken) {
  if (!accessToken || typeof accessToken !== "string") return null;
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readStoredSession() {
  if (typeof window === "undefined") return { user: null, accessToken: null };
  const token = localStorage.getItem("accessToken");
  if (!token) return { user: null, accessToken: null };
  const savedUser = localStorage.getItem("user");
  if (savedUser) {
    try {
      return { user: JSON.parse(savedUser), accessToken: token };
    } catch {
      /* ignore bad localStorage user */
    }
  }
  const payload = decodeJwtPayload(token);
  const id = payload?.sub != null ? Number(payload.sub) : null;
  const user =
    id && !Number.isNaN(id)
      ? { id, email: "session", Role: null }
      : { email: "session" };
  return { user, accessToken: token };
}

export function AuthProvider({ children }) {
  const initial = readStoredSession();
  const [user, setUser] = useState(initial.user);
  const [accessToken, setAccessToken] = useState(initial.accessToken);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (!cancelled) {
          setUser(data);
          localStorage.setItem("user", JSON.stringify(data));
        }
      } catch {
        /* keep JWT session shape */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      isAuthenticated: !!(user && accessToken),
      async refreshUser() {
        try {
          const res = await api.get("/auth/me");
          const userData = res.data?.user || res.data;
          setUser(userData);
          localStorage.setItem("user", JSON.stringify(userData));
          return userData;
        } catch (err) {
          console.error("Refresh user failed:", err);
          return null;
        }
      },
      async login(email, password) {
        setLoading(true);
        try {
          const { data } = await api.post("/auth/login", { email, password });
          if (data.requiresTwoFactor) return data;
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          setAccessToken(data.accessToken);
          try {
            const me = await api.get("/auth/me");
            setUser(me.data);
            localStorage.setItem("user", JSON.stringify(me.data));
          } catch {
            const fallback = data.user || { email };
            setUser(fallback);
            localStorage.setItem("user", JSON.stringify(fallback));
          }
          return data;
        } finally {
          setLoading(false);
        }
      },
      async verify2fa(preAuthToken, otp) {
        const { data } = await api.post("/auth/verify-2fa", { preAuthToken, otp });
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        setAccessToken(data.accessToken);
        try {
          const me = await api.get("/auth/me");
          setUser(me.data);
          localStorage.setItem("user", JSON.stringify(me.data));
        } catch {
          const payload = decodeJwtPayload(data.accessToken);
          const id = payload?.sub != null ? Number(payload.sub) : null;
          const fallback = id && !Number.isNaN(id)
            ? { id, email: "authenticated", Role: null }
            : { email: "authenticated" };
          setUser(fallback);
          localStorage.setItem("user", JSON.stringify(fallback));
        }
        return data;
      },
      logout() {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        setAccessToken(null);
        setUser(null);
      }
    }),
    [user, accessToken, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
