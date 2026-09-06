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
  // null = unknown (that course's total semester count hasn't been set yet) - a suggestion only.
  // alumniStatus below is the authoritative, admin-set signal for the Students/Alumni split.
  passedOut: boolean | null;
  alumniStatus: boolean;
  gender: string | null;
  fatherName: string | null;
  motherName: string | null;
  contactNumber: string | null;
  email: string | null;
  profileImage: string | null;
  // Student-entered from the mobile app (PATCH /api/student/profile) - never set by an admin,
  // null until the student provides it. See lib/studentTaxonomy.ts for display labels.
  category: string | null;
  subCategory: string | null;
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
  /** StudentFeature names (see feature-flags) enabled across `institutes` — a super admin gets
   *  every feature regardless of flags, since they're the one who sets them. */
  enabledFeatures: string[];
  /** Set only while this session is a super admin's "log in as" of this account — the
   *  impersonating super admin's own email. Drives the persistent banner in AuthGate. */
  impersonatedByEmail: string | null;
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
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstituteUpdate {
  shortName?: string | null;
  onboarded?: boolean;
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

// ===== Result types (admin student-detail view only — the self-service app has its own) =====
export interface SubjectResult {
  paperCode: string;
  subjectName: string | null;
  internalMarks: number | null;
  externalMarks: number | null;
  totalMarks: number | null;
  credits: number | null;
  gradePoint: number | null;
  grade: string | null;
  status: string | null;
  graceApplied: boolean | null;
  /** True when this paper has no resolved credit rule — credits is null, not 0. */
  creditsMissing: boolean | null;
  /** True when GGSIPU listed this paper more than once within the semester — the student
   *  reappeared or cleared a backlog for it, and marks/grade shown are the latest attempt. */
  reappeared: boolean | null;
}

export interface SemesterResult {
  semester: number;
  /** Null when a paper in this semester has no resolved credit mapping — render "—", not 0. */
  sgpa: number | null;
  credits: number;
  backlogs: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  declaredDate: string | null;
  creditsIncomplete: boolean | null;
}

export interface ResultDashboard {
  overall: {
    /** Null when any semester has a paper with no resolved credit mapping — render "—", not 0. */
    cgpa: number | null;
    percentage: number;
    totalCredits: number;
    backlogs: number;
    totalMarks: number;
    obtainedMarks: number;
    creditMappingIncomplete: boolean | null;
  } | null;
  semesters: SemesterResult[];
  subjects: Record<string, SubjectResult[]>;
  trend: (number | null)[];
  lastUpdated: string | null;
  unmappedSubjects: string[] | null;
}

/** Everything the student detail page shows, in one round trip. */
export interface StudentDetail {
  profile: StudentProfile;
  results: ResultDashboard;
  documents: DocumentResponse[];
  feeSubmissions: FeeSubmissionDetail[];
}

export async function fetchStudentDetail(enrollmentNo: string): Promise<StudentDetail> {
  const res = await apiFetch(`${API_BASE}/api/admin/students/${encodeURIComponent(enrollmentNo)}`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch student: ${res.status}`));
  return res.json();
}

export interface GraduateBatchResult {
  studentsMarked: number;
}

/**
 * Backs the Alumni page's "Graduate Batch" popup — moves every not-yet-alumni student in one
 * batch year, at one institute, across one or more courses to alumni in a single call, and
 * records the (batchYear, instituteCode, programCode) combinations as standing rules so a
 * student who only imports for the first time later lands as alumni immediately too. There is no
 * per-student alumni toggle — a batch is always graduated as a whole. Scoped server-side the same
 * way the rest of the admin directory is.
 */
export async function graduateBatch(batchYear: number, instituteCode: string, programCodes: string[]): Promise<GraduateBatchResult> {
  const res = await apiFetch(`${API_BASE}/api/admin/students/graduated-batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchYear, instituteCode, programCodes }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to graduate batch: ${res.status}`));
  return res.json();
}

// ===== Unlinked signups (SUPER_ADMIN only) =====
/** One PortalOutageAttempt folded into a signup — did a portal outage plausibly explain why
 *  they never got past login/import. */
export interface UnlinkedUserOutageAttempt {
  outageId: number;
  attemptType: PortalAttemptType;
  lastAttemptedAt: string;
  attemptCount: number;
}

/** One support ticket filed under the same email as an unlinked signup. */
export interface UnlinkedUserSupportTicket {
  id: number;
  category: SupportCategory;
  status: SupportTicketStatus;
  createdAt: string;
  description: string;
}

export type UnlinkedUserStatus = "NEEDS_FOLLOW_UP" | "DROPPED_OUT" | "OTHER_ISSUE" | "RESOLVED";

/** Someone who signed in but never completed the GGSIPU import that links them to a Student
 *  row — so they don't show up anywhere else in the portal. `outageAttempts` and
 *  `supportTickets` are auto-detected from existing data; `status`/`note` are the Student
 *  Cell's own manual triage, set via updateUnlinkedUserStatus. */
export interface UnlinkedUser {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  providers: string[];
  outageAttempts: UnlinkedUserOutageAttempt[];
  supportTickets: UnlinkedUserSupportTicket[];
  status: UnlinkedUserStatus;
  note: string | null;
  statusUpdatedAt: string | null;
}

export async function fetchUnlinkedUsers(): Promise<UnlinkedUser[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/unlinked-users`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch unlinked users: ${res.status}`));
  return res.json();
}

export async function updateUnlinkedUserStatus(
  userId: string,
  status: UnlinkedUserStatus,
  note: string
): Promise<UnlinkedUser> {
  const res = await apiFetch(`${API_BASE}/api/admin/unlinked-users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to update status: ${res.status}`));
  return res.json();
}

// ===== Manual onboarding requests =====
export type OnboardingRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * A first-time student who couldn't get through the real GGSIPU result-portal login (wrong
 * password, or the portal down) submitted enrollment number, name and a lateral-entry flag from
 * the app instead. The backend fills in institute/program/admission-year/batch-year by decoding
 * the enrollment number. There's no photo/ID upload here — verification happens in person: the
 * student visits their own Student Cell with their college ID card, and this is that review.
 * Already scoped server-side to the calling admin's institutes, same as the rest of the directory.
 */
export interface OnboardingRequest {
  id: string;
  enrollmentNo: string;
  name: string;
  loginEmail: string;
  instituteCode: string;
  instituteName: string;
  instituteShortName: string | null;
  programCode: string;
  programName: string;
  programShortName: string | null;
  admissionYear: number;
  batchYear: number;
  lateralEntry: boolean;
  status: OnboardingRequestStatus;
  rejectionRemark: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export async function fetchOnboardingRequests(status?: string): Promise<OnboardingRequest[]> {
  const res = await apiFetch(
    `${API_BASE}/api/admin/onboarding-requests${status ? `?status=${status}` : ""}`
  );
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch onboarding requests: ${res.status}`));
  return res.json();
}

export async function reviewOnboardingRequest(
  id: string,
  action: "APPROVE" | "REJECT",
  remark?: string
): Promise<OnboardingRequest> {
  const res = await apiFetch(`${API_BASE}/api/admin/onboarding-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action === "REJECT" ? { action, remark } : { action }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to review request: ${res.status}`));
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

// ===== Feature flags (SUPER_ADMIN only) =====
// Which student tabs (see StudentFeature on the backend) each school has switched on. Home,
// Results, and Profile aren't here — the app always shows those regardless.
export const STUDENT_FEATURES = ["NOTICES", "FEES", "DOCUMENTS", "PLACEMENT", "FEEDBACK", "ATTENDANCE"] as const;
export type StudentFeature = (typeof STUDENT_FEATURES)[number];

export const FEATURE_LABEL: Record<StudentFeature, string> = {
  NOTICES: "Notices",
  FEES: "Fee Payments",
  DOCUMENTS: "Collect Documents",
  PLACEMENT: "Placements",
  FEEDBACK: "Faculty Feedback",
  ATTENDANCE: "Attendance",
};

export interface InstituteFeatureFlags {
  instituteCode: string;
  instituteName: string;
  enabledFeatures: string[];
}

export async function fetchFeatureFlags(): Promise<InstituteFeatureFlags[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/feature-flags`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch feature flags: ${res.status}`));
  return res.json();
}

export async function setFeatureFlag(instituteCode: string, feature: StudentFeature, enabled: boolean): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/admin/feature-flags`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instituteCode, feature, enabled }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to update feature flag: ${res.status}`));
}

// ===== Fee types =====
export type FeeStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
export type FeeChannel = "FEE_PORTAL" | "BANK_TRANSFER";

export type FeePaymentStatus = "NOT_PAID" | "PARTIAL" | "FULL";

// One student's standing for one academic year. submissionId/submittedAt are null
// for NOT_SUBMITTED — those rows are the roster of who still owes proof of payment.
// totalDue/paymentStatus are null when no admin has configured a FeeStructure for this row's
// (institute, program, admission year, academic year) yet.
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
  totalDue: number | null;
  paymentStatus: FeePaymentStatus | null;
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

export interface FeeStructureItem {
  label: string;
  amount: number;
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
  // Null/empty when no admin has configured a FeeStructure for this student's (institute,
  // program, admission year, academic year) yet.
  totalDue: number | null;
  paymentStatus: FeePaymentStatus | null;
  feeBreakup: FeeStructureItem[];
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

// ===== Fee structure types (what a student owes, not what they've submitted) =====

// Keyed on admissionYear, not batchYear — a fee structure is what a given admitted cohort was
// charged, unrelated to AcademicYearUtil's own batchYear-based eligibility-window logic.
export interface FeeStructure {
  id: number;
  instituteCode: string;
  instituteName: string | null;
  programCode: string;
  programName: string | null;
  admissionYear: number;
  academicYear: number;
  label: string;
  totalAmount: number;
  items: FeeStructureItem[];
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructureUpsertRequest {
  instituteCode: string;
  programCode: string;
  admissionYear: number;
  academicYear: number;
  items: FeeStructureItem[];
}

export interface FeeStructureFilters {
  instituteCode?: string;
  programCode?: string;
  admissionYear?: number;
  academicYear?: number;
}

export async function fetchFeeStructures(filters: FeeStructureFilters = {}): Promise<FeeStructure[]> {
  const params = new URLSearchParams();
  if (filters.instituteCode) params.set("instituteCode", filters.instituteCode);
  if (filters.programCode) params.set("programCode", filters.programCode);
  if (filters.admissionYear) params.set("admissionYear", String(filters.admissionYear));
  if (filters.academicYear) params.set("academicYear", String(filters.academicYear));
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE}/api/admin/fee-structures${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch fee structures: ${res.status}`);
  return res.json();
}

/** Creates or replaces the structure for the request's (institute, program, admission year,
 *  academic year) key — always sends the complete breakup, matching the backend's full-replace
 *  upsert. */
export async function saveFeeStructure(request: FeeStructureUpsertRequest): Promise<FeeStructure> {
  const res = await apiFetch(`${API_BASE}/api/admin/fee-structures`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to save fee structure: ${res.status}`));
  return res.json();
}

export async function deleteFeeStructure(id: number): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/admin/fee-structures/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to delete fee structure: ${res.status}`));
}

// ===== Fee reminder pushes (Notifications tab) =====

// A record of one "send a reminder push" action, not a per-recipient delivery log - see
// FeeReminderLog's Javadoc on the backend. status mirrors FeeRosterFilters.status: a real
// FeeStatus name, or "NOT_SUBMITTED"/"ALL".
export interface FeeReminderLog {
  id: number;
  academicYear: number;
  instituteCodes: string | null;
  programCode: string | null;
  batchYear: number | null;
  status: string;
  targetCount: number;
  sentByEmail: string;
  sentAt: string;
}

export interface FeeReminderRequest {
  academicYear: number;
  programCode?: string;
  instituteCode?: string;
  batchYear?: number;
  status?: string;
}

export async function sendFeeReminder(request: FeeReminderRequest): Promise<FeeReminderLog> {
  const res = await apiFetch(`${API_BASE}/api/admin/fees/reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to send fee reminder: ${res.status}`));
  return res.json();
}

export async function fetchFeeReminders(page = 0, size = 20): Promise<PageResponse<FeeReminderLog>> {
  const res = await apiFetch(`${API_BASE}/api/admin/fees/reminders?page=${page}&size=${size}`);
  if (!res.ok) throw new Error(`Failed to fetch fee reminders: ${res.status}`);
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

export interface PublishPreview {
  subjectsChanged: number;
  semestersChanged: number;
  studentsAffected: number;
  /** institutesAffected > 1 on a paper is the signature of a base rule reaching a same-coded
   *  subject at an institute the change wasn't meant to touch — see CreditAdminService's
   *  cross-scope guard on the backend. */
  papers: { paperCode: string; oldCredits: number; newCredits: number; subjectRows: number; institutesAffected: number }[];
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
  /** Which scheme session(s) placed this paper here, pipe-separated (e.g. "2021-22|2022-23" or
   *  "2026-27 NEP") — display only, says nothing about which credit value applies. Null when the
   *  row came only from an imported result and no scheme names a session. */
  schemeSessions: string | null;
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

/** A paper this school's students hold that has no exact credit rule — it silently counts for
 *  zero. A code held by students of more than one institute appears in each of those
 *  institutes' lists. */
export interface NeedsAttentionPaper {
  paperCode: string;
  subjectName: string | null;
  studentCount: number;
}

export interface GroupedSchool {
  instituteCode: string | null;
  instituteName: string;
  shortName: string | null;
  unknown: boolean;
  paperCount: number;
  programs: GroupedProgram[];
  needsAttention: NeedsAttentionPaper[];
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

/** A named scheme revision, identified by the admission years it covers. `endAdmissionYear`
 *  null means still current — new admissions keep falling into it until a later era is added. */
export interface SchemeEra {
  id: string;
  label: string;
  startAdmissionYear: number;
  endAdmissionYear: number | null;
  /** null = applies university-wide. */
  instituteCode: string | null;
}

export type SchemeEraUpsert = Omit<SchemeEra, "id">;

/** Overrides a paper code's base credit_rules value for one institute and/or one programme
 *  and/or one scheme era — what makes the same code able to mean two different subjects across
 *  a scheme revision, or across institutes. `instituteCode`/`programCode`/`schemeEraId` null
 *  means "any institute"/"any programme"/"any era", but at least one must be set: an override
 *  scoping none of them is just a credit_rules edit. */
export interface ScopedCreditRule {
  id: string;
  paperCode: string;
  instituteCode: string | null;
  programCode: string | null;
  schemeEraId: string | null;
  credits: number;
  subjectName: string | null;
  updatedAt: string;
}

export type ScopedCreditRuleUpsert = Omit<ScopedCreditRule, "id" | "updatedAt">;

export async function fetchSchemeEras(): Promise<SchemeEra[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/eras`);
  if (!res.ok) throw new Error(`Failed to fetch scheme eras: ${res.status}`);
  return res.json();
}

export async function saveSchemeEra(id: string | null, update: SchemeEraUpsert): Promise<SchemeEra> {
  const res = await apiFetch(
    id ? `${API_BASE}/api/admin/credits/eras/${id}` : `${API_BASE}/api/admin/credits/eras`,
    {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }
  );
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to save scheme era: ${res.status}`));
  return res.json();
}

export async function deleteSchemeEra(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/eras/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to delete scheme era: ${res.status}`));
}

export async function fetchCreditOverrides(): Promise<ScopedCreditRule[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/overrides`);
  if (!res.ok) throw new Error(`Failed to fetch credit overrides: ${res.status}`);
  return res.json();
}

export async function saveCreditOverride(
  id: string | null,
  update: ScopedCreditRuleUpsert
): Promise<ScopedCreditRule> {
  const res = await apiFetch(
    id ? `${API_BASE}/api/admin/credits/overrides/${id}` : `${API_BASE}/api/admin/credits/overrides`,
    {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }
  );
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to save credit override: ${res.status}`));
  return res.json();
}

export async function deleteCreditOverride(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/overrides/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to delete credit override: ${res.status}`));
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

/** One (institute, programme, scheme era) group's currently-recorded credits for a paper code
 *  that disagrees with at least one other such group. */
export interface ScopeGroup {
  instituteCode: string | null;
  programCode: string | null;
  schemeEra: string;
  credits: number;
  studentCount: number;
}

/** A paper code whose already-imported subjects disagree on credits across more than one group,
 *  none of them protected by a scheme-era override — editing the base rule for it is refused. */
export interface PaperConflict {
  paperCode: string;
  groups: ScopeGroup[];
}

export async function fetchCreditConflicts(): Promise<PaperConflict[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/conflicts`);
  if (!res.ok) throw new Error(`Failed to fetch credit conflicts: ${res.status}`);
  return res.json();
}

export interface SubjectCreditOverrideResult {
  enrollmentNo: string;
  semester: number;
  paperCode: string;
  oldCredits: number;
  newCredits: number;
  oldSgpa: number | null;
  newSgpa: number | null;
}

/**
 * Hand-corrects one student's one already-imported subject's credits, bypassing credit_rules and
 * credit_rule_overrides entirely — for a paper code a scoped override can't cleanly express (see
 * SubjectCreditOverrideService's Javadoc on the backend). Touches exactly this one subject row;
 * shared rules and every other student are untouched, permanently.
 */
export async function overrideSubjectCredits(
  enrollmentNo: string,
  semester: number,
  paperCode: string,
  credits: number,
  reason: string
): Promise<SubjectCreditOverrideResult> {
  const res = await apiFetch(`${API_BASE}/api/admin/credits/subjects/override`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enrollmentNo, semester, paperCode, credits, reason }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to override subject credits: ${res.status}`));
  return res.json();
}

// ---------------------------------------------------------------------------
// Support tickets — the admin queue for reports submitted through the public
// /support form on the marketing site (ipuone_website), not this portal.
// ---------------------------------------------------------------------------

// Mirrors support/entity/SupportCategory on the backend. Covers the app end-to-end, with
// signing-up/importing-results split out on their own since onboarding is where most reports
// come from before a student ever reaches the rest of the app.
export const SUPPORT_CATEGORIES = [
  "SIGNUP_LOGIN",
  "RESULT_IMPORT",
  "RESULTS_DASHBOARD",
  "NOTICES",
  "DOCUMENTS",
  "FEES",
  "PROFILE",
  "APP_CRASH",
  "OTHER",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  SIGNUP_LOGIN: "Signing up or logging in",
  RESULT_IMPORT: "Importing results (captcha, GGSIPU login)",
  RESULTS_DASHBOARD: "Results, CGPA or marks look wrong",
  NOTICES: "Notices",
  DOCUMENTS: "Submitting documents",
  FEES: "Fee payments",
  PROFILE: "My profile",
  APP_CRASH: "App crashed or froze",
  OTHER: "Something else",
};

export type SupportTicketStatus = "OPEN" | "RESOLVED";

export interface SupportTicketResponse {
  id: number;
  name: string | null;
  email: string | null;
  enrollmentNo: string | null;
  category: SupportCategory;
  description: string;
  screenshotUrl: string | null;
  status: SupportTicketStatus;
  createdAt: string;
}

export async function fetchSupportTickets(): Promise<SupportTicketResponse[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/support/tickets`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch support tickets: ${res.status}`));
  return res.json();
}

export async function setSupportTicketStatus(id: number, status: SupportTicketStatus): Promise<SupportTicketResponse> {
  const res = await apiFetch(`${API_BASE}/api/admin/support/tickets/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to update ticket: ${res.status}`));
  return res.json();
}

// ---------------------------------------------------------------------------
// Portal status — outage windows detected on the GGSIPU result portal (see
// PortalHealthCheckScheduler on the backend) and who tried to log in during each one.
// Not institute-scoped, same as support tickets.
// ---------------------------------------------------------------------------

export interface PortalStatusSummary {
  up: boolean;
  currentOutageStartedAt: string | null;
  lastCheckedAt: string | null;
  outagesLast30Days: number;
  affectedUsersLast30Days: number;
}

export interface PortalOutageResponse {
  id: number;
  startedAt: string;
  endedAt: string | null;
  ongoing: boolean;
  durationMinutes: number;
  affectedUserCount: number;
}

export type PortalAttemptType = "CAPTCHA_FETCH" | "LOGIN";

export interface PortalOutageAttemptResponse {
  userEmail: string;
  enrollmentNo: string | null;
  attemptType: PortalAttemptType;
  firstAttemptedAt: string;
  lastAttemptedAt: string;
  attemptCount: number;
  notified: boolean;
  notifiedAt: string | null;
}

export async function fetchPortalStatusSummary(): Promise<PortalStatusSummary> {
  const res = await apiFetch(`${API_BASE}/api/admin/portal-status/summary`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch portal status: ${res.status}`));
  return res.json();
}

export async function fetchPortalOutages(): Promise<PortalOutageResponse[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/portal-status/outages`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch outages: ${res.status}`));
  return res.json();
}

export async function fetchPortalOutageAttempts(id: number): Promise<PortalOutageAttemptResponse[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/portal-status/outages/${id}/attempts`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch affected users: ${res.status}`));
  return res.json();
}

// ---------------------------------------------------------------------------
// Feedback — per-subject/faculty ratings, collected anonymously each academic term.
// Offerings/windows are narrowed server-side to the caller's own institute(s) via AdminScope;
// question-bank writes are SUPER_ADMIN only (reads are open to every admin).
// ---------------------------------------------------------------------------

export type FeedbackSubjectType = "THEORY" | "PRACTICAL";

/** A real, identity-bearing teacher account — not a free-text label. Authenticates through the
 *  same student-facing auth flow; this is just the admin-curated catalog view of one. */
export interface TeacherDto {
  id: string;
  facultyCode: string | null;
  name: string;
  title: string | null;
  instituteCode: string | null;
  active: boolean;
}

/** Creates the User row up front by email if none exists yet — this is how a teacher who hasn't
 *  logged in gets pre-registered, the same way a Student row can exist before its owner signs in. */
export interface CreateTeacherRequest {
  email: string;
  name: string;
  title: string | null;
  instituteCode: string;
  facultyCode: string | null;
}

export interface UpdateTeacherRequest {
  name: string;
  title: string | null;
  active: boolean;
  /** Corrects a wrong or missing code after creation — institute stays fixed, but this doesn't. */
  facultyCode?: string | null;
}

export async function fetchTeachers(): Promise<TeacherDto[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/teachers`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch teachers: ${res.status}`));
  return res.json();
}

export async function createTeacher(request: CreateTeacherRequest): Promise<TeacherDto> {
  const res = await apiFetch(`${API_BASE}/api/admin/teachers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to add teacher: ${res.status}`));
  return res.json();
}

export async function updateTeacher(id: string, request: UpdateTeacherRequest): Promise<TeacherDto> {
  const res = await apiFetch(`${API_BASE}/api/admin/teachers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to update teacher: ${res.status}`));
  return res.json();
}

/** A self-growing, university-wide catalog — creating an offering with an unseen subject code
 *  adds it here automatically, so coverage improves over time with no separate curation step. */
export interface SubjectCatalogEntryDto {
  id: string;
  subjectCode: string;
  subjectName: string;
  subjectType: FeedbackSubjectType;
  programCode: string | null;
}

/** Blank/omitted `search` returns the first page of the catalog rather than everything —
 *  capped at 30 matches server-side either way. */
export async function searchSubjectCatalog(search?: string): Promise<SubjectCatalogEntryDto[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/subjects${qs}`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to search subjects: ${res.status}`));
  return res.json();
}

/** Flat admin-facing shape — institute/program as codes, not linked entities. */
export interface TeachingOfferingDto {
  id: string;
  subjectCode: string;
  subjectName: string;
  subjectType: FeedbackSubjectType;
  teacherId: string;
  teacherName: string;
  instituteCode: string;
  programCode: string;
  batchYear: number;
  semesterNumber: number | null;
  academicTerm: string;
  isElective: boolean | null;
  active: boolean;
}

export interface CreateTeachingOfferingRequest {
  instituteCode: string;
  programCode: string;
  subjectCode: string;
  subjectName: string;
  subjectType: FeedbackSubjectType;
  teacherId: string;
  batchYear: number;
  semesterNumber: number | null;
  academicTerm: string;
  isElective: boolean;
}

/** Institute/program/batchYear/academicTerm are fixed at creation and not sent here. */
export interface UpdateTeachingOfferingRequest {
  subjectCode: string;
  subjectName: string;
  subjectType: FeedbackSubjectType;
  teacherId: string;
  semesterNumber: number | null;
  isElective: boolean;
  active: boolean;
}

export interface FeedbackWindowDto {
  id: string;
  instituteCode: string;
  academicTerm: string;
  opensAt: string;
  closesAt: string;
  resultsVisibleToAdmin: boolean;
}

/** PUT upserts by (instituteCode, academicTerm) — the same call creates or updates. */
export interface UpsertFeedbackWindowRequest {
  instituteCode: string;
  academicTerm: string;
  opensAt: string;
  closesAt: string;
  resultsVisibleToAdmin: boolean;
}

export interface FeedbackQuestionDto {
  id: string;
  questionText: string;
  subjectType: FeedbackSubjectType;
  displayOrder: number;
  active: boolean;
}

export interface CreateFeedbackQuestionRequest {
  questionText: string;
  subjectType: FeedbackSubjectType;
  displayOrder: number;
}

export interface UpdateFeedbackQuestionRequest {
  questionText: string;
  displayOrder: number;
  active: boolean;
}

export interface QuestionAnalyticsDto {
  questionId: string;
  questionText: string;
  averageRating: number;
  /** Star (1-5, as object string keys) -> response count; a missing key means zero. */
  histogram: Record<string, number>;
}

export interface OfferingAnalyticsDto {
  offeringId: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  academicTerm: string;
  averageRating: number;
  responseCount: number;
  eligibleStudentCount: number;
  submissionCount: number;
  /** submissionCount / eligibleStudentCount, as a 0-1 fraction. */
  participationRate: number;
  questionBreakdown: QuestionAnalyticsDto[];
}

export interface FeedbackAnalyticsDto {
  offerings: OfferingAnalyticsDto[];
}

export async function fetchFeedbackOfferings(academicTerm?: string): Promise<TeachingOfferingDto[]> {
  const qs = academicTerm ? `?academicTerm=${encodeURIComponent(academicTerm)}` : "";
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/offerings${qs}`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch offerings: ${res.status}`));
  return res.json();
}

export async function createFeedbackOffering(request: CreateTeachingOfferingRequest): Promise<TeachingOfferingDto> {
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/offerings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to create offering: ${res.status}`));
  return res.json();
}

export async function updateFeedbackOffering(
  id: string,
  request: UpdateTeachingOfferingRequest
): Promise<TeachingOfferingDto> {
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/offerings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to update offering: ${res.status}`));
  return res.json();
}

export async function fetchFeedbackWindows(): Promise<FeedbackWindowDto[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/windows`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch feedback windows: ${res.status}`));
  return res.json();
}

export async function upsertFeedbackWindow(request: UpsertFeedbackWindowRequest): Promise<FeedbackWindowDto> {
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/windows`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to save feedback window: ${res.status}`));
  return res.json();
}

/** Any admin may read the question bank; only a super admin may write to it. */
export async function fetchFeedbackQuestions(): Promise<FeedbackQuestionDto[]> {
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/questions`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch questions: ${res.status}`));
  return res.json();
}

export async function createFeedbackQuestion(request: CreateFeedbackQuestionRequest): Promise<FeedbackQuestionDto> {
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to create question: ${res.status}`));
  return res.json();
}

export async function updateFeedbackQuestion(
  id: string,
  request: UpdateFeedbackQuestionRequest
): Promise<FeedbackQuestionDto> {
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/questions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to update question: ${res.status}`));
  return res.json();
}

export async function fetchFeedbackAnalytics(academicTerm?: string, programCode?: string): Promise<FeedbackAnalyticsDto> {
  const params = new URLSearchParams();
  if (academicTerm) params.set("academicTerm", academicTerm);
  if (programCode) params.set("programCode", programCode);
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/analytics${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to fetch analytics: ${res.status}`));
  return res.json();
}

/**
 * Downloads the analytics CSV as a blob rather than a plain `<a href>` — that route lives under
 * `/api/admin/**` and needs the bearer token, which a browser won't attach to a URL it resolves
 * itself (see `fetchFileObjectUrl`). The caller wraps the blob in an object URL and drives a
 * temporary `<a download>` to trigger the save.
 */
export async function fetchFeedbackAnalyticsCsv(academicTerm?: string, programCode?: string): Promise<Blob> {
  const params = new URLSearchParams();
  if (academicTerm) params.set("academicTerm", academicTerm);
  if (programCode) params.set("programCode", programCode);
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE}/api/admin/feedback/analytics/export${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to export analytics: ${res.status}`));
  return res.blob();
}
