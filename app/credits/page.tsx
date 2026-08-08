"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Calculator, AlertTriangle, Search, Regex, Upload, X, Plus, Trash2 } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import {
  fetchCreditRules,
  saveCreditRule,
  deleteCreditRule,
  fetchCreditPatterns,
  saveCreditPattern,
  deleteCreditPattern,
  fetchUnmappedPapers,
  previewCreditPublish,
  publishCredits,
  CreditRule,
  CreditPattern,
  UnmappedPaper,
  PublishPreview,
} from "../lib/api";

const TH = "px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide";
const INPUT =
  "px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary";

type Tab = "rules" | "patterns";

export default function CreditsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<CreditRule[]>([]);
  const [patterns, setPatterns] = useState<CreditPattern[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("rules");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p, u] = await Promise.all([fetchCreditRules(), fetchCreditPatterns(), fetchUnmappedPapers()]);
      setRules(r);
      setPatterns(p);
      setUnmapped(u);
    } catch (err) {
      toast(`Failed to load credits: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((r) => r.paperCode.toLowerCase().includes(q) || r.note?.toLowerCase().includes(q));
  }, [rules, search]);

  const zeroCreditPapers = unmapped.filter((u) => u.creditSource === "NONE").length;

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
        subtitle="Credit weight per paper code — this drives every SGPA and CGPA in the app. Edits apply to new imports immediately; publish to apply them to students who have already imported."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatTile value={loading ? "—" : rules.length} label="Paper Codes Mapped" icon={Calculator} />
        <StatTile value={loading ? "—" : patterns.filter((p) => p.active).length} label="Active Patterns" color="violet" icon={Regex} />
        <StatTile
          value={loading ? "—" : zeroCreditPapers}
          label="Counting For Zero"
          color={zeroCreditPapers > 0 ? "danger" : "success"}
          icon={AlertTriangle}
          subLabel={zeroCreditPapers > 0 ? "Excluded from SGPA" : "Nothing unmapped"}
        />
        <StatTile
          value={loading ? "—" : unmapped.length - zeroCreditPapers}
          label="Credits Guessed"
          color="orange"
          subLabel="Matched a pattern, not an exact rule"
        />
      </div>

      {/* Needs attention — only when there is something to act on. */}
      {!loading && unmapped.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-[15px] font-bold text-primary">Needs Attention</h2>
            <p className="text-[12px] text-muted mt-0.5">
              Papers found in imported results with no exact rule. A paper counting for zero is silently
              left out of its semester&apos;s SGPA.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className={TH}>Paper Code</th>
                  <th className={TH}>Subject</th>
                  <th className={TH}>Current</th>
                  <th className={TH}>Students</th>
                  <th className={TH}>Set Credits</th>
                </tr>
              </thead>
              <tbody>
                {unmapped.map((u) => (
                  <UnmappedRow
                    key={u.paperCode}
                    paper={u}
                    onSaved={() => load()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Publish */}
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

      {/* Rules / patterns */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>
              Paper Codes <span className="font-normal text-muted">{rules.length}</span>
            </TabButton>
            <TabButton active={tab === "patterns"} onClick={() => setTab("patterns")}>
              Patterns <span className="font-normal text-muted">{patterns.length}</span>
            </TabButton>
          </div>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline shrink-0">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : tab === "rules" ? (
          <RulesTable
            rules={filteredRules}
            total={rules.length}
            search={search}
            onSearch={setSearch}
            onChanged={load}
          />
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

function UnmappedRow({ paper, onSaved }: { paper: UnmappedPaper; onSaved: () => void }) {
  const { toast } = useToast();
  const [credits, setCredits] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveCreditRule(paper.paperCode, Number(credits));
      toast(`${paper.paperCode} set to ${credits} credits`, "success");
      onSaved();
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const zero = paper.creditSource === "NONE";

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-3 font-mono text-[13px]">{paper.paperCode}</td>
      <td className="px-4 py-3 text-[12px] text-muted">{paper.subjectName || "—"}</td>
      <td className="px-4 py-3">
        {zero ? (
          <Pill color="text-danger" colorFaint="bg-danger-faint">0 — not counted</Pill>
        ) : (
          <Pill color="text-orange" colorFaint="bg-orange-faint">{paper.currentCredits} — guessed</Pill>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums">{paper.studentCount}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="—"
            className={`${INPUT} w-20`}
          />
          {credits.trim() !== "" && (
            <button
              onClick={save}
              disabled={saving}
              className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function RulesTable({
  rules,
  total,
  search,
  onSearch,
  onChanged,
}: {
  rules: CreditRule[];
  total: number;
  search: string;
  onSearch: (v: string) => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCredits, setNewCredits] = useState("");

  const addRule = async () => {
    try {
      await saveCreditRule(newCode.trim().toUpperCase(), Number(newCredits));
      toast(`Added ${newCode.trim().toUpperCase()}`, "success");
      setNewCode("");
      setNewCredits("");
      setAdding(false);
      onChanged();
    } catch (err) {
      toast(`Failed to add: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  return (
    <>
      <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search paper code…"
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-[13px] bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-3">
          {search.trim() && <span className="text-[12px] text-muted">{rules.length} of {total}</span>}
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
          >
            <Plus className="w-4 h-4" /> Add paper code
          </button>
        </div>
      </div>

      {adding && (
        <div className="px-6 py-3 border-b border-border bg-background flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Paper code e.g. ARD299"
            className={`${INPUT} font-mono w-52`}
          />
          <input
            type="number"
            min={0}
            value={newCredits}
            onChange={(e) => setNewCredits(e.target.value)}
            placeholder="Credits"
            className={`${INPUT} w-24`}
          />
          <button
            onClick={addRule}
            disabled={!newCode.trim() || newCredits.trim() === ""}
            className="text-[12px] font-bold text-primary hover:underline disabled:opacity-40"
          >
            Save
          </button>
          <button onClick={() => setAdding(false)} className="text-[12px] font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState icon={Calculator} message={search.trim() ? "No paper code matches that search." : "No credit rules yet."} />
      ) : (
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-primary-faint sticky top-0 z-10">
                <th className={TH}>Paper Code</th>
                <th className={TH}>Credits</th>
                <th className={TH}>Note</th>
                <th className={TH}>Source</th>
                <th className={`${TH} w-8`} />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <RuleRow key={rule.paperCode} rule={rule} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RuleRow({ rule, onChanged }: { rule: CreditRule; onChanged: () => void }) {
  const { toast } = useToast();
  const [credits, setCredits] = useState(String(rule.credits));
  const [note, setNote] = useState(rule.note ?? "");
  const [saving, setSaving] = useState(false);

  const dirty = credits !== String(rule.credits) || note !== (rule.note ?? "");

  const save = async () => {
    setSaving(true);
    try {
      await saveCreditRule(rule.paperCode, Number(credits), note.trim() || null);
      toast(`${rule.paperCode} updated`, "success");
      onChanged();
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete the credit rule for ${rule.paperCode}? It will fall back to the patterns, or to 0 credits.`)) return;
    try {
      await deleteCreditRule(rule.paperCode);
      toast(`${rule.paperCode} deleted`, "success");
      onChanged();
    } catch (err) {
      toast(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  return (
    <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0">
      <td className="px-4 py-2.5 font-mono text-[13px]">{rule.paperCode}</td>
      <td className="px-4 py-2.5">
        <input type="number" min={0} value={credits} onChange={(e) => setCredits(e.target.value)} className={`${INPUT} w-20`} />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="—"
          className={`${INPUT} w-full max-w-xs`}
        />
      </td>
      <td className="px-4 py-2.5">
        {rule.adminEdited ? (
          <Pill color="text-primary" colorFaint="bg-primary-faint">Admin set</Pill>
        ) : (
          <span className="text-[11px] text-muted">Imported default</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          {dirty && (
            <button onClick={save} disabled={saving} className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          <button onClick={remove} aria-label={`Delete ${rule.paperCode}`} className="text-muted/50 hover:text-danger transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
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
