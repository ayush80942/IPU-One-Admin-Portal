"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  GraduationCap,
  KeyRound,
  Landmark,
  LogIn,
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
import { impersonate } from "../../lib/auth";
import StatTile from "../../components/StatTile";
import Pill from "../../components/Pill";
import EmptyState from "../../components/EmptyState";
import SectionCard from "../../components/SectionCard";
import { BatchYearSelect, BatchYearSectionsPanel } from "./CourseSectionsDropdown";
import { AuthedImage } from "../../components/AuthedFile";
import { AdminForm, PasswordForm } from "../../components/AdminFormDialog";
import {
  fetchInstitutes,
  updateInstitute,
  uploadInstituteLogo,
  fetchCourses,
  createCourse,
  updateCourse,
  fetchAdmins,
  deleteAdmin,
  fetchFeatureFlags,
  setFeatureFlag,
  fetchStudents,
  fetchSections,
  STUDENT_FEATURES,
  FEATURE_LABEL,
  type Institute,
  type Course,
  type AdminUser,
  type InstituteFeatureFlags,
  type StudentFeature,
  type SectionDto,
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
  const [sections, setSections] = useState<SectionDto[]>([]);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shortName, setShortName] = useState("");
  const [onboardedDraft, setOnboardedDraft] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  // Locked (read-only) once the profile is "complete" - a short name and onboarded=true are
  // essentially one-time, life-of-the-institute facts, so accidental edits are worth guarding
  // against. One "Edit Profile" button unlocks both fields together; saving (or a still-
  // incomplete profile) re-locks/keeps them open as a group, not per field.
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingCourse, setAddingCourse] = useState(false);
  const [adminDialog, setAdminDialog] = useState<AdminDialog | null>(null);
  const [pendingFeature, setPendingFeature] = useState<StudentFeature | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [institutesData, coursesData, adminsData, flagsData, studentsData, sectionsData] = await Promise.all([
        fetchInstitutes(),
        fetchCourses(),
        fetchAdmins(),
        fetchFeatureFlags(),
        fetchStudents(),
        fetchSections(),
      ]);
      setInstitutes(institutesData);
      setCourses(coursesData);
      setAdmins(adminsData);
      setFlags(flagsData);
      setStudentCount(studentsData.filter((s) => s.instituteCode === instituteCode).length);
      setSections(sectionsData.filter((s) => s.instituteCode === instituteCode));

      const found = institutesData.find((i) => i.instituteCode === instituteCode);
      setShortName(found?.shortName ?? "");
      setOnboardedDraft(found?.onboarded ?? false);
      setEditingProfile(!(found?.shortName && found?.onboarded));
      if (!found) setLoadError("Institute not found");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [instituteCode]);

  useEffect(() => { load(); }, [load]);

  const refreshSections = useCallback(async () => {
    try {
      const all = await fetchSections();
      setSections(all.filter((s) => s.instituteCode === instituteCode));
    } catch (err) {
      toast(`Failed to load sections: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  }, [instituteCode, toast]);

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

  const profileDirty =
    institute != null &&
    (shortName !== (institute.shortName ?? "") || onboardedDraft !== institute.onboarded);
  // Cancel only makes sense once there's a previously-saved state to fall back to - a
  // brand-new institute with nothing set yet has nowhere to "cancel" back to.
  const profileComplete = Boolean(institute?.shortName) && Boolean(institute?.onboarded);

  const saveProfile = async () => {
    if (!institute) return;
    setSavingProfile(true);
    try {
      const updated = await updateInstitute(institute.instituteCode, {
        shortName: shortName.trim() === "" ? null : shortName.trim(),
        onboarded: onboardedDraft,
      });
      setInstitutes((prev) => prev.map((i) => (i.instituteCode === updated.instituteCode ? updated : i)));
      setEditingProfile(!(updated.shortName && updated.onboarded));
      toast("Institute updated", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelEditProfile = () => {
    setShortName(institute?.shortName ?? "");
    setOnboardedDraft(institute?.onboarded ?? false);
    setEditingProfile(false);
  };

  const handleLogoUploaded = (updated: Institute) => {
    setInstitutes((prev) => prev.map((i) => (i.instituteCode === updated.instituteCode ? updated : i)));
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

  const logInAs = async (admin: AdminUser) => {
    setImpersonating(admin.id);
    try {
      await impersonate(admin.id);
      router.replace("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to log in as this admin", "error");
      setImpersonating(null);
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
            <InstituteLogo institute={institute} onUploaded={handleLogoUploaded} />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">
                {institute.instituteName}
                {institute.shortName && !editingProfile && (
                  <span className="text-muted font-semibold"> ({institute.shortName})</span>
                )}
              </h1>
              <div className="text-[13px] font-mono text-muted mt-1">{institute.instituteCode}</div>
            </div>
          </div>

          {/* Single edit button for the whole profile (short name + onboarded together) - once
              both are set, the profile is a settled, life-of-the-institute fact and this is the
              only way back in. Still incomplete, it just stays open below with nothing to click. */}
          {!editingProfile && (
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${
                  institute.onboarded ? "text-teal-600 bg-teal-50" : "text-muted bg-background border border-border"
                }`}
              >
                {institute.onboarded ? "Onboarded" : "Not Onboarded"}
              </span>
              <button
                onClick={() => setEditingProfile(true)}
                title="Edit institute profile"
                className="p-1.5 text-muted hover:text-primary hover:bg-primary-faint rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {editingProfile && (
          <div className="flex items-end gap-3 mt-4 pt-4 border-t border-border flex-wrap">
            <Field label="Short name" hint="Shown across the app and portal instead of the full name">
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. USAR"
                autoFocus
                className={`${INPUT} w-40`}
              />
            </Field>
            <Field label="Onboarded" hint="Set once the institute's Student Cell has actually started using the portal">
              <label className="h-[34px] flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onboardedDraft}
                  onChange={(e) => setOnboardedDraft(e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                />
                <span className="text-[13px] font-semibold text-foreground">
                  {onboardedDraft ? "Onboarded" : "Not Onboarded"}
                </span>
              </label>
            </Field>
            <div className="flex items-center gap-3 pb-2">
              {profileDirty && (
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
                >
                  {savingProfile ? "Saving…" : "Save"}
                </button>
              )}
              {profileComplete && (
                <button onClick={cancelEditProfile} className="text-[12px] font-semibold text-muted hover:text-foreground">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
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
              instituteCode={instituteCode}
              editMode={editingProfile}
              sections={sections}
              onSaved={(updated) =>
                setCourses((prev) => prev.map((c) => (c.programCode === updated.programCode ? updated : c)))
              }
              onSectionsChanged={refreshSections}
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
                          {admin.active && (
                            <button
                              onClick={() => logInAs(admin)}
                              disabled={impersonating === admin.id}
                              title={`Log in as ${admin.displayName}'s Student Cell portal`}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold text-primary bg-gold-faint hover:bg-gold/25 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              {impersonating === admin.id ? "Logging in…" : "Log in as"}
                            </button>
                          )}
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

function InstituteLogo({
  institute,
  onUploaded,
}: {
  institute: Institute;
  onUploaded: (updated: Institute) => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputId = `institute-logo-${institute.instituteCode}`;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadInstituteLogo(institute.instituteCode, file);
      onUploaded(updated);
      toast("Logo updated", "success");
    } catch (err) {
      toast(`Failed to upload logo: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <label
      htmlFor={inputId}
      title="Click to upload the institute logo"
      className="group relative w-14 h-14 rounded-2xl bg-primary-faint text-primary flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
    >
      {institute.logoUrl ? (
        <AuthedImage
          fileUrl={`${institute.logoUrl}?v=${encodeURIComponent(institute.updatedAt)}`}
          alt={`${institute.instituteName} logo`}
          className="w-full h-full object-cover"
          fallbackClassName="w-14 h-14"
        />
      ) : (
        <Landmark className="w-6 h-6" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
        {uploading ? (
          <span className="text-white text-[10px] font-bold">…</span>
        ) : (
          <Camera className="w-4 h-4 text-white" />
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={handleFile}
      />
    </label>
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
  instituteCode,
  editMode,
  sections,
  onSaved,
  onSectionsChanged,
}: {
  courses: Course[];
  instituteCode: string;
  editMode: boolean;
  sections: SectionDto[];
  onSaved: (updated: Course) => void;
  onSectionsChanged: () => void;
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
            <th className="px-4 py-3 w-40" />
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <CourseRow
              key={course.programCode}
              course={course}
              instituteCode={instituteCode}
              editMode={editMode}
              sections={sections}
              onSaved={onSaved}
              onSectionsChanged={onSectionsChanged}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseRow({
  course,
  instituteCode,
  editMode,
  sections,
  onSaved,
  onSectionsChanged,
}: {
  course: Course;
  instituteCode: string;
  editMode: boolean;
  sections: SectionDto[];
  onSaved: (updated: Course) => void;
  onSectionsChanged: () => void;
}) {
  const { toast } = useToast();
  const [shortName, setShortName] = useState(course.shortName ?? "");
  const [totalSemesters, setTotalSemesters] = useState(course.totalSemesters?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [selectedBatchYear, setSelectedBatchYear] = useState<number | null>(null);
  const isComplete = (c: Course) => Boolean(c.shortName) && c.totalSemesters != null;
  // Editable when the page-wide edit toggle (the institute header's single Pencil button) is on,
  // or when this row is still incomplete - same one-time-fact reasoning as the institute's own
  // short name/onboarded flag, now shared across every row instead of each having its own pencil.
  const editable = editMode || !isComplete(course);

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

  const cancel = () => {
    setShortName(course.shortName ?? "");
    setTotalSemesters(course.totalSemesters?.toString() ?? "");
  };

  return (
    <>
      <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0 bg-surface">
        <td className="px-6 py-3 font-mono text-[13px]">{course.programCode}</td>
        <td className="px-4 py-3 font-semibold">{course.programName}</td>
        <td className="px-4 py-3">
          {editable ? (
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
          {editable ? (
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
          <div className="flex items-center justify-end gap-2">
            {editable && dirty && (
              <>
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={cancel} className="text-[12px] font-semibold text-muted hover:text-foreground">
                  Cancel
                </button>
              </>
            )}
            <BatchYearSelect course={course} sections={sections} value={selectedBatchYear} onChange={setSelectedBatchYear} />
          </div>
        </td>
      </tr>
      {selectedBatchYear !== null && (
        <tr className="bg-background border-b border-border last:border-b-0">
          <td colSpan={5} className="px-6 py-4">
            <BatchYearSectionsPanel
              instituteCode={instituteCode}
              course={course}
              batchYear={selectedBatchYear}
              sections={sections}
              onChanged={onSectionsChanged}
            />
          </td>
        </tr>
      )}
    </>
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
