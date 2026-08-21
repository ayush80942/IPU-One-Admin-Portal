"use client";

import { useState, useEffect, useCallback } from "react";
import { Calculator, AlertTriangle, Upload, X } from "lucide-react";
import { useToast } from "../components/Toast";
import { useIsSuperAdmin } from "../components/AuthGate";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import GroupedRules from "./GroupedRules";
import SchemeErasSection from "./SchemeEras";
import ConflictsPanel from "./Conflicts";
import {
  fetchGroupedCreditRules,
  fetchCreditConflicts,
  previewCreditPublish,
  publishCredits,
  PublishPreview,
  GroupedCredits,
  PaperConflict,
} from "../lib/api";

const TH = "px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide";

export default function CreditsPage() {
  const { toast } = useToast();
  // Credit rules apply university-wide, so only the university admin edits them. An institute's
  // Student Cell gets a read-only view of its own branch of the tree, which is what they
  // actually need it for - checking what a paper of theirs is worth.
  const canEdit = useIsSuperAdmin();
  const [grouped, setGrouped] = useState<GroupedCredits | null>(null);
  const [conflicts, setConflicts] = useState<PaperConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupedResult, conflictsResult] = await Promise.all([
        fetchGroupedCreditRules(),
        fetchCreditConflicts(),
      ]);
      setGrouped(groupedResult);
      setConflicts(conflictsResult);
    } catch (err) {
      toast(`Failed to load credits: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Needs-attention papers are scoped per school on the backend, so a code held across two
  // institutes is counted once per school there — dedup by paper code for a university-wide
  // headline number instead of double-counting it here.
  const zeroCreditPapers = new Set(
    (grouped?.schools ?? []).flatMap((s) => s.needsAttention.map((p) => p.paperCode))
  ).size;

  const openPreview = async () => {
    setPreviewing(true);
    try {
      setPreview(await previewCreditPublish());
    } catch (err) {
      toast(`Failed to preview: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setPreviewing(false);
    }
  };

  const confirmPublish = async () => {
    try {
      const result = await publishCredits();
      toast(
        result.studentsAffected === 0
          ? "Published — no student's results needed changing."
          : `Published — updated ${result.semestersChanged} semester${result.semestersChanged === 1 ? "" : "s"} across ${result.studentsAffected} student${result.studentsAffected === 1 ? "" : "s"}.`,
        "success"
      );
      setPreview(null);
      load();
    } catch (err) {
      toast(`Failed to publish: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Credits"
        subtitle={
          canEdit
            ? "Credit weight per paper code — this drives every SGPA and CGPA in the app. Pick a school below, then work down its programmes and semesters; the placement comes from the published scheme and from imported results. Edits apply to new imports immediately; publish to apply them to students who have already imported."
            : "Credit weight per paper code for your school — this drives every SGPA and CGPA in the app. Pick a school below, then work down its programmes and semesters. Read-only: credit rules are set university-wide."
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatTile
          value={loading || !grouped ? "—" : grouped.totalPapers}
          label="Paper Codes Mapped"
          icon={Calculator}
          subLabel="With an exact credit rule"
        />
        {canEdit && (
          <StatTile
            value={loading ? "—" : zeroCreditPapers}
            label="Counting For Zero"
            color={zeroCreditPapers > 0 ? "danger" : "success"}
            icon={AlertTriangle}
            subLabel={zeroCreditPapers > 0 ? "No exact rule — see each school" : "Nothing unmapped"}
          />
        )}
      </div>

      {/* Publish */}
      {canEdit && (
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[14px] font-bold text-foreground">Publish to existing results</div>
          <p className="text-[12px] text-muted mt-0.5 max-w-xl">
            Credits are stored on each result when a student imports, so rule changes only reach new
            imports. Publishing recalculates stored credits and SGPAs for everyone already in the system.
          </p>
        </div>
        <button
          onClick={openPreview}
          disabled={previewing || loading}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {previewing ? "Checking…" : "Review & Publish"}
        </button>
      </div>
      )}

      {canEdit && <ConflictsPanel conflicts={conflicts} />}

      {canEdit && <SchemeErasSection onChanged={load} />}

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[14px] font-bold text-primary">
            Paper Codes <span className="font-normal text-muted">{grouped?.totalPapers ?? 0}</span>
          </div>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline shrink-0">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : (
          grouped && <GroupedRules data={grouped} onChanged={load} />
        )}
      </div>

      {preview && (
        <PublishDialog preview={preview} onCancel={() => setPreview(null)} onConfirm={confirmPublish} />
      )}
    </div>
  );
}

// Publishing moves real students' CGPA, so the blast radius is shown before it happens rather
// than reported after.
function PublishDialog({
  preview,
  onCancel,
  onConfirm,
}: {
  preview: PublishPreview;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const nothingToDo = preview.subjectsChanged === 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onCancel}>
      <div
        className="bg-surface rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-primary">Publish credit changes</h2>
          <button onClick={onCancel} aria-label="Close" className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {nothingToDo ? (
            <p className="text-[13.5px] text-muted">
              Every stored result already matches the current rules. There is nothing to publish.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <Metric value={preview.studentsAffected} label="Students" highlight />
                <Metric value={preview.semestersChanged} label="Semesters" />
                <Metric value={preview.subjectsChanged} label="Subject rows" />
              </div>

              <p className="text-[13px] text-muted mb-4">
                {preview.studentsAffected > 0
                  ? `This recalculates stored SGPAs, which changes the CGPA ${preview.studentsAffected} student${preview.studentsAffected === 1 ? " sees" : "s see"} in the app.`
                  : "Stored credits change, but no student's SGPA works out differently."}
              </p>

              {preview.papers.some((p) => p.institutesAffected > 1) && (
                <div className="flex items-start gap-2 border border-danger/30 bg-danger-faint rounded-xl px-3 py-2.5 mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                  <p className="text-[12.5px] text-danger">
                    Some papers below change credits at more than one institute. If that
                    wasn&apos;t the intent, the paper code is likely reused for a different
                    subject elsewhere — cancel and add a scheme-era override scoped to the
                    institute you meant to fix instead of publishing this.
                  </p>
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-primary-faint">
                      <th className={TH}>Paper</th>
                      <th className={TH}>Change</th>
                      <th className={TH}>Rows</th>
                      <th className={TH}>Institutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.papers.map((p) => (
                      <tr key={p.paperCode} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2 font-mono text-[12px]">{p.paperCode}</td>
                        <td className="px-4 py-2 tabular-nums">
                          <span className="text-muted">{p.oldCredits}</span>
                          <span className="mx-1.5 text-muted">→</span>
                          <span className="font-bold text-primary">{p.newCredits}</span>
                        </td>
                        <td className="px-4 py-2 tabular-nums text-muted">{p.subjectRows}</td>
                        <td className={`px-4 py-2 tabular-nums ${p.institutesAffected > 1 ? "font-bold text-danger" : "text-muted"}`}>
                          {p.institutesAffected}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={() => { setPublishing(true); onConfirm(); }}
            disabled={nothingToDo || publishing}
            className="px-4 py-2 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-40"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? "bg-primary-faint" : "bg-background"}`}>
      <div className={`text-2xl font-extrabold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
      <div className="text-[11px] text-muted mt-0.5">{label}</div>
    </div>
  );
}
