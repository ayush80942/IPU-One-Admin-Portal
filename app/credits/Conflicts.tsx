"use client";

import { AlertTriangle } from "lucide-react";
import { PaperConflict } from "../lib/api";

/**
 * Paper codes where already-imported subjects disagree on credits across more than one
 * (institute, programme, scheme era) group, with none of them protected by a scoped override.
 * Editing the base rule for one of these is refused by the backend (CreditConflictService) — this
 * panel surfaces the same conflicts proactively, before anyone tries and hits that refusal, so a
 * collision this class of bug depends on staying invisible gets found instead.
 */
export default function ConflictsPanel({ conflicts }: { conflicts: PaperConflict[] }) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className="border border-danger/30 bg-danger-faint rounded-2xl overflow-hidden mb-6">
      <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
        <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
        <span className="text-[13.5px] font-bold text-danger">
          Code collisions — {conflicts.length} paper{conflicts.length === 1 ? "" : "s"}
        </span>
        <span className="text-[12px] text-danger/80">
          same paper code, different credit values already on record — editing the base rule for
          these is blocked; add a scoped override (below) for the specific group instead.
        </span>
      </div>
      <div className="divide-y divide-danger/20">
        {conflicts.map((c) => (
          <div key={c.paperCode} className="px-5 py-3">
            <div className="font-mono text-[12.5px] font-bold text-foreground mb-1.5">{c.paperCode}</div>
            <div className="flex flex-wrap gap-1.5">
              {c.groups.map((g, i) => (
                <span
                  key={i}
                  className="text-[11.5px] bg-surface border border-border rounded-lg px-2 py-1 text-muted"
                >
                  {g.instituteCode ?? "—"} / {g.programCode ?? "shared"} / {g.schemeEra}:{" "}
                  <b className="text-foreground">{g.credits}cr</b> ({g.studentCount} student{g.studentCount === 1 ? "" : "s"})
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
