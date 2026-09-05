import {
  LayoutDashboard,
  Megaphone,
  Users,
  UserCheck,
  GraduationCap,
  FileCheck2,
  Landmark,
  Receipt,
  Calculator,
  ShieldCheck,
  UserX,
  UserSearch,
  ToggleLeft,
  LifeBuoy,
  ActivitySquare,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import type { AdminSession, StudentFeature } from "./api";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** University-wide configuration an institute's Student Cell has no business changing. */
  superOnly?: boolean;
  /** Mirrors the app tab this page manages — hidden from an institute admin whose schools don't
   *  have it switched on (see Feature Flags), same as the app hides the tab itself. A super
   *  admin always sees every page regardless, since they're the one who sets the flags. */
  feature?: StudentFeature;
  /** The inverse of superOnly: a page that belongs entirely to a school's own Student Cell, with
   *  no university-wide role for a super admin to play. Hidden from the super admin's sidebar
   *  and blocked from direct navigation in the portal - the backend itself stays unrestricted
   *  for a super admin, same as everywhere else, so this is a portal-presentation choice, not a
   *  new security boundary. */
  hideFromSuperAdmin?: boolean;
}

/**
 * The single description of the portal's sections, shared by the sidebar and the route guard so
 * a page can never be hidden from the nav but still reachable by typing its URL.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/notices", label: "Notices", icon: Megaphone, feature: "NOTICES" },
  { href: "/students", label: "Students", icon: Users },
  // The institute admin doing in-person ID verification needs this, and the backend already
  // scopes the list to their own institutes - a super admin has no institute of their own to
  // review requests for, so this is entirely a Student Cell's own page now.
  { href: "/onboarding-requests", label: "Onboarding Requests", icon: UserCheck, hideFromSuperAdmin: true },
  { href: "/alumni", label: "Alumni", icon: GraduationCap },
  { href: "/documents", label: "Documents", icon: FileCheck2, feature: "DOCUMENTS" },
  { href: "/fees", label: "Fee Payments", icon: Receipt, feature: "FEES" },
  // Entirely a Student Cell's own module now - an institute admin manages their own institute's
  // offerings/windows/analytics and the university-wide question bank alike. A super admin has
  // no institute to run feedback for, so this is hidden from them rather than superOnly.
  { href: "/feedback", label: "Faculty Feedback", icon: MessageSquareText, feature: "FEEDBACK", hideFromSuperAdmin: true },
  // Not institute-scoped (see SupportTicketService's Javadoc) — every admin sees the whole
  // queue, same as a super admin would.
  { href: "/support-tickets", label: "Support Tickets", icon: LifeBuoy },
  // Also not institute-scoped — a GGSIPU portal outage isn't any one institute's problem, see
  // PortalStatusController's Javadoc on the backend.
  { href: "/portal-status", label: "Portal Status", icon: ActivitySquare },
  { href: "/credits", label: "Credits", icon: Calculator },
  // Institutes and courses are one page with a view switch — a course cannot be created without
  // naming its institute, so splitting them across two sidebar entries only made that awkward.
  { href: "/institutes", label: "Institutes & Courses", icon: Landmark, superOnly: true },
  { href: "/admins", label: "Admins", icon: ShieldCheck, superOnly: true },
  { href: "/unlinked-users", label: "Unlinked Signups", icon: UserX, superOnly: true },
  // Cross-references unlinked-users, portal-status (PortalOutageAttempt) and support-tickets for
  // the same accounts, plus a manual triage status - same SUPER_ADMIN scope as unlinked-users
  // since it's built on that same list.
  { href: "/login-issues", label: "Login Issues", icon: UserSearch, superOnly: true },
  { href: "/feature-flags", label: "Feature Flags", icon: ToggleLeft, superOnly: true },
];

function isVisible(item: NavItem, session: AdminSession | null): boolean {
  const isSuper = session?.role === "SUPER_ADMIN";
  if (isSuper) return !item.hideFromSuperAdmin;
  if (item.superOnly) return false;
  if (item.feature && !session?.enabledFeatures?.includes(item.feature)) return false;
  return true;
}

export function navItemsFor(session: AdminSession | null): NavItem[] {
  return NAV_ITEMS.filter((item) => isVisible(item, session));
}

/**
 * Unknown paths are allowed through — they are Next.js's 404 to handle, not ours. This is a
 * convenience so an institute admin who bookmarked a super-admin or not-yet-enabled page lands
 * somewhere sensible; the backend refuses those endpoints regardless.
 */
export function isRouteAllowed(pathname: string, session: AdminSession | null): boolean {
  const item = NAV_ITEMS.find((i) => i.href === pathname || (i.href !== "/" && pathname.startsWith(`${i.href}/`)));
  if (session?.role === "SUPER_ADMIN") return !item || !item.hideFromSuperAdmin;
  return !item || isVisible(item, session);
}
