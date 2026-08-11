"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { fetchFileObjectUrl } from "../lib/api";

/**
 * An object URL for a file behind an authenticated admin route.
 *
 * <p>Document scans and fee receipts are served from `/api/admin/**`, which requires the admin
 * bearer token. A browser never attaches that header to a URL it resolves itself, so pointing an
 * `<img src>` straight at the endpoint sends an anonymous request, gets a 401 back, and renders
 * a broken image with nothing in the UI to explain it. The bytes have to come through the API
 * client that adds the header, which means fetching them and wrapping the blob in an object URL.
 *
 * <p>Object URLs pin their blob in memory until revoked, and a Documents page holds one per row,
 * so the cleanup below is what keeps a long session from leaking every scan an admin scrolled past.
 */
export function useAuthedFileUrl(fileUrl: string | null | undefined) {
  // The result is stored together with the file it belongs to, so a changed `fileUrl` reads as
  // "nothing loaded yet" during render rather than having to be cleared by the effect — setting
  // state synchronously inside an effect is the cascading-render pattern React warns about.
  const [loaded, setLoaded] = useState<{ key: string; url: string | null; error: string | null }>({
    key: "",
    url: null,
    error: null,
  });

  useEffect(() => {
    if (!fileUrl) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    fetchFileObjectUrl(fileUrl)
      .then((next) => {
        // Revoke rather than keep it: this effect has already been superseded, so nothing will
        // ever render the URL and nothing else holds a reference that could free it later.
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next;
        setLoaded({ key: fileUrl, url: next, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoaded({ key: fileUrl, url: null, error: err instanceof Error ? err.message : "Failed to load file" });
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl]);

  const current = fileUrl && loaded.key === fileUrl ? loaded : null;
  return {
    url: current?.url ?? null,
    error: current?.error ?? null,
    loading: !!fileUrl && current === null,
  };
}

/** An `<img>` for a file behind an admin route, with its own loading and failure states. */
export function AuthedImage({
  fileUrl,
  alt,
  className,
  fallbackClassName,
}: {
  fileUrl: string;
  alt: string;
  className?: string;
  /** Applied to the placeholder shown while loading or on failure; defaults to `className`. */
  fallbackClassName?: string;
}) {
  const { url, error, loading } = useAuthedFileUrl(fileUrl);
  const placeholderClass = fallbackClassName ?? className;

  if (loading) {
    return <div className={`skeleton ${placeholderClass ?? ""}`} />;
  }

  if (error || !url) {
    return (
      <div
        className={`flex items-center justify-center bg-background border border-border text-muted ${placeholderClass ?? ""}`}
        title={error ?? "File unavailable"}
      >
        <ImageOff className="w-4 h-4" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}
