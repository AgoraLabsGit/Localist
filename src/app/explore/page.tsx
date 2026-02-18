import { redirect } from "next/navigation";

/**
 * /explore redirects to home with Explore tab active.
 * All app content (tabs, search, filter) lives on the home page for a consistent layout.
 */
export default function ExplorePage() {
  redirect("/?tab=explore");
}
