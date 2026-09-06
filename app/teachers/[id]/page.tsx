"use client";

import { useState, useEffect, useCallback, useMemo, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Landmark, ClipboardList, Star, Users as UsersIcon, AlertTriangle, Pencil } from "lucide-react";
import { useToast } from "../../components/Toast";
import StatTile from "../../components/StatTile";
import Pill from "../../components/Pill";
import EmptyState from "../../components/EmptyState";
import SectionCard from "../../components/SectionCard";
import DetailDialog, { DetailField } from "../../components/DetailDialog";
import {
  fetchTeachers,
  updateTeacher,
  fetchInstitutes,
  fetchFeedbackOfferings,
  fetchFeedbackAnalytics,
  TeacherDto,
  Institute,
  TeachingOfferingDto,
  OfferingAnalyticsDto,
} from "../../lib/api";
import { instituteOptionsFrom } from "../../lib/noticeTaxonomy";
import { teacherLabel } from "../page";

const inputClass = "border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Avatar({ name, size = 72 }: { name: string; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  return (
    <div style={style} className="rounded-full bg-primary-faint text-primary flex items-center justify-center font-bold shrink-0">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function subjectTypeLabel(type: TeachingOfferingDto["subjectType"]) {
  return type === "THEORY" ? "Theory" : "Practical";
}

function OfferingRow({ offering, analytics }: { offering: TeachingOfferingDto; analytics: OfferingAnalyticsDto | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border border-border rounded-xl">
      <div className="min-w-0">
        <div className="font-semibold text-foreground truncate">{offering.subjectName}</div>
        <div className="text-[12px] text-muted mt-0.5">
          {offering.subjectCode} · {subjectTypeLabel(offering.subjectType)}
          {offering.isElective ? " · Elective" : ""} · {offering.academicTerm}
          {offering.semesterNumber ? ` · Sem ${offering.semesterNumber}` : ""} · Batch {offering.batchYear}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {analytics && analytics.responseCount > 0 ? (
          <Pill color="text-violet" colorFaint="bg-violet-faint">
            ★ {analytics.averageRating.toFixed(2)} · {analytics.responseCount} response{analytics.responseCount === 1 ? "" : "s"}
          </Pill>
        ) : (
          <Pill color="text-muted" colorFaint="bg-background">No ratings yet</Pill>
        )}
        {offering.active ? (
          <Pill color="text-success" colorFaint="bg-success-faint">Active</Pill>
        ) : (
          <Pill color="text-muted" colorFaint="bg-background">Retired</Pill>
        )}
      </div>
    </div>
  );
}

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const router = useRouter();

  const [teacher, setTeacher] = useState<TeacherDto | null>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [offerings, setOfferings] = useState<TeachingOfferingDto[]>([]);
  const [analytics, setAnalytics] = useState<OfferingAnalyticsDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [teachers, institutesData] = await Promise.all([fetchTeachers(), fetchInstitutes()]);
      const found = teachers.find((t) => t.id === id);
      if (!found) {
        setLoadError("This teacher doesn't exist, or you don't have access to their institute.");
        return;
      }
      setTeacher(found);
      setInstitutes(institutesData);
      // Best-effort: an institute that hasn't turned on Faculty Feedback simply has no offerings
      // yet, and that's not an error worth surfacing — the section below just renders empty.
      try {
        const [offeringsData, analyticsData] = await Promise.all([fetchFeedbackOfferings(), fetchFeedbackAnalytics()]);
        setOfferings(offeringsData.filter((o) => o.teacherId === id));
        setAnalytics(analyticsData.offerings);
      } catch {
        setOfferings([]);
        setAnalytics([]);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const instituteLabelOf = useMemo(() => {
    const map = new Map(instituteOptionsFrom(institutes).map((o) => [o.value, o.label]));
    return (code: string | null) => (code ? map.get(code) ?? code : null);
  }, [institutes]);

  const analyticsByOfferingId = useMemo(() => new Map(analytics.map((a) => [a.offeringId, a])), [analytics]);

  const ratedOfferings = useMemo(
    () => offerings
      .map((o) => analyticsByOfferingId.get(o.id))
      .filter((a): a is OfferingAnalyticsDto => !!a && a.responseCount > 0),
    [offerings, analyticsByOfferingId]
  );
  const avgRating = ratedOfferings.length > 0
    ? ratedOfferings.reduce((sum, a) => sum + a.averageRating, 0) / ratedOfferings.length
    : null;
  const totalEligible = ratedOfferings.reduce((sum, a) => sum + a.eligibleStudentCount, 0);
  const totalSubmissions = ratedOfferings.reduce((sum, a) => sum + a.submissionCount, 0);
  const participation = totalEligible > 0 ? totalSubmissions / totalEligible : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (loadError || !teacher) {
    return (
      <div className="py-16 text-center">
        <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-3" />
        <p className="text-[14px] text-muted mb-4">Could not load this teacher: {loadError}</p>
        <button onClick={() => router.push("/teachers")} className="text-[13px] font-medium text-primary hover:underline">
          Back to Teachers
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/teachers")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Teachers
      </button>

      {/* Identity header */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-6 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
        <Avatar name={teacher.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{teacherLabel(teacher)}</h1>
            {teacher.active ? (
              <Pill color="text-success" colorFaint="bg-success-faint">Active</Pill>
            ) : (
              <Pill color="text-muted" colorFaint="bg-background">Inactive</Pill>
            )}
          </div>
          <div className="text-[13px] text-muted mt-1">
            {instituteLabelOf(teacher.instituteCode) ?? "No institute"}
            {teacher.facultyCode && <span className="font-mono"> · {teacher.facultyCode}</span>}
          </div>
          <div className="flex items-center justify-center sm:justify-start flex-wrap gap-x-5 gap-y-1.5 mt-3 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{teacher.email}</span>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-primary border border-border hover:bg-primary-faint transition-colors shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile value={offerings.length} label="Teaching Offerings" icon={ClipboardList} />
        <StatTile
          value={avgRating == null ? "—" : avgRating.toFixed(2)}
          label="Average Rating"
          icon={Star}
          color="violet"
        />
        <StatTile
          value={participation == null ? "—" : `${(participation * 100).toFixed(0)}%`}
          label="Participation Rate"
          icon={UsersIcon}
          color="teal"
        />
      </div>

      <div className="space-y-6">
        <SectionCard title="Profile" icon={Landmark}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <DetailField label="Email" value={teacher.email} />
            <DetailField label="Faculty Code" value={teacher.facultyCode} />
            <DetailField label="Institute" value={instituteLabelOf(teacher.instituteCode)} />
            <DetailField label="Institute Code" value={teacher.instituteCode} />
            <DetailField label="Title" value={teacher.title} />
            <DetailField label="Status" value={teacher.active ? "Active" : "Inactive"} />
          </div>
        </SectionCard>

        <SectionCard title="Teaching Offerings" icon={ClipboardList}>
          {offerings.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No teaching offerings recorded for this teacher yet." />
          ) : (
            <div className="space-y-2">
              {offerings.map((o) => (
                <OfferingRow key={o.id} offering={o} analytics={analyticsByOfferingId.get(o.id)} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {editing && (
        <DetailDialog title="Edit Teacher" onClose={() => setEditing(false)}>
          <EditTeacherForm teacher={teacher} onSaved={() => { setEditing(false); load(); }} />
        </DetailDialog>
      )}
    </div>
  );
}

function EditTeacherForm({ teacher, onSaved }: { teacher: TeacherDto; onSaved: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(teacher.name);
  const [title, setTitle] = useState(teacher.title ?? "");
  const [active, setActive] = useState(teacher.active);
  const [facultyCode, setFacultyCode] = useState(teacher.facultyCode ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await updateTeacher(teacher.id, {
        name: name.trim(),
        title: title.trim() || null,
        active,
        facultyCode: facultyCode.trim() || null,
      });
      toast("Teacher updated");
      onSaved();
    } catch (err) {
      toast(`Failed to update teacher: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Institute is set once at creation and isn't editable here — moving a teacher between
          institutes isn't something this form supports; re-add the account under the right
          institute instead. Faculty code, unlike institute, is correctable: an imported row can
          carry the wrong value and there's no other way to fix it after the fact. */}
      <DetailField label="Institute" value={teacher.instituteCode} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dr., Prof." className={inputClass} />
        </Field>
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <Field label="Faculty Code">
        <input value={facultyCode} onChange={(e) => setFacultyCode(e.target.value)} placeholder="Optional" className={inputClass} />
      </Field>

      <label className="flex items-center gap-2 text-[13px] text-foreground">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
        Active — inactive teachers stay in the catalog but drop out of the Feedback teacher picker
      </label>

      <div className="flex justify-end mt-2">
        <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60">
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
