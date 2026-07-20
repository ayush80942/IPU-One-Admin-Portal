"use client";

import { useState, useEffect, useCallback } from "react";
import { GraduationCap } from "lucide-react";
import { useToast } from "../components/Toast";
import PageHeader from "../components/PageHeader";
import StatTile from "../components/StatTile";
import EmptyState from "../components/EmptyState";
import DetailDialog, { DetailField } from "../components/DetailDialog";
import { fetchCourses, updateCourse, Course } from "../lib/api";

export default function CoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Course | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCourses();
      setCourses(data);
    } catch (err) {
      toast(`Failed to load courses: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const unconfirmedCount = courses.filter((c) => !c.confirmed).length;

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle={`Program duration is guessed automatically from the degree name on first import — review and correct it here. This drives each student's "Pass Out" status.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatTile value={courses.length} label="Total Courses" icon={GraduationCap} />
        <StatTile value={unconfirmedCount} label="Awaiting Review" color="danger" />
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-primary">All Courses</h2>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState icon={GraduationCap} message="No courses yet — they're created automatically as students import results." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-primary-faint">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Program</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Short Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Total Semesters</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide">Reviewed</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-primary uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <CourseRow
                    key={course.programCode}
                    course={course}
                    onExpand={setSelected}
                    onSaved={(updated) =>
                      setCourses((prev) => prev.map((c) => (c.programCode === updated.programCode ? updated : c)))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailDialog
          title={selected.programName}
          subtitle={`Code: ${selected.programCode}`}
          onClose={() => setSelected(null)}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Institute" value={selected.instituteName} />
            <DetailField label="Institute Code" value={selected.instituteCode} />
            <DetailField label="Short Name" value={selected.shortName} />
            <DetailField label="Total Semesters" value={selected.totalSemesters} />
            <DetailField label="Reviewed" value={selected.confirmed ? "Yes" : "No"} />
            <DetailField label="Created" value={new Date(selected.createdAt).toLocaleString()} />
            <DetailField label="Last Updated" value={new Date(selected.updatedAt).toLocaleString()} />
          </div>
        </DetailDialog>
      )}
    </div>
  );
}

function CourseRow({
  course,
  onExpand,
  onSaved,
}: {
  course: Course;
  onExpand: (course: Course) => void;
  onSaved: (updated: Course) => void;
}) {
  const { toast } = useToast();
  const [shortName, setShortName] = useState(course.shortName ?? "");
  const [totalSemesters, setTotalSemesters] = useState(course.totalSemesters?.toString() ?? "");
  const [confirmed, setConfirmed] = useState(course.confirmed);
  const [saving, setSaving] = useState(false);

  const dirty =
    shortName !== (course.shortName ?? "") ||
    totalSemesters !== (course.totalSemesters?.toString() ?? "") ||
    confirmed !== course.confirmed;

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateCourse(course.programCode, {
        shortName: shortName.trim() === "" ? null : shortName.trim(),
        totalSemesters: totalSemesters.trim() === "" ? null : Number(totalSemesters),
        confirmed,
      });
      onSaved(updated);
      toast("Course updated", "success");
    } catch (err) {
      toast(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-background transition-colors border-b border-border last:border-b-0">
      <td
        className="px-4 py-3 cursor-pointer group"
        onClick={() => onExpand(course)}
      >
        <div className="font-semibold group-hover:text-primary group-hover:underline">{course.programName}</div>
        <div className="text-[11px] text-muted mt-0.5">Code: {course.programCode}</div>
      </td>
      <td className="px-4 py-3 text-[12px] text-muted">{course.instituteName || "—"}</td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          placeholder="e.g. B.Tech AI&DS"
          className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={1}
          value={totalSemesters}
          onChange={(e) => setTotalSemesters(e.target.value)}
          placeholder="—"
          className="w-20 px-2.5 py-1.5 border border-border rounded-lg text-[13px] bg-surface focus:outline-none focus:border-primary"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 accent-primary"
        />
      </td>
      <td className="px-4 py-3">
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </td>
    </tr>
  );
}
