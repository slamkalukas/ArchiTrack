import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Root route: redirect to the login screen, or into the app shell once the user is
 * authenticated. WP-2/WP-3/WP-7 own the real dashboard / client-home destinations —
 * this placeholder just prevents a dead root route.
 */
export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(session.user.role === "ADMIN" ? "/dashboard" : "/portal");
}
