export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const API_BASE = "https://backend.autointel.cloud";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function setTokens(access?: string | null, refresh?: string | null) {
  if (typeof window === "undefined") return;
  if (access !== undefined && access !== null) {
    localStorage.setItem("token", access);
  }
  if (refresh !== undefined && refresh !== null) {
    localStorage.setItem("token", refresh);
  }
}

export async function apiFetch<T = any>(
  path: string,
  opts: {
    method?: HttpMethod;
    headers?: Record<string, string>;
    body?: any;
    isForm?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(opts.isForm ? {} : { "Content-Type": "application/json" }),
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.isForm
      ? opts.body
      : opts.body
      ? JSON.stringify(opts.body)
      : undefined,
    signal: opts.signal,
    credentials: "include",
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      msg += ` ${text}`;
    } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

// Auth APIs
export async function registerUser(body: {
  name: string;
  email: string;
  password: string;
}) {
  return apiFetch<string>("/api/v1/register", { method: "POST", body });
}

export async function loginUser(body: { email: string; password: string }) {
  const resp = await apiFetch<string>("/api/v1/login", {
    method: "POST",
    body,
  });
  // Expect backend to return tokens; if string, try to parse
  try {
    const parsed = JSON.parse(resp as unknown as string);
    setTokens(parsed.access_token, parsed.refresh_token);
  } catch {
    // ignore
  }
  return resp;
}

export async function verifyOtp(body: { otp: string; session_id: string }) {
  return apiFetch<string>("/api/v1/verify/otp", { method: "PUT", body });
}

export async function resendOtp(session_id: string) {
  return apiFetch<string>(
    `/api/v1/resend-otp?session_id=${encodeURIComponent(session_id)}`,
    { method: "POST" }
  );
}

export async function refreshToken() {
  const resp = await apiFetch<string>("/api/v1/refresh-token", {
    method: "POST",
  });
  try {
    const parsed = JSON.parse(resp as unknown as string);
    setTokens(parsed.access_token, parsed.refresh_token);
  } catch {}
  return resp;
}

export async function getUserInfo() {
  return apiFetch<string>("/api/v1/user", { method: "GET" });
}

export async function updateUserInfo(
  params: Record<string, string | number | boolean | null | undefined>,
  file?: File
) {
  const form = new FormData();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, String(v));
  });
  if (file) form.append("profile_pic", file);
  return apiFetch<string>("/api/v1/user", {
    method: "PUT",
    body: form,
    isForm: true,
  });
}

export async function deleteUser() {
  return apiFetch<string>("/api/v1/user", { method: "DELETE" });
}

// SQL proxy endpoints (question param)
export async function queryPostgres(question: string) {
  return apiFetch<string>(
    `/api/v1/postgresql?question=${encodeURIComponent(question)}`,
    { method: "POST" }
  );
}

export async function querySqlite(question: string) {
  return apiFetch<string>(
    `/api/v1/sqlite?question=${encodeURIComponent(question)}`,
    { method: "POST" }
  );
}

export async function queryMysql(question: string) {
  return apiFetch<string>(
    `/api/v1/mysql?question=${encodeURIComponent(question)}`,
    { method: "POST" }
  );
}

export function logout() {
  setTokens("", "");
  if (typeof window !== "undefined") {
    localStorage.removeItem("ai_access_token");
    localStorage.removeItem("ai_refresh_token");
  }
}
