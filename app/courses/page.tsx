import { redirect } from "next/navigation";

/**
 * Courses moved onto the Institutes page, which now shows either list behind a view switch.
 * This kept-alive route is only here for bookmarks — nothing links to it.
 */
export default function CoursesPage() {
  redirect("/institutes");
}
