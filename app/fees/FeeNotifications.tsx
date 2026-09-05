"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Bell, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import Filter, { SELECT_CLASS } from "../components/Filter";
import {
  fetchFees,
  fetchFeeReminders,
  sendFeeReminder,
  Course,
  FeeReminderLog,
  Institute,
} from "../lib/api";
import { FEE_STATUS_OPTIONS } from "../lib/fees";
import { academicYearLabel, academicYearOptions, currentAcademicYear } from "../lib/academicYear";
import {
  BATCH_YEAR_OPTIONS,
  instituteOptionsFrom,
  labelLookup,
  programOptionsFrom,
  resolveCodeList,
} from "../lib/noticeTaxonomy";

const ALL = "";
const PAGE_SIZE = 20;

function statusLabel(status: string): string {
  if (status === "ALL") return "All Statuses";
  const meta = FEE_STATUS_OPTIONS.find((o) => o.value === status);
  return meta?.label ?? status;
}

interface FeeNotificationsProps {
  institutes: Institute[];
  courses: Course[];
}

/**
 * Pushes a reminder to every student matching a fee-status filter for one academic year - the
 * admin picks the status (Not Submitted / Pending Review / Rejected / Paid, or "every status")
 * rather than this hardcoding one meaning of "pending", since that's ambiguous. The live match
 * count reuses the existing roster endpoint (fetchFees's totalElements) rather than a new
 * preview endpoint - the send itself resolves the real (unpaginated) target list server-side.
 */
export default function FeeNotifications({ institutes, courses }: FeeNotificationsProps) {
  const { toast } = useToast();

  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [instituteCode, setInstituteCode] = useState(ALL);
  const [programCode, setProgramCode] = useState(ALL);
  const [batchYear, setBatchYear] = useState(ALL);
  const [status, setStatus] = useState<string>("NOT_SUBMITTED");

  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [logs, setLogs] = useState<FeeReminderLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);
  const programOptions = useMemo(
    () => programOptionsFrom(courses, instituteCode ? [instituteCode] : []),
    [courses, instituteCode]
  );
  const instituteLabel = useMemo(() => labelLookup(instituteOptionsFrom(institutes)), [institutes]);
  const programLabel = useMemo(() => labelLookup(programOptionsFrom(courses)), [courses]);

  // Debounced so switching several filters in a row fires one count check, not one per change.
  useEffect(() => {
    const timer = setTimeout(async () => {
      setCountLoading(true);
      try {
        const data = await fetchFees(
          { academicYear, instituteCode, programCode, batchYear, status },
          0,
          1
        );
        setMatchCount(data.totalElements);
      } catch {
        setMatchCount(null);
      } finally {
        setCountLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [academicYear, instituteCode, programCode, batchYear, status]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await fetchFeeReminders(page, PAGE_SIZE);
      setLogs(data.content);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast(`Failed to load sent reminders: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLogsLoading(false);
    }
  }, [toast, page]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const send = async () => {
    if (!matchCount) return;
    if (!confirm(`Send this fee reminder to ${matchCount} student${matchCount === 1 ? "" : "s"}?`)) {
      return;
    }
    setSending(true);
    try {
      const result = await sendFeeReminder({ academicYear, instituteCode, programCode, batchYear: batchYear ? Number(batchYear) : undefined, status });
      toast(`Reminder sent to ${result.targetCount} student${result.targetCount === 1 ? "" : "s"}`, "success");
      setPage(0);
      loadLogs();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send fee reminder", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <Filter label="Academic Year">
            <select value={academicYear} onChange={(e) => setAcademicYear(Number(e.target.value))} className={SELECT_CLASS}>
              {academicYearOptions().map((y) => (
                <option key={y} value={y}>{academicYearLabel(y)}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Institute">
            <select
              value={instituteCode}
              onChange={(e) => { setInstituteCode(e.target.value); setProgramCode(ALL); }}
              className={SELECT_CLASS}
            >
              <option value={ALL}>All Institutes</option>
              {instituteOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Program">
            <select value={programCode} onChange={(e) => setProgramCode(e.target.value)} className={SELECT_CLASS}>
              <option value={ALL}>All Programs</option>
              {programOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Batch">
            <select value={batchYear} onChange={(e) => setBatchYear(e.target.value)} className={SELECT_CLASS}>
              <option value={ALL}>All Batches</option>
              {BATCH_YEAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Fee Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT_CLASS}>
              <option value={ALL}>Every status</option>
              {FEE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
          <span className="text-[13px] text-muted">
            {countLoading
              ? "Checking who matches…"
              : matchCount == null
                ? "Couldn't check how many students match."
                : `${matchCount} student${matchCount === 1 ? "" : "s"} match this filter.`}
          </span>
          <button
            onClick={send}
            disabled={sending || countLoading || !matchCount}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : "Send Reminder"}
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-primary">Sent Reminders</h2>
          <button onClick={loadLogs} className="text-[13px] font-medium text-primary hover:underline shrink-0">
            Refresh
          </button>
        </div>

        {logsLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon={Bell} message="No fee reminders have been sent yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Academic Year</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Program</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Batch</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Sent To</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Sent By</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 tabular-nums">{academicYearLabel(l.academicYear)}</td>
                    <td className="px-4 py-3">{l.instituteCodes ? resolveCodeList(l.instituteCodes, instituteLabel) : "All Institutes"}</td>
                    <td className="px-4 py-3">{l.programCode ? programLabel(l.programCode) : "All Programs"}</td>
                    <td className="px-4 py-3">{l.batchYear ?? "All Batches"}</td>
                    <td className="px-4 py-3">{statusLabel(l.status)}</td>
                    <td className="px-4 py-3 font-semibold">{l.targetCount}</td>
                    <td className="px-4 py-3 text-muted">{l.sentByEmail}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted text-[12px]">
                      {new Date(l.sentAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!logsLoading && totalPages > 1 && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[12px] text-muted">Page {page + 1} of {totalPages}</span>
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
    </div>
  );
}
