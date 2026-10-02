export interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "user";
  displayName?: string;
}

export function getToken(): string | null {
  return localStorage.getItem("lf_token");
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem("lf_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem("lf_token", token);
  localStorage.setItem("lf_user", JSON.stringify(user));
}

export function clearToken() {
  localStorage.removeItem("lf_token");
  localStorage.removeItem("lf_user");
}
