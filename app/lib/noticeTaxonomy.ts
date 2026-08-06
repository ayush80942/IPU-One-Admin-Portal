// Single source of truth for notice classification: category/badge metadata
// (label + color token) and the targeting option datasets used by both the
// creation form and the management table's display.

import { yearOfStudy } from "./academicYear";
import type { Course, Institute } from "./api";

export interface TaxonomyOption {
  value: string;
  label: string;
  color: string;
  colorFaint: string;
}

// color/colorFaint reference the Tailwind tokens defined in app/globals.css.
// Category hues are chosen to be visually distinct from the badge colors
// below (danger/success) so a card never shows two confusable pills.
export const CATEGORIES = [
  { value: "EXAM", label: "Exam", color: "text-info", colorFaint: "bg-info-faint" },
  { value: "SCHOLARSHIP", label: "Scholarship", color: "text-violet", colorFaint: "bg-violet-faint" },
  { value: "INTERNSHIP", label: "Internship", color: "text-teal", colorFaint: "bg-teal-faint" },
  { value: "CIRCULAR", label: "Circular", color: "text-magenta", colorFaint: "bg-magenta-faint" },
  { value: "PLACEMENT", label: "Placement", color: "text-orange", colorFaint: "bg-orange-faint" },
] as const satisfies readonly TaxonomyOption[];

export const BADGES = [
  { value: "URGENT", label: "Urgent", color: "text-danger", colorFaint: "bg-danger-faint" },
  { value: "NEW", label: "New", color: "text-success", colorFaint: "bg-success-faint" },
] as const satisfies readonly TaxonomyOption[];

export type NoticeCategoryValue = (typeof CATEGORIES)[number]["value"];
export type NoticeBadgeValue = (typeof BADGES)[number]["value"];

export function categoryTaxonomy(value: string): TaxonomyOption | undefined {
  return CATEGORIES.find((c) => c.value === value);
}

export function badgeTaxonomy(value: string): TaxonomyOption | undefined {
  return BADGES.find((b) => b.value === value);
}

// ===== Targeting option datasets =====
// Institutes/programs are built from the live Institutes/Courses admin data (real GGSIPU
// codes) rather than a hardcoded guess, so the dropdowns always match what's actually in
// the system — including institutes/programs curated after this file was last touched.
export interface CodeOption {
  value: string;
  label: string;
}

export function instituteOptionsFrom(institutes: Institute[]): CodeOption[] {
  return institutes
    .map((i) => ({ value: i.instituteCode, label: i.shortName || i.instituteName }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// When instituteCodes is non-empty, only programs offered by one of those institutes are
// returned — the notice form uses this to make the Programs picker cascade off Institutes.
export function programOptionsFrom(courses: Course[], instituteCodes: string[] = []): CodeOption[] {
  const scoped = instituteCodes.length > 0
    ? courses.filter((c) => c.instituteCode && instituteCodes.includes(c.instituteCode))
    : courses;
  return scoped
    .map((c) => ({ value: c.programCode, label: c.shortName || c.programName }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Capped to the last 5 batches — beyond that, a batch has graduated for essentially every
// program length offered, so older years aren't worth surfacing as a targeting option.
function rollingYearOptions(count = 5) {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => currentYear - i);
}

// Batch year drives semester targeting, so each option is annotated with the year of study
// it currently maps to (see academicYear.ts) — picking "2022" alone doesn't tell an admin
// whether that's this year's 3rd-years or 4th-years.
export const BATCH_YEAR_OPTIONS: CodeOption[] = rollingYearOptions().map((y) => {
  const yos = yearOfStudy(y);
  return { value: String(y), label: yos ? `${y} — Year ${yos}` : String(y) };
});

export function labelLookup(options: CodeOption[]) {
  const map = new Map(options.map((o) => [o.value, o.label]));
  return (code: string) => map.get(code) ?? code;
}

// Resolves a comma-joined code list ("020,028") into human-readable labels
// ("B.Tech AI & DS, B.Tech CSE") for display.
export function resolveCodeList(codes: string, lookup: (code: string) => string): string {
  return codes
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map(lookup)
    .join(", ");
}
