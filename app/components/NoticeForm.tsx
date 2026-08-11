"use client";

import { useState, useEffect, useMemo, FormEvent, ChangeEvent } from "react";
import { Upload, X, FileText } from "lucide-react";
import MultiSelect from "./MultiSelect";
import { useToast } from "./Toast";
import { useAdminSession } from "./AuthGate";
import {
  createNotice,
  fetchInstitutes,
  fetchCourses,
  uploadNoticeAttachment,
  NoticeRequest,
  NoticeAttachmentResponse,
  Institute,
  Course,
} from "../lib/api";
import {
  CATEGORIES,
  BADGES,
  BATCH_YEAR_OPTIONS,
  instituteOptionsFrom,
  programOptionsFrom,
  NoticeCategoryValue,
  NoticeBadgeValue,
} from "../lib/noticeTaxonomy";

interface NoticeFormProps {
  onCreated: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Used both to live-fill the field right after a successful upload and as a last-resort
// default at submit time, so "Action Button Text" never has to block publishing.
function fallbackActionText(isPdf: boolean, uploadedFile: NoticeAttachmentResponse | null): string {
  if (isPdf && uploadedFile?.originalFilename) {
    return uploadedFile.originalFilename.replace(/\.[^.]+$/, "");
  }
  return isPdf ? "View Attachment" : "View Details";
}

export default function NoticeForm({ onCreated }: NoticeFormProps) {
  const { toast } = useToast();
  const session = useAdminSession();
  const [submitting, setSubmitting] = useState(false);

  // An institute admin's notices always go to their own institutes - the backend overwrites the
  // target regardless of what is sent, so the picker is shown locked rather than editable and
  // silently ignored.
  const lockedInstitutes = session && session.role !== "SUPER_ADMIN"
    ? session.institutes.map((i) => i.instituteCode)
    : null;

  // Institutes/courses back the Institutes and Programs pickers below — fetched once so
  // targeting always reflects real, current data instead of a hardcoded guess.
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [institutesData, coursesData] = await Promise.all([fetchInstitutes(), fetchCourses()]);
        setInstitutes(institutesData);
        setCourses(coursesData);
      } catch (err) {
        toast(`Failed to load institutes/programs: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
      } finally {
        setLoadingTargets(false);
      }
    })();
  }, [toast]);

  // Form state
  const [category, setCategory] = useState<NoticeCategoryValue>("EXAM");
  const [badge, setBadge] = useState<NoticeBadgeValue | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionText, setActionText] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<NoticeAttachmentResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [programCodes, setProgramCodes] = useState<string[]>([]);
  const [instituteCodes, setInstituteCodes] = useState<string[]>(lockedInstitutes ?? []);
  const [batchYears, setBatchYears] = useState<string[]>([]);

  const instituteOptions = useMemo(() => instituteOptionsFrom(institutes), [institutes]);
  const programOptions = useMemo(() => programOptionsFrom(courses, instituteCodes), [courses, instituteCodes]);

  // Selected institutes narrow which programs are shown — drop any selected program that
  // no longer belongs to one of the currently selected institutes.
  useEffect(() => {
    setProgramCodes((prev) => prev.filter((code) => programOptions.some((o) => o.value === code)));
  }, [programOptions]);

  const resetForm = () => {
    setCategory("EXAM");
    setBadge("");
    setTitle("");
    setDescription("");
    setActionText("");
    setActionUrl("");
    setIsPdf(false);
    setUploadedFile(null);
    setProgramCodes([]);
    setInstituteCodes(lockedInstitutes ?? []);
    setBatchYears([]);
  };

  // External Link and PDF/File modes don't share a meaningful actionUrl — switching
  // clears both the URL and any uploaded file rather than carrying over a stale value.
  const switchLinkType = (nextIsPdf: boolean) => {
    if (nextIsPdf === isPdf) return;
    setIsPdf(nextIsPdf);
    setUploadedFile(null);
    setActionUrl("");
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after clearing
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadNoticeAttachment(file);
      setUploadedFile(result);
      setActionUrl(result.url);
      if (!actionText.trim()) {
        setActionText(fallbackActionText(true, result));
      }
    } catch (err) {
      toast(`Failed to upload file: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setUploading(false);
    }
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setActionUrl("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast("Please fill all required fields", "error");
      return;
    }
    if (!actionUrl.trim()) {
      toast(isPdf ? "Please upload a file" : "Please enter a redirect URL", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload: NoticeRequest = {
        category,
        badge: badge || null,
        title: title.trim(),
        description: description.trim(),
        actionText: actionText.trim() || fallbackActionText(isPdf, uploadedFile),
        actionUrl: actionUrl.trim(),
        isPdf,
        targetProgramCodes: programCodes.length > 0 ? programCodes.join(",") : null,
        targetInstituteCodes: instituteCodes.length > 0 ? instituteCodes.join(",") : null,
        targetBatchYears: batchYears.length > 0 ? batchYears.join(",") : null,
        targetAdmissionYears: null,
      };
      await createNotice(payload);
      toast("✓ Notice published successfully!");
      resetForm();
      onCreated();
    } catch (err) {
      toast(`Failed to publish: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ===== NOTICE CONTENT ===== */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-[15px] font-bold text-primary mb-5 pb-3 border-b border-border">
          Notice Content
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Category dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NoticeCategoryValue)}
              className="border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Badge dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Badge
            </label>
            <select
              value={badge}
              onChange={(e) => setBadge(e.target.value as NoticeBadgeValue | "")}
              className="border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">None</option>
              {BADGES.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5 col-span-2">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. End Term Examination Schedule — December 2025"
              className="border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5 col-span-2">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of the notice shown on the card…"
              rows={3}
              className="border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors resize-y"
            />
          </div>
        </div>
      </div>

      {/* ===== ATTACHMENT / LINK ===== */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-[15px] font-bold text-primary mb-5 pb-3 border-b border-border">
          Attachment / Link
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Link type toggle */}
          <div className="flex flex-col gap-1.5 col-span-2">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Link Type
            </label>
            <div className="inline-flex w-fit rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => switchLinkType(false)}
                className={`px-4 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                  !isPdf ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                External Link
              </button>
              <button
                type="button"
                onClick={() => switchLinkType(true)}
                className={`px-4 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                  isPdf ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                PDF / File
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Action Button Text
            </label>
            <input
              type="text"
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder={fallbackActionText(isPdf, uploadedFile)}
              className="border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
            />
            <span className="text-[11px] text-muted">Leave blank to auto-fill from the file name</span>
          </div>

          {isPdf ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                Attachment File *
              </label>
              {uploadedFile ? (
                <div className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 bg-background">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">
                        {uploadedFile.originalFilename || "Uploaded file"}
                      </div>
                      <div className="text-[11px] text-muted">{formatBytes(uploadedFile.sizeBytes)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearUploadedFile}
                    className="text-muted hover:text-danger transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
                    uploading
                      ? "opacity-60 pointer-events-none border-border text-muted"
                      : "border-border hover:border-primary text-muted hover:text-primary cursor-pointer"
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Choose file to upload
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                Redirect URL *
              </label>
              <input
                type="url"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://…"
                className="border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {/* ===== AUDIENCE TARGETING ===== */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-[15px] font-bold text-primary mb-5 pb-3 border-b border-border">
          Audience Targeting
        </h2>

        <div className="bg-background border-2 border-dashed border-border rounded-xl p-5 mb-2">
          <p className="text-[13px] text-muted mb-5">
            Leave any field empty to target{" "}
            <strong className="text-foreground">
              {lockedInstitutes != null ? "all students of your institute" : "all students"}
            </strong>{" "}
            in that dimension. Use the dropdowns below to select specific groups.
          </p>

          <div className="grid grid-cols-2 gap-5">
            <MultiSelect
              label="Institutes"
              options={instituteOptions}
              selected={instituteCodes}
              onChange={setInstituteCodes}
              disabled={lockedInstitutes != null}
              placeholder={loadingTargets ? "Loading…" : "All Institutes"}
              hint={
                lockedInstitutes != null
                  ? "Notices you publish always go to your own institute."
                  : "Target specific institutes"
              }
            />

            <MultiSelect
              label="Programs"
              options={programOptions}
              selected={programCodes}
              onChange={setProgramCodes}
              placeholder={loadingTargets ? "Loading…" : "All Programs"}
              hint={
                instituteCodes.length > 0
                  ? `Showing programs for ${instituteCodes.length} selected institute(s)`
                  : "Target specific degree programs"
              }
            />

            <div className="col-span-2">
              <MultiSelect
                label="Batch Years"
                options={BATCH_YEAR_OPTIONS}
                selected={batchYears}
                onChange={setBatchYears}
                placeholder="All Batch Years"
                hint="Year the batch started — limited to the last 5 years"
              />
            </div>
          </div>
        </div>

        {/* Targeting summary */}
        {(programCodes.length > 0 || instituteCodes.length > 0 || batchYears.length > 0) && (
          <div className="mt-4 p-3 bg-primary-faint rounded-lg border border-primary/10">
            <p className="text-[12px] font-semibold text-primary mb-1">Targeting Summary</p>
            <p className="text-[12px] text-muted">
              This notice will be visible to students matching{" "}
              {[
                programCodes.length > 0 && `${programCodes.length} program(s)`,
                instituteCodes.length > 0 && `${instituteCodes.length} institute(s)`,
                batchYears.length > 0 && `${batchYears.length} batch year(s)`,
              ]
                .filter(Boolean)
                .map((text, i) => (
                  <span key={i}>
                    {i > 0 && " • "}
                    <span className="font-semibold text-foreground">{text}</span>
                  </span>
                ))}
            </p>
          </div>
        )}
      </div>

      {/* ===== FORM ACTIONS ===== */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={resetForm}
          className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-muted border border-border hover:border-primary hover:text-primary transition-colors"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={submitting || uploading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-[10px] text-[14px] font-semibold text-white bg-primary hover:bg-primary-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          )}
          {submitting ? "Publishing…" : "Publish Notice"}
        </button>
      </div>
    </form>
  );
}
