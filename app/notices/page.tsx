"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/Toast";
import { fetchNotices, deleteNotice, NoticeResponse } from "../lib/api";

export default function ManageNoticesPage() {
  const { toast } = useToast();
  const [notices, setNotices] = useState<NoticeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchNotices();
      setNotices(page.content);
    } catch (err) {
      toast(`Failed to load notices: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this notice? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await deleteNotice(id);
      toast("Notice deleted");
      setNotices((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      toast(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setDeleting(null);
    }
  };

  const urgentCount = notices.filter((n) => n.badge === "URGENT").length;
  const newCount = notices.filter((n) => n.badge === "NEW").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary">Manage Notices</h1>
      <p className="text-[14px] text-muted mt-1 mb-7">View, filter and delete published notices.</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="text-3xl font-extrabold text-primary">{notices.length}</div>
          <div className="text-[13px] text-muted mt-1">Total Notices</div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="text-3xl font-extrabold text-danger">{urgentCount}</div>
          <div className="text-[13px] text-muted mt-1">Urgent</div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="text-3xl font-extrabold text-success">{newCount}</div>
          <div className="text-[13px] text-muted mt-1">New</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-primary">Published Notices</h2>
          <button
            onClick={load}
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : notices.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-muted/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-muted text-[14px]">No notices published yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Badge</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Targeting</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id} className="hover:bg-background transition-colors border-b border-border last:border-b-0">
                    <td className="px-4 py-3 max-w-[280px]">
                      <div className="font-semibold text-foreground truncate">{n.title}</div>
                      <div className="text-[12px] text-muted truncate mt-0.5">{n.description.substring(0, 70)}…</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-faint text-primary">
                        {n.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {n.badge ? (
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            n.badge === "URGENT"
                              ? "bg-danger-faint text-danger"
                              : "bg-success-faint text-success"
                          }`}
                        >
                          {n.badge}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted max-w-[200px]">
                      <TargetingSummary notice={n} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{n.date}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(n.id)}
                        disabled={deleting === n.id}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-danger border border-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
                      >
                        {deleting === n.id ? "…" : "Delete"}
                      </button>
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

function TargetingSummary({ notice }: { notice: NoticeResponse }) {
  const parts: string[] = [];
  if (notice.targetProgramCodes) parts.push(`Program: ${notice.targetProgramCodes}`);
  if (notice.targetInstituteCodes) parts.push(`Institute: ${notice.targetInstituteCodes}`);
  if (notice.targetBatchYears) parts.push(`Batch: ${notice.targetBatchYears}`);
  if (notice.targetAdmissionYears) parts.push(`Admission: ${notice.targetAdmissionYears}`);

  if (parts.length === 0) {
    return <span className="text-success font-semibold">All Students</span>;
  }

  return (
    <div className="space-y-0.5">
      {parts.map((p, i) => (
        <div key={i}>{p}</div>
      ))}
    </div>
  );
}
