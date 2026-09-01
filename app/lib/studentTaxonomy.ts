// Reservation category/sub-category options for student profiles. Read-only on this side of
// the app — these are student-entered (via the mobile app's PATCH /api/student/profile), never
// set by an admin — so this file only needs display labels, not a write form.
import type { CodeOption } from "./noticeTaxonomy";

export const CATEGORY_OPTIONS: CodeOption[] = [
  { value: "GENERAL", label: "General" },
  { value: "OBC", label: "OBC" },
  { value: "EWS", label: "EWS" },
  { value: "SC", label: "SC" },
  { value: "ST", label: "ST" },
  { value: "PWD", label: "PWD" },
];

export const SUB_CATEGORY_OPTIONS: CodeOption[] = [
  { value: "HOME_STATE", label: "Home State" },
  { value: "ALL_INDIA", label: "All India" },
  { value: "OTHER_STATE", label: "Other State" },
  { value: "DEFENSE", label: "Defense" },
  { value: "NRI", label: "NRI - Non Resident Indian" },
  { value: "JKM", label: "JKM - Jammu & Kashmir Migrants" },
  { value: "SGC", label: "SGC - Single Girl Child" },
  { value: "SPQ", label: "SPQ - Sport's Quota" },
];

export function categoryLabel(value: string | null): string {
  if (!value) return "—";
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function subCategoryLabel(value: string | null): string {
  if (!value) return "—";
  return SUB_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
