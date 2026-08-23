"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { KeyRound, Lock, Mail } from "lucide-react";
import { requestAdminPasswordResetOtp, resetAdminPasswordWithOtp } from "../lib/auth";

type Stage = "request" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestAdminPasswordResetOtp(email);
      setStage("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the OTP");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resetAdminPasswordWithOtp(email, otp, newPassword);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset the password");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="IPU One" width={220} height={132} priority className="h-16 w-auto" />
          <p className="text-[13px] text-muted mt-6">Reset your password</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-sm p-6">
          {stage === "request" && (
            <form onSubmit={sendOtp}>
              <p className="text-[13px] text-muted mb-4">
                Enter your admin account&rsquo;s email — we&rsquo;ll send a one-time code to it.
              </p>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Email</label>
              <div className="relative mb-5">
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
                {busy ? "Sending…" : "Send OTP"}
              </button>
            </form>
          )}

          {stage === "reset" && (
            <form onSubmit={resetPassword}>
              <p className="text-[13px] text-muted mb-4">
                Enter the OTP sent to <span className="font-semibold text-foreground">{email}</span> and your new password.
              </p>

              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">OTP</label>
              <div className="relative mb-4">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  placeholder="123456"
                  className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">New password</label>
              <div className="relative mb-5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
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
                {busy ? "Resetting…" : "Reset password"}
              </button>

              <button
                type="button"
                onClick={() => { setStage("request"); setError(null); }}
                className="w-full mt-3 text-[12.5px] font-medium text-muted hover:text-primary transition-colors"
              >
                Use a different email
              </button>
            </form>
          )}

          {stage === "done" && (
            <div className="text-center">
              <p className="text-[14px] font-semibold text-foreground mb-2">Password updated.</p>
              <p className="text-[13px] text-muted mb-5">You can now sign in with your new password.</p>
              <button
                onClick={() => router.push("/login")}
                className="w-full py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold hover:bg-primary-light transition-colors"
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>

        {stage !== "done" && (
          <p className="text-center text-[12.5px] text-muted mt-6">
            <Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
