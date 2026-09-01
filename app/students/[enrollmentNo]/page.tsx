"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Layers,
  AlertTriangle,
  Receipt,
  FileCheck2,
  Mail,
  Phone,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "../../components/Toast";
import { useIsSuperAdmin } from "../../components/AuthGate";
import StatTile from "../../components/StatTile";
import Pill from "../../components/Pill";
import EmptyState from "../../components/EmptyState";
import { DetailField } from "../../components/DetailDialog";
import { AuthedImage } from "../../components/AuthedFile";
import FeeSubmissionDialog from "../../components/FeeSubmissionDialog";
import {
  fetchStudentDetail,
  overrideSubjectCredits,
  setStudentAlumniStatus,
  StudentDetail,
  SemesterResult,
  SubjectResult,
  DocumentResponse,
  FeeSubmissionDetail,
} from "../../lib/api";
import { calculateYearAndSem, academicYearLabel } from "../../lib/academicYear";
import { FEE_STATUS_META, formatAmount } from "../../lib/fees";
import { categoryLabel, subCategoryLabel } from "../../lib/studentTaxonomy";

function photoSrc(profileImage: string | null): string | null {
  if (!profileImage) return null;
  if (profileImage.startsWith("data:")) return profileImage;
  return `data:image/jpeg;base64,${profileImage}`;
}

function Avatar({ profileImage, name, size = 88 }: { profileImage: string | null; name: string | null; size?: number }) {
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

function SectionCard({ title, icon: Icon, action, children }: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-primary flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function gradeColor(status: string | null) {
  if (status && status.toUpperCase() === "FAIL") return { color: "text-danger", colorFaint: "bg-danger-faint" };
  return { color: "text-success", colorFaint: "bg-success-faint" };
}

function SemesterRow({
  semester,
  subjects,
  enrollmentNo,
  canOverrideCredits,
  onChanged,
}: {
  semester: SemesterResult;
  subjects: StudentDetail["results"]["subjects"][string] | undefined;
  enrollmentNo: string;
  canOverrideCredits: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectResult | null>(null);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 bg-background hover:bg-primary-faint/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[13px] font-bold text-foreground">Semester {semester.semester}</span>
          <Pill color="text-primary" colorFaint="bg-primary-faint">SGPA {semester.sgpa?.toFixed(2) ?? "—"}</Pill>
          <span className="text-[12px] text-muted">{semester.credits} credits</span>
          {semester.backlogs > 0 && (
            <Pill color="text-danger" colorFaint="bg-danger-faint">{semester.backlogs} backlog{semester.backlogs === 1 ? "" : "s"}</Pill>
          )}
          {semester.creditsIncomplete && (
            <Pill color="text-orange" colorFaint="bg-orange-faint">Credit mapping missing</Pill>
          )}
        </div>
        <span className="text-[11px] text-muted">
          {semester.declaredDate ? new Date(semester.declaredDate).toLocaleDateString() : "—"}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-2 text-left text-[10px] font-bold text-muted uppercase tracking-wide">Paper Code</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold text-muted uppercase tracking-wide">Subject</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-muted uppercase tracking-wide">Credits</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-muted uppercase tracking-wide">Marks</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold text-muted uppercase tracking-wide">Grade</th>
              </tr>
            </thead>
            <tbody>
              {(subjects ?? []).map((s, i) => {
                const g = gradeColor(s.status);
                return (
                  <tr key={`${s.paperCode}-${i}`} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 font-mono">{s.paperCode}</td>
                    <td className="px-4 py-2">{s.subjectName || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {s.credits ?? "—"}
                        {canOverrideCredits && (
                          <button
                            onClick={() => setEditing(s)}
                            title="Fix this subject's credits — affects only this student"
                            className="text-[10px] font-semibold text-primary hover:underline"
                          >
                            fix
                          </button>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.totalMarks ?? "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <Pill color={g.color} colorFaint={g.colorFaint}>{s.grade || s.status || "—"}</Pill>
                        {s.reappeared && (
                          <Pill color="text-muted" colorFaint="bg-foreground/10">Reappear</Pill>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <SubjectCreditOverrideDialog
          enrollmentNo={enrollmentNo}
          semester={semester.semester}
          subject={editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

/**
 * Hand-corrects one subject's credits for this student only — see overrideSubjectCredits's
 * Javadoc-equivalent comment in lib/api.ts. Used for a paper code that means two different
 * subjects across students in a way a shared credit rule or scheme-era override can't safely
 * express; the fix touches exactly this one row and nothing else.
 */
function SubjectCreditOverrideDialog({
  enrollmentNo,
  semester,
  subject,
  onClose,
  onDone,
}: {
  enrollmentNo: string;
  semester: number;
  subject: SubjectResult;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [credits, setCredits] = useState(String(subject.credits ?? 0));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = Number(credits);
    if (!Number.isInteger(n) || n < 0 || n > 50) {
      toast("Credits must be a whole number between 0 and 50", "error");
      return;
    }
    setSaving(true);
    try {
      const result = await overrideSubjectCredits(enrollmentNo, semester, subject.paperCode, n, reason);
      toast(`${subject.paperCode}: ${result.oldCredits} → ${result.newCredits} credits`, "success");
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-bold text-primary mb-1">Fix credits — {subject.paperCode}</h3>
        <p className="text-[12px] text-muted mb-4">{subject.subjectName || "—"} · Semester {semester}</p>

        <label className="block text-[12px] font-semibold text-muted mb-1">Credits</label>
        <input
          type="number"
          min={0}
          max={50}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] mb-3 bg-background"
        />

        <label className="block text-[12px] font-semibold text-muted mb-1">Reason (optional, kept in the server log)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] mb-4 bg-background"
        />

        <p className="text-[11px] text-muted mb-4">
          Changes only this student&apos;s {subject.paperCode} in semester {semester} and recomputes
          this semester&apos;s SGPA. Shared credit rules, overrides, and every other student are
          untouched — permanently, including on this student&apos;s next re-import.
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-[13px] font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function typeLabel(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function DocumentCard({ doc, onOpen }: { doc: DocumentResponse; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left border border-border rounded-xl overflow-hidden hover:border-primary transition-colors"
    >
      <div className="h-32 bg-background">
        <AuthedImage fileUrl={doc.fileUrl} alt={typeLabel(doc.documentType)} className="w-full h-32 object-cover" />
      </div>
      <div className="p-3">
        <div className="text-[12.5px] font-semibold text-foreground">{typeLabel(doc.documentType)}</div>
        <div className="text-[11px] text-muted mt-0.5">
          {[doc.semester && `Sem ${doc.semester}`, doc.examType, doc.nocDuration].filter(Boolean).join(" • ") || "—"}
        </div>
        <div className="text-[10.5px] text-muted/70 mt-1">{new Date(doc.submittedAt).toLocaleDateString()}</div>
      </div>
    </button>
  );
}

function FeeRow({ submission, onOpen }: { submission: FeeSubmissionDetail; onOpen: () => void }) {
  const status = FEE_STATUS_META[submission.status];
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center justify-between gap-4 px-4 py-3 border border-border rounded-xl hover:border-primary transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-bold text-foreground">
          {submission.label || academicYearLabel(submission.academicYear)}
        </span>
        <Pill color={status.color} colorFaint={status.colorFaint}>{status.label}</Pill>
      </div>
      <div className="flex items-center gap-3 text-[12px] text-muted">
        <span>{submission.transactionCount} transaction{submission.transactionCount === 1 ? "" : "s"}</span>
        <span className="font-semibold text-foreground">{formatAmount(submission.totalAmount)}</span>
      </div>
    </button>
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ enrollmentNo: string }>();
  const enrollmentNo = decodeURIComponent(params.enrollmentNo);
  const router = useRouter();
  const { toast } = useToast();
  const isSuperAdmin = useIsSuperAdmin();

  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentResponse | null>(null);
  const [selectedFeeId, setSelectedFeeId] = useState<number | null>(null);
  const [savingAlumni, setSavingAlumni] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDetail(await fetchStudentDetail(enrollmentNo));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [enrollmentNo]);

  useEffect(() => { load(); }, [load]);

  const yearSem = useMemo(
    () => (detail ? calculateYearAndSem(detail.profile.batchYear) : null),
    [detail]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="py-16 text-center">
        <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-3" />
        <p className="text-[14px] text-muted mb-4">Could not load this student: {loadError}</p>
        <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

  const { profile, results, documents, feeSubmissions } = detail;
  const currentFee = feeSubmissions[0] ?? null;
  const currentFeeStatus = currentFee ? FEE_STATUS_META[currentFee.status] : FEE_STATUS_META.NOT_SUBMITTED;

  const toggleAlumni = async () => {
    setSavingAlumni(true);
    try {
      await setStudentAlumniStatus(enrollmentNo, !profile.alumniStatus);
      toast(profile.alumniStatus ? "Moved back to Students" : "Marked as Alumni", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update alumni status", "error");
    } finally {
      setSavingAlumni(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => router.push("/students")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Students
      </button>

      {/* Identity header */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-6 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
        <Avatar profileImage={profile.profileImage} name={profile.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{profile.name || "—"}</h1>
            {profile.alumniStatus ? (
              <Pill color="text-teal" colorFaint="bg-teal-faint">Alumni</Pill>
            ) : (
              <>
                {profile.passedOut === true && <Pill color="text-success" colorFaint="bg-success-faint">Passed Out</Pill>}
                {yearSem && profile.passedOut !== true && <Pill color="text-primary" colorFaint="bg-primary-faint">{yearSem}</Pill>}
              </>
            )}
          </div>
          <div className="text-[13px] font-mono text-muted mt-1">{profile.enrollmentNo}</div>
          <div className="text-[13px] text-muted mt-1">
            {profile.courseShortName || profile.programName || "—"}
            {" · "}
            {profile.instituteShortName || profile.instituteName || "—"}
          </div>
          {(profile.alumniStatus || profile.passedOut === true) && (
            <button
              onClick={toggleAlumni}
              disabled={savingAlumni}
              className={
                profile.alumniStatus
                  ? "mt-3 text-[12.5px] font-semibold text-muted hover:text-primary transition-colors disabled:opacity-50"
                  : "mt-3 px-3 py-1.5 rounded-lg bg-teal text-white text-[12.5px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              }
            >
              {savingAlumni ? "Saving…" : profile.alumniStatus ? "Move back to Students" : "Mark as Alumni"}
            </button>
          )}
          <div className="flex items-center justify-center sm:justify-start flex-wrap gap-x-5 gap-y-1.5 mt-3 text-[12.5px] text-muted">
            {profile.contactNumber && (
              <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{profile.contactNumber}</span>
            )}
            {profile.email && (
              <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{profile.email}</span>
            )}
            {(profile.fatherName || profile.motherName) && (
              <span className="inline-flex items-center gap-1.5">
                <UsersIcon className="w-3.5 h-3.5" />
                {[profile.fatherName, profile.motherName].filter(Boolean).join(" / ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatTile
          value={results.overall?.cgpa?.toFixed(2) ?? "—"}
          label="CGPA"
          icon={GraduationCap}
          color={results.overall?.creditMappingIncomplete ? "orange" : "primary"}
          subLabel={
            results.overall?.creditMappingIncomplete
              ? "Blocked by missing credit mapping — see Credits page"
              : undefined
          }
        />
        <StatTile value={results.overall?.totalCredits ?? 0} label="Total Credits" color="teal" icon={Layers} />
        <StatTile
          value={results.overall?.backlogs ?? 0}
          label="Backlogs"
          color={(results.overall?.backlogs ?? 0) > 0 ? "danger" : "success"}
          icon={AlertTriangle}
        />
        <StatTile
          value={currentFeeStatus.label}
          label={currentFee ? `Fee — ${currentFee.label || academicYearLabel(currentFee.academicYear)}` : "Latest Fee Status"}
          color={currentFee?.status === "APPROVED" ? "success" : currentFee?.status === "REJECTED" ? "danger" : "orange"}
          icon={Receipt}
        />
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <SectionCard title="Profile" icon={UsersIcon}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <DetailField label="Program" value={profile.courseShortName || profile.programName} />
            <DetailField label="Program Code" value={profile.programCode} />
            <DetailField label="Institute" value={profile.instituteShortName || profile.instituteName} />
            <DetailField label="Institute Code" value={profile.instituteCode} />
            <DetailField label="Batch Year" value={profile.batchYear} />
            <DetailField label="Admission Year" value={profile.admissionYear} />
            <DetailField label="Gender" value={profile.gender} />
            <DetailField label="Contact Number" value={profile.contactNumber} />
            <DetailField label="Email" value={profile.email} />
            <DetailField label="Father's Name" value={profile.fatherName} />
            <DetailField label="Mother's Name" value={profile.motherName} />
            <DetailField label="Category" value={categoryLabel(profile.category)} />
            <DetailField label="Sub Category" value={subCategoryLabel(profile.subCategory)} />
          </div>
        </SectionCard>

        {/* Results */}
        <SectionCard
          title="Academic Results"
          icon={GraduationCap}
          action={
            results.overall?.creditMappingIncomplete ? (
              <Link
                href="/credits"
                className="text-[12px] font-semibold text-orange hover:underline"
              >
                Fix missing credit mapping →
              </Link>
            ) : undefined
          }
        >
          {results.semesters.length === 0 ? (
            <EmptyState icon={GraduationCap} message="No results imported yet." />
          ) : (
            <div className="space-y-2">
              {results.semesters.map((sem) => (
                <SemesterRow
                  key={sem.semester}
                  semester={sem}
                  subjects={results.subjects[String(sem.semester)]}
                  enrollmentNo={enrollmentNo}
                  canOverrideCredits={isSuperAdmin}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Documents */}
        <SectionCard title="Documents" icon={FileCheck2}>
          {documents.length === 0 ? (
            <EmptyState icon={FileCheck2} message="No documents submitted yet." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {documents.map((d) => (
                <DocumentCard key={d.id} doc={d} onOpen={() => setSelectedDoc(d)} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Fees */}
        <SectionCard title="Fee History" icon={Receipt}>
          {feeSubmissions.length === 0 ? (
            <EmptyState icon={Receipt} message="No fee submissions yet." />
          ) : (
            <div className="space-y-2">
              {feeSubmissions.map((f) => (
                <FeeRow key={f.id} submission={f} onOpen={() => setSelectedFeeId(f.id)} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div className="bg-surface rounded-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-primary mb-1">{typeLabel(selectedDoc.documentType)}</h2>
            <p className="text-[12.5px] text-muted mb-4">
              {[selectedDoc.semester && `Sem ${selectedDoc.semester}`, selectedDoc.examType, selectedDoc.nocDuration]
                .filter(Boolean).join(" • ") || "Submitted document"}
            </p>
            <AuthedDocPreview doc={selectedDoc} />
            <button
              onClick={() => setSelectedDoc(null)}
              className="mt-4 w-full py-2 rounded-lg text-[13px] font-semibold text-muted border border-border hover:bg-background transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {selectedFeeId != null && (
        <FeeSubmissionDialog
          submissionId={selectedFeeId}
          onClose={() => setSelectedFeeId(null)}
          onReviewed={() => { setSelectedFeeId(null); load(); toast("Fee status updated"); }}
        />
      )}
    </div>
  );
}

function AuthedDocPreview({ doc }: { doc: DocumentResponse }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border bg-background">
      <AuthedImage
        fileUrl={doc.fileUrl}
        alt={typeLabel(doc.documentType)}
        className="w-full max-h-[60vh] object-contain"
        fallbackClassName="w-full h-48 flex items-center justify-center"
      />
    </div>
  );
}
