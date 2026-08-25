"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, UserSearch, AlertTriangle, LifeBuoy, UserMinus, HelpCircle, ListChecks } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import Filter, { SELECT_CLASS } from "../components/Filter";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import {
  fetchUnlinkedUsers,
  updateUnlinkedUserStatus,
  SUPPORT_CATEGORY_LABEL,
  type UnlinkedUser,
  type UnlinkedUserStatus,
} from "../lib/api";

const PROVIDER_LABEL: Record<string, string> = {
  GOOGLE: "Google",
  EMAIL_OTP: "Email OTP",
  PASSWORD: "Password",
};

const STATUS_LABEL: Record<UnlinkedUserStatus, string> = {
  NEEDS_FOLLOW_UP: "Needs Follow-up",
  DROPPED_OUT: "Dropped Out",
  OTHER_ISSUE: "Other Issue",
  RESOLVED: "Resolved",
};

const STATUS_COLOR: Record<UnlinkedUserStatus, { color: string; colorFaint: string }> = {
  NEEDS_FOLLOW_UP: { color: "text-danger", colorFaint: "bg-danger-faint" },
  DROPPED_OUT: { color: "text-muted", colorFaint: "bg-background" },
  OTHER_ISSUE: { color: "text-orange", colorFaint: "bg-orange-faint" },
  RESOLVED: { color: "text-success", colorFaint: "bg-success-faint" },
};

function StatusPill({ status }: { status: UnlinkedUserStatus }) {
  const c = STATUS_COLOR[status];
  return <Pill color={c.color} colorFaint={c.colorFaint}>{STATUS_LABEL[status]}</Pill>;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function LoginIssuesPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UnlinkedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UnlinkedUserStatus | "ALL">("ALL");

  const [selected, setSelected] = useState<UnlinkedUser | null>(null);
  const [draftStatus, setDraftStatus] = useState<UnlinkedUserStatus>("NEEDS_FOLLOW_UP");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await fetchUnlinkedUsers());
    } catch (err) {
      toast(`Failed to load login issues: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    needsFollowUp: users.filter((u) => u.status === "NEEDS_FOLLOW_UP").length,
    outageAffected: users.filter((u) => u.outageAttempts.length > 0).length,
    droppedOut: users.filter((u) => u.status === "DROPPED_OUT").length,
    otherIssue: users.filter((u) => u.status === "OTHER_ISSUE").length,
  }), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (!q) return true;
      return (u.name || "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, search, statusFilter]);

  const openUser = (u: UnlinkedUser) => {
    setSelected(u);
    setDraftStatus(u.status);
    setDraftNote(u.note || "");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateUnlinkedUserStatus(selected.id, draftStatus, draftNote.trim());
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSelected(updated);
      toast("Status saved", "success");
    } catch (err) {
      toast(`Failed to save status: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Login Issues"
        subtitle="Every account that signed in but never linked to a Student record — cross-referenced against portal outages and support tickets, with a place to note why."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatTile value={counts.needsFollowUp} label="Needs Follow-up" color="danger" icon={UserSearch} />
        <StatTile value={counts.outageAffected} label="Outage-affected" color="orange" icon={AlertTriangle} />
        <StatTile value={counts.droppedOut} label="Dropped Out" icon={UserMinus} />
        <StatTile value={counts.otherIssue} label="Other Issue" color="violet" icon={HelpCircle} />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-primary">
            Accounts
            {!loading && <span className="ml-2 text-[12px] font-normal text-muted">{filtered.length}</span>}
          </h2>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline shrink-0">
            Refresh
          </button>
        </div>

        <div className="px-6 pt-4 flex flex-wrap items-end gap-4">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide block mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div className="w-56">
            <Filter label="Status">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as UnlinkedUserStatus | "ALL")}
                className={SELECT_CLASS}
              >
                <option value="ALL">All statuses</option>
                {(Object.keys(STATUS_LABEL) as UnlinkedUserStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Filter>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserSearch}
            message={users.length === 0 ? "Nobody is stuck here right now — every signed-in account has imported its results." : "No accounts match your filters."}
          />
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Signed in via</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Signed up</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Signals</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => openUser(u)}
                    className="border-b border-border last:border-b-0 hover:bg-background transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">{u.name || "—"}</td>
                    <td className="px-4 py-3 font-mono text-[12.5px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {u.providers.length === 0
                          ? <span className="text-muted">—</span>
                          : u.providers.map((p) => (
                              <Pill key={p} color="text-info" colorFaint="bg-info-faint">
                                {PROVIDER_LABEL[p] || p}
                              </Pill>
                            ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {u.outageAttempts.length > 0 && (
                          <Pill color="text-orange" colorFaint="bg-orange-faint">
                            Outage × {u.outageAttempts.length}
                          </Pill>
                        )}
                        {u.supportTickets.length > 0 && (
                          <Pill color="text-info" colorFaint="bg-info-faint">
                            {u.supportTickets.length} ticket{u.supportTickets.length > 1 ? "s" : ""}
                          </Pill>
                        )}
                        {u.outageAttempts.length === 0 && u.supportTickets.length === 0 && (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={u.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailDialog
          title={selected.name || selected.email}
          subtitle={`Signed up ${formatDateTime(selected.createdAt)}`}
          onClose={() => setSelected(null)}
          maxWidthClass="max-w-2xl"
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <DetailField label="Email" value={selected.email} />
            <DetailField
              label="Signed in via"
              value={selected.providers.map((p) => PROVIDER_LABEL[p] || p).join(", ") || "—"}
            />
          </div>

          {selected.outageAttempts.length > 0 && (
            <div className="mb-5">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange" /> Portal outage attempts
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-background">
                      <th className="px-3 py-2 text-left text-[11px] font-bold text-muted uppercase tracking-wide">Outage</th>
                      <th className="px-3 py-2 text-left text-[11px] font-bold text-muted uppercase tracking-wide">Type</th>
                      <th className="px-3 py-2 text-left text-[11px] font-bold text-muted uppercase tracking-wide">Last Attempt</th>
                      <th className="px-3 py-2 text-left text-[11px] font-bold text-muted uppercase tracking-wide">Tries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.outageAttempts.map((a, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">#{a.outageId}</td>
                        <td className="px-3 py-2 text-muted">{a.attemptType === "LOGIN" ? "Login" : "Captcha fetch"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted">{formatDateTime(a.lastAttemptedAt)}</td>
                        <td className="px-3 py-2 text-muted">{a.attemptCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selected.supportTickets.length > 0 && (
            <div className="mb-5">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <LifeBuoy className="w-3.5 h-3.5 text-info" /> Support tickets from this email
              </div>
              <div className="space-y-2">
                {selected.supportTickets.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-background border border-border">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Pill color="text-primary" colorFaint="bg-primary-faint">{SUPPORT_CATEGORY_LABEL[t.category]}</Pill>
                      {t.status === "OPEN" ? (
                        <Pill color="text-danger" colorFaint="bg-danger-faint">Open</Pill>
                      ) : (
                        <Pill color="text-success" colorFaint="bg-success-faint">Resolved</Pill>
                      )}
                    </div>
                    <p className="text-[13px] text-foreground line-clamp-2">{t.description}</p>
                    <p className="text-[11px] text-muted mt-1">{formatDateTime(t.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" /> Triage
          </div>
          <div className="p-4 rounded-xl bg-background border border-border space-y-3">
            <Filter label="Status">
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as UnlinkedUserStatus)}
                className={SELECT_CLASS}
              >
                {(Object.keys(STATUS_LABEL) as UnlinkedUserStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Filter>
            <Filter label="Note">
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                rows={3}
                placeholder="e.g. Called the student — they graduated last year."
                className="w-full border border-border rounded-lg px-3 py-2.5 text-[14px] bg-surface focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </Filter>
            {selected.statusUpdatedAt && (
              <p className="text-[11px] text-muted">Last updated {formatDateTime(selected.statusUpdatedAt)}</p>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-[14px] font-bold bg-primary text-white hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </DetailDialog>
      )}
    </div>
  );
}
