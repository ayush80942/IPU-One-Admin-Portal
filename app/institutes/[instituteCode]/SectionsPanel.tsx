"use client";

import { useState, useEffect, useCallback, useMemo, FormEvent } from "react";
import { Users2, Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "../../components/Toast";
import SectionCard from "../../components/SectionCard";
import EmptyState from "../../components/EmptyState";
import DetailDialog from "../../components/DetailDialog";
import {
  fetchSections,
  createSection,
  updateSection,
  deleteSection,
  fetchLabGroups,
  createLabGroup,
  updateLabGroup,
  deleteLabGroup,
  type Course,
  type Institute,
  type SectionDto,
  type LabGroupDto,
} from "../../lib/api";
import { programOptionsFrom, BATCH_YEAR_OPTIONS, type CodeOption } from "../../lib/noticeTaxonomy";

// Class sections (and their lab groups) for one institute, scoped further by program and batch
// year on the create form. Deliberately optional - most programs/batches never split into
// subgroups, so this must never read as a required setup step. See TimetablePage (moved from
// there on 2026-09-06 - section creation belongs with the institute/program it's shaping, not on
// a standalone page) for the sibling "Timetable Slots" concern, which stayed put.
export default function SectionsPanel({ institute, courses }: { institute: Institute; courses: Course[] }) {
  const { toast } = useToast();
  const [sections, setSections] = useState<SectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<SectionDto | null>(null);

  const instituteCourses = useMemo(
    () =>
      courses
        .filter((c) => c.instituteCode === institute.instituteCode)
        .sort((a, b) => a.programCode.localeCompare(b.programCode)),
    [courses, institute.instituteCode]
  );
  const programOptions = useMemo(() => programOptionsFrom(instituteCourses), [instituteCourses]);
  const programLabel = useMemo(() => {
    const map = new Map(programOptions.map((o) => [o.value, o.label]));
    return (code: string) => map.get(code) ?? code;
  }, [programOptions]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchSections();
      setSections(all.filter((s) => s.instituteCode === institute.instituteCode));
    } catch (err) {
      toast(`Failed to load sections: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [institute.instituteCode, toast]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () =>
      [...sections].sort(
        (a, b) =>
          b.batchYear - a.batchYear ||
          a.programCode.localeCompare(b.programCode) ||
          a.sectionName.localeCompare(b.sectionName)
      ),
    [sections]
  );

  return (
    <SectionCard
      title="Class Sections"
      icon={Users2}
      action={
        instituteCourses.length > 0 ? (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            New Section
          </button>
        ) : undefined
      }
    >
      <p className="text-[12.5px] text-muted -mt-2 mb-4">
        Optional — only add sections where a program&apos;s batch actually splits into subgroups (e.g. B1/B2) for
        classrooms or labs. Most programs and batch years have none, and that&apos;s the normal case, not a gap to
        fill in. Who belongs to a section (and its lab groups) is decided by enrollment-number serial range, not a
        roster.
      </p>

      {instituteCourses.length === 0 ? (
        <EmptyState icon={Users2} message="Add a course to this institute first — a section belongs to a specific program." />
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Users2} message="No sections defined — every batch here is currently treated as one group." />
      ) : (
        <div className="overflow-x-auto -mx-6 -mb-6">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-primary-faint">
                <th className="px-6 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Section</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Program</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Batch Year</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Serial Range</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                >
                  <td className="px-6 py-3 font-semibold text-foreground">{s.sectionName}</td>
                  <td className="px-4 py-3 text-[12px] text-muted">{programLabel(s.programCode)}</td>
                  <td className="px-4 py-3">{s.batchYear}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">{s.serialRangeStart}–{s.serialRangeEnd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <DetailDialog
          title="New Section"
          subtitle={`A cohort subdivision within ${institute.shortName || institute.instituteName}, e.g. B1 within AIDS 2024.`}
          onClose={() => setShowForm(false)}
        >
          <SectionForm
            instituteCode={institute.instituteCode}
            programOptions={programOptions}
            onSaved={() => { setShowForm(false); load(); }}
          />
        </DetailDialog>
      )}

      {selected && (
        <DetailDialog
          title={selected.sectionName}
          subtitle={`${programLabel(selected.programCode)} · Batch ${selected.batchYear}`}
          onClose={() => setSelected(null)}
        >
          <SectionDetail
            section={selected}
            onSectionChanged={(updated) => { setSelected(updated); load(); }}
            onSectionDeleted={() => { setSelected(null); load(); }}
          />
        </DetailDialog>
      )}
    </SectionCard>
  );
}

function SectionForm({
  instituteCode,
  programOptions,
  onSaved,
}: {
  instituteCode: string;
  programOptions: CodeOption[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [programCode, setProgramCode] = useState(programOptions[0]?.value ?? "");
  const [batchYear, setBatchYear] = useState(String(BATCH_YEAR_OPTIONS[0]?.value ?? new Date().getFullYear()));
  const [sectionName, setSectionName] = useState("");
  const [serialRangeStart, setSerialRangeStart] = useState("");
  const [serialRangeEnd, setSerialRangeEnd] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const start = Number(serialRangeStart);
    const end = Number(serialRangeEnd);
    if (!programCode || !sectionName.trim() || !serialRangeStart || !serialRangeEnd) {
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
        batchYear: Number(batchYear),
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
      <Field label="Program *">
        <select value={programCode} onChange={(e) => setProgramCode(e.target.value)} className={selectClass}>
          {programOptions.length === 0 && <option value="">No programs for this institute</option>}
          {programOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Batch Year *">
        <select value={batchYear} onChange={(e) => setBatchYear(e.target.value)} className={selectClass}>
          {BATCH_YEAR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Section Name *">
        <input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="e.g. B1" className={inputClass} />
      </Field>
      <div />
      <Field label="Serial Range Start *">
        <input type="number" min={0} value={serialRangeStart} onChange={(e) => setSerialRangeStart(e.target.value)} placeholder="e.g. 1" className={inputClass} />
      </Field>
      <Field label="Serial Range End *">
        <input type="number" min={0} value={serialRangeEnd} onChange={(e) => setSerialRangeEnd(e.target.value)} placeholder="e.g. 60" className={inputClass} />
      </Field>
      <p className="col-span-2 text-[11.5px] text-muted -mt-1">
        A student falls in this section if their enrollment number&apos;s 3-digit serial component lies in this
        range — read the actual ranges off the university&apos;s own class list or timetable PDF.
      </p>
      <div className="col-span-2 flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
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

  useEffect(() => { loadGroups(); }, [loadGroups]);

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
      const updated = await updateSection(section.id, { sectionName: sectionName.trim(), serialRangeStart: start, serialRangeEnd: end });
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
          <input type="number" min={0} value={serialRangeStart} onChange={(e) => setSerialRangeStart(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Serial Range End">
          <input type="number" min={0} value={serialRangeEnd} onChange={(e) => setSerialRangeEnd(e.target.value)} className={inputClass} />
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
          <button type="submit" disabled={savingSection} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
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
              <span className="tabular-nums text-muted">{g.serialRangeStart}–{g.serialRangeEnd}</span>
              <div className="flex items-center gap-3 ml-auto">
                <button onClick={() => setEditingGroup(g)} className="text-muted hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDeleteGroup(g)} className="text-muted hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showGroupForm && (
        <div className="mt-4 pt-4 border-t border-border">
          <LabGroupForm sectionId={section.id} onSaved={() => { setShowGroupForm(false); loadGroups(); }} onCancel={() => setShowGroupForm(false)} />
        </div>
      )}
      {editingGroup && (
        <div className="mt-4 pt-4 border-t border-border">
          <LabGroupForm
            sectionId={section.id}
            existing={editingGroup}
            onSaved={() => { setEditingGroup(null); loadGroups(); }}
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

const inputClass = "border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors w-full";
const selectClass = inputClass;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
