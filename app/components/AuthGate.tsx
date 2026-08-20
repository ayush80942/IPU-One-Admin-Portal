"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { verifySession } from "../lib/auth";
import { isRouteAllowed } from "../lib/nav";
import type { AdminSession } from "../lib/api";

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

/** Routes reachable with no admin session at all — rendered standalone, no sidebar, no probe. */
const PUBLIC_ROUTES = ["/login", "/support"];

/**
 * Wraps every page except the sign-in screen and the public bug-report form. This is a
 * convenience gate, not the security boundary — the real enforcement is the backend refusing
 * any admin route without a valid bearer token, and narrowing every read to the institutes that
 * token's account covers. Its job is to keep an unauthenticated visitor from seeing an
 * application shell full of failed requests, to send an expired session back to sign-in, and to
 * keep an institute admin off the university-wide pages the backend would refuse anyway.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const [state, setState] = useState<"checking" | "in" | "out">(isPublicRoute ? "in" : "checking");
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    // Public routes return children before `state` is ever read, so there is nothing to set
    // here - just skip the session probe.
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
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </SessionContext.Provider>
  );
}
