"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, GraduationCap, Landmark, Plus, X } from "lucide-react";
import { useToast } from "../components/Toast";
import { useIsSuperAdmin } from "../components/AuthGate";
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

export default function AcademicStructurePage() {
  const { toast } = useToast();
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingInstitute, setAddingInstitute] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingCourseFor, setAddingCourseFor] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

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

  // Courses whose institute code doesn't match any known institute are kept out of the per-
  // institute accordions and surfaced separately, since there's nowhere sensible to nest them.
  const coursesByInstitute = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const course of courses) {
      const key = course.instituteCode ?? "__none";
      const list = map.get(key);
      if (list) list.push(course);
      else map.set(key, [course]);
    }
    for (const list of map.values()) list.sort((a, b) => a.programCode.localeCompare(b.programCode));
    return map;
  }, [courses]);

  const knownInstituteCodes = useMemo(() => new Set(institutes.map((i) => i.instituteCode)), [institutes]);
  const orphanCourses = useMemo(
    () => courses.filter((c) => !c.instituteCode || !knownInstituteCodes.has(c.instituteCode)),
    [courses, knownInstituteCodes]
  );

  const sortedInstitutes = useMemo(
    () => [...institutes].sort((a, b) => a.instituteName.localeCompare(b.instituteName)),
    [institutes]
  );

  const toggleExpanded = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setAddingCourseFor(null);
  };

  const coursesMissingDuration = courses.filter((c) => c.totalSemesters == null).length;
  const institutesMissingShortName = institutes.filter((i) => !i.shortName).length;
  const onboardedCount = institutes.filter((i) => i.onboarded).length;

  return (
    <div>
      <PageHeader
        title="Institutes & Courses"
        subtitle="Codes and names stay in sync automatically from imported results. Add a school or programme here only when it has to exist before its first student imports — everything else is curation: short names, and the semester count that decides a student's “Pass Out” status."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
        <StatTile
          value={loading ? "—" : onboardedCount}
          label="Onboarded"
          icon={Landmark}
          color="teal"
          subLabel={!loading ? `of ${institutes.length} institutes` : undefined}
        />
        <StatTile
          value={loading ? "—" : courses.length}
          label="Total Courses"
          icon={GraduationCap}
          color="teal"
          subLabel={
            !loading && coursesMissingDuration > 0 ? `${coursesMissingDuration} missing duration` : undefined
          }
        />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[14px] font-bold text-primary">Institutes</h2>
            <span className="text-[12px] text-muted tabular-nums">
              {loading ? "—" : institutes.length}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAddingInstitute((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
            >
              {addingInstitute ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {addingInstitute ? "Cancel" : "Add institute"}
            </button>
            <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">
              Refresh
            </button>
          </div>
        </div>

        {addingInstitute && (
          <AddInstituteForm
            onCancel={() => setAddingInstitute(false)}
            onCreated={(created) => {
              setInstitutes((prev) => [...prev, created]);
              setAddingInstitute(false);
            }}
          />
        )}

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : institutes.length === 0 ? (
          <EmptyState
            icon={Landmark}
            message="No institutes yet — they're created automatically as students import results, or add one above."
          />
        ) : (
          <div>
            {sortedInstitutes.map((institute) => (
              <InstituteAccordionRow
                key={institute.instituteCode}
                institute={institute}
                courses={coursesByInstitute.get(institute.instituteCode) ?? []}
                isExpanded={expanded.has(institute.instituteCode)}
                onToggle={() => toggleExpanded(institute.instituteCode)}
                onSavedInstitute={(updated) =>
                  setInstitutes((prev) =>
                    prev.map((i) => (i.instituteCode === updated.instituteCode ? updated : i))
                  )
                }
                onExpandCourse={setSelectedCourse}
                onSavedCourse={(updated) =>
                  setCourses((prev) => prev.map((c) => (c.programCode === updated.programCode ? updated : c)))
                }
                isAddingCourse={addingCourseFor === institute.instituteCode}
                onToggleAddCourse={() =>
                  setAddingCourseFor((prev) => (prev === institute.instituteCode ? null : institute.instituteCode))
                }
                onCourseCreated={(created) => {
                  setCourses((prev) => [...prev, created]);
                  setAddingCourseFor(null);
                }}
              />
            ))}

            {orphanCourses.length > 0 && (
              <div>
                <div className="px-6 py-3 border-t border-b border-border bg-background">
                  <div className="text-[13px] font-bold text-foreground">Courses without a matched institute</div>
                  <div className="text-[12px] text-muted">
                    Their institute code doesn&apos;t match any institute above — likely a typo, or an institute
                    record that hasn&apos;t been added yet.
                  </div>
                </div>
                <div className="px-6 py-4">
                  <CoursesMiniTable
                    courses={orphanCourses}
                    onExpand={setSelectedCourse}
                    onSaved={(updated) =>
                      setCourses((prev) => prev.map((c) => (c.programCode === updated.programCode ? updated : c)))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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

function InstituteAccordionRow({
  institute,
  courses,
  isExpanded,
  onToggle,
  onSavedInstitute,
  onExpandCourse,
  onSavedCourse,
  isAddingCourse,
  onToggleAddCourse,
  onCourseCreated,
}: {
  institute: Institute;
  courses: Course[];
  isExpanded: boolean;
  onToggle: () => void;
  onSavedInstitute: (updated: Institute) => void;
  onExpandCourse: (course: Course) => void;
  onSavedCourse: (updated: Course) => void;
  isAddingCourse: boolean;
  onToggleAddCourse: () => void;
  onCourseCreated: (created: Course) => void;
}) {
  const { toast } = useToast();
  const isSuperAdmin = useIsSuperAdmin();
  const [shortName, setShortName] = useState(institute.shortName ?? "");
  const [saving, setSaving] = useState(false);
  const [togglingOnboarded, setTogglingOnboarded] = useState(false);

  const dirty = shortName !== (institute.shortName ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateInstitute(institute.instituteCode, {
        shortName: shortName.trim() === "" ? null : shortName.trim(),
      });
      onSavedInstitute(updated);
      toast("Institute updated", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleOnboarded = async (checked: boolean) => {
    setTogglingOnboarded(true);
    try {
      const updated = await updateInstitute(institute.instituteCode, { onboarded: checked });
      onSavedInstitute(updated);
      toast(checked ? "Marked as onboarded" : "Marked as not onboarded", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setTogglingOnboarded(false);
    }
  };

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-6 py-3 hover:bg-background transition-colors">
        <button
          onClick={onToggle}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted shrink-0" />
          )}
          <span className="font-mono text-[13px] text-muted shrink-0">{institute.instituteCode}</span>
          <span className="font-semibold text-[13.5px] truncate">{institute.instituteName}</span>
          <span className="text-[12px] text-muted tabular-nums shrink-0">
            {courses.length} course{courses.length === 1 ? "" : "s"}
          </span>
        </button>
        {isSuperAdmin ? (
          <label
            className="flex items-center gap-1.5 text-[12px] font-semibold text-muted shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={institute.onboarded}
              disabled={togglingOnboarded}
              onChange={(e) => toggleOnboarded(e.target.checked)}
              className="w-4 h-4 accent-primary disabled:opacity-40"
            />
            Onboarded
          </label>
        ) : (
          institute.onboarded && (
            <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full shrink-0">
              Onboarded
            </span>
          )
        )}
        <input
          type="text"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Short name"
          className={`${INPUT} w-32 shrink-0`}
        />
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50 shrink-0"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="bg-background border-t border-border">
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="text-[12px] font-bold text-muted uppercase tracking-wide">Courses</span>
            <button
              onClick={onToggleAddCourse}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline"
            >
              {isAddingCourse ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {isAddingCourse ? "Cancel" : "Add course"}
            </button>
          </div>

          {isAddingCourse && (
            <AddCourseForm institute={institute} onCancel={onToggleAddCourse} onCreated={onCourseCreated} />
          )}

          {courses.length === 0 ? (
            <div className="px-6 pb-4 text-[13px] text-muted">
              No courses yet for this institute — add the first one above.
            </div>
          ) : (
            <div className="px-6 pb-4">
              <CoursesMiniTable courses={courses} onExpand={onExpandCourse} onSaved={onSavedCourse} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

function AddCourseForm({
  institute,
  onCancel,
  onCreated,
}: {
  institute: Institute;
  onCancel: () => void;
  onCreated: (course: Course) => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [totalSemesters, setTotalSemesters] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const created = await createCourse({
        programCode: code.trim(),
        programName: name.trim(),
        instituteCode: institute.instituteCode,
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
    <div className="px-6 py-4 border-y border-border bg-surface">
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
        <Field label="Institute" hint={institute.instituteCode}>
          <div className={`${INPUT} w-56 bg-background text-muted`}>
            {institute.shortName ? `${institute.shortName} — ${institute.instituteName}` : institute.instituteName}
          </div>
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
            disabled={saving || !code.trim() || !name.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add course"}
          </button>
          <button onClick={onCancel} className="text-[12px] font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CoursesMiniTable({
  courses,
  onExpand,
  onSaved,
}: {
  courses: Course[];
  onExpand: (course: Course) => void;
  onSaved: (updated: Course) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
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
          {courses.map((course) => (
            <CourseRow key={course.programCode} course={course} onExpand={onExpand} onSaved={onSaved} />
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
    <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0 bg-surface">
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
