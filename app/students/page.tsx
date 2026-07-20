"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Users } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import Pill from "../components/Pill";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import { fetchStudents, StudentProfile } from "../lib/api";

function statusPill(passedOut: boolean | null) {
  if (passedOut === true) return <Pill color="text-success" colorFaint="bg-success-faint">Pass Out</Pill>;
  if (passedOut === false) return <Pill color="text-primary" colorFaint="bg-primary-faint">Enrolled</Pill>;
  return <Pill color="text-muted" colorFaint="bg-background">Unknown</Pill>;
}

export default function StudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StudentProfile | null>(null);

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

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.enrollmentNo?.toLowerCase().includes(q) ||
        s.programName?.toLowerCase().includes(q) ||
        s.instituteName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [students, search]);

  return (
    <div>
      <PageHeader title="Students" subtitle="All students who have linked their IPU portal account." />

      {/* Stats + Search */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <StatTile value={students.length} label="Students Registered" icon={Users} />

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, enrollment, program…"
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-[14px] bg-surface focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-primary">Student Directory</h2>
          <button
            onClick={load}
            className="text-[13px] font-medium text-primary hover:underline"
          >
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
            message={search.trim() ? "No students match your search." : "No students registered yet."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Enrollment No</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Program</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Batch</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.enrollmentNo}
                    onClick={() => setSelected(s)}
                    className="hover:bg-background transition-colors border-b border-border last:border-b-0 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{s.name || "—"}</div>
                      {s.gender && <div className="text-[11px] text-muted mt-0.5">{s.gender}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{s.enrollmentNo}</td>
                    <td className="px-4 py-3">
                      <div>{s.courseShortName || s.programName || "—"}</div>
                      {s.programCode && <div className="text-[11px] text-muted mt-0.5">Code: {s.programCode}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div>{s.instituteName || "—"}</div>
                      {s.instituteCode && <div className="text-[11px] text-muted mt-0.5">Code: {s.instituteCode}</div>}
                    </td>
                    <td className="px-4 py-3">{s.batchYear || "—"}</td>
                    <td className="px-4 py-3">{statusPill(s.passedOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailDialog
          title={selected.name || selected.enrollmentNo}
          subtitle={selected.enrollmentNo}
          onClose={() => setSelected(null)}
        >
          <div className="mb-4">{statusPill(selected.passedOut)}</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Program" value={selected.courseShortName || selected.programName} />
            <DetailField label="Program Code" value={selected.programCode} />
            <DetailField label="Institute" value={selected.instituteName} />
            <DetailField label="Institute Code" value={selected.instituteCode} />
            <DetailField label="Batch Year" value={selected.batchYear} />
            <DetailField label="Admission Year" value={selected.admissionYear} />
            <DetailField label="Gender" value={selected.gender} />
            <DetailField label="Contact Number" value={selected.contactNumber} />
            <DetailField label="Email" value={selected.email} />
            <DetailField label="Father's Name" value={selected.fatherName} />
            <DetailField label="Mother's Name" value={selected.motherName} />
          </div>
        </DetailDialog>
      )}
    </div>
  );
}
