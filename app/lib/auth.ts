"use client";

import { API_BASE, TOKEN_KEY } from "./api";

const EMAIL_KEY = "ipuone.admin.email";

/**
 * sessionStorage, not localStorage: the token is a full-access credential to every student's
 * personal details, so it should not outlive the browser tab on what may well be a shared
 * machine in the Student Cell office.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function getAdminEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(EMAIL_KEY);
}

export function storeSession(token: string, email: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(EMAIL_KEY, email);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(EMAIL_KEY);
}

export async function login(email: string, password: string): Promise<{ token: string; email: string }> {
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
  return { token: body.token, email: body.email };
}

/** Cheap probe used on load to tell a still-valid session from an expired one. */
export async function verifySession(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/api/admin/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
