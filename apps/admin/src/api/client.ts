const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const setSessionLostHandler = (fn: () => void) => {
  onSessionLost = fn;
};

/** Pide un access token nuevo. Las llamadas simultáneas comparten una sola petición (el refresh rota). */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (r) => {
      if (!r.ok) return null;
      const body = (await r.json()) as { accessToken: string };
      accessToken = body.accessToken;
      return accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function api<T>(path: string, { method = "GET", body, auth = true }: Options = {}): Promise<T> {
  const send = () =>
    fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined && !(body instanceof FormData) && { "Content-Type": "application/json" }),
        ...(auth && accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && auth) {
      const fresh = await refreshAccessToken();
      if (!fresh) {
        onSessionLost?.();
      } else {
        res = await send();
      }
    }
  } catch {
    throw new ApiError(0, "network", "network");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? "Error", e?.issues ?? []);
  }
  return data as T;
}
