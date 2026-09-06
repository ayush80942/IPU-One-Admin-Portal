"use client";

import { useState, useEffect, useCallback, useMemo, FormEvent } from "react";
import { CalendarDays, Plus, Users2, Rows3, Trash2, Pencil, Clock } from "lucide-react";
import { useToast } from "../components/Toast";
import { useAdminSession, useIsSuperAdmin } from "../components/AuthGate";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import DetailDialog from "../components/DetailDialog";
import Combobox, { ComboboxOption } from "../components/Combobox";
import {
  fetchInstitutes,
  fetchCourses,
  fetchSections,
  createSection,
  updateSection,
  deleteSection,
  fetchLabGroups,
  createLabGroup,
  updateLabGroup,
  deleteLabGroup,
  fetchFeedbackOfferings,
  fetchTimetableSlots,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  Institute,
  Course,
  SectionDto,
  LabGroupDto,
  TeachingOfferingDto,
  TimetableSlotDto,
  TimetableDayOfWeek,
  DAYS_OF_WEEK,
} from "../lib/api";
import { instituteOptionsFrom, programOptionsFrom, BATCH_YEAR_OPTIONS } from "../lib/noticeTaxonomy";

type Tab = "sections" | "slots";

const TABS: { value: Tab; label: string; icon: typeof Rows3 }[] = [
  { value: "sections", label: "Sections & Groups", icon: Users2 },
  { value: "slots", label: "Timetable Slots", icon: Clock },
];

const DAY_LABEL: Record<TimetableDayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export default function TimetablePage() {
  const { toast } = useToast();
  const session = useAdminSession();
  const isSuper = useIsSuperAdmin();
  const [tab, setTab] = useState<Tab>("sections");

  const [loading, setLoading] = useState(true);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<SectionDto[]>([]);
  const [offerings, setOfferings] = useState<TeachingOfferingDto[]>([]);

  const lockedInstituteCodes = useMemo(
    () => (isSuper ? null : session?.institutes.map((i) => i.instituteCode) ?? []),
    [isSuper, session]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [institutesData, coursesData, sectionsData, offeringsData] = await Promise.all([
        fetchInstitutes(),
        fetchCourses(),
        fetchSections(),
        fetchFeedbackOfferings(),
      ]);
      setInstitutes(institutesData);
      setCourses(coursesData);
      setSections(sectionsData);
      setOfferings(offeringsData);
    } catch (err) {
      toast(`Failed to load timetable data: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle="Class shape (sections, lab groups) and the weekly schedule for each teaching offering."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile value={loading ? "—" : sections.length} label="Sections" icon={Users2} />
        <StatTile value={loading ? "—" : offerings.length} label="Teaching Offerings" icon={Rows3} color="info" />
        <StatTile
          value={loading ? "—" : offerings.filter((o) => o.sectionId).length}
          label="Section-Scoped Offerings"
          icon={CalendarDays}
          color="violet"
        />
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition-colors -mb-px ${
                tab === t.value ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "sections" && (
        <SectionsTab
          institutes={institutes}
          courses={courses}
          sections={sections}
          lockedInstituteCodes={lockedInstituteCodes}
          loading={loading}
          onChanged={load}
        />
      )}
      {tab === "slots" && (
        <SlotsTab offerings={offerings} loading={loading} />
      )}
    </div>
  );
}

// ============================================================================
// Sections & Groups
// ============================================================================

function SectionsTab({
  institutes,
  courses,
  sections,
  lockedInstituteCodes,
  loading,
  onChanged,
}: {
  institutes: Institute[];
  courses: Course[];
  sections: SectionDto[];
  lockedInstituteCodes: string[] | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<SectionDto | null>(null);
  const instituteLabel = useMemo(() => {
    const map = new Map(instituteOptionsFrom(institutes).map((o) => [o.value, o.label]));
    return (code: string) => map.get(code) ?? code;
  }, [institutes]);
  const programLabel = useMemo(() => {
    const map = new Map(programOptionsFrom(courses).map((o) => [o.value, o.label]));
    return (code: string) => map.get(code) ?? code;
  }, [courses]);

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-bold text-primary">Sections</h2>
          <p className="text-[12px] text-muted mt-0.5">
            Who belongs to a section (and its lab groups) is decided by enrollment-number serial range, not a roster.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13.5px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Section
        </button>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      ) : sections.length === 0 ? (
        <EmptyState icon={Users2} message="No sections defined yet — create one to start building a timetable." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-primary-faint">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Section</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute / Program</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Batch Year</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Serial Range</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                >
                  <td className="px-4 py-3 font-semibold text-foreground">{s.sectionName}</td>
                  <td className="px-4 py-3 text-[12px] text-muted">{instituteLabel(s.instituteCode)} / {programLabel(s.programCode)}</td>
                  <td className="px-4 py-3">{s.batchYear}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">{s.serialRangeStart}–{s.serialRangeEnd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <DetailDialog title="New Section" subtitle="A cohort subdivision, e.g. B1 within AIDS 2024." onClose={() => setShowForm(false)}>
          <SectionForm
            institutes={institutes}
            courses={courses}
            lockedInstituteCodes={lockedInstituteCodes}
            onSaved={() => { setShowForm(false); onChanged(); }}
          />
        </DetailDialog>
      )}

      {selected && (
        <DetailDialog
          title={selected.sectionName}
          subtitle={`${instituteLabel(selected.instituteCode)} / ${programLabel(selected.programCode)} · Batch ${selected.batchYear}`}
          onClose={() => setSelected(null)}
        >
          <SectionDetail
            section={selected}
            onSectionChanged={(updated) => { setSelected(updated); onChanged(); }}
            onSectionDeleted={() => { setSelected(null); onChanged(); }}
          />
        </DetailDialog>
      )}
    </div>
  );
}

function SectionForm({
  institutes,
  courses,
  lockedInstituteCodes,
  onSaved,
}: {
  institutes: Institute[];
  courses: Course[];
  lockedInstituteCodes: string[] | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);
  const allowedInstituteOptions = lockedInstituteCodes
    ? instituteOptions.filter((o) => lockedInstituteCodes.includes(o.value))
    : instituteOptions;

  const [instituteCode, setInstituteCode] = useState(allowedInstituteOptions[0]?.value ?? "");
  const programOptions = useMemo(
    () => programOptionsFrom(courses, instituteCode ? [instituteCode] : []),
    [courses, instituteCode]
  );
  const [programCode, setProgramCode] = useState("");
  const [batchYear, setBatchYear] = useState(String(BATCH_YEAR_OPTIONS[0]?.value ?? new Date().getFullYear()));
  const [sectionName, setSectionName] = useState("");
  const [serialRangeStart, setSerialRangeStart] = useState("");
  const [serialRangeEnd, setSerialRangeEnd] = useState("");

  useEffect(() => {
    setProgramCode((prev) => (programOptions.some((o) => o.value === prev) ? prev : programOptions[0]?.value ?? ""));
  }, [programOptions]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const start = Number(serialRangeStart);
    const end = Number(serialRangeEnd);
    if (!instituteCode || !programCode || !sectionName.trim() || !serialRangeStart || !serialRangeEnd) {
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
      <Field label="Institute *">
        <select value={instituteCode} onChange={(e) => setInstituteCode(e.target.value)} className={selectClass} disabled={!!lockedInstituteCodes && allowedInstituteOptions.length <= 1}>
          {allowedInstituteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
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
      <Field label="Serial Range Start *">
        <input type="number" min={0} value={serialRangeStart} onChange={(e) => setSerialRangeStart(e.target.value)} placeholder="e.g. 1" className={inputClass} />
      </Field>
      <Field label="Serial Range End *">
        <input type="number" min={0} value={serialRangeEnd} onChange={(e) => setSerialRangeEnd(e.target.value)} placeholder="e.g. 60" className={inputClass} />
      </Field>
      <p className="col-span-2 text-[11.5px] text-muted -mt-1">
        A student falls in this section if their enrollment number&apos;s 3-digit serial component lies in this range —
        read the actual ranges off the university&apos;s own class list or timetable PDF.
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

// ============================================================================
// Timetable Slots
// ============================================================================

function offeringOptionsFrom(offerings: TeachingOfferingDto[]): ComboboxOption[] {
  return offerings.map((o) => ({
    value: o.id,
    label: `${o.subjectName} (${o.subjectCode})`,
    sublabel: `${o.teacherName} · ${o.academicTerm}${o.sectionName ? ` · ${o.sectionName}${o.groupName ? ` ${o.groupName}` : ""}` : ""}`,
  }));
}

function SlotsTab({ offerings, loading: offeringsLoading }: { offerings: TeachingOfferingDto[]; loading: boolean }) {
  const { toast } = useToast();
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [selectedOfferingLabel, setSelectedOfferingLabel] = useState("");
  const [slots, setSlots] = useState<TimetableSlotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TimetableSlotDto | null>(null);
  const offeringOptions = useMemo(() => offeringOptionsFrom(offerings), [offerings]);

  const load = useCallback(async (offeringId: string) => {
    setLoading(true);
    try {
      setSlots(await fetchTimetableSlots(offeringId));
    } catch (err) {
      toast(`Failed to load timetable slots: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedOfferingId) load(selectedOfferingId);
    else setSlots([]);
  }, [selectedOfferingId, load]);

  const handleDelete = async (slot: TimetableSlotDto) => {
    if (!confirm(`Delete this ${DAY_LABEL[slot.dayOfWeek]} slot?`)) return;
    try {
      await deleteTimetableSlot(slot.id);
      toast("Slot deleted");
      load(selectedOfferingId);
    } catch (err) {
      toast(`Failed to delete slot: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  const sorted = [...slots].sort((a, b) => {
    const dayDiff = DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek);
    return dayDiff !== 0 ? dayDiff : a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-[15px] font-bold text-primary mb-3">Pick a Teaching Offering</h2>
        <Combobox
          label="Offering"
          value={selectedOfferingId}
          displayValue={selectedOfferingLabel}
          search={(q) => {
            const lower = q.toLowerCase();
            return offeringOptions.filter(
              (o) => o.label.toLowerCase().includes(lower) || (o.sublabel ?? "").toLowerCase().includes(lower)
            );
          }}
          onSelect={(opt) => {
            setSelectedOfferingId(opt?.value ?? "");
            setSelectedOfferingLabel(opt?.label ?? "");
          }}
          placeholder={offeringsLoading ? "Loading offerings…" : "Search subject, code, or teacher…"}
          disabled={offeringsLoading}
        />
      </div>

      {!selectedOfferingId ? (
        <EmptyState icon={Clock} message="Pick a teaching offering above to see and edit its weekly slots." />
      ) : (
        <>
          <div className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap border-b border-border">
            <h3 className="text-[13.5px] font-semibold text-foreground">{selectedOfferingLabel}</h3>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13.5px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add Slot
            </button>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
          ) : sorted.length === 0 ? (
            <EmptyState icon={Clock} message="No slots yet for this offering." />
          ) : (
            <ul className="divide-y divide-border">
              {sorted.map((s) => (
                <li key={s.id} className="px-6 py-3 flex items-center gap-4 text-[13.5px]">
                  <Pill color="text-primary" colorFaint="bg-primary-faint">{DAY_LABEL[s.dayOfWeek]}</Pill>
                  <span className="tabular-nums font-medium text-foreground">{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</span>
                  <span className="text-muted">{s.room}</span>
                  <div className="flex items-center gap-3 ml-auto">
                    <button onClick={() => setEditing(s)} className="text-muted hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(s)} className="text-muted hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {showForm && (
        <DetailDialog title="Add Timetable Slot" subtitle={selectedOfferingLabel} onClose={() => setShowForm(false)}>
          <SlotForm offeringId={selectedOfferingId} onSaved={() => { setShowForm(false); load(selectedOfferingId); }} />
        </DetailDialog>
      )}
      {editing && (
        <DetailDialog title="Edit Timetable Slot" subtitle={selectedOfferingLabel} onClose={() => setEditing(null)}>
          <SlotForm offeringId={selectedOfferingId} existing={editing} onSaved={() => { setEditing(null); load(selectedOfferingId); }} />
        </DetailDialog>
      )}
    </div>
  );
}

function SlotForm({
  offeringId,
  existing,
  onSaved,
}: {
  offeringId: string;
  existing?: TimetableSlotDto;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState<TimetableDayOfWeek>(existing?.dayOfWeek ?? "MONDAY");
  const [startTime, setStartTime] = useState(existing?.startTime.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(existing?.endTime.slice(0, 5) ?? "10:00");
  const [room, setRoom] = useState(existing?.room ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!room.trim() || !startTime || !endTime) {
      toast("Please fill all fields", "error");
      return;
    }
    if (startTime >= endTime) {
      toast("Start time must be before end time", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (existing) {
        await updateTimetableSlot(existing.id, { dayOfWeek, startTime, endTime, room: room.trim() });
        toast("Slot updated");
      } else {
        await createTimetableSlot({ offeringId, dayOfWeek, startTime, endTime, room: room.trim() });
        toast("Slot added");
      }
      onSaved();
    } catch (err) {
      toast(`Failed to save slot: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <Field label="Day of Week *">
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as TimetableDayOfWeek)} className={selectClass}>
          {DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
        </select>
      </Field>
      <Field label="Room *">
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. A-406-CR" className={inputClass} />
      </Field>
      <Field label="Start Time *">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
      </Field>
      <Field label="End Time *">
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
      </Field>
      <div className="col-span-2 flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Saving…" : existing ? "Save Changes" : "Add Slot"}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Shared field styling
// ============================================================================

const inputClass = "border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors w-full";
const selectClass = inputClass;

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "col-span-2" : ""}`}>
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
