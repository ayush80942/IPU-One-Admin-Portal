"use client";

import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from "react";
import {
  MessageSquareText,
  Plus,
  ClipboardList,
  CalendarClock,
  BarChart3,
  Download,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { useToast } from "../components/Toast";
import { useAdminSession, useIsSuperAdmin } from "../components/AuthGate";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import {
  fetchFeedbackOfferings,
  createFeedbackOffering,
  updateFeedbackOffering,
  fetchFeedbackWindows,
  upsertFeedbackWindow,
  fetchFeedbackQuestions,
  createFeedbackQuestion,
  updateFeedbackQuestion,
  fetchFeedbackAnalytics,
  fetchFeedbackAnalyticsCsv,
  fetchInstitutes,
  fetchCourses,
  fetchTeachers,
  createTeacher,
  searchSubjectCatalog,
  fetchSections,
  fetchLabGroups,
  TeachingOfferingDto,
  FeedbackWindowDto,
  FeedbackQuestionDto,
  FeedbackAnalyticsDto,
  OfferingAnalyticsDto,
  FeedbackSubjectType,
  Institute,
  Course,
  TeacherDto,
  SectionDto,
  LabGroupDto,
} from "../lib/api";
import { instituteOptionsFrom, programOptionsFrom, BATCH_YEAR_OPTIONS } from "../lib/noticeTaxonomy";
import Combobox, { ComboboxOption } from "../components/Combobox";

type Tab = "offerings" | "windows" | "analytics" | "questions";

const TABS: { value: Tab; label: string; icon: typeof ClipboardList }[] = [
  { value: "offerings", label: "Offerings", icon: ClipboardList },
  { value: "windows", label: "Collection Window", icon: CalendarClock },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "questions", label: "Question Bank", icon: HelpCircle },
];

export default function FeedbackPage() {
  const { toast } = useToast();
  const session = useAdminSession();
  const isSuper = useIsSuperAdmin();
  const [tab, setTab] = useState<Tab>("offerings");

  const [loading, setLoading] = useState(true);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<TeacherDto[]>([]);
  const [sections, setSections] = useState<SectionDto[]>([]);
  const [offerings, setOfferings] = useState<TeachingOfferingDto[]>([]);
  const [windows, setWindows] = useState<FeedbackWindowDto[]>([]);
  const [analytics, setAnalytics] = useState<FeedbackAnalyticsDto>({ offerings: [] });

  // An institute admin only ever acts on their own institute(s); a super admin sees every
  // institute that has at least one offering/window, same split NoticeForm uses for targeting.
  const lockedInstituteCodes = useMemo(
    () => (isSuper ? null : session?.institutes.map((i) => i.instituteCode) ?? []),
    [isSuper, session]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [institutesData, coursesData, teachersData, sectionsData, offeringsData, windowsData, analyticsData] = await Promise.all([
        fetchInstitutes(),
        fetchCourses(),
        fetchTeachers(),
        fetchSections(),
        fetchFeedbackOfferings(),
        fetchFeedbackWindows(),
        fetchFeedbackAnalytics(),
      ]);
      setInstitutes(institutesData);
      setCourses(coursesData);
      setTeachers(teachersData);
      setSections(sectionsData);
      setOfferings(offeringsData);
      setWindows(windowsData);
      setAnalytics(analyticsData);
    } catch (err) {
      toast(`Failed to load feedback data: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Ticks once a minute so "open" status stays live without calling Date.now() directly during
  // render (impure — React flags this as a rule-of-purity violation), same pattern as portal-status.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const openWindowCount = windows.filter((w) => new Date(w.opensAt).getTime() <= now && now <= new Date(w.closesAt).getTime()).length;
  const ratedOfferings = analytics.offerings.filter((o) => o.responseCount > 0);
  const overallAverage = ratedOfferings.length > 0
    ? ratedOfferings.reduce((sum, o) => sum + o.averageRating, 0) / ratedOfferings.length
    : null;
  const totalEligible = analytics.offerings.reduce((sum, o) => sum + o.eligibleStudentCount, 0);
  const totalSubmissions = analytics.offerings.reduce((sum, o) => sum + o.submissionCount, 0);
  const overallParticipation = totalEligible > 0 ? totalSubmissions / totalEligible : null;

  return (
    <div>
      <PageHeader
        title="Faculty Feedback"
        subtitle="Manage teaching offerings, the collection window, and anonymous student ratings."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatTile value={loading ? "—" : offerings.length} label="Teaching Offerings" icon={ClipboardList} />
        <StatTile value={loading ? "—" : openWindowCount} label="Open Windows" icon={CalendarClock} color="info" />
        <StatTile
          value={loading || overallAverage == null ? "—" : overallAverage.toFixed(2)}
          label="Average Rating"
          icon={MessageSquareText}
          color="violet"
        />
        <StatTile
          value={loading || overallParticipation == null ? "—" : `${(overallParticipation * 100).toFixed(0)}%`}
          label="Participation Rate"
          icon={BarChart3}
          color="teal"
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
                tab === t.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "offerings" && (
        <OfferingsSection
          offerings={offerings}
          institutes={institutes}
          courses={courses}
          teachers={teachers}
          sections={sections}
          lockedInstituteCodes={lockedInstituteCodes}
          loading={loading}
          onChanged={load}
        />
      )}
      {tab === "windows" && (
        <WindowsSection
          windows={windows}
          institutes={institutes}
          lockedInstituteCodes={lockedInstituteCodes}
          loading={loading}
          onChanged={load}
        />
      )}
      {tab === "analytics" && (
        <AnalyticsSection courses={courses} analytics={analytics} loading={loading} onFilterChange={setAnalytics} />
      )}
      {tab === "questions" && <QuestionsSection />}
    </div>
  );
}

// ============================================================================
// Offerings
// ============================================================================

function OfferingsSection({
  offerings,
  institutes,
  courses,
  teachers,
  sections,
  lockedInstituteCodes,
  loading,
  onChanged,
}: {
  offerings: TeachingOfferingDto[];
  institutes: Institute[];
  courses: Course[];
  teachers: TeacherDto[];
  sections: SectionDto[];
  lockedInstituteCodes: string[] | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<TeachingOfferingDto | null>(null);
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
        <h2 className="text-[15px] font-bold text-primary">Teaching Offerings</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13.5px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Offering
        </button>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      ) : offerings.length === 0 ? (
        <EmptyState icon={ClipboardList} message="No teaching offerings yet — create one to start collecting feedback." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-primary-faint">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Subject</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Faculty</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute / Program</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Batch</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Term</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{o.subjectName}</div>
                    <div className="text-[12px] text-muted">{o.subjectCode} · {o.subjectType === "THEORY" ? "Theory" : "Practical"}{o.isElective ? " · Elective" : ""}</div>
                  </td>
                  <td className="px-4 py-3">{o.teacherName}</td>
                  <td className="px-4 py-3 text-[12px] text-muted">{instituteLabel(o.instituteCode)} / {programLabel(o.programCode)}</td>
                  <td className="px-4 py-3">{o.batchYear}{o.semesterNumber ? ` · Sem ${o.semesterNumber}` : ""}</td>
                  <td className="px-4 py-3">{o.academicTerm}</td>
                  <td className="px-4 py-3">
                    {o.active ? (
                      <Pill color="text-success" colorFaint="bg-success-faint">Active</Pill>
                    ) : (
                      <Pill color="text-muted" colorFaint="bg-background">Retired</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <DetailDialog title="New Teaching Offering" subtitle="What feedback should be collected on." onClose={() => setShowForm(false)}>
          <OfferingForm
            institutes={institutes}
            courses={courses}
            teachers={teachers}
            sections={sections}
            lockedInstituteCodes={lockedInstituteCodes}
            onSaved={() => { setShowForm(false); onChanged(); }}
            onTeacherAdded={onChanged}
          />
        </DetailDialog>
      )}

      {selected && (
        <DetailDialog title={selected.subjectName} subtitle={`${selected.academicTerm} · Batch ${selected.batchYear}`} onClose={() => setSelected(null)}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <DetailField label="Institute" value={instituteLabel(selected.instituteCode)} />
            <DetailField label="Program" value={programLabel(selected.programCode)} />
            <DetailField label="Batch Year" value={selected.batchYear} />
            <DetailField label="Academic Term" value={selected.academicTerm} />
          </div>
          <OfferingEditForm
            offering={selected}
            teachers={teachers.filter((t) => t.instituteCode === selected.instituteCode)}
            sections={sections.filter((s) => s.instituteCode === selected.instituteCode && s.programCode === selected.programCode)}
            onSaved={(updated) => { setSelected(updated); onChanged(); }}
            onTeacherAdded={onChanged}
          />
        </DetailDialog>
      )}
    </div>
  );
}

function teacherOptionsFrom(teachers: TeacherDto[]): ComboboxOption[] {
  return teachers.map((t) => ({
    value: t.id,
    label: t.title ? `${t.title} ${t.name}` : t.name,
    sublabel: t.facultyCode ?? undefined,
  }));
}

function OfferingForm({
  institutes,
  courses,
  teachers,
  sections,
  lockedInstituteCodes,
  onSaved,
  onTeacherAdded,
}: {
  institutes: Institute[];
  courses: Course[];
  teachers: TeacherDto[];
  sections: SectionDto[];
  lockedInstituteCodes: string[] | null;
  onSaved: () => void;
  onTeacherAdded: () => void;
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

  const [manualSubject, setManualSubject] = useState(false);
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectType, setSubjectType] = useState<FeedbackSubjectType>("THEORY");
  // Populated on every catalog search so picking a result can also prefill its known subject
  // type — free-text entry has no such source and leaves the manual selector as the only input.
  const subjectTypeByCode = useRef<Record<string, FeedbackSubjectType>>({});

  const [teacherId, setTeacherId] = useState("");
  const [teacherLabel, setTeacherLabel] = useState("");
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const teacherOptions = useMemo(
    () => teacherOptionsFrom(teachers.filter((t) => t.active && t.instituteCode === instituteCode)),
    [teachers, instituteCode]
  );

  const [batchYear, setBatchYear] = useState(String(BATCH_YEAR_OPTIONS[0]?.value ?? new Date().getFullYear()));
  const [semesterNumber, setSemesterNumber] = useState("");
  const [academicTerm, setAcademicTerm] = useState("");
  const [isElective, setIsElective] = useState(false);

  // Optional — null means the offering applies to the whole batch, the common case. Only
  // sections matching the chosen institute/program/batch year are offered.
  const [sectionId, setSectionId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<LabGroupDto[]>([]);
  const matchingSections = useMemo(
    () => sections.filter((s) => s.instituteCode === instituteCode && s.programCode === programCode && String(s.batchYear) === batchYear),
    [sections, instituteCode, programCode, batchYear]
  );

  useEffect(() => {
    setProgramCode((prev) => (programOptions.some((o) => o.value === prev) ? prev : programOptions[0]?.value ?? ""));
  }, [programOptions]);

  // A teacher picked under a different institute no longer applies once the institute changes.
  useEffect(() => {
    setTeacherId("");
    setTeacherLabel("");
  }, [instituteCode]);

  // A section picked under a different institute/program/batch no longer applies once those change.
  useEffect(() => {
    setSectionId("");
    setGroupId("");
    setGroups([]);
  }, [instituteCode, programCode, batchYear]);

  useEffect(() => {
    if (!sectionId) {
      setGroups([]);
      setGroupId("");
      return;
    }
    fetchLabGroups(sectionId).then(setGroups).catch(() => setGroups([]));
    setGroupId("");
  }, [sectionId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!instituteCode || !programCode || !subjectCode.trim() || !subjectName.trim() || !teacherId || !academicTerm.trim()) {
      toast("Please fill all required fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createFeedbackOffering({
        instituteCode,
        programCode,
        subjectCode: subjectCode.trim(),
        subjectName: subjectName.trim(),
        subjectType,
        teacherId,
        batchYear: Number(batchYear),
        semesterNumber: semesterNumber ? Number(semesterNumber) : null,
        academicTerm: academicTerm.trim(),
        isElective,
        sectionId: sectionId || null,
        groupId: groupId || null,
      });
      toast("Teaching offering created");
      onSaved();
    } catch (err) {
      toast(`Failed to create offering: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
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

      {manualSubject ? (
        <>
          <Field label="Subject Code *">
            <input value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g. CO301" className={inputClass} />
          </Field>
          <Field label="Subject Name *">
            <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g. Data Structures" className={inputClass} />
          </Field>
        </>
      ) : (
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <Combobox
            label="Subject *"
            value={subjectCode}
            displayValue={subjectName ? `${subjectName} (${subjectCode})` : subjectCode}
            search={async (q) => {
              const matches = await searchSubjectCatalog(q);
              subjectTypeByCode.current = Object.fromEntries(matches.map((m) => [m.subjectCode, m.subjectType]));
              return matches.map((m) => ({ value: m.subjectCode, label: m.subjectName, sublabel: m.subjectCode }));
            }}
            onSelect={(opt) => {
              if (!opt) return;
              setSubjectCode(opt.value);
              setSubjectName(opt.label);
              const knownType = subjectTypeByCode.current[opt.value];
              if (knownType) setSubjectType(knownType);
            }}
            placeholder="Search subject code or name…"
          />
          <div className="flex items-end pb-1">
            <button type="button" onClick={() => setManualSubject(true)} className="text-[12.5px] font-medium text-primary hover:underline">
              Can&apos;t find it? Enter manually
            </button>
          </div>
        </div>
      )}

      <Field label="Subject Type *">
        <select value={subjectType} onChange={(e) => setSubjectType(e.target.value as FeedbackSubjectType)} className={selectClass}>
          <option value="THEORY">Theory</option>
          <option value="PRACTICAL">Practical</option>
        </select>
      </Field>

      <Combobox
        label="Teacher *"
        value={teacherId}
        displayValue={teacherLabel}
        search={(q) => {
          const lower = q.toLowerCase();
          return teacherOptions.filter((o) => o.label.toLowerCase().includes(lower) || (o.sublabel ?? "").toLowerCase().includes(lower));
        }}
        onSelect={(opt) => {
          if (!opt) return;
          setTeacherId(opt.value);
          setTeacherLabel(opt.label);
        }}
        placeholder={instituteCode ? "Search teacher…" : "Pick an institute first"}
        disabled={!instituteCode}
        onCreateNew={{ label: "Add new teacher", onClick: () => setShowAddTeacher(true) }}
      />

      <Field label="Batch Year *">
        <select value={batchYear} onChange={(e) => setBatchYear(e.target.value)} className={selectClass}>
          {BATCH_YEAR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Semester Number">
        <input type="number" min={1} max={12} value={semesterNumber} onChange={(e) => setSemesterNumber(e.target.value)} placeholder="e.g. 5" className={inputClass} />
      </Field>
      <Field label="Academic Term *" full>
        <input value={academicTerm} onChange={(e) => setAcademicTerm(e.target.value)} placeholder="e.g. 2025-26 Odd" className={inputClass} />
      </Field>

      <Field label="Section">
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={selectClass}>
          <option value="">Whole batch (no section)</option>
          {matchingSections.map((s) => <option key={s.id} value={s.id}>{s.sectionName}</option>)}
        </select>
      </Field>
      <Field label="Lab Group">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectClass} disabled={!sectionId || groups.length === 0}>
          <option value="">{sectionId ? "Whole section (no group)" : "Pick a section first"}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.groupName}</option>)}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-[13px] text-foreground col-span-2">
        <input type="checkbox" checked={isElective} onChange={(e) => setIsElective(e.target.checked)} className="w-4 h-4" />
        This is an elective subject (optional for students to rate)
      </label>
      <div className="col-span-2 flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Creating…" : "Create Offering"}
        </button>
      </div>

      {showAddTeacher && (
        <DetailDialog title="Add New Teacher" onClose={() => setShowAddTeacher(false)}>
          <TeacherQuickAddForm
            instituteCode={instituteCode}
            onSaved={(teacher) => {
              setShowAddTeacher(false);
              setTeacherId(teacher.id);
              setTeacherLabel(teacher.title ? `${teacher.title} ${teacher.name}` : teacher.name);
              onTeacherAdded();
            }}
          />
        </DetailDialog>
      )}
    </form>
  );
}

function TeacherQuickAddForm({ instituteCode, onSaved }: { instituteCode: string; onSaved: (teacher: TeacherDto) => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Dr.");
  const [facultyCode, setFacultyCode] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      toast("Please enter at least an email and name", "error");
      return;
    }
    setSubmitting(true);
    try {
      const teacher = await createTeacher({
        email: email.trim(),
        name: name.trim(),
        title: title.trim() || null,
        instituteCode,
        facultyCode: facultyCode.trim() || null,
      });
      toast("Teacher added");
      onSaved(teacher);
    } catch (err) {
      toast(`Failed to add teacher: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <Field label="Email *" full>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@ipu.ac.in" className={inputClass} />
      </Field>
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dr., Prof." className={inputClass} />
      </Field>
      <Field label="Name *">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ruchika Sehgal" className={inputClass} />
      </Field>
      <Field label="Faculty Code" full>
        <input value={facultyCode} onChange={(e) => setFacultyCode(e.target.value)} placeholder="Optional" className={inputClass} />
      </Field>
      <div className="col-span-2 flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Adding…" : "Add Teacher"}
        </button>
      </div>
    </form>
  );
}

function OfferingEditForm({
  offering,
  teachers,
  sections,
  onSaved,
  onTeacherAdded,
}: {
  offering: TeachingOfferingDto;
  teachers: TeacherDto[];
  sections: SectionDto[];
  onSaved: (updated: TeachingOfferingDto) => void;
  onTeacherAdded: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [subjectCode, setSubjectCode] = useState(offering.subjectCode);
  const [subjectName, setSubjectName] = useState(offering.subjectName);
  const [subjectType, setSubjectType] = useState<FeedbackSubjectType>(offering.subjectType);
  const [teacherId, setTeacherId] = useState(offering.teacherId);
  const [teacherLabel, setTeacherLabel] = useState(offering.teacherName);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const teacherOptions = useMemo(() => teacherOptionsFrom(teachers.filter((t) => t.active)), [teachers]);
  const [semesterNumber, setSemesterNumber] = useState(offering.semesterNumber != null ? String(offering.semesterNumber) : "");
  const [isElective, setIsElective] = useState(!!offering.isElective);
  const [active, setActive] = useState(offering.active);

  const [sectionId, setSectionId] = useState(offering.sectionId ?? "");
  const [groupId, setGroupId] = useState(offering.groupId ?? "");
  const [groups, setGroups] = useState<LabGroupDto[]>([]);

  useEffect(() => {
    if (!sectionId) {
      setGroups([]);
      return;
    }
    fetchLabGroups(sectionId).then(setGroups).catch(() => setGroups([]));
  }, [sectionId]);

  // A group picked under a different section no longer applies once the section changes.
  const handleSectionChange = (newSectionId: string) => {
    setSectionId(newSectionId);
    if (newSectionId !== offering.sectionId) setGroupId("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updated = await updateFeedbackOffering(offering.id, {
        subjectCode: subjectCode.trim(),
        subjectName: subjectName.trim(),
        subjectType,
        teacherId,
        semesterNumber: semesterNumber ? Number(semesterNumber) : null,
        isElective,
        active,
        sectionId: sectionId || null,
        groupId: groupId || null,
      });
      toast("Offering updated");
      onSaved(updated);
    } catch (err) {
      toast(`Failed to update offering: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <Field label="Subject Code"><input value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} className={inputClass} /></Field>
      <Field label="Subject Name"><input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} className={inputClass} /></Field>
      <Field label="Subject Type">
        <select value={subjectType} onChange={(e) => setSubjectType(e.target.value as FeedbackSubjectType)} className={selectClass}>
          <option value="THEORY">Theory</option>
          <option value="PRACTICAL">Practical</option>
        </select>
      </Field>
      <Combobox
        label="Teacher"
        value={teacherId}
        displayValue={teacherLabel}
        search={(q) => {
          const lower = q.toLowerCase();
          return teacherOptions.filter((o) => o.label.toLowerCase().includes(lower) || (o.sublabel ?? "").toLowerCase().includes(lower));
        }}
        onSelect={(opt) => {
          if (!opt) return;
          setTeacherId(opt.value);
          setTeacherLabel(opt.label);
        }}
        onCreateNew={{ label: "Add new teacher", onClick: () => setShowAddTeacher(true) }}
      />
      <Field label="Semester Number"><input type="number" min={1} max={12} value={semesterNumber} onChange={(e) => setSemesterNumber(e.target.value)} className={inputClass} /></Field>
      <Field label="Section">
        <select value={sectionId} onChange={(e) => handleSectionChange(e.target.value)} className={selectClass}>
          <option value="">Whole batch (no section)</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.sectionName}</option>)}
        </select>
      </Field>
      <Field label="Lab Group">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectClass} disabled={!sectionId || groups.length === 0}>
          <option value="">{sectionId ? "Whole section (no group)" : "Pick a section first"}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.groupName}</option>)}
        </select>
      </Field>
      <div className="flex items-end gap-5 pb-1">
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" checked={isElective} onChange={(e) => setIsElective(e.target.checked)} className="w-4 h-4" />
          Elective
        </label>
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
          Active
        </label>
      </div>
      <div className="col-span-2 flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {showAddTeacher && (
        <DetailDialog title="Add New Teacher" onClose={() => setShowAddTeacher(false)}>
          <TeacherQuickAddForm
            instituteCode={offering.instituteCode}
            onSaved={(teacher) => {
              setShowAddTeacher(false);
              setTeacherId(teacher.id);
              setTeacherLabel(teacher.title ? `${teacher.title} ${teacher.name}` : teacher.name);
              onTeacherAdded();
            }}
          />
        </DetailDialog>
      )}
    </form>
  );
}

// ============================================================================
// Collection window
// ============================================================================

function WindowsSection({
  windows,
  institutes,
  lockedInstituteCodes,
  loading,
  onChanged,
}: {
  windows: FeedbackWindowDto[];
  institutes: Institute[];
  lockedInstituteCodes: string[] | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);
  const manageable = lockedInstituteCodes ? instituteOptions.filter((o) => lockedInstituteCodes.includes(o.value)) : instituteOptions;
  const [instituteCode, setInstituteCode] = useState(manageable[0]?.value ?? "");

  useEffect(() => {
    setInstituteCode((prev) => (manageable.some((o) => o.value === prev) ? prev : manageable[0]?.value ?? ""));
  }, [manageable]);

  const current = windows.find((w) => w.instituteCode === instituteCode);

  if (loading) {
    return <div className="bg-surface border border-border rounded-2xl shadow-sm p-6"><div className="skeleton h-32 rounded-lg" /></div>;
  }

  if (manageable.length === 0) {
    return <EmptyState icon={CalendarClock} message="No institute assigned to this account yet." />;
  }

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-border flex-wrap">
        <h2 className="text-[15px] font-bold text-primary">Collection Window</h2>
        {manageable.length > 1 && (
          <select value={instituteCode} onChange={(e) => setInstituteCode(e.target.value)} className={selectClass}>
            {manageable.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
      {instituteCode && (
        <WindowForm key={instituteCode} instituteCode={instituteCode} current={current} onSaved={onChanged} />
      )}
    </div>
  );
}

function toDatetimeLocal(iso: string): string {
  return iso.length >= 16 ? iso.slice(0, 16) : iso;
}

function WindowForm({ instituteCode, current, onSaved }: { instituteCode: string; current: FeedbackWindowDto | undefined; onSaved: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [academicTerm, setAcademicTerm] = useState(current?.academicTerm ?? "");
  const [opensAt, setOpensAt] = useState(current ? toDatetimeLocal(current.opensAt) : "");
  const [closesAt, setClosesAt] = useState(current ? toDatetimeLocal(current.closesAt) : "");
  const [resultsVisibleToAdmin, setResultsVisibleToAdmin] = useState(current?.resultsVisibleToAdmin ?? false);

  // See FeedbackPage's identical comment — avoids calling the impure Date.now() during render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const isOpen = !!current && new Date(current.opensAt).getTime() <= now && now <= new Date(current.closesAt).getTime();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!academicTerm.trim() || !opensAt || !closesAt) {
      toast("Please fill all fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      await upsertFeedbackWindow({
        instituteCode,
        academicTerm: academicTerm.trim(),
        opensAt,
        closesAt,
        resultsVisibleToAdmin,
      });
      toast("Collection window saved");
      onSaved();
    } catch (err) {
      toast(`Failed to save window: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {current && (
        <div className="mb-4">
          {isOpen ? (
            <Pill color="text-success" colorFaint="bg-success-faint">Currently Open</Pill>
          ) : (
            <Pill color="text-muted" colorFaint="bg-background">Closed</Pill>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Academic Term *" full>
          <input value={academicTerm} onChange={(e) => setAcademicTerm(e.target.value)} placeholder="e.g. 2025-26 Odd" className={inputClass} />
        </Field>
        <Field label="Opens At *">
          <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Closes At *">
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-foreground mt-4">
        <input type="checkbox" checked={resultsVisibleToAdmin} onChange={(e) => setResultsVisibleToAdmin(e.target.checked)} className="w-4 h-4" />
        Make aggregated results visible to admins now
      </label>
      <p className="text-[11px] text-muted mt-1">
        Independent of the submission window — you can close submissions but delay revealing results, or the reverse.
      </p>
      <div className="flex justify-end mt-4">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Saving…" : "Save Window"}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Analytics
// ============================================================================

function AnalyticsSection({
  courses,
  analytics,
  loading,
  onFilterChange,
}: {
  courses: Course[];
  analytics: FeedbackAnalyticsDto;
  loading: boolean;
  onFilterChange: (analytics: FeedbackAnalyticsDto) => void;
}) {
  const { toast } = useToast();
  const [academicTerm, setAcademicTerm] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [filtering, setFiltering] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const programOptions = useMemo(() => programOptionsFrom(courses), [courses]);

  const applyFilter = useCallback(async () => {
    setFiltering(true);
    try {
      const data = await fetchFeedbackAnalytics(academicTerm || undefined, programCode || undefined);
      onFilterChange(data);
    } catch (err) {
      toast(`Failed to filter analytics: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setFiltering(false);
    }
  }, [academicTerm, programCode, onFilterChange, toast]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await fetchFeedbackAnalyticsCsv(academicTerm || undefined, programCode || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "feedback-analytics.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(`Failed to export: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[15px] font-bold text-primary">Rating Analytics</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={academicTerm}
            onChange={(e) => setAcademicTerm(e.target.value)}
            placeholder="Academic term…"
            className={`${inputClass} w-40`}
          />
          <select value={programCode} onChange={(e) => setProgramCode(e.target.value)} className={selectClass}>
            <option value="">All Programs</option>
            {programOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={applyFilter} disabled={filtering} className="text-[13px] font-medium text-primary hover:underline disabled:opacity-50">
            {filtering ? "Filtering…" : "Apply"}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-primary border border-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
        </div>
      ) : analytics.offerings.length === 0 ? (
        <EmptyState icon={BarChart3} message="No feedback responses match the current filters yet." />
      ) : (
        <div className="divide-y divide-border">
          {analytics.offerings.map((o) => (
            <OfferingAnalyticsRow
              key={o.offeringId}
              offering={o}
              expanded={expanded === o.offeringId}
              onToggle={() => setExpanded(expanded === o.offeringId ? null : o.offeringId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferingAnalyticsRow({ offering, expanded, onToggle }: { offering: OfferingAnalyticsDto; expanded: boolean; onToggle: () => void }) {
  const max = 5;
  return (
    <div className="px-6 py-4">
      <button onClick={onToggle} className="w-full flex items-center gap-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground text-[13.5px] truncate">{offering.subjectName} <span className="text-muted font-normal">({offering.subjectCode})</span></div>
          <div className="text-[12px] text-muted mt-0.5">{offering.teacherName} · {offering.academicTerm}</div>
        </div>
        <div className="flex-1 max-w-[200px] bg-background rounded-full h-2.5 overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max((offering.averageRating / max) * 100, offering.responseCount > 0 ? 4 : 0)}%` }} />
        </div>
        <div className="w-16 shrink-0 text-[13px] font-bold text-primary text-right tabular-nums">{offering.averageRating.toFixed(2)} / 5</div>
        <div className="w-28 shrink-0 text-[12px] text-muted text-right tabular-nums">{offering.submissionCount}/{offering.eligibleStudentCount} ({(offering.participationRate * 100).toFixed(0)}%)</div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted shrink-0" />}
      </button>

      {expanded && (
        <div className="mt-4 pl-2 space-y-3 border-l-2 border-primary-faint">
          {offering.questionBreakdown.length === 0 ? (
            <p className="text-[12px] text-muted pl-3">No responses yet.</p>
          ) : (
            offering.questionBreakdown.map((q) => (
              <div key={q.questionId} className="pl-3">
                <div className="text-[12.5px] text-foreground font-medium mb-1.5">{q.questionText} <span className="text-muted font-normal">— avg {q.averageRating.toFixed(2)}</span></div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const count = q.histogram[String(star)] ?? 0;
                    const totalResponses = Object.values(q.histogram).reduce((a, b) => a + b, 0) || 1;
                    return (
                      <div key={star} className="flex items-center gap-1">
                        <span className="text-[10px] text-muted w-6">{star}★</span>
                        <div className="w-14 bg-background rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-violet rounded-full" style={{ width: `${(count / totalResponses) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-muted w-4">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Question bank
// ============================================================================

function QuestionsSection() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<FeedbackQuestionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeedbackQuestionDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQuestions(await fetchFeedbackQuestions());
    } catch (err) {
      toast(`Failed to load questions: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const theoryQuestions = questions.filter((q) => q.subjectType === "THEORY").sort((a, b) => a.displayOrder - b.displayOrder);
  const practicalQuestions = questions.filter((q) => q.subjectType === "PRACTICAL").sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-bold text-primary">Question Bank</h2>
          <p className="text-[12px] text-muted mt-0.5">Asked university-wide, split by Theory vs. Practical subjects.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13.5px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Question
        </button>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
      ) : questions.length === 0 ? (
        <EmptyState icon={HelpCircle} message="No questions configured yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border">
          <QuestionList title="Theory" questions={theoryQuestions} onEdit={setEditing} />
          <QuestionList title="Practical" questions={practicalQuestions} onEdit={setEditing} />
        </div>
      )}

      {showForm && (
        <DetailDialog title="New Question" onClose={() => setShowForm(false)}>
          <QuestionForm onSaved={() => { setShowForm(false); load(); }} />
        </DetailDialog>
      )}
      {editing && (
        <DetailDialog title="Edit Question" onClose={() => setEditing(null)}>
          <QuestionEditForm question={editing} onSaved={() => { setEditing(null); load(); }} />
        </DetailDialog>
      )}
    </div>
  );
}

function QuestionList({
  title,
  questions,
  onEdit,
}: {
  title: string;
  questions: FeedbackQuestionDto[];
  onEdit: (q: FeedbackQuestionDto) => void;
}) {
  return (
    <div className="p-5">
      <h3 className="text-[12px] font-bold text-muted uppercase tracking-wide mb-3">{title}</h3>
      {questions.length === 0 ? (
        <p className="text-[12px] text-muted">No {title.toLowerCase()} questions yet.</p>
      ) : (
        <ol className="space-y-2">
          {questions.map((q) => (
            <li
              key={q.id}
              onClick={() => onEdit(q)}
              className={`flex items-start justify-between gap-2 text-[13px] p-2 rounded-lg cursor-pointer hover:bg-background ${!q.active ? "opacity-50" : ""}`}
            >
              <span className="text-foreground">{q.displayOrder}. {q.questionText}</span>
              {!q.active && <Pill color="text-muted" colorFaint="bg-background">Inactive</Pill>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function QuestionForm({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [subjectType, setSubjectType] = useState<FeedbackSubjectType>("THEORY");
  const [displayOrder, setDisplayOrder] = useState("1");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      toast("Please enter the question text", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createFeedbackQuestion({ questionText: questionText.trim(), subjectType, displayOrder: Number(displayOrder) || 1 });
      toast("Question added");
      onSaved();
    } catch (err) {
      toast(`Failed to add question: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Question Text *" full>
        <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Subject Type *">
          <select value={subjectType} onChange={(e) => setSubjectType(e.target.value as FeedbackSubjectType)} className={selectClass}>
            <option value="THEORY">Theory</option>
            <option value="PRACTICAL">Practical</option>
          </select>
        </Field>
        <Field label="Display Order *">
          <input type="number" min={1} value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Adding…" : "Add Question"}
        </button>
      </div>
    </form>
  );
}

function QuestionEditForm({ question, onSaved }: { question: FeedbackQuestionDto; onSaved: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [questionText, setQuestionText] = useState(question.questionText);
  const [displayOrder, setDisplayOrder] = useState(String(question.displayOrder));
  const [active, setActive] = useState(question.active);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateFeedbackQuestion(question.id, { questionText: questionText.trim(), displayOrder: Number(displayOrder) || 1, active });
      toast("Question updated");
      onSaved();
    } catch (err) {
      toast(`Failed to update question: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Question Text" full>
        <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
      </Field>
      <Field label="Display Order">
        <input type="number" min={1} value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-foreground">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
        Active
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Saving…" : "Save Changes"}
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
