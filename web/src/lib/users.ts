import { api } from "./api";
import type { ThemePref } from "./theme";

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  themePreference: ThemePref;
  role: "admin" | "user";
}

interface ProfileResponse {
  user: UserProfile;
}

export async function getMyProfile(): Promise<UserProfile> {
  const res = await api.get<ProfileResponse>("/api/users/me");
  return res.data.user;
}

export interface UpdateProfileInput {
  username: string;
  displayName: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  const res = await api.put<ProfileResponse>("/api/users/me/profile", input);
  return res.data.user;
}

export interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function updatePassword(input: UpdatePasswordInput): Promise<{ ok: boolean }> {
  const res = await api.put<{ ok: boolean }>("/api/users/me/password", input);
  return res.data;
}

export async function updatePreferences(themePreference: ThemePref): Promise<UserProfile> {
  const res = await api.put<ProfileResponse>("/api/users/me/preferences", { themePreference });
  return res.data.user;
}
