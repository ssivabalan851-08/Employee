const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "https://cytxktquenuninwgbrxh.supabase.co").replace(/\/$/, "");
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_98P5um_PQX3NqNL784K4ew_yWfrRKex";

let accessToken: string | null = null;

export interface SupabaseAuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

function configurationError() {
  return new Error("Supabase is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the site environment.");
}

async function parseResponse(response: Response) {
  const body = await response.text();
  const data = body ? JSON.parse(body) : null;
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Supabase request failed (${response.status}).`);
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
    accessToken = data.access_token || null;
    return { user: data.user as SupabaseAuthUser, hasSession: Boolean(data.access_token) };
  },
  async requestAccountApproval(userId: string) {
    const response = await fetch(`${supabaseUrl}/functions/v1/account-approval`, {
      method: "POST",
      headers: authHeaders(null),
      body: JSON.stringify({ action: "request", user_id: userId }),
    });
    await parseResponse(response);
  },
  async resendSignUpConfirmation(email: string) {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const response = await fetch(`${supabaseUrl}/auth/v1/resend?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: authHeaders(null),
      body: JSON.stringify({ type: "signup", email }),
    });
    await parseResponse(response);
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
