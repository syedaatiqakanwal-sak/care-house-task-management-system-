import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: 24
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            background: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
            padding: 24
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 8, color: "#0f172a", fontSize: 22, fontWeight: 800 }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
            The application encountered an unexpected error. You can retry or refresh.
          </p>
          {this.state.error?.message && (
            <pre
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                background: "#f8fafc",
                color: "#334155",
                fontSize: 12,
                overflowX: "auto"
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                background: "linear-gradient(135deg, #0D9488, #0F766E)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "10px 18px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
