const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

// ===== Notice types =====
export interface NoticeResponse {
  id: number;
  category: string;
  badge: string | null;
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
  category: string;
  badge: string | null;
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
  instituteCode: string | null;
  instituteName: string | null;
  gender: string | null;
  fatherName: string | null;
  motherName: string | null;
  contactNumber: string | null;
  email: string | null;
  profileImage: string | null;
}

// ===== Enum constants (matching backend) =====
export const CATEGORIES = [
  { value: "EXAM", label: "Exam" },
  { value: "SCHOLARSHIP", label: "Scholarship" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "CIRCULAR", label: "Circular" },
  { value: "PLACEMENT", label: "Placement" },
] as const;

export const BADGES = [
  { value: "URGENT", label: "Urgent" },
  { value: "NEW", label: "New" },
] as const;

// ===== API functions =====
export async function fetchNotices(
  page = 0,
  size = 100
): Promise<PageResponse<NoticeResponse>> {
  const res = await fetch(`${API_BASE}/api/notices?page=${page}&size=${size}`);
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
  imageBase64: string;
  submittedAt: string;
  updatedAt: string;
}

export async function fetchDocuments(): Promise<DocumentResponse[]> {
  const res = await fetch(`${API_BASE}/api/admin/documents`);
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  return res.json();
}
