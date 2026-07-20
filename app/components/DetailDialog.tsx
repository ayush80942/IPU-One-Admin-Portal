"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

interface DetailDialogProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

// Generic modal shell for "click a row to see the complete details" —
// built on the backdrop/panel convention already used twice (the documents
// image preview, the notices create form) so every detail view in the app
// opens and closes the same way.
export default function DetailDialog({
  title,
  subtitle,
  onClose,
  children,
  maxWidthClass = "max-w-2xl",
}: DetailDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-surface rounded-xl p-6 w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 z-10"
        >
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold text-primary mb-1 pr-10">{title}</h2>
        {subtitle && <p className="text-[13px] text-muted mb-6">{subtitle}</p>}
        {!subtitle && <div className="mb-4" />}
        {children}
      </div>
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: ReactNode;
}

// Consistent label/value row for the grids inside detail dialogs.
export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-[14px] text-foreground">{value ?? "—"}</div>
    </div>
  );
}
