import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ToastContext = createContext(null);

const TYPE_STYLE = {
  success: { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
  error: { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  warning: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  info: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" }
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const removeToast = useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "info", duration = 3000) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setItems((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        window.setTimeout(() => removeToast(id), duration);
      }
      return id;
    },
    [removeToast]
  );

  const value = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);

  useEffect(() => {
    const handleGlobalToast = (e) => {
      const { message, type } = e.detail || {};
      if (message) showToast(message, type || "info");
    };
    window.addEventListener("app:toast", handleGlobalToast);
    return () => window.removeEventListener("app:toast", handleGlobalToast);
  }, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 2000
        }}
      >
        {items.map((toast) => {
          const s = TYPE_STYLE[toast.type] || TYPE_STYLE.info;
          return (
            <div
              key={toast.id}
              style={{
                minWidth: 280,
                maxWidth: 420,
                background: s.bg,
                color: s.color,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{toast.message}</div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: s.color,
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
