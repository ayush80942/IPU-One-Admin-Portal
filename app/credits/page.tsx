"use client";

import { useState, useEffect, useCallback } from "react";
import { Calculator, AlertTriangle, Regex, Upload, X, Trash2 } from "lucide-react";
import { useToast } from "../components/Toast";
import { useIsSuperAdmin } from "../components/AuthGate";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import GroupedRules from "./GroupedRules";
import {
  fetchCreditPatterns,
  saveCreditPattern,
  deleteCreditPattern,
  fetchGroupedCreditRules,
  previewCreditPublish,
  publishCredits,
  CreditPattern,
  PublishPreview,
  GroupedCredits,
} from "../lib/api";

const TH = "px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide";

type Tab = "rules" | "patterns";

export default function CreditsPage() {
  const { toast } = useToast();
  // Credit rules apply university-wide, so only the university admin edits them. An institute's
  // Student Cell gets a read-only view of its own branch of the tree, which is what they
  // actually need it for - checking what a paper of theirs is worth.
  const canEdit = useIsSuperAdmin();
  const [grouped, setGrouped] = useState<GroupedCredits | null>(null);
  const [patterns, setPatterns] = useState<CreditPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("rules");
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, p] = await Promise.all([
        fetchGroupedCreditRules(),
        canEdit ? fetchCreditPatterns() : Promise.resolve([]),
      ]);
      setGrouped(g);
      setPatterns(p);
    } catch (err) {
      toast(`Failed to load credits: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, canEdit]);

  useEffect(() => { load(); }, [load]);

  // Needs-attention papers are scoped per school on the backend, so a code held across two
  // institutes is counted once per school there — dedup by paper code for a university-wide
  // headline number instead of double-counting it here.
  const needsAttention = new Map<string, "PATTERN" | "NONE">();
  for (const school of grouped?.schools ?? []) {
    for (const paper of school.needsAttention) {
      if (paper.creditSource === "NONE" || !needsAttention.has(paper.paperCode)) {
        needsAttention.set(paper.paperCode, paper.creditSource);
      }
    }
  }
  const zeroCreditPapers = [...needsAttention.values()].filter((s) => s === "NONE").length;
  const guessedCreditPapers = needsAttention.size - zeroCreditPapers;

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatTile
          value={loading || !grouped ? "—" : grouped.totalPapers}
          label="Paper Codes Mapped"
          icon={Calculator}
          subLabel="With an exact credit rule"
        />
        {canEdit && (
          <>
            <StatTile value={loading ? "—" : patterns.filter((p) => p.active).length} label="Active Patterns" color="violet" icon={Regex} />
            <StatTile
              value={loading ? "—" : zeroCreditPapers}
              label="Counting For Zero"
              color={zeroCreditPapers > 0 ? "danger" : "success"}
              icon={AlertTriangle}
              subLabel={zeroCreditPapers > 0 ? "Excluded from SGPA — see each school" : "Nothing unmapped"}
            />
            <StatTile
              value={loading ? "—" : guessedCreditPapers}
              label="Credits Guessed"
              color="orange"
              subLabel="Matched a pattern, not an exact rule"
            />
          </>
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

      {/* Rules / patterns */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>
              Paper Codes <span className="font-normal text-muted">{grouped?.totalPapers ?? 0}</span>
            </TabButton>
            {canEdit && (
              <TabButton active={tab === "patterns"} onClick={() => setTab("patterns")}>
                Patterns <span className="font-normal text-muted">{patterns.length}</span>
              </TabButton>
            )}
          </div>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline shrink-0">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : tab === "rules" || !canEdit ? (
          grouped && <GroupedRules data={grouped} onChanged={load} />
        ) : (
          <PatternsTable patterns={patterns} onChanged={load} />
        )}
      </div>

      {preview && (
        <PublishDialog preview={preview} onCancel={() => setPreview(null)} onConfirm={confirmPublish} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${
        active ? "bg-primary-faint text-primary" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PatternsTable({ patterns, onChanged }: { patterns: CreditPattern[]; onChanged: () => void }) {
  const { toast } = useToast();

  const toggle = async (pattern: CreditPattern) => {
    try {
      await saveCreditPattern(pattern.id, { active: !pattern.active });
      onChanged();
    } catch (err) {
      toast(`Failed to update: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  const remove = async (pattern: CreditPattern) => {
    if (!confirm(`Delete the pattern ${pattern.regex}?`)) return;
    try {
      await deleteCreditPattern(pattern.id);
      toast("Pattern deleted", "success");
      onChanged();
    } catch (err) {
      toast(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  if (patterns.length === 0) {
    return <EmptyState icon={Regex} message="No fallback patterns configured." />;
  }

  return (
    <>
      <p className="px-6 py-3 text-[12px] text-muted border-b border-border">
        Used only when a paper code has no exact rule. Tried top to bottom — the first match wins, so
        priority order decides the outcome when two patterns overlap.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-primary-faint">
              <th className={TH}>Priority</th>
              <th className={TH}>Pattern</th>
              <th className={TH}>Credits</th>
              <th className={TH}>Description</th>
              <th className={TH}>Active</th>
              <th className={`${TH} w-8`} />
            </tr>
          </thead>
          <tbody>
            {patterns.map((p) => (
              <tr key={p.id} className={`hover:bg-background transition-colors border-b border-border last:border-b-0 ${p.active ? "" : "opacity-50"}`}>
                <td className="px-4 py-2.5 tabular-nums text-muted">{p.priority}</td>
                <td className="px-4 py-2.5 font-mono text-[12px]">{p.regex}</td>
                <td className="px-4 py-2.5 tabular-nums font-semibold">{p.credits}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{p.description || "—"}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => toggle(p)} className="text-[12px] font-semibold text-primary hover:underline">
                    {p.active ? "Disable" : "Enable"}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => remove(p)} aria-label="Delete pattern" className="text-muted/50 hover:text-danger transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-primary-faint">
                      <th className={TH}>Paper</th>
                      <th className={TH}>Change</th>
                      <th className={TH}>Rows</th>
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
