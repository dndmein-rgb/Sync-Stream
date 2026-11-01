const ACCESS = "ss_access";
const REFRESH = "ss_refresh";
const USER = "ss_user";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setSession(opts: {
  accessToken: string;
  refreshToken: string;
  user?: StoredUser;
}) {
  localStorage.setItem(ACCESS, opts.accessToken);
  localStorage.setItem(REFRESH, opts.refreshToken);
  if (opts.user) localStorage.setItem(USER, JSON.stringify(opts.user));
}

export function setAccessToken(token: string) {
  localStorage.setItem(ACCESS, token);
}

export function clearSession() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}