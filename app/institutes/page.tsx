"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, GraduationCap, KeyRound, Landmark, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useToast } from "../components/Toast";
import { useAdminSession } from "../components/AuthGate";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import { AdminForm, PasswordForm } from "../components/AdminFormDialog";
import {
  fetchInstitutes,
  createInstitute,
  fetchCourses,
  fetchAdmins,
  deleteAdmin,
  fetchStudents,
  fetchTeachers,
  type Institute,
  type Course,
  type AdminUser,
} from "../lib/api";
import { instituteOptionsFrom } from "../lib/noticeTaxonomy";

const INPUT =
  "px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary";

type AdminDialog = { kind: "create" } | { kind: "edit"; admin: AdminUser } | { kind: "password"; admin: AdminUser };

export default function InstitutesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const session = useAdminSession();

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [studentCounts, setStudentCounts] = useState<Map<string, number>>(new Map());
  const [teacherCounts, setTeacherCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [addingInstitute, setAddingInstitute] = useState(false);
  const [adminDialog, setAdminDialog] = useState<AdminDialog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [institutesData, coursesData, adminsData, studentsData, teachersData] = await Promise.all([
        fetchInstitutes(),
        fetchCourses(),
        fetchAdmins(),
        fetchStudents(),
        fetchTeachers(),
      ]);
      setInstitutes(institutesData);
      setCourses(coursesData);
      setAdmins(adminsData);

      // Excludes alumni, matching the Students page's own primary listing - they've moved to
      // their own section there, so counting them here would overstate who's actually enrolled.
      const students = new Map<string, number>();
      for (const s of studentsData) {
        if (!s.instituteCode || s.alumniStatus) continue;
        students.set(s.instituteCode, (students.get(s.instituteCode) ?? 0) + 1);
      }
      setStudentCounts(students);

      const teachers = new Map<string, number>();
      for (const t of teachersData) {
        if (!t.instituteCode) continue;
        teachers.set(t.instituteCode, (teachers.get(t.instituteCode) ?? 0) + 1);
      }
      setTeacherCounts(teachers);
    } catch (err) {
      toast(`Failed to load: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);

  const courseCountByInstitute = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of courses) {
      if (!c.instituteCode) continue;
      map.set(c.instituteCode, (map.get(c.instituteCode) ?? 0) + 1);
    }
    return map;
  }, [courses]);

  const adminCountByInstitute = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of admins) {
      if (a.role !== "INSTITUTE_ADMIN") continue;
      for (const i of a.institutes) {
        map.set(i.instituteCode, (map.get(i.instituteCode) ?? 0) + 1);
      }
    }
    return map;
  }, [admins]);

  const superAdmins = useMemo(() => admins.filter((a) => a.role === "SUPER_ADMIN"), [admins]);

  const sortedInstitutes = useMemo(
    () =>
      [...institutes].sort((a, b) => {
        const diff = (studentCounts.get(b.instituteCode) ?? 0) - (studentCounts.get(a.instituteCode) ?? 0);
        return diff !== 0 ? diff : a.instituteName.localeCompare(b.instituteName);
      }),
    [institutes, studentCounts]
  );

  const institutesMissingShortName = institutes.filter((i) => !i.shortName).length;
  const onboardedCount = institutes.filter((i) => i.onboarded).length;

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

  const openInstitute = (code: string) => router.push(`/institutes/${encodeURIComponent(code)}`);

  return (
    <div>
      <PageHeader
        title="Institutes"
        subtitle="Codes and names stay in sync automatically from imported results. Click an institute to see its courses, admins, and enabled features — or add one below only when it has to exist before its first student imports."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
        <StatTile value={loading ? "—" : courses.length} label="Total Courses" icon={GraduationCap} color="info" />
        <StatTile value={loading ? "—" : superAdmins.length} label="Super Admins" icon={ShieldCheck} color="violet" />
      </div>

      {/* Institutes table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-bold text-primary">Institutes</h2>
            <span className="text-[12px] text-muted tabular-nums">{loading ? "—" : institutes.length}</span>
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
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Code</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Full Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Students</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Teachers</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Courses</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Admins</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {sortedInstitutes.map((institute) => (
                  <tr
                    key={institute.instituteCode}
                    onClick={() => openInstitute(institute.instituteCode)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openInstitute(institute.instituteCode);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${institute.instituteName}${institute.onboarded ? " (onboarded)" : ""}`}
                    title={institute.onboarded ? "Onboarded" : undefined}
                    className={`group transition-colors border-b border-border last:border-b-0 cursor-pointer focus:outline-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                      institute.onboarded
                        ? "border-l-4 border-l-teal-500 bg-teal-50/40 hover:bg-teal-50/70"
                        : "hover:bg-background"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[13px]">{institute.instituteCode}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${institute.onboarded ? "text-teal-700" : "text-foreground"}`}>
                        {institute.instituteName}
                        {institute.shortName && <span className="font-normal text-muted"> ({institute.shortName})</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{studentCounts.get(institute.instituteCode) ?? 0}</td>
                    <td className="px-4 py-3 tabular-nums">{teacherCounts.get(institute.instituteCode) ?? 0}</td>
                    <td className="px-4 py-3 tabular-nums">{courseCountByInstitute.get(institute.instituteCode) ?? 0}</td>
                    <td className="px-4 py-3 tabular-nums">{adminCountByInstitute.get(institute.instituteCode) ?? 0}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-muted/40 group-hover:text-primary transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Super Admins - the only admin accounts not tied to any one institute, so they live here
          rather than on any institute's own page. */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-bold text-primary">Super Admins</h2>
            <span className="text-[12px] text-muted tabular-nums">{loading ? "—" : superAdmins.length}</span>
          </div>
          <button
            onClick={() => setAdminDialog({ kind: "create" })}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
          >
            <Plus className="w-4 h-4" />
            New super admin
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : superAdmins.length === 0 ? (
          <EmptyState icon={ShieldCheck} message="No super admin accounts yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Last sign-in</th>
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {superAdmins.map((admin) => {
                  const isSelf = admin.id === session?.id;
                  return (
                    <tr key={admin.id} className="border-b border-border last:border-b-0 hover:bg-background transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{admin.displayName}</span>
                          {isSelf && <span className="text-[11px] font-normal text-muted">(you)</span>}
                          {!admin.active && <Pill color="text-danger" colorFaint="bg-danger-faint">Disabled</Pill>}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">{admin.email}</div>
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
                            disabled={isSelf}
                            title={isSelf ? "You cannot delete your own account" : "Delete"}
                            className="p-1.5 text-muted hover:text-danger hover:bg-danger-faint rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adminDialog?.kind === "create" && (
        <AdminForm
          fixedRole="SUPER_ADMIN"
          instituteOptions={instituteOptions}
          onClose={() => setAdminDialog(null)}
          onSaved={() => { setAdminDialog(null); load(); }}
        />
      )}

      {adminDialog?.kind === "edit" && (
        <AdminForm
          admin={adminDialog.admin}
          isSelf={adminDialog.admin.id === session?.id}
          fixedRole="SUPER_ADMIN"
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
