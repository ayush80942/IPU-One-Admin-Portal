"use client";

import { useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { useToast } from "./Toast";
import Pill from "./Pill";
import DetailDialog, { DetailField } from "./DetailDialog";
import { reviewOnboardingRequest, OnboardingRequest } from "../lib/api";
import { ONBOARDING_STATUS_META } from "../lib/onboarding";

interface OnboardingRequestDialogProps {
  request: OnboardingRequest;
  onClose: () => void;
  /** Called with the updated request once a review succeeds — the caller updates its list and
   *  closes this dialog, since PENDING is the only state either action still applies to. */
  onReviewed: (updated: OnboardingRequest) => void;
}

export default function OnboardingRequestDialog({ request, onClose, onReviewed }: OnboardingRequestDialogProps) {
  const { toast } = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const review = async (action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && !remark.trim()) return;
    setSubmitting(true);
    try {
      const updated = await reviewOnboardingRequest(
        request.id,
        action,
        action === "REJECT" ? remark.trim() : undefined
      );
      toast(action === "APPROVE" ? "Request approved" : "Request rejected", "success");
      onReviewed(updated);
    } catch (err) {
      toast(`Failed to review request: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const status = ONBOARDING_STATUS_META[request.status];

  return (
    <DetailDialog title={request.name} subtitle={`${request.enrollmentNo} • ${request.programName}`} onClose={onClose}>
      <div className="flex items-center gap-2 mb-5">
        <Pill color={status.color} colorFaint={status.colorFaint}>{status.label}</Pill>
        {request.lateralEntry && <Pill color="text-violet" colorFaint="bg-violet-faint">Lateral Entry</Pill>}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
        <DetailField label="Enrollment No" value={request.enrollmentNo} />
        <DetailField label="Login Email" value={request.loginEmail} />
        <DetailField label="Institute" value={`${request.instituteName} (${request.instituteCode})`} />
        <DetailField label="Program" value={`${request.programName} (${request.programCode})`} />
        <DetailField label="Admission Year" value={request.admissionYear} />
        <DetailField label="Batch Year" value={request.batchYear} />
        <DetailField label="Submitted" value={new Date(request.submittedAt).toLocaleString()} />
        <DetailField
          label="Reviewed"
          value={request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "Not reviewed yet"}
        />
        {request.rejectionRemark && (
          <div className="col-span-2">
            <DetailField label="Rejection Remark" value={request.rejectionRemark} />
          </div>
        )}
      </div>

      {request.status === "PENDING" && (
        <>
          {rejectOpen && (
            <div className="mb-4">
              <label
                htmlFor="onboarding-rejection-remark"
                className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5"
              >
                Rejection Remark (required)
              </label>
              <textarea
                id="onboarding-rejection-remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Tell the student what didn't check out at the Student Cell…"
                className="w-full border border-border rounded-lg px-3 py-2.5 text-[14px] bg-background focus:outline-none focus:border-primary transition-colors resize-y"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
            {rejectOpen ? (
              <>
                <button
                  onClick={() => { setRejectOpen(false); setRemark(""); }}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-muted border border-border hover:bg-background transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => review("REJECT")}
                  disabled={submitting || !remark.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-danger hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <CircleX className="w-3.5 h-3.5" />
                  {submitting ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setRejectOpen(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-danger border border-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
                >
                  <CircleX className="w-3.5 h-3.5" />
                  Reject
                </button>
                <button
                  onClick={() => review("APPROVE")}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-success hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <CircleCheck className="w-3.5 h-3.5" />
                  {submitting ? "Approving…" : "Approve"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </DetailDialog>
  );
}
