import type { NoticeBadgeValue, NoticeCategoryValue } from "./noticeTaxonomy";

// NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not read at
// runtime — this must be set (and marked available at build time) before `next build`
// runs, or the app silently falls back to localhost in production.
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080").replace(/\/+$/, "");

export function resolveFileUrl(fileUrl: string): string {
  return fileUrl.startsWith("http") ? fileUrl : `${API_BASE}${fileUrl}`;
}

// ===== Notice types =====
export interface NoticeResponse {
  id: number;
  category: NoticeCategoryValue;
  badge: NoticeBadgeValue | null;
  title: string;
  description: string;
  actionText: string;
  isPdf: boolean;
  actionUrl: string;
  targetProgramCodes: string | null;
  targetInstituteCodes: string | null;
  targetBatchYears: string | null;
  targetAdmissionYears: string | null;
  date: string;
}

export interface NoticeRequest {
  category: NoticeCategoryValue;
  badge: NoticeBadgeValue | null;
  title: string;
  description: string;
  actionText: string;
  isPdf: boolean;
  actionUrl: string;
  targetProgramCodes: string | null;
  targetInstituteCodes: string | null;
  targetBatchYears: string | null;
  targetAdmissionYears: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  last: boolean;
}

// ===== Student types =====
export interface StudentProfile {
  enrollmentNo: string;
  name: string;
  batchYear: number | null;
  admissionYear: number | null;
  programCode: string | null;
  programName: string | null;
  courseShortName: string | null;
  instituteCode: string | null;
  instituteName: string | null;
  // null = unknown (that course's total semester count hasn't been set yet)
  passedOut: boolean | null;
  gender: string | null;
  fatherName: string | null;
  motherName: string | null;
  contactNumber: string | null;
  email: string | null;
  profileImage: string | null;
}

// ===== Course types =====
export interface Course {
  programCode: string;
  programName: string;
  shortName: string | null;
  instituteCode: string | null;
  instituteName: string | null;
  totalSemesters: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseUpdate {
  shortName?: string | null;
  totalSemesters?: number | null;
}

// ===== Institute types =====
export interface Institute {
  instituteCode: string;
  instituteName: string;
  shortName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstituteUpdate {
  shortName?: string | null;
}

// ===== API functions =====
export async function fetchNotices(
  page = 0,
  size = 100,
  category?: string,
  search?: string
): Promise<PageResponse<NoticeResponse>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  const res = await fetch(`${API_BASE}/api/notices?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch notices: ${res.status}`);
  return res.json();
}

export async function createNotice(
  notice: NoticeRequest
): Promise<NoticeResponse> {
  const res = await fetch(`${API_BASE}/api/notices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notice),
  });
  if (!res.ok) throw new Error(`Failed to create notice: ${res.status}`);
  return res.json();
}

export async function deleteNotice(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notices/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete notice: ${res.status}`);
}

export async function fetchStudents(): Promise<StudentProfile[]> {
  const res = await fetch(`${API_BASE}/api/student/all`);
  if (!res.ok) throw new Error(`Failed to fetch students: ${res.status}`);
  return res.json();
}

// ===== Document types =====
export interface DocumentResponse {
  id: number;
  enrollmentNo: string;
  documentType: string;
  semester: string | null;
  examType: string | null;
  nocDuration: string | null;
  fileUrl: string;
  submittedAt: string;
  updatedAt: string;
}

export async function fetchDocuments(): Promise<DocumentResponse[]> {
  const res = await fetch(`${API_BASE}/api/admin/documents`);
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  return res.json();
}

export async function fetchCourses(): Promise<Course[]> {
  const res = await fetch(`${API_BASE}/api/admin/courses`);
  if (!res.ok) throw new Error(`Failed to fetch courses: ${res.status}`);
  return res.json();
}

export async function updateCourse(programCode: string, update: CourseUpdate): Promise<Course> {
  const res = await fetch(`${API_BASE}/api/admin/courses/${encodeURIComponent(programCode)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`Failed to update course: ${res.status}`);
  return res.json();
}

export async function fetchInstitutes(): Promise<Institute[]> {
  const res = await fetch(`${API_BASE}/api/admin/institutes`);
  if (!res.ok) throw new Error(`Failed to fetch institutes: ${res.status}`);
  return res.json();
}

export async function updateInstitute(instituteCode: string, update: InstituteUpdate): Promise<Institute> {
  const res = await fetch(`${API_BASE}/api/admin/institutes/${encodeURIComponent(instituteCode)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`Failed to update institute: ${res.status}`);
  return res.json();
}
