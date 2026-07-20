"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Megaphone, ExternalLink } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import NoticeForm from "../components/NoticeForm";
import DetailDialog, { DetailField } from "../components/DetailDialog";
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
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<NoticeResponse | null>(null);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchNotices(0, 100, category || undefined, search || undefined);
      setNotices(page.content);
      setTotalCount(page.totalElements);
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
      setSelected(null);
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
      <PageHeader
        title="Notices"
        subtitle="Create, target, and manage published notices."
        action={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            New Notice
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatTile value={totalCount} label="Total Notices" icon={Megaphone} />
        <StatTile value={urgentCount} label="Urgent" color="danger" />
        <StatTile value={newCount} label="New" color="success" />
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
          <EmptyState icon={Megaphone} message="No notices match the current filters." />
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
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => {
                  const cat = categoryTaxonomy(n.category);
                  const badge = n.badge ? badgeTaxonomy(n.badge) : undefined;
                  return (
                    <tr
                      key={n.id}
                      onClick={() => setSelected(n)}
                      className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                    >
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(n.id);
                          }}
                          disabled={deleting === n.id}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-danger border border-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
                          title="Delete notice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <DetailDialog
          title="New Notice"
          subtitle="Create and publish a notice to targeted student groups."
          onClose={() => setShowForm(false)}
        >
          <NoticeForm
            onCreated={() => {
              setShowForm(false);
              load();
            }}
          />
        </DetailDialog>
      )}

      {/* Notice detail dialog */}
      {selected && (() => {
        const cat = categoryTaxonomy(selected.category);
        const badge = selected.badge ? badgeTaxonomy(selected.badge) : undefined;
        return (
          <DetailDialog title={selected.title} subtitle={selected.date} onClose={() => setSelected(null)}>
            <div className="flex items-center gap-2 mb-5">
              {cat && <Pill color={cat.color} colorFaint={cat.colorFaint}>{cat.label}</Pill>}
              {badge && <Pill color={badge.color} colorFaint={badge.colorFaint}>{badge.label}</Pill>}
            </div>
            <DetailField label="Description" value={selected.description} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4">
              <DetailField
                label="Action"
                value={
                  <a
                    href={selected.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {selected.actionText} <ExternalLink className="w-3 h-3" />
                  </a>
                }
              />
              <DetailField label="Type" value={selected.isPdf ? "PDF / File" : "External Link"} />
              <div className="col-span-2">
                <DetailField label="Targeting" value={<TargetingSummary notice={selected} />} />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => handleDelete(selected.id)}
                disabled={deleting === selected.id}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-danger border border-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting === selected.id ? "Deleting…" : "Delete Notice"}
              </button>
            </div>
          </DetailDialog>
        );
      })()}
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
