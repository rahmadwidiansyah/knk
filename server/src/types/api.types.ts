export interface JwtPayload {
  sub: string; // user id
  username: string;
  role: "admin" | "user";
}

export interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "user";
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
