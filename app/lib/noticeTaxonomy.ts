// Single source of truth for notice classification: category/badge metadata
// (label + color token) and the targeting option datasets used by both the
// creation form and the management table's display.

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
// These can be fetched from the backend later; hardcoded for now based on IPU data.
// Shared between the creation form (MultiSelect inputs) and the management
// table (resolving stored codes back to human-readable labels).
export const PROGRAM_OPTIONS = [
  { value: "020", label: "B.Tech AI & DS" },
  { value: "028", label: "B.Tech CSE" },
  { value: "031", label: "B.Tech ECE" },
  { value: "032", label: "B.Tech EEE" },
  { value: "033", label: "B.Tech ME" },
  { value: "034", label: "B.Tech CE" },
  { value: "035", label: "B.Tech IT" },
  { value: "040", label: "BBA" },
  { value: "041", label: "BCA" },
  { value: "050", label: "B.Com (H)" },
  { value: "060", label: "BA (JMC)" },
  { value: "070", label: "B.Ed" },
  { value: "100", label: "MBA" },
  { value: "110", label: "MCA" },
  { value: "120", label: "M.Tech" },
  { value: "130", label: "LLB" },
  { value: "140", label: "BHMCT" },
];

export const INSTITUTE_OPTIONS = [
  { value: "101", label: "USICT" },
  { value: "102", label: "USAR" },
  { value: "103", label: "USME" },
  { value: "104", label: "USBAS" },
  { value: "105", label: "USMS" },
  { value: "106", label: "USLS" },
  { value: "107", label: "USEM" },
  { value: "108", label: "USBT" },
  { value: "109", label: "USAP" },
  { value: "110", label: "USE" },
  { value: "127", label: "MSIT" },
  { value: "128", label: "BPIT" },
  { value: "129", label: "MAIT" },
  { value: "131", label: "ADGITM" },
  { value: "132", label: "HMR" },
  { value: "133", label: "GTBIT" },
  { value: "134", label: "BVCOE" },
  { value: "136", label: "SSCBS" },
  { value: "137", label: "DSEU" },
  { value: "138", label: "AIACTR" },
  { value: "139", label: "JIMS" },
];

function rollingYearOptions(count = 8) {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => {
    const y = String(currentYear - i);
    return { value: y, label: y };
  });
}

export const BATCH_YEAR_OPTIONS = rollingYearOptions();
export const ADMISSION_YEAR_OPTIONS = rollingYearOptions();

function labelLookup(options: { value: string; label: string }[]) {
  const map = new Map(options.map((o) => [o.value, o.label]));
  return (code: string) => map.get(code) ?? code;
}

export const programLabel = labelLookup(PROGRAM_OPTIONS);
export const instituteLabel = labelLookup(INSTITUTE_OPTIONS);

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
