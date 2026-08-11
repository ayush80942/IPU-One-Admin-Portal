"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { GraduationCap, Landmark, Plus, X } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import {
  fetchInstitutes,
  createInstitute,
  updateInstitute,
  fetchCourses,
  createCourse,
  updateCourse,
  Institute,
  Course,
} from "../lib/api";

const TH = "px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide";
const INPUT =
  "px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary";

/**
 * Institutes and courses are the same job — the university's academic structure — and a course
 * cannot be created without picking its institute, so the two are one page with a view switch
 * rather than two entries in the sidebar.
 */
type View = "institutes" | "courses";

export default function AcademicStructurePage() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("institutes");
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedInstitute, setSelectedInstitute] = useState<Institute | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Both lists load together: the Courses view needs the institute roster for its picker and for
  // naming the institute of a course whose own institute row has not resolved yet.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [institutesData, coursesData] = await Promise.all([fetchInstitutes(), fetchCourses()]);
      setInstitutes(institutesData);
      setCourses(coursesData);
    } catch (err) {
      toast(`Failed to load: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const coursesMissingDuration = courses.filter((c) => c.totalSemesters == null).length;
  const institutesMissingShortName = institutes.filter((i) => !i.shortName).length;

  const switchView = (next: View) => {
    setView(next);
    setAdding(false);
  };

  return (
    <div>
      <PageHeader
        title="Institutes & Courses"
        subtitle="Codes and names stay in sync automatically from imported results. Add a school or programme here only when it has to exist before its first student imports — everything else is curation: short names, and the semester count that decides a student's “Pass Out” status."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {view === "institutes" ? (
          <StatTile
            value={loading ? "—" : institutes.length}
            label="Total Institutes"
            icon={Landmark}
            subLabel={
              !loading && institutesMissingShortName > 0
                ? `${institutesMissingShortName} without a short name`
                : undefined
            }
          />
        ) : (
          <StatTile
            value={loading ? "—" : courses.length}
            label="Total Courses"
            icon={GraduationCap}
            color="teal"
            subLabel={
              !loading && coursesMissingDuration > 0
                ? `${coursesMissingDuration} missing duration`
                : undefined
            }
          />
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <label htmlFor="structure-view" className="sr-only">
              Show
            </label>
            <select
              id="structure-view"
              value={view}
              onChange={(e) => switchView(e.target.value as View)}
              className="px-3 py-2 border border-border rounded-lg text-[14px] font-bold text-primary bg-surface focus:outline-none focus:border-primary"
            >
              <option value="institutes">Institutes</option>
              <option value="courses">Courses</option>
            </select>
            <span className="text-[12px] text-muted tabular-nums">
              {loading ? "—" : view === "institutes" ? institutes.length : courses.length}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAdding((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
            >
              {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {adding ? "Cancel" : view === "institutes" ? "Add institute" : "Add course"}
            </button>
            <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">
              Refresh
            </button>
          </div>
        </div>

        {adding &&
          (view === "institutes" ? (
            <AddInstituteForm
              onCancel={() => setAdding(false)}
              onCreated={(created) => {
                setInstitutes((prev) => [...prev, created]);
                setAdding(false);
              }}
            />
          ) : (
            <AddCourseForm
              institutes={institutes}
              onCancel={() => setAdding(false)}
              onCreated={(created) => {
                setCourses((prev) => [...prev, created]);
                setAdding(false);
              }}
            />
          ))}

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : view === "institutes" ? (
          <InstitutesTable
            institutes={institutes}
            onExpand={setSelectedInstitute}
            onSaved={(updated) =>
              setInstitutes((prev) =>
                prev.map((i) => (i.instituteCode === updated.instituteCode ? updated : i))
              )
            }
          />
        ) : (
          <CoursesTable
            courses={courses}
            onExpand={setSelectedCourse}
            onSaved={(updated) =>
              setCourses((prev) => prev.map((c) => (c.programCode === updated.programCode ? updated : c)))
            }
          />
        )}
      </div>

      {selectedInstitute && (
        <DetailDialog
          title={selectedInstitute.instituteName}
          subtitle={`Code: ${selectedInstitute.instituteCode}`}
          onClose={() => setSelectedInstitute(null)}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Short Name" value={selectedInstitute.shortName} />
            <DetailField
              label="Courses"
              value={courses.filter((c) => c.instituteCode === selectedInstitute.instituteCode).length}
            />
            <DetailField label="Created" value={new Date(selectedInstitute.createdAt).toLocaleString()} />
            <DetailField label="Last Updated" value={new Date(selectedInstitute.updatedAt).toLocaleString()} />
          </div>
        </DetailDialog>
      )}

      {selectedCourse && (
        <DetailDialog
          title={selectedCourse.programName}
          subtitle={`Code: ${selectedCourse.programCode}`}
          onClose={() => setSelectedCourse(null)}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Institute" value={selectedCourse.instituteName} />
            <DetailField label="Institute Code" value={selectedCourse.instituteCode} />
            <DetailField label="Short Name" value={selectedCourse.shortName} />
            <DetailField label="Total Semesters" value={selectedCourse.totalSemesters} />
            <DetailField label="Created" value={new Date(selectedCourse.createdAt).toLocaleString()} />
            <DetailField label="Last Updated" value={new Date(selectedCourse.updatedAt).toLocaleString()} />
          </div>
        </DetailDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Institutes
// ---------------------------------------------------------------------------

function AddInstituteForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (institute: Institute) => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const created = await createInstitute({
        instituteCode: code.trim(),
        instituteName: name.trim(),
        shortName: shortName.trim() || null,
      });
      toast(`Added ${created.instituteCode}`, "success");
      onCreated(created);
    } catch (err) {
      toast(`Failed to add: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-4 border-b border-border bg-background">
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="Institute code" hint="As the university writes it, e.g. 176">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="176"
            className={`${INPUT} font-mono w-28`}
          />
        </Field>
        <Field label="Institute name" hint="The portal's own wording — imports will keep it in sync">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="UNIVERSITY SCHOOL OF AUTOMATION AND ROBOTICS"
            className={`${INPUT} w-[26rem] max-w-full`}
          />
        </Field>
        <Field label="Short name" hint="Optional">
          <input
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="USAR"
            className={`${INPUT} w-28`}
          />
        </Field>
        <div className="flex items-center gap-3 pb-1.5">
          <button
            onClick={submit}
            disabled={saving || !code.trim() || !name.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add institute"}
          </button>
          <button onClick={onCancel} className="text-[12px] font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function InstitutesTable({
  institutes,
  onExpand,
  onSaved,
}: {
  institutes: Institute[];
  onExpand: (institute: Institute) => void;
  onSaved: (updated: Institute) => void;
}) {
  if (institutes.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        message="No institutes yet — they're created automatically as students import results, or add one above."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="bg-primary-faint">
            <th className={TH}>Code</th>
            <th className={TH}>Institute</th>
            <th className={TH}>Short Name</th>
            <th className={TH}></th>
          </tr>
        </thead>
        <tbody>
          {institutes.map((institute) => (
            <InstituteRow
              key={institute.instituteCode}
              institute={institute}
              onExpand={onExpand}
              onSaved={onSaved}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstituteRow({
  institute,
  onExpand,
  onSaved,
}: {
  institute: Institute;
  onExpand: (institute: Institute) => void;
  onSaved: (updated: Institute) => void;
}) {
  const { toast } = useToast();
  const [shortName, setShortName] = useState(institute.shortName ?? "");
  const [saving, setSaving] = useState(false);

  const dirty = shortName !== (institute.shortName ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateInstitute(institute.instituteCode, {
        shortName: shortName.trim() === "" ? null : shortName.trim(),
      });
      onSaved(updated);
      toast("Institute updated", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0">
      <td className="px-4 py-3 font-mono text-[13px]">{institute.instituteCode}</td>
      <td className="px-4 py-3 cursor-pointer group" onClick={() => onExpand(institute)}>
        <div className="font-semibold group-hover:text-primary group-hover:underline">
          {institute.instituteName}
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          placeholder="e.g. USAR"
          className={`${INPUT} w-full`}
        />
      </td>
      <td className="px-4 py-3">
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

function AddCourseForm({
  institutes,
  onCancel,
  onCreated,
}: {
  institutes: Institute[];
  onCancel: () => void;
  onCreated: (course: Course) => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [instituteCode, setInstituteCode] = useState("");
  const [shortName, setShortName] = useState("");
  const [totalSemesters, setTotalSemesters] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const created = await createCourse({
        programCode: code.trim(),
        programName: name.trim(),
        instituteCode,
        shortName: shortName.trim() || null,
        totalSemesters: totalSemesters.trim() === "" ? null : Number(totalSemesters),
      });
      toast(`Added ${created.programCode}`, "success");
      onCreated(created);
    } catch (err) {
      toast(`Failed to add: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-4 border-b border-border bg-background">
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="Program code" hint="e.g. 031">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="031"
            className={`${INPUT} font-mono w-28`}
          />
        </Field>
        <Field label="Program name" hint="Imports will keep it in sync">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="BACHELOR OF TECHNOLOGY (ARTIFICIAL INTELLIGENCE AND DATA SCIENCE)"
            className={`${INPUT} w-[26rem] max-w-full`}
          />
        </Field>
        <Field label="Institute" hint="Must already exist">
          <select
            value={instituteCode}
            onChange={(e) => setInstituteCode(e.target.value)}
            className={`${INPUT} w-56`}
          >
            <option value="">Select institute…</option>
            {institutes.map((i) => (
              <option key={i.instituteCode} value={i.instituteCode}>
                {i.shortName ? `${i.shortName} — ${i.instituteCode}` : `${i.instituteCode} — ${i.instituteName}`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Short name" hint="Optional">
          <input
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="B.Tech AI&DS"
            className={`${INPUT} w-36`}
          />
        </Field>
        <Field label="Semesters" hint="Optional">
          <input
            type="number"
            min={1}
            value={totalSemesters}
            onChange={(e) => setTotalSemesters(e.target.value)}
            placeholder="8"
            className={`${INPUT} w-20`}
          />
        </Field>
        <div className="flex items-center gap-3 pb-1.5">
          <button
            onClick={submit}
            disabled={saving || !code.trim() || !name.trim() || !instituteCode}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add course"}
          </button>
          <button onClick={onCancel} className="text-[12px] font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
      {institutes.length === 0 && (
        <p className="text-[12px] text-muted mt-3">
          There are no institutes yet — add one first, since a course has to belong to a school.
        </p>
      )}
    </div>
  );
}

function CoursesTable({
  courses,
  onExpand,
  onSaved,
}: {
  courses: Course[];
  onExpand: (course: Course) => void;
  onSaved: (updated: Course) => void;
}) {
  // Grouped by school, so a university admin reading down the list sees the structure rather
  // than 30-odd programmes in whatever order the table returned them.
  const grouped = useMemo(() => {
    const byInstitute = new Map<string, { label: string; courses: Course[] }>();
    for (const course of courses) {
      const key = course.instituteCode ?? "__none";
      const existing = byInstitute.get(key);
      if (existing) {
        existing.courses.push(course);
        continue;
      }
      byInstitute.set(key, {
        label: course.instituteName || course.instituteCode || "No institute yet",
        courses: [course],
      });
    }
    return [...byInstitute.entries()]
      .map(([key, group]) => ({
        key,
        ...group,
        courses: [...group.courses].sort((a, b) => a.programCode.localeCompare(b.programCode)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [courses]);

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        message="No courses yet — they're created automatically as students import results, or add one above."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="bg-primary-faint">
            <th className={TH}>Code</th>
            <th className={TH}>Program</th>
            <th className={TH}>Short Name</th>
            <th className={TH}>Total Semesters</th>
            <th className={TH}></th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((group) => (
            <Fragment key={group.key}>
              <tr className="bg-background border-b border-border">
                <td colSpan={5} className="px-4 py-2 text-[11px] font-bold text-muted uppercase tracking-wide">
                  {group.label}
                  <span className="ml-2 font-normal normal-case tabular-nums">{group.courses.length}</span>
                </td>
              </tr>
              {group.courses.map((course) => (
                <CourseRow
                  key={course.programCode}
                  course={course}
                  onExpand={onExpand}
                  onSaved={onSaved}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseRow({
  course,
  onExpand,
  onSaved,
}: {
  course: Course;
  onExpand: (course: Course) => void;
  onSaved: (updated: Course) => void;
}) {
  const { toast } = useToast();
  const [shortName, setShortName] = useState(course.shortName ?? "");
  const [totalSemesters, setTotalSemesters] = useState(course.totalSemesters?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    shortName !== (course.shortName ?? "") ||
    totalSemesters !== (course.totalSemesters?.toString() ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateCourse(course.programCode, {
        shortName: shortName.trim() === "" ? null : shortName.trim(),
        totalSemesters: totalSemesters.trim() === "" ? null : Number(totalSemesters),
      });
      onSaved(updated);
      toast("Course updated", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0">
      <td className="px-4 py-3 font-mono text-[13px]">{course.programCode}</td>
      <td className="px-4 py-3 cursor-pointer group" onClick={() => onExpand(course)}>
        <div className="font-semibold group-hover:text-primary group-hover:underline">
          {course.programName}
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          placeholder="e.g. B.Tech AI&DS"
          className={`${INPUT} w-full`}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={1}
          value={totalSemesters}
          onChange={(e) => setTotalSemesters(e.target.value)}
          placeholder="—"
          className={`${INPUT} w-20`}
        />
      </td>
      <td className="px-4 py-3">
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </td>
    </tr>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-muted uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted/70">{hint}</span>}
    </label>
  );
}
