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
