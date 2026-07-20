"use client";

import { useState, FormEvent } from "react";
import MultiSelect from "./MultiSelect";
import { useToast } from "./Toast";
import { createNotice, NoticeRequest } from "../lib/api";
import {
  CATEGORIES,
  BADGES,
  PROGRAM_OPTIONS,
  INSTITUTE_OPTIONS,
  BATCH_YEAR_OPTIONS,
  ADMISSION_YEAR_OPTIONS,
  NoticeCategoryValue,
  NoticeBadgeValue,
} from "../lib/noticeTaxonomy";

interface NoticeFormProps {
  onCreated: () => void;
}

export default function NoticeForm({ onCreated }: NoticeFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [category, setCategory] = useState<NoticeCategoryValue>("EXAM");
  const [badge, setBadge] = useState<NoticeBadgeValue | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionText, setActionText] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [programCodes, setProgramCodes] = useState<string[]>([]);
  const [instituteCodes, setInstituteCodes] = useState<string[]>([]);
  const [batchYears, setBatchYears] = useState<string[]>([]);
  const [admissionYears, setAdmissionYears] = useState<string[]>([]);

  const resetForm = () => {
    setCategory("EXAM");
    setBadge("");
    setTitle("");
    setDescription("");
    setActionText("");
    setActionUrl("");
    setIsPdf(false);
    setProgramCodes([]);
    setInstituteCodes([]);
    setBatchYears([]);
    setAdmissionYears([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim() || !actionText.trim() || !actionUrl.trim()) {
      toast("Please fill all required fields", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload: NoticeRequest = {
        category,
        badge: badge || null,
        title: title.trim(),
        description: description.trim(),
        actionText: actionText.trim(),
        actionUrl: actionUrl.trim(),
        isPdf,
        targetProgramCodes: programCodes.length > 0 ? programCodes.join(",") : null,
        targetInstituteCodes: instituteCodes.length > 0 ? instituteCodes.join(",") : null,
        targetBatchYears: batchYears.length > 0 ? batchYears.join(",") : null,
        targetAdmissionYears: admissionYears.length > 0 ? admissionYears.join(",") : null,
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
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Action Button Text *
            </label>
            <input
              type="text"
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="e.g. exam_schedule.pdf"
              className="border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Attachment / Redirect URL *
            </label>
            <input
              type="url"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="https://…"
              className="border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Link type toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Link Type
            </label>
            <div className="flex items-center gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[14px]">
                <input
                  type="radio"
                  name="isPdf"
                  checked={!isPdf}
                  onChange={() => setIsPdf(false)}
                  className="accent-primary"
                />
                External Link
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[14px]">
                <input
                  type="radio"
                  name="isPdf"
                  checked={isPdf}
                  onChange={() => setIsPdf(true)}
                  className="accent-primary"
                />
                PDF / File
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ===== AUDIENCE TARGETING ===== */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-[15px] font-bold text-primary mb-5 pb-3 border-b border-border">
          Audience Targeting
        </h2>

        <div className="bg-background border-2 border-dashed border-border rounded-xl p-5 mb-2">
          <p className="text-[13px] text-muted mb-5">
            Leave any field empty to target <strong className="text-foreground">all students</strong> in that dimension.
            Use the dropdowns below to select specific groups.
          </p>

          <div className="grid grid-cols-2 gap-5">
            <MultiSelect
              label="Programs"
              options={PROGRAM_OPTIONS}
              selected={programCodes}
              onChange={setProgramCodes}
              placeholder="All Programs"
              hint="Target specific degree programs"
            />

            <MultiSelect
              label="Institutes"
              options={INSTITUTE_OPTIONS}
              selected={instituteCodes}
              onChange={setInstituteCodes}
              placeholder="All Institutes"
              hint="Target specific affiliated institutes"
            />

            <MultiSelect
              label="Batch Years"
              options={BATCH_YEAR_OPTIONS}
              selected={batchYears}
              onChange={setBatchYears}
              placeholder="All Batch Years"
              hint="Year the batch started"
            />

            <MultiSelect
              label="Admission Years"
              options={ADMISSION_YEAR_OPTIONS}
              selected={admissionYears}
              onChange={setAdmissionYears}
              placeholder="All Admission Years"
              hint="Year student was admitted"
            />
          </div>
        </div>

        {/* Targeting summary */}
        {(programCodes.length > 0 || instituteCodes.length > 0 || batchYears.length > 0 || admissionYears.length > 0) && (
          <div className="mt-4 p-3 bg-primary-faint rounded-lg border border-primary/10">
            <p className="text-[12px] font-semibold text-primary mb-1">Targeting Summary</p>
            <p className="text-[12px] text-muted">
              This notice will be visible to students matching{" "}
              {programCodes.length > 0 && <span className="font-semibold text-foreground">{programCodes.length} program(s)</span>}
              {programCodes.length > 0 && (instituteCodes.length > 0 || batchYears.length > 0 || admissionYears.length > 0) && " • "}
              {instituteCodes.length > 0 && <span className="font-semibold text-foreground">{instituteCodes.length} institute(s)</span>}
              {instituteCodes.length > 0 && (batchYears.length > 0 || admissionYears.length > 0) && " • "}
              {batchYears.length > 0 && <span className="font-semibold text-foreground">{batchYears.length} batch year(s)</span>}
              {batchYears.length > 0 && admissionYears.length > 0 && " • "}
              {admissionYears.length > 0 && <span className="font-semibold text-foreground">{admissionYears.length} admission year(s)</span>}
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
          disabled={submitting}
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
