import axios from "axios";

export const api = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("lf_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (!err?.response) {
      // Backend mati / URL salah / CORS — axios cuma kasih "Network Error"
      err.message = "Backend tidak terjangkau. Pastikan container lightflow jalan (docker compose up) di :4000.";
    } else if (err?.response?.status === 401 && !location.pathname.startsWith("/login")) {
      localStorage.removeItem("lf_token");
      localStorage.removeItem("lf_user");
      location.href = "/login";
    }
    return Promise.reject(err);
  }
);
