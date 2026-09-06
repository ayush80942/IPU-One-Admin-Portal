"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  KeyRound,
  Landmark,
  Pencil,
  Plus,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { useToast } from "../../components/Toast";
import { useAdminSession } from "../../components/AuthGate";
import StatTile from "../../components/StatTile";
import Pill from "../../components/Pill";
import EmptyState from "../../components/EmptyState";
import SectionCard from "../../components/SectionCard";
import { AdminForm, PasswordForm } from "../../components/AdminFormDialog";
import {
  fetchInstitutes,
  updateInstitute,
  fetchCourses,
  createCourse,
  updateCourse,
  fetchAdmins,
  deleteAdmin,
  fetchFeatureFlags,
  setFeatureFlag,
  fetchStudents,
  STUDENT_FEATURES,
  FEATURE_LABEL,
  type Institute,
  type Course,
  type AdminUser,
  type InstituteFeatureFlags,
  type StudentFeature,
} from "../../lib/api";
import { instituteOptionsFrom } from "../../lib/noticeTaxonomy";

const INPUT =
  "px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary";

type AdminDialog = { kind: "create" } | { kind: "edit"; admin: AdminUser } | { kind: "password"; admin: AdminUser };

export default function InstituteDetailPage() {
  const params = useParams<{ instituteCode: string }>();
  const instituteCode = decodeURIComponent(params.instituteCode);
  const router = useRouter();
  const { toast } = useToast();
  const session = useAdminSession();

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [flags, setFlags] = useState<InstituteFeatureFlags[]>([]);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shortName, setShortName] = useState("");
  const [savingShortName, setSavingShortName] = useState(false);
  // Locked (read-only) once a value already exists - a short name or an onboarded=true is
  // essentially a one-time, life-of-the-institute fact, so accidental edits are worth guarding
  // against. The Edit button unlocks it; saving (or toggling onboarded back off) re-locks
  // automatically once the field has a value again.
  const [editingShortName, setEditingShortName] = useState(false);
  const [togglingOnboarded, setTogglingOnboarded] = useState(false);
  const [editingOnboarded, setEditingOnboarded] = useState(false);
  const [addingCourse, setAddingCourse] = useState(false);
  const [adminDialog, setAdminDialog] = useState<AdminDialog | null>(null);
  const [pendingFeature, setPendingFeature] = useState<StudentFeature | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [institutesData, coursesData, adminsData, flagsData, studentsData] = await Promise.all([
        fetchInstitutes(),
        fetchCourses(),
        fetchAdmins(),
        fetchFeatureFlags(),
        fetchStudents(),
      ]);
      setInstitutes(institutesData);
      setCourses(coursesData);
      setAdmins(adminsData);
      setFlags(flagsData);
      setStudentCount(studentsData.filter((s) => s.instituteCode === instituteCode).length);

      const found = institutesData.find((i) => i.instituteCode === instituteCode);
      setShortName(found?.shortName ?? "");
      setEditingShortName(!found?.shortName);
      setEditingOnboarded(!found?.onboarded);
      if (!found) setLoadError("Institute not found");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [instituteCode]);

  useEffect(() => { load(); }, [load]);

  const institute = institutes.find((i) => i.instituteCode === instituteCode) ?? null;

  const instituteCourses = useMemo(
    () =>
      courses
        .filter((c) => c.instituteCode === instituteCode)
        .sort((a, b) => a.programCode.localeCompare(b.programCode)),
    [courses, instituteCode]
  );
  const instituteAdmins = useMemo(
    () => admins.filter((a) => a.role === "INSTITUTE_ADMIN" && a.institutes.some((i) => i.instituteCode === instituteCode)),
    [admins, instituteCode]
  );
  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);
  const enabledFeatures = flags.find((f) => f.instituteCode === instituteCode)?.enabledFeatures ?? [];

  const shortNameDirty = institute != null && shortName !== (institute.shortName ?? "");

  const saveShortName = async () => {
    if (!institute) return;
    setSavingShortName(true);
    try {
      const updated = await updateInstitute(institute.instituteCode, {
        shortName: shortName.trim() === "" ? null : shortName.trim(),
      });
      setInstitutes((prev) => prev.map((i) => (i.instituteCode === updated.instituteCode ? updated : i)));
      setEditingShortName(!updated.shortName);
      toast("Institute updated", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSavingShortName(false);
    }
  };

  const cancelEditShortName = () => {
    setShortName(institute?.shortName ?? "");
    setEditingShortName(false);
  };

  const toggleOnboarded = async (checked: boolean) => {
    if (!institute) return;
    setTogglingOnboarded(true);
    try {
      const updated = await updateInstitute(institute.instituteCode, { onboarded: checked });
      setInstitutes((prev) => prev.map((i) => (i.instituteCode === updated.instituteCode ? updated : i)));
      setEditingOnboarded(!updated.onboarded);
      toast(checked ? "Marked as onboarded" : "Marked as not onboarded", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setTogglingOnboarded(false);
    }
  };

  // Optimistic, same pattern as /feature-flags — flip it locally, only re-fetch on failure.
  const toggleFeature = async (feature: StudentFeature, enabled: boolean) => {
    setPendingFeature(feature);
    setFlags((prev) =>
      prev.map((f) =>
        f.instituteCode !== instituteCode
          ? f
          : {
              ...f,
              enabledFeatures: enabled
                ? [...f.enabledFeatures, feature]
                : f.enabledFeatures.filter((x) => x !== feature),
            }
      )
    );
    try {
      await setFeatureFlag(instituteCode, feature, enabled);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update feature flag", "error");
      load();
    } finally {
      setPendingFeature(null);
    }
  };

  const removeAdmin = async (admin: AdminUser) => {
    if (!window.confirm(`Delete ${admin.displayName} (${admin.email})? They will lose access immediately.`)) {
      return;
    }
    try {
      await deleteAdmin(admin.id);
      toast("Admin deleted", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete admin", "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (loadError || !institute) {
    return (
      <div className="py-16 text-center">
        <p className="text-[14px] text-muted mb-4">Could not load this institute: {loadError ?? "Not found"}</p>
        <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/institutes")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Institutes
      </button>

      {/* Identity header */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-primary-faint text-primary flex items-center justify-center shrink-0">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">{institute.instituteName}</h1>
              <div className="text-[13px] font-mono text-muted mt-1">{institute.instituteCode}</div>
            </div>
          </div>

          {/* Top-right onboarded flag - locked read-only once true (a one-time, life-of-the-
              institute fact), same reasoning as the short name below. Not yet onboarded stays
              freely toggleable, since there's nothing settled to protect yet. */}
          {institute.onboarded && !editingOnboarded ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-full text-teal-600 bg-teal-50">
                Onboarded
              </span>
              <button
                onClick={() => setEditingOnboarded(true)}
                title="Edit onboarded status"
                className="p-1.5 text-muted hover:text-primary hover:bg-primary-faint rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={institute.onboarded}
                  disabled={togglingOnboarded}
                  onChange={(e) => toggleOnboarded(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 disabled:opacity-40"
                />
                <span
                  className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${
                    institute.onboarded ? "text-teal-600 bg-teal-50" : "text-muted bg-background border border-border"
                  }`}
                >
                  {institute.onboarded ? "Onboarded" : "Not Onboarded"}
                </span>
              </label>
              {institute.onboarded && (
                <button
                  onClick={() => setEditingOnboarded(false)}
                  className="text-[11px] font-semibold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-end gap-3 mt-4 pt-4 border-t border-border">
          <Field label="Short name" hint="Shown across the app and portal instead of the full name">
            {editingShortName ? (
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. USAR"
                autoFocus
                className={`${INPUT} w-40`}
              />
            ) : (
              <div className="h-[34px] flex items-center text-[14px] font-semibold text-foreground">
                {institute.shortName}
              </div>
            )}
          </Field>
          {editingShortName ? (
            <div className="flex items-center gap-3 pb-2">
              {shortNameDirty && (
                <button
                  onClick={saveShortName}
                  disabled={savingShortName}
                  className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
                >
                  {savingShortName ? "Saving…" : "Save"}
                </button>
              )}
              <button onClick={cancelEditShortName} className="text-[12px] font-semibold text-muted hover:text-foreground">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingShortName(true)}
              title="Edit short name"
              className="p-1.5 mb-1 text-muted hover:text-primary hover:bg-primary-faint rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile value={instituteCourses.length} label="Courses" icon={GraduationCap} color="info" />
        <StatTile value={instituteAdmins.length} label="Admins" icon={ShieldCheck} color="violet" />
        <StatTile value={studentCount ?? "—"} label="Students" icon={UsersIcon} color="teal" />
      </div>

      <div className="space-y-6">
        {/* Courses */}
        <SectionCard
          title="Courses"
          icon={GraduationCap}
          action={
            <button
              onClick={() => setAddingCourse((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline"
            >
              {addingCourse ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {addingCourse ? "Cancel" : "Add course"}
            </button>
          }
        >
          {addingCourse && (
            <div className="-mx-6 -mt-6 mb-4">
              <AddCourseForm
                institute={institute}
                onCancel={() => setAddingCourse(false)}
                onCreated={(created) => {
                  setCourses((prev) => [...prev, created]);
                  setAddingCourse(false);
                }}
              />
            </div>
          )}
          {instituteCourses.length === 0 ? (
            <EmptyState icon={GraduationCap} message="No courses yet for this institute." />
          ) : (
            <CoursesTable
              courses={instituteCourses}
              onSaved={(updated) =>
                setCourses((prev) => prev.map((c) => (c.programCode === updated.programCode ? updated : c)))
              }
            />
          )}
        </SectionCard>

        {/* Admins */}
        <SectionCard
          title="Admins"
          icon={ShieldCheck}
          action={
            <button
              onClick={() => setAdminDialog({ kind: "create" })}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add admin
            </button>
          }
        >
          {instituteAdmins.length === 0 ? (
            <EmptyState icon={ShieldCheck} message="No admin accounts assigned to this institute yet." />
          ) : (
            <div className="overflow-x-auto -mx-6 -mb-6">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="bg-primary-faint">
                    <th className="px-6 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Also Assigned To</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Last sign-in</th>
                    <th className="px-4 py-3 w-32" />
                  </tr>
                </thead>
                <tbody>
                  {instituteAdmins.map((admin) => (
                    <tr key={admin.id} className="border-b border-border last:border-b-0 hover:bg-background transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{admin.displayName}</span>
                          {!admin.active && <Pill color="text-danger" colorFaint="bg-danger-faint">Disabled</Pill>}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">{admin.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {admin.institutes
                          .filter((i) => i.instituteCode !== instituteCode)
                          .map((i) => i.shortName || i.instituteName)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setAdminDialog({ kind: "edit", admin })}
                            className="px-2.5 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary-faint rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setAdminDialog({ kind: "password", admin })}
                            title="Set a new password"
                            className="p-1.5 text-muted hover:text-primary hover:bg-primary-faint rounded-lg transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeAdmin(admin)}
                            title="Delete"
                            className="p-1.5 text-muted hover:text-danger hover:bg-danger-faint rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Features */}
        <SectionCard title="Features" icon={ToggleLeft}>
          <p className="text-[12.5px] text-muted mb-4">
            Which optional tabs this school&apos;s students see in the app. Home, Results, and Profile always show.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STUDENT_FEATURES.map((feature) => {
              const checked = enabledFeatures.includes(feature);
              return (
                <label
                  key={feature}
                  className="flex items-center gap-2.5 px-3 py-2.5 border border-border rounded-lg text-[13px] cursor-pointer hover:bg-background transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pendingFeature === feature}
                    onChange={(e) => toggleFeature(feature, e.target.checked)}
                    className="w-4 h-4 accent-primary disabled:opacity-40"
                  />
                  {FEATURE_LABEL[feature]}
                </label>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {adminDialog?.kind === "create" && (
        <AdminForm
          fixedRole="INSTITUTE_ADMIN"
          presetInstituteCodes={[instituteCode]}
          instituteOptions={instituteOptions}
          onClose={() => setAdminDialog(null)}
          onSaved={() => { setAdminDialog(null); load(); }}
        />
      )}

      {adminDialog?.kind === "edit" && (
        <AdminForm
          admin={adminDialog.admin}
          isSelf={adminDialog.admin.id === session?.id}
          fixedRole="INSTITUTE_ADMIN"
          instituteOptions={instituteOptions}
          onClose={() => setAdminDialog(null)}
          onSaved={() => { setAdminDialog(null); load(); }}
        />
      )}

      {adminDialog?.kind === "password" && (
        <PasswordForm admin={adminDialog.admin} onClose={() => setAdminDialog(null)} onSaved={() => setAdminDialog(null)} />
      )}
    </div>
  );
}

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
    <div className="px-6 py-4 border-y border-border bg-background">
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

function CoursesTable({
  courses,
  onSaved,
}: {
  courses: Course[];
  onSaved: (updated: Course) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-6 -mb-6">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="bg-primary-faint">
            <th className="px-6 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Code</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Program</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Short Name</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Total Semesters</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <CourseRow key={course.programCode} course={course} onSaved={onSaved} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseRow({
  course,
  onSaved,
}: {
  course: Course;
  onSaved: (updated: Course) => void;
}) {
  const { toast } = useToast();
  const [shortName, setShortName] = useState(course.shortName ?? "");
  const [totalSemesters, setTotalSemesters] = useState(course.totalSemesters?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const isComplete = (c: Course) => Boolean(c.shortName) && c.totalSemesters != null;
  // Locked once both fields are already filled in - same one-time-fact reasoning as the
  // institute's own short name/onboarded flag. A partially-filled row (e.g. short name set but
  // semesters still missing) stays open so there's nothing extra to click through to finish it.
  const [editing, setEditing] = useState(!isComplete(course));

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
      setEditing(!isComplete(updated));
      toast("Course updated", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setShortName(course.shortName ?? "");
    setTotalSemesters(course.totalSemesters?.toString() ?? "");
    setEditing(false);
  };

  return (
    <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0 bg-surface">
      <td className="px-6 py-3 font-mono text-[13px]">{course.programCode}</td>
      <td className="px-4 py-3 font-semibold">{course.programName}</td>
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="e.g. B.Tech AI&DS"
            className={`${INPUT} w-full`}
          />
        ) : (
          course.shortName
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="number"
            min={1}
            value={totalSemesters}
            onChange={(e) => setTotalSemesters(e.target.value)}
            placeholder="—"
            className={`${INPUT} w-20`}
          />
        ) : (
          course.totalSemesters
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            {dirty && (
              <button
                onClick={save}
                disabled={saving}
                className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            {isComplete(course) && (
              <button onClick={cancel} className="text-[12px] font-semibold text-muted hover:text-foreground">
                Cancel
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Edit this course"
            className="p-1.5 text-muted hover:text-primary hover:bg-primary-faint rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
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
