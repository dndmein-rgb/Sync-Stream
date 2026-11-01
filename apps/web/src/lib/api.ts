import { config } from "./config";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setSession,
  type StoredUser,
} from "./auth-storage";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiSuccess<T> = {
  success: true;
  message?: string;
  data: T;
};

type ApiFail = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${config.apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const body = (await parseJson(res)) as
        | ApiSuccess<{
            accessToken: string;
            refreshToken: string;
            expiresIn: string;
          }>
        | ApiFail
        | null;
      if (!res.ok || !body || !("success" in body) || !body.success) {
        clearSession();
        return null;
      }
      setSession({
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
      });
      return body.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean; retry?: boolean } = {},
): Promise<T> {
  const { auth = true, retry = true } = opts;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${config.apiUrl}${path}`, { ...init, headers });
  const body = await parseJson(res);

  if (res.status === 401 && auth && retry) {
    const next = await refreshAccessToken();
    if (next) {
      setAccessToken(next);
      return apiFetch<T>(path, init, { auth, retry: false });
    }
  }

  if (!res.ok) {
    const fail = body as ApiFail | null;
    throw new ApiError(
      res.status,
      fail?.error?.code ?? "HTTP_ERROR",
      (fail?.error?.message ?? res.statusText) || "Request failed",
    );
  }

  if (body && typeof body === "object" && "success" in body && body.success) {
    return (body as ApiSuccess<T>).data;
  }
  return body as T;
}

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthResult = {
  user: StoredUser;
  tokens: TokenPair;
};

export const authApi = {
  register(input: { email: string; password: string; name: string }) {
    return apiFetch<AuthResult>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(input) },
      { auth: false },
    );
  },
  login(input: { email: string; password: string }) {
    return apiFetch<AuthResult>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(input) },
      { auth: false },
    );
  },
  me() {
    return apiFetch<StoredUser>("/auth/me");
  },
  logout() {
    const refreshToken = getRefreshToken();
    return apiFetch<{ success?: boolean }>(
      "/auth/logout",
      { method: "POST", body: JSON.stringify({ refreshToken }) },
      { auth: false },
    ).catch(() => null);
  },
};

export type RoomView = {
  id: string;
  code: string;
  name: string;
  visibility: "PRIVATE" | "PUBLIC";
  hostId: string;
  maxMembers: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  myRole?: "HOST" | "CO_HOST" | "VIEWER";
};

export const roomsApi = {
  create(input: {
    name: string;
    visibility?: "PRIVATE" | "PUBLIC";
    maxMembers?: number;
  }) {
    return apiFetch<RoomView>("/rooms", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  joinByCode(code: string) {
    return apiFetch<{ room: RoomView; members: unknown[]; created: boolean }>(
      "/rooms/join",
      { method: "POST", body: JSON.stringify({ code }) },
    );
  },
  get(id: string) {
    return apiFetch<RoomView>(`/rooms/${id}`);
  },
  leave(id: string) {
    return apiFetch<unknown>(`/rooms/${id}/leave`, { method: "POST" });
  },
};