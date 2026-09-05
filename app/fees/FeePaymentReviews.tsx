"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { useToast } from "../components/Toast";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import { SELECT_CLASS } from "../components/Filter";
import FeeSubmissionDialog from "../components/FeeSubmissionDialog";
import { fetchFees, fetchFeeSummary, Course, FeeRosterRow, FeeSummary } from "../lib/api";
import { FEE_STATUS_META, formatAmount } from "../lib/fees";
import { academicYearLabel, academicYearOptions, currentAcademicYear } from "../lib/academicYear";
import { labelLookup, programOptionsFrom } from "../lib/noticeTaxonomy";

const PAGE_SIZE = 20;

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

const STATUS_TABS: { value: ReviewStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

interface FeePaymentReviewsProps {
  courses: Course[];
}

/**
 * A focused review queue for fee-payment proofs - same shape as the Onboarding Requests page
 * (stat tiles, status tabs, click-a-row-to-decide table) since deciding pending submissions is
 * the one workflow they share, unlike Submissions' general filterable roster of every student
 * (paid, pending, rejected and never-submitted alike) meant for browsing/reporting instead.
 */
export default function FeePaymentReviews({ courses }: FeePaymentReviewsProps) {
  const { toast } = useToast();

  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [statusTab, setStatusTab] = useState<ReviewStatus>("PENDING");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<FeeRosterRow[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const programLabel = useMemo(() => labelLookup(programOptionsFrom(courses)), [courses]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFees({ academicYear, status: statusTab }, page, PAGE_SIZE);
      setRows(data.content);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast(`Failed to load fee reviews: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, academicYear, statusTab, page]);

  // Year-wide and status-independent, same as the Submissions tab's summary - reloads whenever
  // the academic year changes, not on every status-tab switch.
  const loadSummary = useCallback(async () => {
    try {
      setSummary(await fetchFeeSummary(academicYear));
    } catch {
      setSummary(null);
    }
  }, [academicYear]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { setPage(0); }, [academicYear, statusTab]);

  const refresh = useCallback(() => {
    load();
    loadSummary();
  }, [load, loadSummary]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile value={summary?.pending ?? "—"} label="Pending" color="orange" icon={ClipboardCheck} />
        <StatTile value={summary?.paid ?? "—"} label="Approved" color="success" />
        <StatTile value={summary?.rejected ?? "—"} label="Rejected" color="danger" />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-border bg-background p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                  statusTab === tab.value ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {academicYearOptions().map((y) => (
                <option key={y} value={y}>{academicYearLabel(y)}</option>
              ))}
            </select>
            <button onClick={refresh} className="text-[13px] font-medium text-primary hover:underline shrink-0">
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardCheck} message="No fee submissions match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Enrollment No</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Program</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Batch</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Total Paid</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = FEE_STATUS_META[r.status];
                  const submissionId = r.submissionId;
                  const open = submissionId == null ? undefined : () => setSelectedId(submissionId);
                  return (
                    <tr
                      key={r.enrollmentNo}
                      onClick={open}
                      onKeyDown={
                        open
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                open();
                              }
                            }
                          : undefined
                      }
                      tabIndex={open ? 0 : undefined}
                      role={open ? "button" : undefined}
                      aria-label={open ? `Review fee submission for ${r.name || r.enrollmentNo}` : undefined}
                      className={`transition-colors border-b border-border last:border-b-0 ${
                        open
                          ? "hover:bg-background cursor-pointer focus:outline-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-[13px]">{r.enrollmentNo}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{r.name || "—"}</td>
                      <td className="px-4 py-3">{r.programCode ? programLabel(r.programCode) : "—"}</td>
                      <td className="px-4 py-3">{r.batchYear ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Pill color={meta.color} colorFaint={meta.colorFaint}>{meta.label}</Pill>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatAmount(r.totalAmount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted text-[12px]">
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[12px] text-muted">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-medium text-primary border border-border hover:bg-primary-faint transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page + 1 >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-medium text-primary border border-border hover:bg-primary-faint transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedId != null && (
        <FeeSubmissionDialog submissionId={selectedId} onClose={() => setSelectedId(null)} onReviewed={refresh} />
      )}
    </>
  );
}
