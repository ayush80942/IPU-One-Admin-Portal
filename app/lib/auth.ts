"use client";

import { API_BASE, SESSION_KEY, TOKEN_KEY, type AdminSession } from "./api";

/**
 * sessionStorage, not localStorage: the token is a credential to students' personal details, so
 * it should not outlive the browser tab on what may well be a shared machine in a Student Cell
 * office.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

/**
 * The signed-in account, including its role and institutes. Read it to decide what to show — but
 * never treat it as the boundary: it is client-side state, and the backend is what actually
 * refuses the data.
 */
export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function getAdminEmail(): string | null {
  return getAdminSession()?.email ?? null;
}

export function isSuperAdmin(session: AdminSession | null): boolean {
  return session?.role === "SUPER_ADMIN";
}

/** "USAR" / "USAR, USICT" / "" — the institutes an account covers, for the portal's chrome. */
export function instituteLabel(session: AdminSession | null): string {
  if (!session || session.institutes.length === 0) return "";
  return session.institutes
    .map((i) => i.shortName || i.instituteName || i.instituteCode)
    .join(", ");
}

export function storeSession(token: string, session: AdminSession) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}

export async function login(email: string, password: string): Promise<AdminSession> {
  const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let message = `Sign-in failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // Non-JSON error body — the status-code message above is the best we have.
    }
    throw new Error(message);
  }

  const body = await res.json();
  storeSession(body.token, body.admin);
  return body.admin as AdminSession;
}

/**
 * Cheap probe used on load to tell a still-valid session from an expired one. It also refreshes
 * the stored session, so a role change or a reassigned institute takes effect on the next page
 * load rather than whenever the token happens to expire.
 */
export async function verifySession(): Promise<AdminSession | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/admin/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const session = (await res.json()) as AdminSession;
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}
