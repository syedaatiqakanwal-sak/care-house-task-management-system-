import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError("Failed to send reset email. Check your email address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        padding: "20px"
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px",
          padding: "40px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0F766E" }}>Lets Care All</div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "8px 0 4px" }}>Reset Password</h2>
          <p style={{ color: "#64748b", fontSize: "13px" }}>Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              color: "#16a34a"
            }}
          >
            Reset link sent! Check your email.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "12px",
                  color: "#dc2626",
                  fontSize: "13px",
                  marginBottom: "16px"
                }}
              >
                {error}
              </div>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1.5px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "14px",
                marginBottom: "16px",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box"
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: loading ? "#e2e8f0" : "linear-gradient(135deg, #0D9488, #0F766E)",
                color: loading ? "#94a3b8" : "#fff",
                border: "none",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit"
              }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#64748b" }}>
          Remember your password?{" "}
          <Link to="/login" style={{ color: "#0D9488" }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
