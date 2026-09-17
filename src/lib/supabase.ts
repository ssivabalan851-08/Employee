const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "https://cytxktquenuninwgbrxh.supabase.co").replace(/\/$/, "");
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_98P5um_PQX3NqNL784K4ew_yWfrRKex";

let accessToken: string | null = null;

export interface SupabaseAuthUser {
  id: string;
  email?: string;
  identities?: unknown[];
  user_metadata?: Record<string, unknown>;
}

export interface AccountApprovalResult {
  ok: boolean;
  title: string;
  message: string;
  kind: "success" | "warning" | "error";
}

function configurationError() {
  return new Error("Supabase is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the site environment.");
}

async function parseResponse(response: Response) {
  const body = await response.text();
  let data: any = null;
  if (body) {
    try { data = JSON.parse(body); }
    catch { data = { error: body }; }
  }
  if (!response.ok) {
    const rawMessage = data?.msg || data?.message || data?.error_description || data?.error || `Supabase request failed (${response.status}).`;
    const message = /permission denied|row-level security|42501/i.test(String(rawMessage))
      ? "The account service could not complete this request. Please try again shortly."
      : String(rawMessage);
    throw new Error(message);
  }
  return data;
}

function authHeaders(token = accessToken) {
  if (!supabaseUrl || !supabaseKey) throw configurationError();
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${token || supabaseKey}`,
    "Content-Type": "application/json",
  };
}

export const supabaseAuth = {
  isConfigured: Boolean(supabaseUrl && supabaseKey),
  async signInWithPassword(email: string, password: string) {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: authHeaders(null), body: JSON.stringify({ email, password }) });
    const data = await parseResponse(response);
    accessToken = data.access_token;
    return data.user as SupabaseAuthUser;
  },
  async signUp(email: string, password: string, metadata: Record<string, unknown>) {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, { method: "POST", headers: authHeaders(null), body: JSON.stringify({ email, password, data: metadata }) });
    const data = await parseResponse(response);
    if (!data?.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0)) {
      throw new Error("An account already exists for this email.");
    }
    accessToken = data.access_token || null;
    return { user: data.user as SupabaseAuthUser, hasSession: Boolean(data.access_token) };
  },
  async requestAccountApproval(userId: string) {
    if (!accessToken) throw new Error("A secure signup session was not created. Confirm email must remain disabled for administrator-approved accounts.");
    const response = await fetch(`${supabaseUrl}/functions/v1/account-approval`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "request", user_id: userId }),
    });
    await parseResponse(response);
  },
  async decideAccountApproval(token: string, decision: "approve" | "reject") {
    const response = await fetch(`${supabaseUrl}/functions/v1/account-approval`, {
      method: "POST",
      headers: authHeaders(null),
      body: JSON.stringify({ action: "decide", token, decision }),
    });
    return parseResponse(response) as Promise<AccountApprovalResult>;
  },
  signInWithGoogle() {
    if (!supabaseUrl || !supabaseKey) throw configurationError();
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(`${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  },
  async consumeOAuthRedirect() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("access_token");
    if (!token) return null;
    accessToken = token;
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return this.getUser();
  },
  async getUser() {
    if (!accessToken) return null;
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: authHeaders() });
    return (await parseResponse(response)) as SupabaseAuthUser;
  },
  async signOut() {
    if (!accessToken) return;
    try { await fetch(`${supabaseUrl}/auth/v1/logout`, { method: "POST", headers: authHeaders() }); }
    finally { accessToken = null; }
  },
};

export async function supabaseRequest<T>(path: string, options: RequestInit & { prefer?: string } = {}): Promise<T> {
  if (!accessToken) throw new Error("Your session has ended. Please sign in again.");
  const headers = { ...authHeaders(), ...(options.headers || {}) } as Record<string, string>;
  if (options.prefer) headers.Prefer = options.prefer;
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...options, headers });
  return parseResponse(response) as Promise<T>;
}

export function callRpc<T>(name: string, args: Record<string, unknown> = {}) {
  return supabaseRequest<T>(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
}
