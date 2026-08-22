"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Sidebar from "./Sidebar";
import { exitImpersonation, verifySession } from "../lib/auth";
import { isRouteAllowed } from "../lib/nav";
import type { AdminSession } from "../lib/api";

/** Routes reachable with no session at all - the sign-in screen and self-service password reset. */
const PUBLIC_ROUTES = ["/login", "/forgot-password"];

const SessionContext = createContext<AdminSession | null>(null);

/**
 * The signed-in account. Non-null anywhere inside the gate, so pages can read the role and
 * institutes without each re-probing /me.
 */
export function useAdminSession(): AdminSession | null {
  return useContext(SessionContext);
}

/** Whether the signed-in account may change university-wide configuration. */
export function useIsSuperAdmin(): boolean {
  return useContext(SessionContext)?.role === "SUPER_ADMIN";
}

/**
 * Wraps every page except the sign-in screen. This is a convenience gate, not the security
 * boundary — the real enforcement is the backend refusing any admin route without a valid
 * bearer token, and narrowing every read to the institutes that token's account covers. Its job
 * is to keep an unauthenticated visitor from seeing an application shell full of failed
 * requests, to send an expired session back to sign-in, and to keep an institute admin off the
 * university-wide pages the backend would refuse anyway.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const [state, setState] = useState<"checking" | "in" | "out">(isPublicRoute ? "in" : "checking");
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    // The sign-in/reset-password routes return children before `state` is ever read, so there
    // is nothing to set here - just skip the session probe.
    if (isPublicRoute) return;

    let cancelled = false;
    verifySession().then((admin) => {
      if (cancelled) return;
      if (!admin) {
        setState("out");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setSession(admin);
      if (!isRouteAllowed(pathname, admin)) {
        setState("out");
        router.replace("/");
        return;
      }
      setState("in");
    });

    return () => { cancelled = true; };
  }, [pathname, isPublicRoute, router]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Render nothing rather than a flash of the shell while the probe is in flight or the
  // redirect is being applied.
  if (state !== "in") {
    return null;
  }

  return (
    <SessionContext.Provider value={session}>
      <div className="flex flex-col h-full w-full">
        {session?.impersonatedByEmail && <ImpersonationBanner impersonatorEmail={session.impersonatedByEmail} />}
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-8">{children}</main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}

/**
 * Persistent while a super admin is "logged in as" another account - survives a page refresh
 * since it reads off the session, not local component state. Deliberately loud (fixed, full
 * width, high-contrast) since it is the only thing standing between an operator and forgetting
 * they are looking at someone else's account.
 */
function ImpersonationBanner({ impersonatorEmail }: { impersonatorEmail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const exit = async () => {
    setBusy(true);
    try {
      await exitImpersonation();
      router.replace("/admins");
      router.refresh();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="shrink-0 bg-gold text-primary px-4 py-2 text-[13px] font-semibold flex items-center justify-center gap-3 shadow-sm">
      <span>Logged in as this account on behalf of {impersonatorEmail}</span>
      <button
        onClick={exit}
        disabled={busy}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        <LogOut className="w-3.5 h-3.5" />
        {busy ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}
