"use client";

import { useState } from "react";
import { useToast } from "./Toast";
import DetailDialog from "./DetailDialog";
import MultiSelect from "./MultiSelect";
import { createAdmin, updateAdmin, setAdminPassword, type AdminRole, type AdminUser } from "../lib/api";

export const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: "University Admin",
  INSTITUTE_ADMIN: "Student Cell",
};

interface AdminFormProps {
  admin?: AdminUser;
  isSelf?: boolean;
  // Locks the role and hides its picker - both call sites (the Super Admins section on the
  // Institutes list page, and the Admins section on one institute's own page) only ever
  // create/edit one kind of account, so there's nothing to pick.
  fixedRole?: AdminRole;
  // Only meaningful when creating (not editing) a fixedRole="INSTITUTE_ADMIN" account - pre-
  // selects the institute whose page this dialog was opened from, without preventing more from
  // being added, since one account can cover several institutes.
  presetInstituteCodes?: string[];
  instituteOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}

export function AdminForm({
  admin,
  isSelf = false,
  fixedRole,
  presetInstituteCodes,
  instituteOptions,
  onClose,
  onSaved,
}: AdminFormProps) {
  const { toast } = useToast();
  const editing = admin != null;

  const [email, setEmail] = useState(admin?.email ?? "");
  const [displayName, setDisplayName] = useState(admin?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>(admin?.role ?? fixedRole ?? "INSTITUTE_ADMIN");
  const [active, setActive] = useState(admin?.active ?? true);
  const [instituteCodes, setInstituteCodes] = useState<string[]>(
    admin?.institutes.map((i) => i.instituteCode) ?? presetInstituteCodes ?? []
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

        {!fixedRole && (
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
        )}

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

export function PasswordForm({ admin, onClose, onSaved }: { admin: AdminUser; onClose: () => void; onSaved: () => void }) {
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
