import {
  LayoutDashboard,
  Megaphone,
  Users,
  FileCheck2,
  GraduationCap,
  Landmark,
  Receipt,
  Calculator,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AdminSession } from "./api";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** University-wide configuration an institute's Student Cell has no business changing. */
  superOnly?: boolean;
}

/**
 * The single description of the portal's sections, shared by the sidebar and the route guard so
 * a page can never be hidden from the nav but still reachable by typing its URL.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/notices", label: "Notices", icon: Megaphone },
  { href: "/students", label: "Students", icon: Users },
  { href: "/documents", label: "Documents", icon: FileCheck2 },
  { href: "/fees", label: "Fee Payments", icon: Receipt },
  { href: "/credits", label: "Credits", icon: Calculator },
  { href: "/courses", label: "Courses", icon: GraduationCap, superOnly: true },
  { href: "/institutes", label: "Institutes", icon: Landmark, superOnly: true },
  { href: "/admins", label: "Admins", icon: ShieldCheck, superOnly: true },
];

export function navItemsFor(session: AdminSession | null): NavItem[] {
  const isSuper = session?.role === "SUPER_ADMIN";
  return NAV_ITEMS.filter((item) => isSuper || !item.superOnly);
}

/**
 * Unknown paths are allowed through — they are Next.js's 404 to handle, not ours. This is a
 * convenience so an institute admin who bookmarked a super-admin page lands somewhere sensible;
 * the backend refuses those endpoints regardless.
 */
export function isRouteAllowed(pathname: string, session: AdminSession | null): boolean {
  if (session?.role === "SUPER_ADMIN") return true;
  const item = NAV_ITEMS.find((i) => i.href === pathname || (i.href !== "/" && pathname.startsWith(`${i.href}/`)));
  return !item?.superOnly;
}
