"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogIn, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useToast } from "../components/Toast";
import { useAdminSession } from "../components/AuthGate";
import PageHeader from "../components/PageHeader";
import Pill from "../components/Pill";
import EmptyState from "../components/EmptyState";
import DetailDialog from "../components/DetailDialog";
import MultiSelect from "../components/MultiSelect";
import { impersonate } from "../lib/auth";
import {
  createAdmin,
  deleteAdmin,
  fetchAdmins,
  fetchInstitutes,
  setAdminPassword,
  updateAdmin,
  type AdminRole,
  type AdminUser,
  type Institute,
} from "../lib/api";
import { instituteOptionsFrom } from "../lib/noticeTaxonomy";

const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: "University Admin",
  INSTITUTE_ADMIN: "Student Cell",
};

/** Editing an existing account, creating a new one, or resetting someone's password. */
type Dialog =
  | { kind: "create" }
  | { kind: "edit"; admin: AdminUser }
  | { kind: "password"; admin: AdminUser };

export default function AdminsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const session = useAdminSession();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsData, institutesData] = await Promise.all([fetchAdmins(), fetchInstitutes()]);
      setAdmins(adminsData);
      setInstitutes(institutesData);
    } catch (err) {
      toast(`Failed to load admins: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);

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

  const remove = async (admin: AdminUser) => {
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

  return (
    <div>
      <PageHeader
        title="Admins"
        subtitle="Who can sign in to this portal, and which institutes each of them can see."
        action={
          <button
            onClick={() => setDialog({ kind: "create" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-[13.5px] font-bold hover:bg-primary-light transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            New admin
          </button>
        }
      />

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-primary">
            Accounts
            {!loading && <span className="ml-2 text-[12px] font-normal text-muted">{admins.length}</span>}
          </h2>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline shrink-0">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : admins.length === 0 ? (
          <EmptyState icon={ShieldCheck} message="No admin accounts yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institutes</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Last sign-in</th>
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isSelf = admin.id === session?.id;
                  return (
                    <tr key={admin.id} className="border-b border-border last:border-b-0 hover:bg-background transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {admin.displayName}
                          {isSelf && <span className="ml-2 text-[11px] font-normal text-muted">(you)</span>}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">{admin.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {admin.role === "SUPER_ADMIN" ? (
                            <Pill color="text-violet" colorFaint="bg-violet-faint">{ROLE_LABEL.SUPER_ADMIN}</Pill>
                          ) : (
                            <Pill color="text-info" colorFaint="bg-info-faint">{ROLE_LABEL.INSTITUTE_ADMIN}</Pill>
                          )}
                          {!admin.active && (
                            <Pill color="text-danger" colorFaint="bg-danger-faint">Disabled</Pill>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {admin.role === "SUPER_ADMIN"
                          ? <span className="text-muted">All institutes</span>
                          : admin.institutes.map((i) => i.shortName || i.instituteName).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {admin.role === "INSTITUTE_ADMIN" && admin.active && (
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
                            onClick={() => setDialog({ kind: "edit", admin })}
                            className="px-2.5 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary-faint rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDialog({ kind: "password", admin })}
                            title="Set a new password"
                            className="p-1.5 text-muted hover:text-primary hover:bg-primary-faint rounded-lg transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => remove(admin)}
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

      {dialog?.kind === "create" && (
        <AdminForm
          instituteOptions={instituteOptions}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); load(); }}
        />
      )}

      {dialog?.kind === "edit" && (
        <AdminForm
          admin={dialog.admin}
          isSelf={dialog.admin.id === session?.id}
          instituteOptions={instituteOptions}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); load(); }}
        />
      )}

      {dialog?.kind === "password" && (
        <PasswordForm
          admin={dialog.admin}
          onClose={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface FormProps {
  admin?: AdminUser;
  isSelf?: boolean;
  instituteOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function AdminForm({ admin, isSelf = false, instituteOptions, onClose, onSaved }: FormProps) {
  const { toast } = useToast();
  const editing = admin != null;

  const [email, setEmail] = useState(admin?.email ?? "");
  const [displayName, setDisplayName] = useState(admin?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>(admin?.role ?? "INSTITUTE_ADMIN");
  const [active, setActive] = useState(admin?.active ?? true);
  const [instituteCodes, setInstituteCodes] = useState<string[]>(
    admin?.institutes.map((i) => i.instituteCode) ?? []
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await updateAdmin(admin.id, { displayName, role, instituteCodes, active });
        toast("Admin updated", "success");
      } else {
        await createAdmin({ email, displayName, password, role, instituteCodes });
        toast(`${displayName} can now sign in. Hand them the password you set.`, "success");
      }
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save admin", "error");
      setBusy(false);
    }
  };

  return (
    <DetailDialog
      title={editing ? "Edit admin" : "New admin"}
      subtitle={
        editing
          ? "The email address is fixed once an account exists."
          : "The password you set here is the one they sign in with — hand it over directly, nothing is emailed."
      }
      maxWidthClass="max-w-lg"
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={editing}
            required
            placeholder="studentcell.usar@ipu.ac.in"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          />
        </Field>

        <Field label="Name">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            placeholder="USAR Student Cell"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
          />
        </Field>

        {!editing && (
          <Field label="Initial password">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-[14px] bg-background font-mono focus:outline-none focus:border-primary transition-colors"
            />
          </Field>
        )}

        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            disabled={isSelf}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          >
            <option value="INSTITUTE_ADMIN">{ROLE_LABEL.INSTITUTE_ADMIN} — one or more institutes</option>
            <option value="SUPER_ADMIN">{ROLE_LABEL.SUPER_ADMIN} — everything</option>
          </select>
          {isSelf && <span className="text-[11px] text-muted">You cannot change your own role.</span>}
        </Field>

        {role === "INSTITUTE_ADMIN" && (
          <MultiSelect
            label="Institutes"
            options={instituteOptions}
            selected={instituteCodes}
            onChange={setInstituteCodes}
            placeholder="Select institutes…"
            hint="Everything this account sees — students, documents, fees, notices — is limited to these."
          />
        )}

        {editing && (
          <label className={`flex items-center gap-2.5 text-[13.5px] ${isSelf ? "opacity-60" : ""}`}>
            <input
              type="checkbox"
              checked={active}
              disabled={isSelf}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            Account is active
            {isSelf && <span className="text-[11px] text-muted">(you cannot disable yourself)</span>}
          </label>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-[13.5px] font-semibold text-muted hover:text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-[13.5px] font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Create admin"}
          </button>
        </div>
      </form>
    </DetailDialog>
  );
}

function PasswordForm({ admin, onClose, onSaved }: { admin: AdminUser; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await setAdminPassword(admin.id, password);
      toast(`New password set for ${admin.displayName}`, "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to set password", "error");
      setBusy(false);
    }
  };

  return (
    <DetailDialog
      title="Set password"
      subtitle={`${admin.displayName} — ${admin.email}`}
      maxWidthClass="max-w-md"
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="New password">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            placeholder="At least 8 characters"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-[14px] bg-background font-mono focus:outline-none focus:border-primary transition-colors"
          />
        </Field>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-[13.5px] font-semibold text-muted hover:text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-[13.5px] font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {busy ? "Saving…" : "Set password"}
          </button>
        </div>
      </form>
    </DetailDialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
