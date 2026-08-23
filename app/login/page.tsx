"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { login } from "../lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      const next = params.get("next");
      // Only same-site paths: a full URL here would turn the sign-in screen into an open
      // redirect that could bounce an authenticated operator to an attacker's page.
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={submit} className="bg-surface border border-border rounded-2xl shadow-sm p-6">
        <div className="flex flex-col items-center mb-8">
          {/* The IPU One mark, not the university's — this app isn't affiliated with GGSIPU.
              Diverges from the Android app's sign-in screen (IPUOneApp res/drawable/logo.png),
              which still shows the university lockup; that one's unchanged for now. */}
          <Image
            src="/logo.png"
            alt="IPU One"
            width={220}
            height={132}
            priority
            className="h-16 w-auto"
          />
          <p className="text-[13px] font-bold text-primary mt-6">Admin Portal</p>
        </div>

        <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Email</label>
        <div className="relative mb-4">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            placeholder="studentcell.usar@ipu.ac.in"
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide">Password</label>
          <Link href="/forgot-password" className="text-[11px] font-semibold text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative mb-5">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-danger-faint text-danger text-[13px] font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background">
      {/* useSearchParams needs a Suspense boundary to keep this page prerenderable. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
