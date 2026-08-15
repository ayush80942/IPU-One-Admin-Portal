import {
  LayoutDashboard,
  Megaphone,
  Users,
  FileCheck2,
  Landmark,
  Receipt,
  Calculator,
  ShieldCheck,
  UserX,
  ToggleLeft,
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
}

/**
 * The single description of the portal's sections, shared by the sidebar and the route guard so
 * a page can never be hidden from the nav but still reachable by typing its URL.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/notices", label: "Notices", icon: Megaphone, feature: "NOTICES" },
  { href: "/students", label: "Students", icon: Users },
  { href: "/documents", label: "Documents", icon: FileCheck2, feature: "DOCUMENTS" },
  { href: "/fees", label: "Fee Payments", icon: Receipt, feature: "FEES" },
  { href: "/credits", label: "Credits", icon: Calculator },
  // Institutes and courses are one page with a view switch — a course cannot be created without
  // naming its institute, so splitting them across two sidebar entries only made that awkward.
  { href: "/institutes", label: "Institutes & Courses", icon: Landmark, superOnly: true },
  { href: "/admins", label: "Admins", icon: ShieldCheck, superOnly: true },
  { href: "/unlinked-users", label: "Unlinked Signups", icon: UserX, superOnly: true },
  { href: "/feature-flags", label: "Feature Flags", icon: ToggleLeft, superOnly: true },
];

function isVisible(item: NavItem, session: AdminSession | null): boolean {
  const isSuper = session?.role === "SUPER_ADMIN";
  if (isSuper) return true;
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
  if (session?.role === "SUPER_ADMIN") return true;
  const item = NAV_ITEMS.find((i) => i.href === pathname || (i.href !== "/" && pathname.startsWith(`${i.href}/`)));
  return !item || isVisible(item, session);
}
