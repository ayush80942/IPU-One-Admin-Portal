"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Users, FileCheck2, Megaphone, GraduationCap, Landmark, Receipt, ShieldCheck, ArrowRight } from "lucide-react";
import { useToast } from "./components/Toast";
import { useAdminSession } from "./components/AuthGate";
import PageHeader from "./components/PageHeader";
import StatTile from "./components/StatTile";
import Pill from "./components/Pill";
import {
  fetchStudents,
  fetchDocuments,
  fetchCourses,
  fetchNotices,
  StudentProfile,
  DocumentResponse,
  NoticeResponse,
  Course,
} from "./lib/api";
import { categoryTaxonomy } from "./lib/noticeTaxonomy";
import { instituteLabel } from "./lib/auth";

const QUICK_LINKS = [
  { href: "/students", label: "Students", description: "View the registered student directory", icon: Users },
  { href: "/documents", label: "Documents", description: "Review submitted documents", icon: FileCheck2 },
  { href: "/fees", label: "Fee Payments", description: "Verify proofs and chase non-payers", icon: Receipt },
  { href: "/notices", label: "Notices", description: "Publish and manage notices", icon: Megaphone },
  { href: "/courses", label: "Courses", description: "Set course durations", icon: GraduationCap, superOnly: true },
  { href: "/institutes", label: "Institutes", description: "Set institute short names", icon: Landmark, superOnly: true },
  { href: "/admins", label: "Admins", description: "Create student cell accounts", icon: ShieldCheck, superOnly: true },
];

export default function DashboardPage() {
  const { toast } = useToast();
  const session = useAdminSession();
  const isSuper = session?.role === "SUPER_ADMIN";
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentNotices, setRecentNotices] = useState<NoticeResponse[]>([]);
  const [totalNotices, setTotalNotices] = useState(0);
  const [urgentNotices, setUrgentNotices] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsData, documentsData, coursesData, noticesPage, allNoticesPage] = await Promise.all([
        fetchStudents(),
        fetchDocuments(),
        fetchCourses(),
        fetchNotices(0, 5),
        fetchNotices(0, 100),
      ]);
      setStudents(studentsData);
      setDocuments(documentsData);
      setCourses(coursesData);
      setRecentNotices(noticesPage.content);
      setTotalNotices(allNoticesPage.totalElements);
      setUrgentNotices(allNoticesPage.content.filter((n) => n.badge === "URGENT").length);
    } catch (err) {
      toast(`Failed to load dashboard: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const coursesMissingDuration = courses.filter((c) => c.totalSemesters == null).length;

  const recentDocuments = useMemo(
    () =>
      [...documents]
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .slice(0, 5),
    [documents]
  );

  // Grouped on programCode rather than the label, so two courses an admin hasn't given a
  // short name to yet stay separate bars instead of collapsing into one.
  const courseCounts = useMemo(() => {
    const counts = new Map<string, { code: string; label: string; title: string; count: number }>();
    for (const s of students) {
      const key = s.programCode ?? "unknown";
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      counts.set(key, {
        code: key,
        label: s.courseShortName || s.programName || s.programCode || "Unknown",
        title: s.programName || s.courseShortName || s.programCode || "Unknown",
        count: 1,
      });
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [students]);
  const maxCourseCount = courseCounts[0]?.count ?? 1;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          isSuper
            ? "Complete overview of the portal, across every institute."
            : `Overview for ${instituteLabel(session) || "your institute"}. Every figure below counts only your students.`
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatTile value={loading ? "—" : students.length} label="Students" icon={Users} />
        <StatTile value={loading ? "—" : documents.length} label="Documents" icon={FileCheck2} color="info" />
        <StatTile
          value={loading ? "—" : totalNotices}
          label="Notices"
          icon={Megaphone}
          color="violet"
          subLabel={!loading && urgentNotices > 0 ? `${urgentNotices} urgent` : undefined}
        />
        <StatTile
          value={loading ? "—" : courses.length}
          label="Courses"
          icon={GraduationCap}
          color="teal"
          subLabel={!loading && coursesMissingDuration > 0 ? `${coursesMissingDuration} missing duration` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Students by course */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-6">
          <h2 className="text-[15px] font-bold text-primary mb-5">Students by Course</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-6 rounded-lg" />)}
            </div>
          ) : courseCounts.length === 0 ? (
            <p className="text-muted text-[13px]">No student data yet.</p>
          ) : (
            <div className="space-y-3">
              {courseCounts.map((course) => (
                <div key={course.code} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-[12px] text-muted truncate" title={course.title}>{course.label}</div>
                  <div className="flex-1 bg-background rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.max((course.count / maxCourseCount) * 100, 4)}%` }}
                    />
                  </div>
                  <div className="w-8 shrink-0 text-[12px] font-bold text-primary text-right">{course.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUICK_LINKS.filter((link) => isSuper || !link.superOnly).map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="bg-surface border border-border rounded-2xl shadow-sm p-5 hover:border-primary transition-colors group no-underline flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary-faint flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="font-bold text-[14px] text-foreground">{link.label}</div>
                  <div className="text-[12px] text-muted mt-0.5">{link.description}</div>
                </div>
                <div className="flex items-center gap-1 text-[12px] font-semibold text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent notices */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-primary">Recent Notices</h2>
            <Link href="/notices" className="text-[13px] font-medium text-primary hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
            </div>
          ) : recentNotices.length === 0 ? (
            <p className="text-muted text-[13px] p-6">No notices published yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentNotices.map((n) => {
                const cat = categoryTaxonomy(n.category);
                return (
                  <div key={n.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground text-[13.5px] truncate">{n.title}</div>
                      <div className="text-[11px] text-muted mt-0.5">{n.date}</div>
                    </div>
                    {cat && <Pill color={cat.color} colorFaint={cat.colorFaint}>{cat.label}</Pill>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent documents */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-primary">Recent Documents</h2>
            <Link href="/documents" className="text-[13px] font-medium text-primary hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
            </div>
          ) : recentDocuments.length === 0 ? (
            <p className="text-muted text-[13px] p-6">No documents submitted yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentDocuments.map((d) => (
                <div key={d.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground text-[13.5px] truncate">{d.enrollmentNo}</div>
                    <div className="text-[11px] text-muted mt-0.5">{d.documentType.replace(/_/g, " ")}</div>
                  </div>
                  <div className="text-[11px] text-muted shrink-0">{new Date(d.submittedAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
