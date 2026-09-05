"use client";

import { useState, useEffect, useCallback, useMemo, FormEvent } from "react";
import { UserCog, Plus, Search, BadgeCheck, X } from "lucide-react";
import { useToast } from "../components/Toast";
import { useAdminSession, useIsSuperAdmin } from "../components/AuthGate";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import Filter, { SELECT_CLASS } from "../components/Filter";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import {
  fetchTeachers,
  createTeacher,
  updateTeacher,
  fetchInstitutes,
  TeacherDto,
  Institute,
} from "../lib/api";
import { instituteOptionsFrom } from "../lib/noticeTaxonomy";

const ALL = "";
const inputClass = "border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors w-full";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "col-span-2" : ""}`}>
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function teacherLabel(t: TeacherDto): string {
  return t.title ? `${t.title} ${t.name}` : t.name;
}

// A dismissable summary of what's currently narrowing the table, matching the Students page.
function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-primary-faint text-primary text-[11px] font-semibold hover:bg-primary/10 transition-colors"
    >
      {label}
      <X className="w-3 h-3" />
    </button>
  );
}

export default function TeachersPage() {
  const { toast } = useToast();
  const session = useAdminSession();
  const isSuper = useIsSuperAdmin();

  const [teachers, setTeachers] = useState<TeacherDto[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<TeacherDto | null>(null);

  const [search, setSearch] = useState("");
  const [instituteCode, setInstituteCode] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  // An institute admin only ever adds teachers to their own institute(s); a super admin (the
  // university) is unrestricted, same split every other institute-scoped form in the portal uses.
  const lockedInstituteCodes = useMemo(
    () => (isSuper ? null : session?.institutes.map((i) => i.instituteCode) ?? []),
    [isSuper, session]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teachersData, institutesData] = await Promise.all([fetchTeachers(), fetchInstitutes()]);
      setTeachers(teachersData);
      setInstitutes(institutesData);
    } catch (err) {
      toast(`Failed to load teachers: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const instituteLabelOf = useMemo(() => {
    const map = new Map(instituteOptionsFrom(institutes).map((o) => [o.value, o.label]));
    return (code: string | null) => (code ? map.get(code) ?? code : null);
  }, [institutes]);

  // Only institutes that actually have a teacher, so the filter never dead-ends — same reasoning
  // as Students' institute filter.
  const instituteOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers) {
      if (t.instituteCode) map.set(t.instituteCode, instituteLabelOf(t.instituteCode) ?? t.instituteCode);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [teachers, instituteLabelOf]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (instituteCode && t.instituteCode !== instituteCode) return false;
      if (status === "active" && !t.active) return false;
      if (status === "inactive" && t.active) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.facultyCode ?? "").toLowerCase().includes(q) ||
        (instituteLabelOf(t.instituteCode) ?? "").toLowerCase().includes(q)
      );
    });
  }, [teachers, search, instituteCode, status, instituteLabelOf]);

  const activeCount = useMemo(() => teachers.filter((t) => t.active).length, [teachers]);
  const instituteCount = useMemo(
    () => new Set(teachers.map((t) => t.instituteCode).filter(Boolean)).size,
    [teachers]
  );

  const activeFilters = [
    instituteCode && {
      label: instituteOptions.find((o) => o.value === instituteCode)?.label ?? instituteCode,
      clear: () => setInstituteCode(ALL),
    },
    status && { label: status === "active" ? "Active" : "Inactive", clear: () => setStatus(ALL) },
    search.trim() && { label: `"${search.trim()}"`, clear: () => setSearch("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setInstituteCode(ALL);
    setStatus(ALL);
    setSearch("");
  };

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle="Admin-curated catalog of identity-bearing faculty accounts — the same directory Faculty Feedback assigns teaching offerings against."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile value={loading ? "—" : teachers.length} label="Teachers" icon={UserCog} />
        <StatTile value={loading ? "—" : activeCount} label="Active" icon={BadgeCheck} color="success" />
        <StatTile value={loading ? "—" : instituteCount} label="Institutes Represented" color="teal" />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Filter label="Institute">
            <select value={instituteCode} onChange={(e) => setInstituteCode(e.target.value)} className={SELECT_CLASS}>
              <option value={ALL}>All Institutes</option>
              {instituteOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT_CLASS}>
              <option value={ALL}>All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Filter>
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, faculty code, institute…"
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {activeFilters.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            {activeFilters.map((f) => (
              <ActiveFilterChip key={f.label} label={f.label} onClear={f.clear} />
            ))}
            <button onClick={clearAll} className="text-[11px] font-semibold text-muted hover:text-primary transition-colors ml-1">
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[15px] font-bold text-primary">
            Faculty Directory
            {!loading && (
              <span className="ml-2 text-[12px] font-normal text-muted">
                {activeFilters.length > 0 ? `${filtered.length} of ${teachers.length}` : teachers.length}
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13.5px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Add Teacher
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserCog}
            message={
              activeFilters.length > 0
                ? "No teachers match the current filters."
                : "No teachers added yet — use “Add Teacher” to create the first one."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint sticky top-0 z-10">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Faculty Code</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setEditing(t)}
                    className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-faint text-primary flex items-center justify-center font-bold shrink-0">
                          {t.name.trim().charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">{teacherLabel(t)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{t.facultyCode || "—"}</td>
                    <td className="px-4 py-3">{instituteLabelOf(t.instituteCode) ?? "—"}</td>
                    <td className="px-4 py-3">
                      {t.active ? (
                        <Pill color="text-success" colorFaint="bg-success-faint">Active</Pill>
                      ) : (
                        <Pill color="text-muted" colorFaint="bg-background">Inactive</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddForm && (
        <DetailDialog title="Add Teacher" subtitle="Pre-registers a faculty account — it links up automatically the first time they sign in." onClose={() => setShowAddForm(false)}>
          <AddTeacherForm
            institutes={institutes}
            lockedInstituteCodes={lockedInstituteCodes}
            onSaved={() => { setShowAddForm(false); load(); }}
          />
        </DetailDialog>
      )}

      {editing && (
        <DetailDialog title={teacherLabel(editing)} subtitle={instituteLabelOf(editing.instituteCode) ?? undefined} onClose={() => setEditing(null)}>
          <EditTeacherForm teacher={editing} onSaved={() => { setEditing(null); load(); }} />
        </DetailDialog>
      )}
    </div>
  );
}

function AddTeacherForm({
  institutes,
  lockedInstituteCodes,
  onSaved,
}: {
  institutes: Institute[];
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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Dr.");
  const [facultyCode, setFacultyCode] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim() || !instituteCode) {
      toast("Please enter at least an institute, email, and name", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createTeacher({
        email: email.trim(),
        name: name.trim(),
        title: title.trim() || null,
        instituteCode,
        facultyCode: facultyCode.trim() || null,
      });
      toast("Teacher added");
      onSaved();
    } catch (err) {
      toast(`Failed to add teacher: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <Field label="Institute *" full>
        <select
          value={instituteCode}
          onChange={(e) => setInstituteCode(e.target.value)}
          className={inputClass}
          disabled={!!lockedInstituteCodes && allowedInstituteOptions.length <= 1}
        >
          {allowedInstituteOptions.length === 0 && <option value="">No institute available</option>}
          {allowedInstituteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
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
        <input value={facultyCode} onChange={(e) => setFacultyCode(e.target.value)} placeholder="Optional — the old system's faculty code, if known" className={inputClass} />
      </Field>
      <div className="col-span-2 flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Adding…" : "Add Teacher"}
        </button>
      </div>
    </form>
  );
}

function EditTeacherForm({ teacher, onSaved }: { teacher: TeacherDto; onSaved: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(teacher.name);
  const [title, setTitle] = useState(teacher.title ?? "");
  const [active, setActive] = useState(teacher.active);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await updateTeacher(teacher.id, { name: name.trim(), title: title.trim() || null, active });
      toast("Teacher updated");
      onSaved();
    } catch (err) {
      toast(`Failed to update teacher: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Faculty code and institute are set once at creation and aren't editable here — moving a
          teacher between institutes or renumbering their faculty code isn't something this form
          supports; re-add the account under the right institute instead. */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Faculty Code" value={teacher.facultyCode} />
        <DetailField label="Institute" value={teacher.instituteCode} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dr., Prof." className={inputClass} />
        </Field>
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-foreground">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
        Active — inactive teachers stay in the catalog but drop out of the Feedback teacher picker
      </label>

      <div className="flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
