import { ReactNode } from "react";

// The labelled-control pattern used by every filter bar. Lived inside the Fees page until
// Students grew a filter bar of its own; shared here so the two can't drift apart.
export default function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export const SELECT_CLASS =
  "w-full border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors";
