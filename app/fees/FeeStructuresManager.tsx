"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import Filter, { SELECT_CLASS } from "../components/Filter";
import {
  fetchFeeStructures,
  saveFeeStructure,
  deleteFeeStructure,
  Course,
  FeeStructure,
  FeeStructureItem,
  Institute,
} from "../lib/api";
import { formatAmount } from "../lib/fees";
import { academicYearLabel, academicYearOptions, currentAcademicYear } from "../lib/academicYear";
import { instituteOptionsFrom, programOptionsFrom, labelLookup } from "../lib/noticeTaxonomy";

const ALL = "";

// A plain rolling-year list, not noticeTaxonomy's BATCH_YEAR_OPTIONS — that one's labels are
// annotated with a batch's current "Year of study", which doesn't apply to an admission year.
function admissionYearOptions(count = 6): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => current - i);
}

interface FeeStructuresManagerProps {
  institutes: Institute[];
  courses: Course[];
}

export default function FeeStructuresManager({ institutes, courses }: FeeStructuresManagerProps) {
  const { toast } = useToast();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [instituteCode, setInstituteCode] = useState(ALL);
  const [programCode, setProgramCode] = useState(ALL);
  const [academicYear, setAcademicYear] = useState<number>(currentAcademicYear());
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);
  const programOptions = useMemo(
    () => programOptionsFrom(courses, instituteCode ? [instituteCode] : []),
    [courses, instituteCode]
  );
  const programLabel = useMemo(() => labelLookup(programOptionsFrom(courses)), [courses]);
  const instituteLabel = useMemo(() => labelLookup(instituteOptionsFrom(institutes)), [institutes]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFeeStructures({
        instituteCode: instituteCode || undefined,
        programCode: programCode || undefined,
        academicYear,
      });
      setStructures(data);
    } catch (err) {
      toast(`Failed to load fee structures: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, instituteCode, programCode, academicYear]);

  useEffect(() => { load(); }, [load]);

  const remove = async (structure: FeeStructure) => {
    if (!confirm(`Delete the fee structure for ${structure.programCode} — ${structure.admissionYear} admission, ${structure.label} session?`)) {
      return;
    }
    try {
      await deleteFeeStructure(structure.id);
      toast("Fee structure deleted", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete fee structure", "error");
    }
  };

  return (
    <div>
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Filter label="Institute">
            <select
              value={instituteCode}
              onChange={(e) => { setInstituteCode(e.target.value); setProgramCode(ALL); }}
              className={SELECT_CLASS}
            >
              <option value={ALL}>All Institutes</option>
              {instituteOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Program">
            <select value={programCode} onChange={(e) => setProgramCode(e.target.value)} className={SELECT_CLASS}>
              <option value={ALL}>All Programs</option>
              {programOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Academic Year">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {academicYearOptions().map((y) => (
                <option key={y} value={y}>{academicYearLabel(y)}</option>
              ))}
            </select>
          </Filter>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-primary">
            Fee Structures
            {!loading && <span className="ml-2 text-[12px] font-normal text-muted">{structures.length}</span>}
          </h2>
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold text-white bg-primary hover:bg-primary-light transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Fee Structure
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : structures.length === 0 ? (
          <EmptyState
            icon={Plus}
            message="No fee structures configured for this filter yet — add one above so students can see what they owe."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Program</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Admission Year</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Session</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Items</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {structures.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setEditing(s)}
                    className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                  >
                    {/* Short names (instituteLabel/programLabel already prefer shortName - see
                        instituteOptionsFrom/programOptionsFrom) over the structure's own full
                        instituteName/programName, so the list stays scannable. */}
                    <td className="px-4 py-3">{instituteLabel(s.instituteCode)}</td>
                    <td className="px-4 py-3">{programLabel(s.programCode)}</td>
                    <td className="px-4 py-3 tabular-nums">{s.admissionYear}</td>
                    <td className="px-4 py-3">{s.label}</td>
                    <td className="px-4 py-3 text-muted">{s.items.length}</td>
                    <td className="px-4 py-3 font-semibold">{formatAmount(s.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(s); }}
                        title="Delete this fee structure"
                        className="text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(addingNew || editing) && (
        <FeeStructureFormDialog
          institutes={institutes}
          courses={courses}
          structure={editing}
          onClose={() => { setAddingNew(false); setEditing(null); }}
          onSaved={() => { setAddingNew(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

interface ItemDraft {
  key: number;
  label: string;
  amount: string;
}

function toDrafts(items: FeeStructureItem[]): ItemDraft[] {
  return items.length > 0
    ? items.map((it, i) => ({ key: i, label: it.label, amount: String(it.amount) }))
    : [{ key: 0, label: "", amount: "" }];
}

function FeeStructureFormDialog({
  institutes,
  courses,
  structure,
  onClose,
  onSaved,
}: {
  institutes: Institute[];
  courses: Course[];
  structure: FeeStructure | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const editingExisting = structure != null;

  const [instituteCode, setInstituteCode] = useState(structure?.instituteCode ?? ALL);
  // Editing an existing structure keeps its single locked program (never changes, so no setter
  // needed); adding new lets the admin check off any number of that institute's programs to
  // create one identical structure per program in a single save.
  const programCode = structure?.programCode ?? ALL;
  const [selectedProgramCodes, setSelectedProgramCodes] = useState<string[]>([]);
  const [admissionYear, setAdmissionYear] = useState<number>(structure?.admissionYear ?? new Date().getFullYear());
  const [academicYear, setAcademicYear] = useState<number>(structure?.academicYear ?? currentAcademicYear());
  const [items, setItems] = useState<ItemDraft[]>(toDrafts(structure?.items ?? []));
  const [saving, setSaving] = useState(false);
  const [nextKey, setNextKey] = useState(items.length);

  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);
  const programOptions = useMemo(
    () => programOptionsFrom(courses, instituteCode ? [instituteCode] : []),
    [courses, instituteCode]
  );
  // Short names (e.g. "USAR") over the raw portal names, matching the list row and the rest of
  // the admin portal's institute/program pickers.
  const instituteLabel = useMemo(() => labelLookup(instituteOptionsFrom(institutes)), [institutes]);
  const programLabel = useMemo(() => labelLookup(programOptionsFrom(courses)), [courses]);

  const allProgramsSelected = programOptions.length > 0 && selectedProgramCodes.length === programOptions.length;
  const toggleProgram = (code: string, checked: boolean) =>
    setSelectedProgramCodes((prev) => (checked ? [...prev, code] : prev.filter((c) => c !== code)));

  const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const addItem = () => {
    setItems((prev) => [...prev, { key: nextKey, label: "", amount: "" }]);
    setNextKey((k) => k + 1);
  };
  const removeItem = (key: number) => setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  const updateItem = (key: number, field: "label" | "amount", value: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));

  const validItems = items
    .map((it) => ({ label: it.label.trim(), amount: Number(it.amount) }))
    .filter((it) => it.label && it.amount > 0);

  const itemsValid = validItems.length === items.length && items.length > 0;
  const canSave = editingExisting
    ? Boolean(instituteCode && programCode && admissionYear > 0 && academicYear > 0 && itemsValid)
    : Boolean(instituteCode && selectedProgramCodes.length > 0 && admissionYear > 0 && academicYear > 0 && itemsValid);

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editingExisting) {
        await saveFeeStructure({ instituteCode, programCode, admissionYear, academicYear, items: validItems });
        toast("Fee structure updated", "success");
      } else {
        // One identical structure per checked program - a full-replace upsert per (institute,
        // program, admissionYear, academicYear), so re-checking a program that already has one
        // for this exact year/session just overwrites it rather than erroring or duplicating.
        await Promise.all(
          selectedProgramCodes.map((code) =>
            saveFeeStructure({ instituteCode, programCode: code, admissionYear, academicYear, items: validItems })
          )
        );
        toast(
          selectedProgramCodes.length === 1
            ? "Fee structure added"
            : `Fee structure added for ${selectedProgramCodes.length} programs`,
          "success"
        );
      }
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save fee structure", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-bold text-primary">
            {editingExisting ? "Edit Fee Structure" : "Add Fee Structure"}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12.5px] text-muted mb-4">
          The total is always the sum of the items below — there is no separate total to enter.
          {!editingExisting && selectedProgramCodes.length > 1 && (
            <> This breakup will be saved identically for all {selectedProgramCodes.length} selected programs.</>
          )}
        </p>

        <div className="space-y-4 mb-5">
          {editingExisting ? (
            // Institute/program/admission year/session are the structure's identity — changing
            // any of them here would silently create a second structure instead of editing this
            // one, so they're locked; delete and re-add instead if one was chosen by mistake.
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <div><span className="text-muted">Institute:</span> <span className="font-semibold">{instituteLabel(structure!.instituteCode)}</span></div>
              <div><span className="text-muted">Program:</span> <span className="font-semibold">{programLabel(structure!.programCode)}</span></div>
              <div><span className="text-muted">Admission Year:</span> <span className="font-semibold">{structure!.admissionYear}</span></div>
              <div><span className="text-muted">Session:</span> <span className="font-semibold">{structure!.label}</span></div>
            </div>
          ) : (
            <>
              <Filter label="Institute">
                <select
                  value={instituteCode}
                  onChange={(e) => { setInstituteCode(e.target.value); setSelectedProgramCodes([]); }}
                  className={SELECT_CLASS}
                >
                  <option value={ALL}>Select an institute…</option>
                  {instituteOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Filter>

              <Filter label={`Programs${selectedProgramCodes.length > 0 ? ` (${selectedProgramCodes.length} selected)` : ""}`}>
                {!instituteCode ? (
                  <p className="text-[12.5px] text-muted px-1 py-2">Select an institute first.</p>
                ) : programOptions.length === 0 ? (
                  <p className="text-[12.5px] text-muted px-1 py-2">This institute has no programs yet.</p>
                ) : (
                  <div className="border border-border rounded-lg bg-background max-h-40 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold border-b border-border cursor-pointer hover:bg-primary-faint">
                      <input
                        type="checkbox"
                        checked={allProgramsSelected}
                        onChange={(e) => setSelectedProgramCodes(e.target.checked ? programOptions.map((o) => o.value) : [])}
                      />
                      Select all programs in this institute
                    </label>
                    {programOptions.map((o) => (
                      <label
                        key={o.value}
                        className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-primary-faint"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProgramCodes.includes(o.value)}
                          onChange={(e) => toggleProgram(o.value, e.target.checked)}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                )}
              </Filter>

              <div className="grid grid-cols-2 gap-4">
                <Filter label="Admission Year">
                  <select value={admissionYear} onChange={(e) => setAdmissionYear(Number(e.target.value))} className={SELECT_CLASS}>
                    {admissionYearOptions().map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </Filter>

                <Filter label="Session">
                  <select value={academicYear} onChange={(e) => setAcademicYear(Number(e.target.value))} className={SELECT_CLASS}>
                    {academicYearOptions().map((y) => (
                      <option key={y} value={y}>{academicYearLabel(y)}</option>
                    ))}
                  </select>
                </Filter>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Fee Breakup</span>
          <button onClick={addItem} className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline">
            <Plus className="w-3.5 h-3.5" />
            Add line
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-2">
              <input
                type="text"
                value={it.label}
                onChange={(e) => updateItem(it.key, "label", e.target.value)}
                placeholder="e.g. Tuition Fee"
                className="flex-1 border border-border rounded-lg px-3 py-2 text-[13px] bg-background focus:outline-none focus:border-primary"
              />
              <input
                type="number"
                min={0}
                value={it.amount}
                onChange={(e) => updateItem(it.key, "amount", e.target.value)}
                placeholder="Amount"
                className="w-32 border border-border rounded-lg px-3 py-2 text-[13px] bg-background focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => removeItem(it.key)}
                disabled={items.length === 1}
                className="text-muted hover:text-danger transition-colors disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-primary-faint text-[13px] text-primary font-bold flex items-center justify-between mb-5">
          <span>Total</span>
          <span>{formatAmount(total)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-[13px] font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !canSave}
            className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : !editingExisting && selectedProgramCodes.length > 1
                ? `Save for ${selectedProgramCodes.length} programs`
                : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
