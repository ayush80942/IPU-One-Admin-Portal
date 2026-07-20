"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/Toast";
import Pill from "../components/Pill";
import NoticeForm from "../components/NoticeForm";
import { fetchNotices, deleteNotice, NoticeResponse } from "../lib/api";
import {
  CATEGORIES,
  categoryTaxonomy,
  badgeTaxonomy,
  programLabel,
  instituteLabel,
  resolveCodeList,
} from "../lib/noticeTaxonomy";

export default function ManageNoticesPage() {
  const { toast } = useToast();
  const [notices, setNotices] = useState<NoticeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchNotices(0, 100, category || undefined, search || undefined);
      setNotices(page.content);
    } catch (err) {
      toast(`Failed to load notices: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, category, search]);

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
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-primary">Notices</h1>
          <p className="text-[14px] text-muted mt-1">Create, target, and manage published notices.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Notice
        </button>
      </div>

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
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[15px] font-bold text-primary shrink-0">Published Notices</h2>

          <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or description…"
              className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-background focus:outline-none focus:border-primary transition-colors w-56"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-[13px] bg-background focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={load}
              className="text-[13px] font-medium text-primary hover:underline shrink-0"
            >
              Refresh
            </button>
          </div>
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
            <p className="text-muted text-[14px]">No notices match the current filters.</p>
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
                {notices.map((n) => {
                  const cat = categoryTaxonomy(n.category);
                  const badge = n.badge ? badgeTaxonomy(n.badge) : undefined;
                  return (
                    <tr key={n.id} className="hover:bg-background transition-colors border-b border-border last:border-b-0">
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="font-semibold text-foreground truncate">{n.title}</div>
                        <div className="text-[12px] text-muted truncate mt-0.5">{n.description.substring(0, 70)}…</div>
                      </td>
                      <td className="px-4 py-3">
                        {cat ? (
                          <Pill color={cat.color} colorFaint={cat.colorFaint}>{cat.label}</Pill>
                        ) : (
                          <span className="text-muted">{n.category}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {badge ? (
                          <Pill color={badge.color} colorFaint={badge.colorFaint}>{badge.label}</Pill>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted max-w-[240px]">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Notice modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 z-10"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold text-primary mb-1">New Notice</h2>
            <p className="text-[13px] text-muted mb-6">Create and publish a notice to targeted student groups.</p>
            <NoticeForm
              onCreated={() => {
                setShowForm(false);
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TargetingSummary({ notice }: { notice: NoticeResponse }) {
  const parts: string[] = [];
  if (notice.targetProgramCodes) parts.push(resolveCodeList(notice.targetProgramCodes, programLabel));
  if (notice.targetInstituteCodes) parts.push(resolveCodeList(notice.targetInstituteCodes, instituteLabel));
  if (notice.targetBatchYears) parts.push(`Batch ${notice.targetBatchYears.split(",").join(", ")}`);
  if (notice.targetAdmissionYears) parts.push(`Admitted ${notice.targetAdmissionYears.split(",").join(", ")}`);

  if (parts.length === 0) {
    return <span className="text-success font-semibold">All Students</span>;
  }

  return <span>{parts.join(" • ")}</span>;
}
