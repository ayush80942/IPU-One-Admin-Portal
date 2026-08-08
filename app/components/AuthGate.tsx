"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { verifySession } from "../lib/auth";

/**
 * Wraps every page except the sign-in screen. This is a convenience gate, not the security
 * boundary — the real enforcement is the backend refusing any admin route without a valid
 * bearer token. Its job is to keep an unauthenticated visitor from seeing an application shell
 * full of failed requests, and to send an expired session back to sign-in.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === "/login";
  const [state, setState] = useState<"checking" | "in" | "out">(isLoginRoute ? "in" : "checking");

  useEffect(() => {
    // The sign-in route returns children before `state` is ever read, so there is nothing to
    // set here - just skip the session probe.
    if (isLoginRoute) return;

    let cancelled = false;
    verifySession().then((ok) => {
      if (cancelled) return;
      if (ok) {
        setState("in");
      } else {
        setState("out");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });

    return () => { cancelled = true; };
  }, [pathname, isLoginRoute, router]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  // Render nothing rather than a flash of the shell while the probe is in flight or the
  // redirect is being applied.
  if (state !== "in") {
    return null;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </>
  );
}
