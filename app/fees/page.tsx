"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Receipt, Search } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import Filter, { SELECT_CLASS } from "../components/Filter";
import FeeSubmissionDialog from "../components/FeeSubmissionDialog";
import FeeStructuresManager from "./FeeStructuresManager";
import {
  fetchFees,
  fetchFeeSummary,
  fetchCourses,
  fetchInstitutes,
  Course,
  FeeRosterRow,
  FeeSummary,
  Institute,
} from "../lib/api";
import { FEE_PAYMENT_STATUS_META, FEE_STATUS_META, FEE_STATUS_OPTIONS, formatAmount } from "../lib/fees";
import { academicYearLabel, academicYearOptions, currentAcademicYear } from "../lib/academicYear";
import {
  BATCH_YEAR_OPTIONS,
  instituteOptionsFrom,
  labelLookup,
  programOptionsFrom,
} from "../lib/noticeTaxonomy";

const PAGE_SIZE = 20;

export default function FeesPage() {
  const { toast } = useToast();

  const [view, setView] = useState<"submissions" | "structures">("submissions");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [instituteCode, setInstituteCode] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [batchYear, setBatchYear] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<FeeRosterRow[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Institutes/courses back the filter dropdowns and the roster's code -> label resolution.
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [institutesData, coursesData] = await Promise.all([fetchInstitutes(), fetchCourses()]);
        setInstitutes(institutesData);
        setCourses(coursesData);
      } catch {
        // Falls back to showing raw codes — non-fatal for the roster itself.
      }
    })();
  }, []);

  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);
  const programOptions = useMemo(
    () => programOptionsFrom(courses, instituteCode ? [instituteCode] : []),
    [courses, instituteCode]
  );
  const programLabel = useMemo(() => labelLookup(programOptionsFrom(courses)), [courses]);

  // Server-side search on a paged endpoint — debounced so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFees(
        { academicYear, instituteCode, programCode, batchYear, status, search },
        page,
        PAGE_SIZE
      );
      setRows(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (err) {
      toast(`Failed to load fee submissions: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, academicYear, instituteCode, programCode, batchYear, status, search, page]);

  // Summary is year-wide and ignores the other filters, so it reloads independently of the roster.
  const loadSummary = useCallback(async () => {
    try {
      setSummary(await fetchFeeSummary(academicYear));
    } catch {
      // The roster load already surfaces a backend outage — don't double-toast.
      setSummary(null);
    }
  }, [academicYear]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const refresh = useCallback(() => {
    load();
    loadSummary();
  }, [load, loadSummary]);

  const share = (count: number | undefined) =>
    summary && summary.total > 0 && count != null
      ? `${Math.round((count / summary.total) * 100)}% of ${summary.total}`
      : undefined;

  return (
    <div>
      <PageHeader
        title="Fee Payments"
        subtitle="Verify annual fee payment proofs and track who still hasn't paid."
        action={
          <div className="inline-flex rounded-lg border border-border bg-background p-1">
            {(["submissions", "structures"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                  view === v ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {v === "submissions" ? "Submissions" : "Fee Structures"}
              </button>
            ))}
          </div>
        }
      />

      {view === "structures" ? (
        <FeeStructuresManager institutes={institutes} courses={courses} />
      ) : (
        <>
      {/* Filters — each change resets the offset, since a page number is meaningless
          against a differently sized result set. */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <Filter label="Academic Year">
            <select
              value={academicYear}
              onChange={(e) => { setAcademicYear(Number(e.target.value)); setPage(0); }}
              className={SELECT_CLASS}
            >
              {academicYearOptions().map((y) => (
                <option key={y} value={y}>{academicYearLabel(y)}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Institute">
            <select
              value={instituteCode}
              onChange={(e) => {
                setInstituteCode(e.target.value);
                setProgramCode("");
                setPage(0);
              }}
              className={SELECT_CLASS}
            >
              <option value="">All Institutes</option>
              {instituteOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Program">
            <select
              value={programCode}
              onChange={(e) => { setProgramCode(e.target.value); setPage(0); }}
              className={SELECT_CLASS}
            >
              <option value="">All Programs</option>
              {programOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Batch">
            <select
              value={batchYear}
              onChange={(e) => { setBatchYear(e.target.value); setPage(0); }}
              className={SELECT_CLASS}
            >
              <option value="">All Batches</option>
              {BATCH_YEAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Status">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(0); }}
              className={SELECT_CLASS}
            >
              <option value="">All Statuses</option>
              {FEE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or enrollment no…"
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatTile value={summary?.paid ?? "—"} label="Paid" color="success" subLabel={share(summary?.paid)} />
        <StatTile value={summary?.pending ?? "—"} label="Pending Review" color="orange" subLabel={share(summary?.pending)} />
        <StatTile value={summary?.rejected ?? "—"} label="Rejected" color="danger" subLabel={share(summary?.rejected)} />
        <StatTile
          value={summary?.notSubmitted ?? "—"}
          label="Not Submitted"
          color="primary"
          icon={Receipt}
          subLabel={share(summary?.notSubmitted)}
        />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-primary">
            {academicYearLabel(academicYear)} Roster
            {!loading && <span className="ml-2 text-[12px] font-normal text-muted">{totalElements}</span>}
          </h2>
          <button onClick={refresh} className="text-[13px] font-medium text-primary hover:underline shrink-0">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Receipt} message="No students match the current filters." />
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
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Payment</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Txns</th>
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
                      <td className="px-4 py-3">
                        {r.paymentStatus ? (
                          <Pill color={FEE_PAYMENT_STATUS_META[r.paymentStatus].color} colorFaint={FEE_PAYMENT_STATUS_META[r.paymentStatus].colorFaint}>
                            {FEE_PAYMENT_STATUS_META[r.paymentStatus].label}
                          </Pill>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{r.transactionCount || "—"}</td>
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
        <FeeSubmissionDialog
          submissionId={selectedId}
          onClose={() => setSelectedId(null)}
          onReviewed={refresh}
        />
      )}
        </>
      )}
    </div>
  );
}
