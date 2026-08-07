// Ported from IPUOneApp's calculateYearAndSem (StudentCard.kt). batchYear is the year Sem 1
// started (Jul-Dec) — odd semesters run Jul-Dec, even run Jan-Jun, so it anchors every
// semester boundary since. Shared by the students table/dialog and the notices form's
// batch-year targeting picker.

export function yearOfStudy(batchYear: number): number | null {
  const now = new Date();
  const isOddSemPeriod = now.getMonth() + 1 >= 7;
  const cycleYear = isOddSemPeriod ? now.getFullYear() : now.getFullYear() - 1;
  const year = cycleYear - batchYear + 1;
  return year >= 1 ? year : null;
}

export function calculateYearAndSem(batchYear: number | null): string | null {
  if (batchYear == null) return null;
  const year = yearOfStudy(batchYear);
  if (year == null) return null;

  const isOddSemPeriod = new Date().getMonth() + 1 >= 7;
  const semester = isOddSemPeriod ? year * 2 - 1 : year * 2;

  return `Year ${year} | Sem ${semester}`;
}

// Fees are charged per academic session, which is named after the calendar year it starts
// in — the 2023 fee year is the 2023-24 session, running from July 2023. Same July boundary
// the semester math above uses.
export function currentAcademicYear(): number {
  const now = new Date();
  return now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

export function academicYearLabel(year: number): string {
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

export function academicYearOptions(count = 5): number[] {
  const current = currentAcademicYear();
  return Array.from({ length: count }, (_, i) => current - i);
}
