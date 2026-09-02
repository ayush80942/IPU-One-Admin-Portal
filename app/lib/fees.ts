// Display metadata and formatting for fee payment verification, shared by the roster
// table and the submission review dialog.

import type { FeeChannel, FeePaymentStatus, FeeStatus } from "./api";

export interface FeeStatusMeta {
  label: string;
  color: string;
  colorFaint: string;
}

// A fee year is binary to the Student Cell — paid or not — so APPROVED reads as "Paid"
// rather than echoing the review verb back at them. color/colorFaint reference the
// Tailwind tokens in app/globals.css.
export const FEE_STATUS_META: Record<FeeStatus, FeeStatusMeta> = {
  APPROVED: { label: "Paid", color: "text-success", colorFaint: "bg-success-faint" },
  PENDING: { label: "Pending Review", color: "text-orange", colorFaint: "bg-orange-faint" },
  REJECTED: { label: "Rejected", color: "text-danger", colorFaint: "bg-danger-faint" },
  NOT_SUBMITTED: { label: "Not Submitted", color: "text-muted", colorFaint: "bg-background" },
};

export const FEE_STATUS_OPTIONS: { value: FeeStatus; label: string }[] = (
  Object.keys(FEE_STATUS_META) as FeeStatus[]
).map((value) => ({ value, label: FEE_STATUS_META[value].label }));

// How much of a FeeStructure's total a student has actually gotten counted towards it (only an
// APPROVED submission's amount counts — see FeeStructureUtil on the backend). Distinct from
// FeeStatus: a submission can be APPROVED (verified as legitimate) while still only Partial.
export const FEE_PAYMENT_STATUS_META: Record<FeePaymentStatus, FeeStatusMeta> = {
  FULL: { label: "Fully Paid", color: "text-success", colorFaint: "bg-success-faint" },
  PARTIAL: { label: "Partial", color: "text-orange", colorFaint: "bg-orange-faint" },
  NOT_PAID: { label: "Not Paid", color: "text-danger", colorFaint: "bg-danger-faint" },
};

export const FEE_CHANNEL_LABELS: Record<FeeChannel, string> = {
  FEE_PORTAL: "Fee Portal",
  BANK_TRANSFER: "Bank Transfer",
};

// Bank transfer receipts (loans/scholarships) carry a UTR number; fee portal receipts
// carry the portal's own reference — naming it correctly is what makes it verifiable.
export function referenceLabel(channel: FeeChannel): string {
  return channel === "BANK_TRANSFER" ? "UTR Number" : "Reference Number";
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatAmount(amount: number | null): string {
  return amount == null ? "—" : INR.format(amount);
}

// paymentDate is a date-only value; `new Date("2023-08-14")` parses as UTC midnight and
// renders as the previous day west of Greenwich, so build it in local time instead.
export function formatPaymentDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
