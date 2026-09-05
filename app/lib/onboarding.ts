// Display metadata for manual onboarding request review, shared by the requests table and the
// review dialog.

import type { OnboardingRequestStatus } from "./api";

export interface OnboardingStatusMeta {
  label: string;
  color: string;
  colorFaint: string;
}

export const ONBOARDING_STATUS_META: Record<OnboardingRequestStatus, OnboardingStatusMeta> = {
  PENDING: { label: "Pending", color: "text-orange", colorFaint: "bg-orange-faint" },
  APPROVED: { label: "Approved", color: "text-success", colorFaint: "bg-success-faint" },
  REJECTED: { label: "Rejected", color: "text-danger", colorFaint: "bg-danger-faint" },
};
