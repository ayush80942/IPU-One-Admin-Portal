"use client";

import { useState, useEffect, useCallback } from "react";
import { LifeBuoy, CheckCircle2, Circle } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import { AuthedImage } from "../components/AuthedFile";
import {
  fetchSupportTickets,
  setSupportTicketStatus,
  SUPPORT_CATEGORY_LABEL,
  type SupportTicketResponse,
} from "../lib/api";

function timeAgo(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function reporterLabel(t: SupportTicketResponse) {
  return t.name || t.email || t.enrollmentNo || "Anonymous";
}

export default function SupportTicketsPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicketResponse | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSupportTickets();
      setTickets(data);
    } catch (err) {
      toast(`Failed to load support tickets: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const resolvedCount = tickets.length - openCount;

  const toggleStatus = async (ticket: SupportTicketResponse) => {
    const nextStatus = ticket.status === "OPEN" ? "RESOLVED" : "OPEN";
    setUpdating(true);
    try {
      const updated = await setSupportTicketStatus(ticket.id, nextStatus);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelected(updated);
      toast(nextStatus === "RESOLVED" ? "Marked as resolved" : "Reopened", "success");
    } catch (err) {
      toast(`Failed to update ticket: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        subtitle="Problems students reported through the /support form, across every institute."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile value={tickets.length} label="Total Reports" icon={LifeBuoy} />
        <StatTile value={openCount} label="Open" color="danger" icon={Circle} />
        <StatTile value={resolvedCount} label="Resolved" color="success" icon={CheckCircle2} />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-primary">Reports</h2>
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
        ) : tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} message="No problems reported yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Reported By</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      {t.status === "OPEN" ? (
                        <Pill color="text-danger" colorFaint="bg-danger-faint">Open</Pill>
                      ) : (
                        <Pill color="text-success" colorFaint="bg-success-faint">Resolved</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill color="text-primary" colorFaint="bg-primary-faint">{SUPPORT_CATEGORY_LABEL[t.category]}</Pill>
                    </td>
                    <td className="px-4 py-3 max-w-sm">
                      <span className="line-clamp-1 text-foreground">{t.description}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{reporterLabel(t)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted text-[12px]">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailDialog
          title={SUPPORT_CATEGORY_LABEL[selected.category]}
          subtitle={`Reference #${selected.id} · ${timeAgo(selected.createdAt)}`}
          onClose={() => setSelected(null)}
          maxWidthClass="max-w-2xl"
        >
          <div className="mb-5">
            {selected.status === "OPEN" ? (
              <Pill color="text-danger" colorFaint="bg-danger-faint">Open</Pill>
            ) : (
              <Pill color="text-success" colorFaint="bg-success-faint">Resolved</Pill>
            )}
          </div>

          <div className="mb-5 p-4 rounded-xl bg-background border border-border">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Description</div>
            <p className="text-[14px] text-foreground whitespace-pre-wrap">{selected.description}</p>
          </div>

          {selected.screenshotUrl && (
            <div className="mb-5">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Screenshot</div>
              <AuthedImage
                fileUrl={selected.screenshotUrl}
                alt="Reported screenshot"
                className="w-full max-h-[45vh] object-contain rounded-lg border border-border bg-background"
                fallbackClassName="w-full h-[30vh] rounded-lg"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <DetailField label="Name" value={selected.name} />
            <DetailField label="Email" value={selected.email} />
            <DetailField label="Enrollment No" value={selected.enrollmentNo} />
          </div>

          <button
            onClick={() => toggleStatus(selected)}
            disabled={updating}
            className={`w-full py-2.5 rounded-xl text-[14px] font-bold transition-colors disabled:opacity-50 ${
              selected.status === "OPEN"
                ? "bg-success text-white hover:opacity-90"
                : "bg-background border border-border text-foreground hover:bg-primary-faint"
            }`}
          >
            {updating ? "Updating…" : selected.status === "OPEN" ? "Mark as Resolved" : "Reopen"}
          </button>
        </DetailDialog>
      )}
    </div>
  );
}
