import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { saveSession } from "../lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { username, password });
      saveSession(res.data.token, res.data.user);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
      <div className="md3-card md3-card--outlined" style={{ width: "100%", maxWidth: 440 }}>
        <h2 className="md3-card__title">Masuk ke LightFlow</h2>
        <p className="md3-card__supporting">
          Workflow automation ringan — Telegram, WAHA, AI.
        </p>
        <form className="md3-form" onSubmit={submit}>
          {error && <div className="md3-error">{error}</div>}
          <div className="md3-text-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="md3-text-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="md3-form__actions">
            <button className="md3-button md3-button--filled" disabled={loading}>
              {loading ? "Masuk..." : "Masuk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
