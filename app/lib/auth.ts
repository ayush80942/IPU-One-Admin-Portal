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

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.message || fallback;
  } catch {
    return fallback;
  }
}

/**
 * A super admin "logging in as" another account (see AdminUserService#impersonate on the
 * backend) - swaps the stored session for the target account's own, with no password exchanged.
 * The caller is responsible for navigating away afterwards so the whole app shell re-reads the
 * new session rather than showing a stale super-admin view under an institute admin's token.
 */
export async function impersonate(adminId: string): Promise<AdminSession> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/admin/admins/${adminId}/impersonate`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Couldn't log in as this admin (${res.status})`));
  }
  const body = await res.json();
  storeSession(body.token, body.admin);
  return body.admin as AdminSession;
}

/** Hands a super admin their own session back after {@link impersonate}, with no password
 *  prompt - see AdminAuthController#exitImpersonation on the backend. */
export async function exitImpersonation(): Promise<AdminSession> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/admin/auth/exit-impersonation`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Couldn't exit "log in as" (${res.status})`));
  }
  const body = await res.json();
  storeSession(body.token, body.admin);
  return body.admin as AdminSession;
}

/**
 * Requests a password-reset OTP by email. Always resolves the same way whether or not the
 * address belongs to an account - see AdminAuthController#forgotPassword's Javadoc - so this
 * never tells the caller which way it went.
 */
export async function requestAdminPasswordResetOtp(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Couldn't send the OTP (${res.status})`));
  }
}

/** Verifies the OTP from {@link requestAdminPasswordResetOtp} and sets the new password. */
export async function resetAdminPasswordWithOtp(email: string, otp: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, newPassword }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Couldn't reset the password (${res.status})`));
  }
}
