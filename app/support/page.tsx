"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, ImagePlus, LifeBuoy, Send, X } from "lucide-react";
import {
  submitSupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABEL,
  type SupportCategory,
} from "../lib/api";

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024; // 10MB — mirrors the backend's cap.
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function SupportPage() {
  const [category, setCategory] = useState<SupportCategory | "">("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [screenshot, setScreenshot] = useState<{ dataUrl: string; name: string } | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    setScreenshotError(null);
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setScreenshotError("Only JPEG, PNG or WebP images are accepted.");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotError("That screenshot is over 10MB — try a smaller one.");
      return;
    }
    setScreenshot({ dataUrl: await readAsDataUrl(file), name: file.name });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      setError("Please select what the problem is about.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the problem.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const ticket = await submitSupportTicket({
        category,
        description: description.trim(),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        enrollmentNo: enrollmentNo.trim() || undefined,
        screenshotBase64: screenshot?.dataUrl,
      });
      setSubmittedId(ticket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitAnother = () => {
    setSubmittedId(null);
    setCategory("");
    setDescription("");
    setName("");
    setEmail("");
    setEnrollmentNo("");
    setScreenshot(null);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="IPU One" width={72} height={72} priority className="rounded-2xl" />
          <h1 className="text-[20px] font-extrabold text-primary mt-5">Report a Problem</h1>
          <p className="text-[13px] text-muted mt-1 text-center max-w-sm">
            Hit a bug, or something not working as expected in IPU One? Tell us about it and the Student Cell will look into it.
          </p>
        </div>

        {submittedId !== null ? (
          <div className="bg-surface border border-border rounded-2xl shadow-sm p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-success-faint flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <h2 className="text-[16px] font-bold text-foreground mb-1">Thanks — we&apos;ve got it</h2>
            <p className="text-[13px] text-muted mb-1">
              Reference #{submittedId}. The team will take it from here.
            </p>
            {email.trim() && (
              <p className="text-[12px] text-muted mb-6">
                We&apos;ll reach out at {email.trim()} if we need more details.
              </p>
            )}
            <button
              onClick={submitAnother}
              className="text-[13px] font-semibold text-primary hover:underline"
            >
              Report another problem
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-surface border border-border rounded-2xl shadow-sm p-6">
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
              Where&apos;s the problem? <span className="text-danger">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportCategory)}
              required
              className="w-full px-3.5 py-2.5 mb-4 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors appearance-none"
            >
              <option value="" disabled>
                Select a category…
              </option>
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {SUPPORT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>

            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
              What happened? <span className="text-danger">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              placeholder="Describe what you were doing, what you expected, and what happened instead…"
              className="w-full px-3.5 py-2.5 mb-4 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors resize-none"
            />

            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
              Screenshot <span className="text-muted normal-case font-normal">(optional)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
            {screenshot ? (
              <div className="mb-4 flex items-center gap-3 p-2.5 border border-border rounded-lg bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshot.dataUrl} alt="Screenshot preview" className="w-14 h-14 rounded-md object-cover border border-border shrink-0" />
                <span className="text-[13px] text-foreground truncate flex-1">{screenshot.name}</span>
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted hover:bg-danger-faint hover:text-danger transition-colors"
                  aria-label="Remove screenshot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full mb-4 flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-lg text-[13px] font-medium text-muted hover:border-primary hover:text-primary transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                Attach a screenshot
              </button>
            )}
            {screenshotError && <p className="text-[12px] text-danger mb-4 -mt-2">{screenshotError}</p>}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Enrollment No <span className="text-muted normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  placeholder="e.g. 12345678923"
                  className="w-full px-3.5 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Your Name <span className="text-muted normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Student"
                  className="w-full px-3.5 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
              Email <span className="text-muted normal-case font-normal">(optional, so we can follow up)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 mb-5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
            />

            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-danger-faint text-danger text-[13px] font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {busy ? (
                "Submitting…"
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit
                </>
              )}
            </button>
          </form>
        )}

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted mt-6">
          <LifeBuoy className="w-3.5 h-3.5" />
          IPU One is an unofficial student companion app, not affiliated with GGSIPU.
        </p>
      </div>
    </div>
  );
}
