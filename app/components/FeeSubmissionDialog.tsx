"use client";

import { useState, useEffect, useCallback } from "react";
import { CircleCheck, CircleX, Download, ExternalLink, FileWarning } from "lucide-react";
import { useToast } from "./Toast";
import Pill from "./Pill";
import DetailDialog, { DetailField } from "./DetailDialog";
import { useAuthedFileUrl } from "./AuthedFile";
import {
  fetchFeeSubmission,
  reviewFeeSubmission,
  FeeSubmissionDetail,
  FeeTransaction,
} from "../lib/api";
import {
  FEE_CHANNEL_LABELS,
  FEE_PAYMENT_STATUS_META,
  FEE_STATUS_META,
  formatAmount,
  formatFileSize,
  formatPaymentDate,
  referenceLabel,
} from "../lib/fees";
import { academicYearLabel } from "../lib/academicYear";

// Receipts are served from /api/admin/**, which needs the admin bearer token — a URL the browser
// resolves itself (an img src, an iframe src, an anchor href) never carries it and comes back
// 401. So the bytes are fetched once per transaction in TransactionCard and everything here
// renders from the resulting object URL.
function ReceiptPreview({
  transaction,
  url,
  error,
  loading,
}: {
  transaction: FeeTransaction;
  url: string | null;
  error: string | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="skeleton w-full h-[240px] rounded-lg" />;
  }

  if (error || !url) {
    return (
      <div className="flex items-center justify-center gap-2 h-24 rounded-lg border border-border bg-background text-[13px] text-muted">
        <FileWarning className="w-4 h-4" />
        Receipt could not be loaded
      </div>
    );
  }

  if (transaction.contentType === "application/pdf") {
    return (
      <iframe
        src={url}
        title={`Receipt for transaction ${transaction.id}`}
        className="w-full h-[440px] rounded-lg border border-border bg-background"
      />
    );
  }

  if (transaction.contentType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Payment receipt"
        className="w-full max-h-[440px] object-contain rounded-lg border border-border bg-background"
      />
    );
  }

  return (
    <a
      href={url}
      download
      className="flex items-center justify-center gap-2 h-24 rounded-lg border border-border bg-background text-[13px] font-medium text-primary hover:underline"
    >
      <Download className="w-4 h-4" />
      Download receipt ({transaction.contentType})
    </a>
  );
}

function TransactionCard({ transaction, index, total }: { transaction: FeeTransaction; index: number; total: number }) {
  // One fetch per transaction, shared by the preview and the "Open receipt" link below it.
  const file = useAuthedFileUrl(transaction.fileUrl);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-background border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Pill color="text-primary" colorFaint="bg-primary-faint">
            {FEE_CHANNEL_LABELS[transaction.channel]}
          </Pill>
          {total > 1 && (
            <span className="text-[11px] text-muted">
              Part {index + 1} of {total}
            </span>
          )}
        </div>
        <div className="text-[15px] font-bold text-foreground">{formatAmount(transaction.amount)}</div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
          <DetailField label={referenceLabel(transaction.channel)} value={transaction.referenceNumber} />
          <DetailField label="Payment Date" value={formatPaymentDate(transaction.paymentDate)} />
          {transaction.bankName && <DetailField label="Bank" value={transaction.bankName} />}
          <DetailField label="Uploaded" value={new Date(transaction.uploadedAt).toLocaleString()} />
        </div>

        <ReceiptPreview transaction={transaction} url={file.url} error={file.error} loading={file.loading} />

        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted">{formatFileSize(transaction.fileSizeBytes)}</span>
          {file.url && (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              Open receipt <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Informational only — never gates the Approve/Reject buttons below it. "Counted" mirrors the
// backend's own rule (FeeStructureUtil / FeeAdminService.toDetailDto): only an APPROVED
// submission's amount counts towards the structure's total, so a still-pending bank-transfer
// receipt reads as Not Paid here even if its amount would otherwise be enough.
function FeeStructureSummary({ detail }: { detail: FeeSubmissionDetail }) {
  const totalDue = detail.totalDue ?? 0;
  const amountCounted = detail.status === "APPROVED" ? detail.totalAmount ?? 0 : 0;
  const meta = detail.paymentStatus ? FEE_PAYMENT_STATUS_META[detail.paymentStatus] : null;

  return (
    <div className="border border-border rounded-xl p-4 mb-6 bg-background">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Fee Structure</h3>
        {meta && <Pill color={meta.color} colorFaint={meta.colorFaint}>{meta.label}</Pill>}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[18px] font-bold text-foreground">{formatAmount(amountCounted)}</span>
        <span className="text-[13px] text-muted">of {formatAmount(totalDue)} due</span>
      </div>
      {detail.feeBreakup.length > 0 && (
        <div className="space-y-1">
          {detail.feeBreakup.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-[12.5px] text-muted">
              <span>{item.label}</span>
              <span className="tabular-nums">{formatAmount(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FeeSubmissionDialogProps {
  submissionId: number;
  onClose: () => void;
  onReviewed: () => void;
}

export default function FeeSubmissionDialog({ submissionId, onClose, onReviewed }: FeeSubmissionDialogProps) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<FeeSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDetail(await fetchFeeSubmission(submissionId));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { load(); }, [load]);

  const review = async (action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && !remark.trim()) return;
    setSubmitting(true);
    try {
      const updated = await reviewFeeSubmission(submissionId, action, action === "REJECT" ? remark.trim() : undefined);
      setDetail(updated);
      setRejectOpen(false);
      setRemark("");
      toast(action === "APPROVE" ? "Payment approved" : "Payment rejected");
      onReviewed();
    } catch (err) {
      toast(`Failed to review: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const status = detail ? FEE_STATUS_META[detail.status] : null;

  return (
    <DetailDialog
      title={detail?.name || "Fee Submission"}
      subtitle={
        detail
          ? `${detail.enrollmentNo} • ${detail.label || academicYearLabel(detail.academicYear)} session`
          : undefined
      }
      onClose={onClose}
      maxWidthClass="max-w-4xl"
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      ) : loadError || !detail ? (
        <div className="py-10 text-center">
          <p className="text-[14px] text-muted mb-3">Could not load this submission: {loadError}</p>
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-5">
            {status && <Pill color={status.color} colorFaint={status.colorFaint}>{status.label}</Pill>}
            <span className="text-[13px] text-muted">
              {detail.transactionCount} transaction{detail.transactionCount === 1 ? "" : "s"} •{" "}
              <span className="font-semibold text-foreground">{formatAmount(detail.totalAmount)}</span>
            </span>
          </div>

          {detail.totalDue != null && <FeeStructureSummary detail={detail} />}

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <DetailField label="Program" value={detail.programName || detail.programCode} />
            <DetailField label="Institute" value={detail.instituteName || detail.instituteCode} />
            <DetailField label="Batch Year" value={detail.batchYear} />
            <DetailField label="Admission Year" value={detail.admissionYear} />
            <DetailField label="Submitted" value={new Date(detail.submittedAt).toLocaleString()} />
            <DetailField
              label="Reviewed"
              value={detail.reviewedAt ? new Date(detail.reviewedAt).toLocaleString() : "Not reviewed yet"}
            />
            {detail.rejectionRemark && (
              <div className="col-span-2">
                <DetailField label="Rejection Remark" value={detail.rejectionRemark} />
              </div>
            )}
          </div>

          <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
            Receipts ({detail.transactions.length})
          </h3>
          <div className="space-y-4 mb-6">
            {detail.transactions.map((t, i) => (
              <TransactionCard key={t.id} transaction={t} index={i} total={detail.transactions.length} />
            ))}
          </div>

          {rejectOpen && (
            <div className="mb-4">
              <label
                htmlFor="fee-rejection-remark"
                className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5"
              >
                Rejection Remark (required)
              </label>
              <textarea
                id="fee-rejection-remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Tell the student what's wrong with this proof of payment…"
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
                {detail.status !== "REJECTED" && (
                  <button
                    onClick={() => setRejectOpen(true)}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-danger border border-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
                  >
                    <CircleX className="w-3.5 h-3.5" />
                    Reject
                  </button>
                )}
                {detail.status !== "APPROVED" && (
                  <button
                    onClick={() => review("APPROVE")}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-success hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <CircleCheck className="w-3.5 h-3.5" />
                    {submitting ? "Approving…" : "Approve"}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </DetailDialog>
  );
}
