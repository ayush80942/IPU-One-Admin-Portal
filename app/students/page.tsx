"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "../components/Toast";
import { fetchStudents, StudentProfile } from "../lib/api";

export default function StudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
      <h1 className="text-2xl font-bold text-primary">Registered Students</h1>
      <p className="text-[14px] text-muted mt-1 mb-7">All students who have linked their IPU portal account.</p>

      {/* Stats + Search */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="bg-surface border border-border rounded-2xl px-5 py-4 shadow-sm">
          <span className="text-2xl font-extrabold text-primary">{students.length}</span>
          <span className="text-[13px] text-muted ml-2">Students Registered</span>
        </div>

        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
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
          <div className="py-16 text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-muted/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <p className="text-muted text-[14px]">
              {search.trim() ? "No students match your search." : "No students registered yet."}
            </p>
          </div>
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
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Email</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.enrollmentNo} className="hover:bg-background transition-colors border-b border-border last:border-b-0">
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
                    <td className="px-4 py-3">
                      {s.passedOut === true ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                          Pass Out
                        </span>
                      ) : s.passedOut === false ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-faint text-primary">
                          Enrolled
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500">
                          Unknown
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px]">{s.email || "—"}</td>
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
