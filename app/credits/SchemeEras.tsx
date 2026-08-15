"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronRight, GitBranch, Plus, Trash2, X } from "lucide-react";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import {
  fetchSchemeEras,
  saveSchemeEra,
  deleteSchemeEra,
  fetchCreditOverrides,
  saveCreditOverride,
  deleteCreditOverride,
  SchemeEra,
  ScopedCreditRule,
} from "../lib/api";

const INPUT =
  "px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary";
const TH = "px-4 py-2 text-left text-[11px] font-bold text-primary uppercase tracking-wide";

/**
 * The same paper code can mean two different subjects across a scheme revision (ARD203 is
 * "Introduction to AI" pre-NEP and "Analysis and Design of Algorithm" under NEP 2026-27) — this
 * is where an admin names the scheme eras and the per-programme/per-era overrides that resolve
 * that collision, instead of one silently overwriting the other. Collapsed by default: most
 * admins never touch this, it only matters when the university actually revises a scheme.
 */
export default function SchemeErasSection({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [eras, setEras] = useState<SchemeEra[]>([]);
  const [overrides, setOverrides] = useState<ScopedCreditRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [addingEra, setAddingEra] = useState(false);
  const [addingOverride, setAddingOverride] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [e, o] = await Promise.all([fetchSchemeEras(), fetchCreditOverrides()]);
      setEras(e);
      setOverrides(o);
      setLoaded(true);
    } catch (err) {
      toast(`Failed to load scheme eras: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !loaded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const eraLabel = useMemo(() => {
    const byId = new Map(eras.map((e) => [e.id, e]));
    return (id: string | null) => {
      if (!id) return "Any era";
      const era = byId.get(id);
      return era ? era.label : "Unknown era";
    };
  }, [eras]);

  const refresh = async () => {
    await load();
    onChanged();
  };

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 py-4 flex items-center gap-2.5 hover:bg-background transition-colors text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
        <span className="text-[14px] font-bold text-primary">Scheme Eras &amp; Overrides</span>
        <span className="text-[12px] text-muted">
          For when the university reuses a paper code across a scheme revision
        </span>
      </button>

      {open && (
        <div className="border-t border-border">
          {loading && !loaded ? (
            <div className="p-6 space-y-3">
              <div className="skeleton h-10 rounded-lg" />
              <div className="skeleton h-10 rounded-lg" />
            </div>
          ) : (
            <>
              <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="text-[12.5px] font-bold text-muted uppercase tracking-wide">Eras</div>
                <button
                  onClick={() => setAddingEra((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline"
                >
                  {addingEra ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {addingEra ? "Cancel" : "Add era"}
                </button>
              </div>
              {addingEra && <AddEraForm onCancel={() => setAddingEra(false)} onCreated={refresh} />}
              <ErasTable eras={eras} onChanged={refresh} />

              <div className="px-6 py-3 border-y border-border flex items-center justify-between gap-3 bg-background">
                <div className="text-[12.5px] font-bold text-muted uppercase tracking-wide">Overrides</div>
                <button
                  onClick={() => setAddingOverride((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline"
                >
                  {addingOverride ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {addingOverride ? "Cancel" : "Add override"}
                </button>
              </div>
              {addingOverride && (
                <AddOverrideForm eras={eras} onCancel={() => setAddingOverride(false)} onCreated={refresh} />
              )}
              <OverridesTable overrides={overrides} eraLabel={eraLabel} onChanged={refresh} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function yearRange(era: SchemeEra) {
  return era.endAdmissionYear ? `${era.startAdmissionYear}–${era.endAdmissionYear}` : `${era.startAdmissionYear} onwards`;
}

function AddEraForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [instituteCode, setInstituteCode] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await saveSchemeEra(null, {
        label: label.trim(),
        startAdmissionYear: Number(start),
        endAdmissionYear: end.trim() === "" ? null : Number(end),
        instituteCode: instituteCode.trim() || null,
      });
      toast(`Added ${label.trim()}`, "success");
      onCreated();
      onCancel();
    } catch (err) {
      toast(`Failed to add: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-3 border-b border-border bg-background flex items-end gap-3 flex-wrap">
      <Field label="Label">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="NEP 2026-27" className={`${INPUT} w-48`} />
      </Field>
      <Field label="Start admission year">
        <input type="number" value={start} onChange={(e) => setStart(e.target.value)} placeholder="2026" className={`${INPUT} w-28`} />
      </Field>
      <Field label="End admission year" hint="Blank = still current">
        <input type="number" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="—" className={`${INPUT} w-28`} />
      </Field>
      <Field label="Institute code" hint="Blank = university-wide">
        <input value={instituteCode} onChange={(e) => setInstituteCode(e.target.value)} placeholder="190" className={`${INPUT} w-24`} />
      </Field>
      <div className="flex items-center gap-3 pb-1.5">
        <button
          onClick={submit}
          disabled={saving || !label.trim() || start.trim() === ""}
          className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-40"
        >
          {saving ? "Adding…" : "Add era"}
        </button>
        <button onClick={onCancel} className="text-[12px] font-semibold text-muted hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}

function ErasTable({ eras, onChanged }: { eras: SchemeEra[]; onChanged: () => void }) {
  const { toast } = useToast();

  const remove = async (era: SchemeEra) => {
    if (!confirm(`Delete the era "${era.label}"? Overrides referencing it fall back to matching by programme only.`)) return;
    try {
      await deleteSchemeEra(era.id);
      toast("Era deleted", "success");
      onChanged();
    } catch (err) {
      toast(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  if (eras.length === 0) {
    return <EmptyState icon={Calendar} message="No scheme eras yet — every paper code resolves through credit_rules alone." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="bg-primary-faint">
            <th className={TH}>Label</th>
            <th className={TH}>Admission years</th>
            <th className={TH}>Scope</th>
            <th className={`${TH} w-8`} />
          </tr>
        </thead>
        <tbody>
          {eras.map((era) => (
            <tr key={era.id} className="hover:bg-background transition-colors border-b border-border last:border-b-0">
              <td className="px-4 py-2.5 font-semibold">{era.label}</td>
              <td className="px-4 py-2.5 tabular-nums text-muted">{yearRange(era)}</td>
              <td className="px-4 py-2.5 text-muted">{era.instituteCode ?? "University-wide"}</td>
              <td className="px-4 py-2.5">
                <button onClick={() => remove(era)} aria-label={`Delete ${era.label}`} className="text-muted/50 hover:text-danger transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddOverrideForm({
  eras,
  onCancel,
  onCreated,
}: {
  eras: SchemeEra[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [paperCode, setPaperCode] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [schemeEraId, setSchemeEraId] = useState("");
  const [credits, setCredits] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = paperCode.trim() !== "" && credits.trim() !== "" && (programCode.trim() !== "" || schemeEraId !== "");

  const submit = async () => {
    setSaving(true);
    try {
      await saveCreditOverride(null, {
        paperCode: paperCode.trim().toUpperCase(),
        programCode: programCode.trim() || null,
        schemeEraId: schemeEraId || null,
        credits: Number(credits),
        subjectName: subjectName.trim() || null,
      });
      toast(`Added an override for ${paperCode.trim().toUpperCase()}`, "success");
      onCreated();
      onCancel();
    } catch (err) {
      toast(`Failed to add: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-3 border-b border-border bg-background flex items-end gap-3 flex-wrap">
      <Field label="Paper code">
        <input value={paperCode} onChange={(e) => setPaperCode(e.target.value)} placeholder="ARD203" className={`${INPUT} font-mono w-32`} />
      </Field>
      <Field label="Programme" hint="Blank = any">
        <input value={programCode} onChange={(e) => setProgramCode(e.target.value)} placeholder="519" className={`${INPUT} w-24`} />
      </Field>
      <Field label="Era" hint="Blank = any">
        <select value={schemeEraId} onChange={(e) => setSchemeEraId(e.target.value)} className={`${INPUT} w-44`}>
          <option value="">Any era</option>
          {eras.map((era) => (
            <option key={era.id} value={era.id}>{era.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Credits">
        <input type="number" min={0} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="3" className={`${INPUT} w-20`} />
      </Field>
      <Field label="Subject name" hint="Optional">
        <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Analysis and Design of Algorithm" className={`${INPUT} w-72`} />
      </Field>
      <div className="flex items-center gap-3 pb-1.5">
        <button
          onClick={submit}
          disabled={saving || !canSave}
          className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-40"
        >
          {saving ? "Adding…" : "Add override"}
        </button>
        <button onClick={onCancel} className="text-[12px] font-semibold text-muted hover:text-foreground">Cancel</button>
      </div>
      {!canSave && paperCode.trim() !== "" && credits.trim() !== "" && (
        <p className="w-full text-[11px] text-muted">Needs a programme, an era, or both — otherwise edit the paper&apos;s credit rule directly instead.</p>
      )}
    </div>
  );
}

function OverridesTable({
  overrides,
  eraLabel,
  onChanged,
}: {
  overrides: ScopedCreditRule[];
  eraLabel: (id: string | null) => string;
  onChanged: () => void;
}) {
  const { toast } = useToast();

  const remove = async (override: ScopedCreditRule) => {
    if (!confirm(`Delete this override for ${override.paperCode}? It falls back to credit_rules or a less specific override.`)) return;
    try {
      await deleteCreditOverride(override.id);
      toast("Override deleted", "success");
      onChanged();
    } catch (err) {
      toast(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  if (overrides.length === 0) {
    return <EmptyState icon={GitBranch} message="No overrides yet — every paper code means the same thing across every scheme era." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="bg-primary-faint">
            <th className={TH}>Paper</th>
            <th className={TH}>Programme</th>
            <th className={TH}>Era</th>
            <th className={TH}>Credits</th>
            <th className={TH}>Subject Name</th>
            <th className={`${TH} w-8`} />
          </tr>
        </thead>
        <tbody>
          {overrides.map((override) => (
            <tr key={override.id} className="hover:bg-background transition-colors border-b border-border last:border-b-0">
              <td className="px-4 py-2.5 font-mono text-[13px]">{override.paperCode}</td>
              <td className="px-4 py-2.5 text-muted">{override.programCode ?? "Any"}</td>
              <td className="px-4 py-2.5 text-muted">{eraLabel(override.schemeEraId)}</td>
              <td className="px-4 py-2.5 tabular-nums font-semibold">{override.credits}</td>
              <td className="px-4 py-2.5 text-muted">{override.subjectName || "—"}</td>
              <td className="px-4 py-2.5">
                <button onClick={() => remove(override)} aria-label={`Delete override for ${override.paperCode}`} className="text-muted/50 hover:text-danger transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-muted uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted/70">{hint}</span>}
    </label>
  );
}
