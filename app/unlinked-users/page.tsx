"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, UserX, Mail, Copy } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import { fetchUnlinkedUsers, type UnlinkedUser } from "../lib/api";

const PROVIDER_LABEL: Record<string, string> = {
  GOOGLE: "Google",
  EMAIL_OTP: "Email OTP",
  PASSWORD: "Password",
};

export default function UnlinkedUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UnlinkedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await fetchUnlinkedUsers());
    } catch (err) {
      toast(`Failed to load unlinked signups: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => (u.name || "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast("Email copied", "success");
    } catch {
      toast("Could not copy — your browser blocked clipboard access", "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Unlinked Signups"
        subtitle="Signed in, but never imported their GGSIPU results — so they don't appear anywhere else in the portal. Worth a nudge."
      />

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

        <div className="px-6 pt-4">
          <div className="relative max-w-sm">
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

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserX}
            message={users.length === 0 ? "Nobody is stuck here right now — every signed-in account has imported its results." : "No accounts match your search."}
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
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-background transition-colors">
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
                    <td className="px-4 py-3 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`mailto:${u.email}`}
                          title="Send an email"
                          className="p-1.5 text-muted hover:text-primary hover:bg-primary-faint rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => copyEmail(u.email)}
                          title="Copy email"
                          className="p-1.5 text-muted hover:text-primary hover:bg-primary-faint rounded-lg transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
