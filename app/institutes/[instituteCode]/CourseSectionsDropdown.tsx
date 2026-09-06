"use client";

import { useState, useCallback, useEffect, useMemo, FormEvent } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { useToast } from "../../components/Toast";
import DetailDialog from "../../components/DetailDialog";
import {
  createSection,
  updateSection,
  deleteSection,
  fetchLabGroups,
  createLabGroup,
  updateLabGroup,
  deleteLabGroup,
  type Course,
  type SectionDto,
  type LabGroupDto,
} from "../../lib/api";

// Class sections (and their lab groups) live on the course row they belong to, scoped by batch
// year via this dropdown, rather than on a standalone page — a section needs both the institute
// (already the page's context) and the specific program, so it belongs with the course. Moved
// here on 2026-09-06 from a per-institute "Class Sections" card that listed every course's
// sections together; see TimetablePage for the sibling "Timetable Slots" concern, which stayed
// put. Deliberately optional — most programs/batches never split into subgroups, so this must
// never read as a required setup step.

export function BatchYearSelect({
  course,
  sections,
  value,
  onChange,
}: {
  course: Course;
  sections: SectionDto[];
  value: number | null;
  onChange: (batchYear: number | null) => void;
}) {
  const batchYears = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of sections) {
      if (s.programCode !== course.programCode) continue;
      counts.set(s.batchYear, (counts.get(s.batchYear) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0] - a[0]);
  }, [sections, course.programCode]);

  const isKnownYear = value != null && batchYears.some(([y]) => y === value);
  const displayValue = value == null ? "" : isKnownYear ? String(value) : "__custom__";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === "") {
      onChange(null);
      return;
    }
    if (v === "__custom__") return; // already-selected pending year, re-picking the same option
    if (v === "__new__") {
      const input = prompt("Batch year to add sections for (e.g. 2024):");
      if (!input) return;
      const year = Number(input.trim());
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        alert("Enter a valid 4-digit year.");
        return;
      }
      onChange(year);
      return;
    }
    onChange(Number(v));
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={displayValue}
        onChange={handleChange}
        title="Manage class sections for this program's batches"
        className="px-2 py-1.5 border border-border rounded-lg text-[12px] bg-surface focus:outline-none focus:border-primary max-w-[10rem]"
      >
        <option value="">Sections ▾</option>
        {batchYears.map(([year, count]) => (
          <option key={year} value={year}>
            {year} ({count})
          </option>
        ))}
        {value != null && !isKnownYear && <option value="__custom__">{value} (new)</option>}
        <option value="__new__">+ Add batch year…</option>
      </select>
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Close"
          className="p-1 text-muted hover:text-foreground rounded transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function BatchYearSectionsPanel({
  instituteCode,
  course,
  batchYear,
  sections,
  onChanged,
}: {
  instituteCode: string;
  course: Course;
  batchYear: number;
  sections: SectionDto[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<SectionDto | null>(null);

  const batchSections = useMemo(
    () =>
      sections
        .filter((s) => s.programCode === course.programCode && s.batchYear === batchYear)
        .sort((a, b) => a.sectionName.localeCompare(b.sectionName)),
    [sections, course.programCode, batchYear]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[12.5px] font-bold text-primary">
          {course.shortName || course.programCode} · Batch {batchYear} — Sections
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          New Section
        </button>
      </div>

      <p className="text-[11.5px] text-muted mb-3">
        Optional — only add sections where this batch actually splits into subgroups (e.g. B1/B2) for classrooms
        or labs. Who belongs to a section (and its lab groups) is decided by enrollment-number serial range, not a
        roster.
      </p>

      {batchSections.length === 0 ? (
        <p className="text-[12.5px] text-muted py-3">
          No sections defined for this batch — it&apos;s currently treated as one group.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {batchSections.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setSelected(s)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface border border-border hover:border-primary text-[13px] transition-colors"
              >
                <span className="font-semibold text-foreground">{s.sectionName}</span>
                <span className="tabular-nums text-muted">
                  {s.serialRangeStart}–{s.serialRangeEnd}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <DetailDialog
          title="New Section"
          subtitle={`A cohort subdivision within ${course.programName}, batch ${batchYear}.`}
          onClose={() => setShowForm(false)}
        >
          <SectionForm
            instituteCode={instituteCode}
            programCode={course.programCode}
            batchYear={batchYear}
            onSaved={() => {
              setShowForm(false);
              onChanged();
            }}
          />
        </DetailDialog>
      )}

      {selected && (
        <DetailDialog
          title={selected.sectionName}
          subtitle={`${course.shortName || course.programCode} · Batch ${selected.batchYear}`}
          onClose={() => setSelected(null)}
        >
          <SectionDetail
            section={selected}
            onSectionChanged={(updated) => {
              setSelected(updated);
              onChanged();
            }}
            onSectionDeleted={() => {
              setSelected(null);
              onChanged();
            }}
          />
        </DetailDialog>
      )}
    </div>
  );
}

function SectionForm({
  instituteCode,
  programCode,
  batchYear,
  onSaved,
}: {
  instituteCode: string;
  programCode: string;
  batchYear: number;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [serialRangeStart, setSerialRangeStart] = useState("");
  const [serialRangeEnd, setSerialRangeEnd] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const start = Number(serialRangeStart);
    const end = Number(serialRangeEnd);
    if (!sectionName.trim() || !serialRangeStart || !serialRangeEnd) {
      toast("Please fill all required fields", "error");
      return;
    }
    if (start > end) {
      toast("Serial range start must not be greater than end", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createSection({
        instituteCode,
        programCode,
        batchYear,
        sectionName: sectionName.trim(),
        serialRangeStart: start,
        serialRangeEnd: end,
      });
      toast("Section created");
      onSaved();
    } catch (err) {
      toast(`Failed to create section: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <Field label="Section Name *">
        <input
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          placeholder="e.g. B1"
          autoFocus
          className={inputClass}
        />
      </Field>
      <div />
      <Field label="Serial Range Start *">
        <input
          type="number"
          min={0}
          value={serialRangeStart}
          onChange={(e) => setSerialRangeStart(e.target.value)}
          placeholder="e.g. 1"
          className={inputClass}
        />
      </Field>
      <Field label="Serial Range End *">
        <input
          type="number"
          min={0}
          value={serialRangeEnd}
          onChange={(e) => setSerialRangeEnd(e.target.value)}
          placeholder="e.g. 60"
          className={inputClass}
        />
      </Field>
      <p className="col-span-2 text-[11.5px] text-muted -mt-1">
        A student falls in this section if their enrollment number&apos;s 3-digit serial component lies in this
        range — read the actual ranges off the university&apos;s own class list or timetable PDF.
      </p>
      <div className="col-span-2 flex justify-end mt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create Section"}
        </button>
      </div>
    </form>
  );
}

function SectionDetail({
  section,
  onSectionChanged,
  onSectionDeleted,
}: {
  section: SectionDto;
  onSectionChanged: (updated: SectionDto) => void;
  onSectionDeleted: () => void;
}) {
  const { toast } = useToast();
  const [sectionName, setSectionName] = useState(section.sectionName);
  const [serialRangeStart, setSerialRangeStart] = useState(String(section.serialRangeStart));
  const [serialRangeEnd, setSerialRangeEnd] = useState(String(section.serialRangeEnd));
  const [savingSection, setSavingSection] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [groups, setGroups] = useState<LabGroupDto[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LabGroupDto | null>(null);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      setGroups(await fetchLabGroups(section.id));
    } catch (err) {
      toast(`Failed to load lab groups: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setGroupsLoading(false);
    }
  }, [section.id, toast]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleSaveSection = async (e: FormEvent) => {
    e.preventDefault();
    const start = Number(serialRangeStart);
    const end = Number(serialRangeEnd);
    if (!sectionName.trim() || !serialRangeStart || !serialRangeEnd || start > end) {
      toast("Please check the section name and serial range", "error");
      return;
    }
    setSavingSection(true);
    try {
      const updated = await updateSection(section.id, {
        sectionName: sectionName.trim(),
        serialRangeStart: start,
        serialRangeEnd: end,
      });
      toast("Section updated");
      onSectionChanged(updated);
    } catch (err) {
      toast(`Failed to update section: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSavingSection(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!confirm(`Delete section "${section.sectionName}"? This also removes its lab groups.`)) return;
    setDeleting(true);
    try {
      await deleteSection(section.id);
      toast("Section deleted");
      onSectionDeleted();
    } catch (err) {
      toast(`Failed to delete section: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
      setDeleting(false);
    }
  };

  const handleDeleteGroup = async (group: LabGroupDto) => {
    if (!confirm(`Delete lab group "${group.groupName}"?`)) return;
    try {
      await deleteLabGroup(group.id);
      toast("Lab group deleted");
      loadGroups();
    } catch (err) {
      toast(`Failed to delete lab group: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  return (
    <div>
      <form onSubmit={handleSaveSection} className="grid grid-cols-2 gap-4 pb-5 mb-5 border-b border-border">
        <Field label="Section Name">
          <input value={sectionName} onChange={(e) => setSectionName(e.target.value)} className={inputClass} />
        </Field>
        <div />
        <Field label="Serial Range Start">
          <input
            type="number"
            min={0}
            value={serialRangeStart}
            onChange={(e) => setSerialRangeStart(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Serial Range End">
          <input
            type="number"
            min={0}
            value={serialRangeEnd}
            onChange={(e) => setSerialRangeEnd(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="col-span-2 flex justify-between items-center mt-1">
          <button
            type="button"
            onClick={handleDeleteSection}
            disabled={deleting}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger hover:underline disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "Deleting…" : "Delete Section"}
          </button>
          <button
            type="submit"
            disabled={savingSection}
            className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60"
          >
            {savingSection ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-primary">Lab Groups</h3>
        <button
          onClick={() => setShowGroupForm(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Group
        </button>
      </div>

      {groupsLoading ? (
        <div className="skeleton h-10 rounded-lg" />
      ) : groups.length === 0 ? (
        <p className="text-[12.5px] text-muted">No lab groups yet — only needed if this section splits for labs (e.g. A/B).</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-background text-[13px]">
              <span className="font-semibold text-foreground">{g.groupName}</span>
              <span className="tabular-nums text-muted">
                {g.serialRangeStart}–{g.serialRangeEnd}
              </span>
              <div className="flex items-center gap-3 ml-auto">
                <button onClick={() => setEditingGroup(g)} className="text-muted hover:text-primary">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteGroup(g)} className="text-muted hover:text-danger">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showGroupForm && (
        <div className="mt-4 pt-4 border-t border-border">
          <LabGroupForm
            sectionId={section.id}
            onSaved={() => {
              setShowGroupForm(false);
              loadGroups();
            }}
            onCancel={() => setShowGroupForm(false)}
          />
        </div>
      )}
      {editingGroup && (
        <div className="mt-4 pt-4 border-t border-border">
          <LabGroupForm
            sectionId={section.id}
            existing={editingGroup}
            onSaved={() => {
              setEditingGroup(null);
              loadGroups();
            }}
            onCancel={() => setEditingGroup(null)}
          />
        </div>
      )}
    </div>
  );
}

function LabGroupForm({
  sectionId,
  existing,
  onSaved,
  onCancel,
}: {
  sectionId: string;
  existing?: LabGroupDto;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [groupName, setGroupName] = useState(existing?.groupName ?? "");
  const [serialRangeStart, setSerialRangeStart] = useState(existing ? String(existing.serialRangeStart) : "");
  const [serialRangeEnd, setSerialRangeEnd] = useState(existing ? String(existing.serialRangeEnd) : "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const start = Number(serialRangeStart);
    const end = Number(serialRangeEnd);
    if (!groupName.trim() || !serialRangeStart || !serialRangeEnd || start > end) {
      toast("Please check the group name and serial range", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (existing) {
        await updateLabGroup(existing.id, { groupName: groupName.trim(), serialRangeStart: start, serialRangeEnd: end });
        toast("Lab group updated");
      } else {
        await createLabGroup(sectionId, { groupName: groupName.trim(), serialRangeStart: start, serialRangeEnd: end });
        toast("Lab group added");
      }
      onSaved();
    } catch (err) {
      toast(`Failed to save lab group: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-3 items-end">
      <Field label="Group Name *">
        <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. A" className={inputClass} />
      </Field>
      <Field label="Serial Range Start *">
        <input type="number" min={0} value={serialRangeStart} onChange={(e) => setSerialRangeStart(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Serial Range End *">
        <input type="number" min={0} value={serialRangeEnd} onChange={(e) => setSerialRangeEnd(e.target.value)} className={inputClass} />
      </Field>
      <div className="col-span-3 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-[10px] text-[13px] font-semibold text-muted hover:text-foreground">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Saving…" : existing ? "Save Group" : "Add Group"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
