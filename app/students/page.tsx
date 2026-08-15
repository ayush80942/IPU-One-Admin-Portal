"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, GraduationCap, CircleCheck, X, ChevronRight } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import Filter, { SELECT_CLASS } from "../components/Filter";
import { fetchStudents, StudentProfile } from "../lib/api";
import { calculateYearAndSem } from "../lib/academicYear";

// "" is the all-pass value for every filter, so an empty string never means "unset but active".
const ALL = "";

const STATUS_OPTIONS = [
  { value: "ongoing", label: "Ongoing" },
  { value: "passed", label: "Passed Out" },
  { value: "unknown", label: "Unknown" },
];

function yearSemPill(passedOut: boolean | null, batchYear: number | null) {
  if (passedOut === true) return <Pill color="text-success" colorFaint="bg-success-faint">Pass Out</Pill>;
  const yearSem = calculateYearAndSem(batchYear);
  return <Pill color="text-primary" colorFaint="bg-primary-faint">{yearSem || "—"}</Pill>;
}

// The portal returns raw base64 (sometimes already prefixed as a data URL) — normalize to a data URL for <img>.
function photoSrc(profileImage: string | null): string | null {
  if (!profileImage) return null;
  if (profileImage.startsWith("data:")) return profileImage;
  return `data:image/jpeg;base64,${profileImage}`;
}

function Avatar({ profileImage, name, size = 38 }: { profileImage: string | null; name: string | null; size?: number }) {
  const src = photoSrc(profileImage);
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || "Student"}
        style={style}
        className="rounded-full object-cover border border-border shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.4 }}
      className="rounded-full bg-primary-faint text-primary flex items-center justify-center font-bold shrink-0"
    >
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

// A dismissable summary of what's currently narrowing the table, so an unexpectedly short
// list is never a mystery — the usual cause is a filter left set from an earlier search.
function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-primary-faint text-primary text-[11px] font-semibold hover:bg-primary/10 transition-colors"
    >
      {label}
      <X className="w-3 h-3" />
    </button>
  );
}

export default function StudentsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [instituteCode, setInstituteCode] = useState(ALL);
  const [programCode, setProgramCode] = useState(ALL);
  const [batchYear, setBatchYear] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStudents();
      setStudents(data);
    } catch (err) {
      toast(`Failed to load students: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Options come from the loaded students rather than the courses/institutes endpoints, so the
  // dropdowns can only ever offer a value that some row actually has - no dead-end filters.
  const instituteOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      if (s.instituteCode) map.set(s.instituteCode, s.instituteShortName || s.instituteName || s.instituteCode);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [students]);

  // Narrowed by the chosen institute, mirroring how the Fees page chains the two.
  const programOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      if (instituteCode && s.instituteCode !== instituteCode) continue;
      if (s.programCode) map.set(s.programCode, s.courseShortName || s.programName || s.programCode);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [students, instituteCode]);

  const batchOptions = useMemo(() => {
    const years = new Set<number>();
    for (const s of students) if (s.batchYear != null) years.add(s.batchYear);
    return [...years].sort((a, b) => b - a);
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (instituteCode && s.instituteCode !== instituteCode) return false;
      if (programCode && s.programCode !== programCode) return false;
      if (batchYear && String(s.batchYear ?? "") !== batchYear) return false;
      if (status === "passed" && s.passedOut !== true) return false;
      if (status === "ongoing" && s.passedOut !== false) return false;
      if (status === "unknown" && s.passedOut !== null) return false;
      if (!q) return true;
      return (
        s.name?.toLowerCase().includes(q) ||
        s.enrollmentNo?.toLowerCase().includes(q) ||
        s.programName?.toLowerCase().includes(q) ||
        s.courseShortName?.toLowerCase().includes(q) ||
        s.instituteName?.toLowerCase().includes(q) ||
        s.instituteShortName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    });
  }, [students, search, instituteCode, programCode, batchYear, status]);

  const passedOutCount = useMemo(() => students.filter((s) => s.passedOut === true).length, [students]);
  const ongoingCount = useMemo(() => students.filter((s) => s.passedOut === false).length, [students]);
  const courseCount = useMemo(
    () => new Set(students.map((s) => s.programCode).filter(Boolean)).size,
    [students]
  );

  const activeFilters = [
    instituteCode && {
      label: instituteOptions.find((o) => o.value === instituteCode)?.label ?? instituteCode,
      clear: () => setInstituteCode(ALL),
    },
    programCode && {
      label: programOptions.find((o) => o.value === programCode)?.label ?? programCode,
      clear: () => setProgramCode(ALL),
    },
    batchYear && { label: `Batch ${batchYear}`, clear: () => setBatchYear(ALL) },
    status && {
      label: STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status,
      clear: () => setStatus(ALL),
    },
    search.trim() && { label: `"${search.trim()}"`, clear: () => setSearch("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setInstituteCode(ALL);
    setProgramCode(ALL);
    setBatchYear(ALL);
    setStatus(ALL);
    setSearch("");
  };

  return (
    <div>
      <PageHeader title="Students" subtitle="All students who have linked their IPU portal account." />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatTile value={loading ? "—" : students.length} label="Students Registered" icon={Users} />
        <StatTile value={loading ? "—" : ongoingCount} label="Currently Studying" color="info" />
        <StatTile value={loading ? "—" : passedOutCount} label="Passed Out" color="success" icon={CircleCheck} />
        <StatTile value={loading ? "—" : courseCount} label="Courses Represented" color="teal" icon={GraduationCap} />
      </div>

      {/* Filters — institute narrows the program list, so clearing it also clears the program
          to avoid a stale pair that matches nothing. */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
              {batchOptions.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT_CLASS}>
              <option value={ALL}>All Statuses</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Filter>
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, enrollment, program…"
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {activeFilters.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            {activeFilters.map((f) => (
              <ActiveFilterChip key={f.label} label={f.label} onClear={f.clear} />
            ))}
            <button onClick={clearAll} className="text-[11px] font-semibold text-muted hover:text-primary transition-colors ml-1">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-primary">
            Student Directory
            {!loading && (
              <span className="ml-2 text-[12px] font-normal text-muted">
                {activeFilters.length > 0 ? `${filtered.length} of ${students.length}` : students.length}
              </span>
            )}
          </h2>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline shrink-0">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            message={
              activeFilters.length > 0
                ? "No students match the current filters."
                : "No students registered yet."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint sticky top-0 z-10">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Enrollment No</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Program</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Batch</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Year &amp; Sem</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.enrollmentNo}
                    onClick={() => router.push(`/students/${encodeURIComponent(s.enrollmentNo)}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/students/${encodeURIComponent(s.enrollmentNo)}`);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${s.name || s.enrollmentNo}`}
                    className="group hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer focus:outline-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar profileImage={s.profileImage} name={s.name} />
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{s.name || "—"}</div>
                          {s.email && (
                            <div className="text-[11px] text-muted mt-0.5 truncate max-w-[220px]" title={s.email}>
                              {s.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{s.enrollmentNo}</td>
                    <td className="px-4 py-3" title={s.programName || undefined}>
                      {s.courseShortName || s.programName || "—"}
                    </td>
                    <td className="px-4 py-3" title={s.instituteName || undefined}>
                      {s.instituteShortName || s.instituteName || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{s.batchYear || "—"}</td>
                    <td className="px-4 py-3">{yearSemPill(s.passedOut, s.batchYear)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-muted/40 group-hover:text-primary transition-colors" />
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
