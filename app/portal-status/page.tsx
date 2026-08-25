"use client";

import { useState, useEffect, useCallback } from "react";
import { ActivitySquare, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import {
  fetchPortalStatusSummary,
  fetchPortalOutages,
  fetchPortalOutageAttempts,
  type PortalStatusSummary,
  type PortalOutageResponse,
  type PortalOutageAttemptResponse,
} from "../lib/api";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export default function PortalStatusPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<PortalStatusSummary | null>(null);
  const [outages, setOutages] = useState<PortalOutageResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<PortalOutageResponse | null>(null);
  const [attempts, setAttempts] = useState<PortalOutageAttemptResponse[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  // Ticks once a minute so the ongoing-outage duration stays live without calling Date.now()
  // directly during render (impure — React flags this as a rule-of-purity violation).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, outageData] = await Promise.all([
        fetchPortalStatusSummary(),
        fetchPortalOutages(),
      ]);
      setSummary(summaryData);
      setOutages(outageData);
    } catch (err) {
      toast(`Failed to load portal status: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openOutage = async (outage: PortalOutageResponse) => {
    setSelected(outage);
    setAttemptsLoading(true);
    try {
      const data = await fetchPortalOutageAttempts(outage.id);
      setAttempts(data);
    } catch (err) {
      toast(`Failed to load affected users: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setAttemptsLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Portal Status"
        subtitle="When the GGSIPU result portal has gone down, and who tried to log in or import results while it was."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatTile
          value={summary ? (summary.up ? "Up" : "Down") : "…"}
          label="Current Status"
          color={summary && !summary.up ? "danger" : "success"}
          icon={summary && !summary.up ? AlertTriangle : CheckCircle2}
          subLabel={summary?.lastCheckedAt ? `Last checked ${formatDateTime(summary.lastCheckedAt)}` : undefined}
        />
        <StatTile
          value={summary && !summary.up && summary.currentOutageStartedAt
            ? formatDuration(Math.max(0, Math.round((now - new Date(summary.currentOutageStartedAt).getTime()) / 60000)))
            : "—"}
          label="Ongoing Outage"
          color={summary && !summary.up ? "danger" : "primary"}
          icon={AlertTriangle}
        />
        <StatTile value={summary?.outagesLast30Days ?? "…"} label="Outages (30 days)" icon={ActivitySquare} />
        <StatTile value={summary?.affectedUsersLast30Days ?? "…"} label="Affected Users (30 days)" icon={Users} />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-primary">Outage History</h2>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : outages.length === 0 ? (
          <EmptyState icon={ActivitySquare} message="No outages recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Started</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Ended</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Affected Users</th>
                </tr>
              </thead>
              <tbody>
                {outages.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => openOutage(o)}
                    className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      {o.ongoing ? (
                        <Pill color="text-danger" colorFaint="bg-danger-faint">Ongoing</Pill>
                      ) : (
                        <Pill color="text-success" colorFaint="bg-success-faint">Resolved</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-foreground">{formatDateTime(o.startedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {o.endedAt ? formatDateTime(o.endedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDuration(o.durationMinutes)}</td>
                    <td className="px-4 py-3 text-foreground">{o.affectedUserCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailDialog
          title={selected.ongoing ? "Ongoing Outage" : "Resolved Outage"}
          subtitle={`Started ${formatDateTime(selected.startedAt)} · ${formatDuration(selected.durationMinutes)}${
            selected.endedAt ? ` · ended ${formatDateTime(selected.endedAt)}` : ""
          }`}
          onClose={() => setSelected(null)}
          maxWidthClass="max-w-3xl"
        >
          <div className="mb-3 text-[11px] font-semibold text-muted uppercase tracking-wide">
            Who tried to log in during this outage
          </div>

          {attemptsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-10 rounded-lg" />
              ))}
            </div>
          ) : attempts.length === 0 ? (
            <EmptyState icon={Users} message="No one attempted a login during this window." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-background">
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-muted uppercase tracking-wide">User</th>
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-muted uppercase tracking-wide">Last Attempt</th>
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-muted uppercase tracking-wide">Tries</th>
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-muted uppercase tracking-wide">Notified</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="text-foreground">{a.userEmail}</div>
                        {a.enrollmentNo && <div className="text-[11px] text-muted">{a.enrollmentNo}</div>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted">{formatDateTime(a.lastAttemptedAt)}</td>
                      <td className="px-3 py-2 text-muted">{a.attemptCount}</td>
                      <td className="px-3 py-2">
                        {a.notified ? (
                          <Pill color="text-success" colorFaint="bg-success-faint">Notified</Pill>
                        ) : (
                          <Pill color="text-muted" colorFaint="bg-background">Pending</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5">
            <DetailField label="Outage ID" value={`#${selected.id}`} />
          </div>
        </DetailDialog>
      )}
    </div>
  );
}
