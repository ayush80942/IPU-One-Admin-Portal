import { redirect } from "next/navigation";

/**
 * Admin-account management moved onto the Institutes hierarchy: Super Admins are managed from
 * the Institutes list page, and each institute's own Admins are managed from that institute's
 * page. This kept-alive route is only here for bookmarks — nothing links to it.
 */
export default function AdminsPage() {
  redirect("/institutes");
}
