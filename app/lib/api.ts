import type { NoticeBadgeValue, NoticeCategoryValue } from "./noticeTaxonomy";

// NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not read at
// runtime — this must be set (and marked available at build time) before `next build`
// runs, or the app silently falls back to localhost in production.
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080").replace(/\/+$/, "");

/** Shared with lib/auth.ts, which owns writing the session; this module only reads it. */
export const TOKEN_KEY = "ipuone.admin.token";
export const SESSION_KEY = "ipuone.admin.session";

function authHeaders(init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers);
  const token = typeof window === "undefined" ? null : window.sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/**
 * Every backend call goes through here so the admin session token is attached in one place
 * rather than at ~25 call sites, and so an expired session lands on the sign-in screen instead
 * of surfacing as an unexplained "failed to load" toast on whatever page happened to be open.
 */
async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, headers: authHeaders(init) });

  // 401 means the session is gone; 403 means this account may not have what it asked for, which
  // is not a reason to sign it out — an institute admin poking at another institute's record
  // should see the error, not be bounced to the login screen.
  if (res.status === 401 && typeof window !== "undefined") {
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  return res;
}


export function resolveFileUrl(fileUrl: string): string {
  return fileUrl.startsWith("http") ? fileUrl : `${API_BASE}${fileUrl}`;
}

/**
 * Downloads a document or receipt and hands back an object URL that `<img>`, `<iframe>` and
 * `<a download>` can all point at.
 *
 * <p>The file routes live under `/api/admin/**` and so require the admin bearer token, which a
 * browser will not attach to a `src` or `href` it resolves itself — those requests arrive
 * anonymous and come back 401, which is why previews rendered as broken images. Fetching the
 * bytes through {@link apiFetch} is the only way the header gets sent; the caller owns the
 * returned URL and must `URL.revokeObjectURL` it (see `useAuthedFileUrl`).
 */
export async function fetchFileObjectUrl(fileUrl: string): Promise<string> {
  const res = await apiFetch(resolveFileUrl(fileUrl));
  if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
  return URL.createObjectURL(await res.blob());
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

export interface NoticeAttachmentResponse {
  id: number;
  url: string;
  originalFilename: string | null;
  contentType: string;
  sizeBytes: number;
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
  instituteShortName: string | null;
  // null = unknown (that course's total semester count hasn't been set yet)
  passedOut: boolean | null;
  gender: string | null;
  fatherName: string | null;
  motherName: string | null;
  contactNumber: string | null;
  email: string | null;
  profileImage: string | null;
}

// ===== Admin account types =====
/**
 * SUPER_ADMIN is the university-level operator: every institute, every page, and the only role
 * that can manage accounts. INSTITUTE_ADMIN is one institute's Student Cell — the same portal
 * with every read narrowed to the institutes assigned to that account.
 */
export type AdminRole = "SUPER_ADMIN" | "INSTITUTE_ADMIN";

export interface AdminInstitute {
  instituteCode: string;
  instituteName: string;
  shortName: string | null;
}

/** Who the portal is signed in as. Shapes the UI; the backend does the enforcing. */
export interface AdminSession {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  institutes: AdminInstitute[];
}

export interface AdminUser extends AdminSession {
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserCreate {
  email: string;
  displayName: string;
  password: string;
  role: AdminRole;
  instituteCodes: string[];
}

export interface AdminUserUpdate {
  displayName?: string;
  role?: AdminRole;
  instituteCodes?: string[];
  active?: boolean;
}

export async function fetchAdmins(): Promise<AdminUser[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/admins`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch admins: ${res.status}`));
  return res.json();
}

export async function createAdmin(admin: AdminUserCreate): Promise<AdminUser> {
  const res = await apiFetch(`${API_BASE}/api/admin/admins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(admin),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to create admin: ${res.status}`));
  return res.json();
}

export async function updateAdmin(id: string, update: AdminUserUpdate): Promise<AdminUser> {
  const res = await apiFetch(`${API_BASE}/api/admin/admins/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to update admin: ${res.status}`));
  return res.json();
}

export async function setAdminPassword(id: string, password: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/admin/admins/${id}/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to set password: ${res.status}`));
}

export async function deleteAdmin(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/admin/admins/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to delete admin: ${res.status}`));
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

/** Hand-entered programme, for one that exists before any student has imported it. */
export interface CourseCreate {
  programCode: string;
  programName: string;
  instituteCode: string;
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

/** Hand-entered school, for one that exists before any student has imported from it. */
export interface InstituteCreate {
  instituteCode: string;
  instituteName: string;
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
  const res = await apiFetch(`${API_BASE}/api/notices?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch notices: ${res.status}`);
  return res.json();
}

export async function createNotice(
  notice: NoticeRequest
): Promise<NoticeResponse> {
  const res = await apiFetch(`${API_BASE}/api/notices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notice),
  });
  if (!res.ok) throw new Error(`Failed to create notice: ${res.status}`);
  return res.json();
}

export async function uploadNoticeAttachment(file: File): Promise<NoticeAttachmentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`${API_BASE}/api/notices/attachments`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to upload file: ${res.status}`);
  return res.json();
}

export async function deleteNotice(id: number): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/notices/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete notice: ${res.status}`);
}

export async function fetchStudents(): Promise<StudentProfile[]> {
  const res = await apiFetch(`${API_BASE}/api/student/all`);
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
  const res = await apiFetch(`${API_BASE}/api/admin/documents`);
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  return res.json();
}

export async function fetchCourses(): Promise<Course[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/courses`);
  if (!res.ok) throw new Error(`Failed to fetch courses: ${res.status}`);
  return res.json();
}

export async function createCourse(course: CourseCreate): Promise<Course> {
  const res = await apiFetch(`${API_BASE}/api/admin/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(course),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to create course: ${res.status}`));
  return res.json();
}

export async function updateCourse(programCode: string, update: CourseUpdate): Promise<Course> {
  const res = await apiFetch(`${API_BASE}/api/admin/courses/${encodeURIComponent(programCode)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`Failed to update course: ${res.status}`);
  return res.json();
}

export async function fetchInstitutes(): Promise<Institute[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/institutes`);
  if (!res.ok) throw new Error(`Failed to fetch institutes: ${res.status}`);
  return res.json();
}

export async function createInstitute(institute: InstituteCreate): Promise<Institute> {
  const res = await apiFetch(`${API_BASE}/api/admin/institutes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(institute),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to create institute: ${res.status}`));
  return res.json();
}

export async function updateInstitute(instituteCode: string, update: InstituteUpdate): Promise<Institute> {
  const res = await apiFetch(`${API_BASE}/api/admin/institutes/${encodeURIComponent(instituteCode)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`Failed to update institute: ${res.status}`);
  return res.json();
}

// ===== Fee types =====
export type FeeStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
export type FeeChannel = "FEE_PORTAL" | "BANK_TRANSFER" | "OTHER";

// One student's standing for one academic year. submissionId/submittedAt are null
// for NOT_SUBMITTED — those rows are the roster of who still owes proof of payment.
export interface FeeRosterRow {
  enrollmentNo: string;
  name: string | null;
  programCode: string | null;
  instituteCode: string | null;
  batchYear: number | null;
  submissionId: number | null;
  status: FeeStatus;
  transactionCount: number;
  totalAmount: number | null;
  submittedAt: string | null;
}

export interface FeeSummary {
  academicYear: number;
  paid: number;
  pending: number;
  rejected: number;
  notSubmitted: number;
  total: number;
}

export interface FeeTransaction {
  id: number;
  channel: FeeChannel;
  referenceNumber: string | null;
  amount: number;
  paymentDate: string;
  bankName: string | null;
  fileUrl: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export interface FeeSubmissionDetail {
  id: number;
  academicYear: number;
  label: string;
  status: FeeStatus;
  rejectionRemark: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  enrollmentNo: string;
  name: string | null;
  programCode: string | null;
  programName: string | null;
  instituteCode: string | null;
  instituteName: string | null;
  batchYear: number | null;
  admissionYear: number | null;
  transactionCount: number;
  totalAmount: number | null;
  transactions: FeeTransaction[];
}

export interface FeeRosterFilters {
  academicYear: number;
  programCode?: string;
  instituteCode?: string;
  batchYear?: string;
  status?: string;
  search?: string;
}

// The admin API reports validation failures (a REJECT without a remark, most notably)
// in a { "message": … } body — surface it verbatim so the user can act on it.
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === "string" && body.message) return body.message;
  } catch {
    // Non-JSON error body — fall through to the status-code message.
  }
  return fallback;
}

export async function fetchFees(
  filters: FeeRosterFilters,
  page = 0,
  size = 20
): Promise<PageResponse<FeeRosterRow>> {
  const params = new URLSearchParams({
    academicYear: String(filters.academicYear),
    page: String(page),
    size: String(size),
  });
  if (filters.programCode) params.set("programCode", filters.programCode);
  if (filters.instituteCode) params.set("instituteCode", filters.instituteCode);
  if (filters.batchYear) params.set("batchYear", filters.batchYear);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const res = await apiFetch(`${API_BASE}/api/admin/fees?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch fee submissions: ${res.status}`);
  return res.json();
}

export async function fetchFeeSummary(academicYear: number): Promise<FeeSummary> {
  const res = await apiFetch(`${API_BASE}/api/admin/fees/summary?academicYear=${academicYear}`);
  if (!res.ok) throw new Error(`Failed to fetch fee summary: ${res.status}`);
  return res.json();
}

export async function fetchFeeSubmission(id: number): Promise<FeeSubmissionDetail> {
  const res = await apiFetch(`${API_BASE}/api/admin/fees/submissions/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch submission: ${res.status}`);
  return res.json();
}

export async function reviewFeeSubmission(
  id: number,
  action: "APPROVE" | "REJECT",
  remark?: string
): Promise<FeeSubmissionDetail> {
  const res = await apiFetch(`${API_BASE}/api/admin/fees/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action === "REJECT" ? { action, remark } : { action }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to review submission: ${res.status}`));
  return res.json();
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export interface CreditRule {
  paperCode: string;
  credits: number;
  /** The admin-set name, or null when the page falls back to the result/scheme name. */
  subjectName: string | null;
  adminEdited: boolean;
  updatedAt: string | null;
}

export interface CreditPattern {
  id: string;
  regex: string;
  credits: number;
  description: string;
  priority: number;
  active: boolean;
}

/** A paper seen in real results that no exact rule covers. NONE = counts for zero credits. */
export interface UnmappedPaper {
  paperCode: string;
  subjectName: string | null;
  creditSource: "PATTERN" | "NONE";
  currentCredits: number;
  studentCount: number;
}

export interface PublishPreview {
  subjectsChanged: number;
  semestersChanged: number;
  studentsAffected: number;
  papers: { paperCode: string; oldCredits: number; newCredits: number; subjectRows: number }[];
}

/**
 * One paper in the grouped tree. `nameSource` says where the subject name came from: ADMIN is
 * one someone typed here and outranks the rest, RESULT is the name students actually see, and
 * SCHEME is the syllabus PDF's provisional one.
 */
export interface GroupedPaper {
  paperCode: string;
  subjectName: string | null;
  nameSource: "ADMIN" | "RESULT" | "SCHEME" | "NONE";
  paperGroup: string | null;
  credits: number;
  adminEdited: boolean;
  programCodes: string[];
  studentCount: number;
  seenInResults: boolean;
}

export interface GroupedSemester {
  semester: number | null;
  paperCount: number;
  papers: GroupedPaper[];
}

/** kind: a real programme, the papers several programmes share, or first year (sems 1-2). */
export interface GroupedProgram {
  programCode: string | null;
  programName: string | null;
  shortName: string | null;
  kind: "PROGRAM" | "SHARED" | "FIRST_YEAR";
  paperCount: number;
  semesters: GroupedSemester[];
}

export interface GroupedSchool {
  instituteCode: string | null;
  instituteName: string;
  shortName: string | null;
  unknown: boolean;
  paperCount: number;
  programs: GroupedProgram[];
}

export interface GroupedCredits {
  schools: GroupedSchool[];
  totalPapers: number;
  placedPapers: number;
}

export async function fetchCreditRules(): Promise<CreditRule[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/rules`);
  if (!res.ok) throw new Error(`Failed to fetch credit rules: ${res.status}`);
  return res.json();
}

export async function fetchGroupedCreditRules(): Promise<GroupedCredits> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/rules/grouped`);
  if (!res.ok) throw new Error(`Failed to fetch grouped credit rules: ${res.status}`);
  return res.json();
}

/**
 * `subjectName` is three-valued, matching the backend: omit it to leave the stored name alone,
 * pass "" to clear it back to the result/scheme name, pass text to set it. Callers that only
 * mean to change credits must omit it rather than sending null, or they wipe a name they never
 * showed the user.
 */
export async function saveCreditRule(
  paperCode: string,
  credits: number,
  subjectName?: string
): Promise<CreditRule> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/rules`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    // JSON.stringify drops an undefined value, which is exactly the "leave it alone" case.
    body: JSON.stringify({ paperCode, credits, subjectName }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to save credit rule: ${res.status}`));
  return res.json();
}

export async function deleteCreditRule(paperCode: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/rules/${encodeURIComponent(paperCode)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to delete credit rule: ${res.status}`));
}

export async function fetchCreditPatterns(): Promise<CreditPattern[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/patterns`);
  if (!res.ok) throw new Error(`Failed to fetch credit patterns: ${res.status}`);
  return res.json();
}

export async function saveCreditPattern(
  id: string | null,
  update: Partial<Omit<CreditPattern, "id">>
): Promise<CreditPattern> {
  const res = await apiFetch(
    id ? `${API_BASE}/api/admin/credits/patterns/${id}` : `${API_BASE}/api/admin/credits/patterns`,
    {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }
  );
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to save pattern: ${res.status}`));
  return res.json();
}

export async function deleteCreditPattern(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/patterns/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to delete pattern: ${res.status}`));
}

export async function fetchUnmappedPapers(): Promise<UnmappedPaper[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/unmapped`);
  if (!res.ok) throw new Error(`Failed to fetch unmapped papers: ${res.status}`);
  return res.json();
}

/** Dry run — writes nothing. */
export async function previewCreditPublish(): Promise<PublishPreview> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/publish/preview`);
  if (!res.ok) throw new Error(`Failed to preview publish: ${res.status}`);
  return res.json();
}

/** Rewrites stored credits and SGPAs for already-imported results. */
export async function publishCredits(): Promise<PublishPreview> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/publish`, { method: "POST" });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to publish credits: ${res.status}`));
  return res.json();
}
