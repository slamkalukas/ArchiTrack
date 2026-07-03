import { redirect } from "next/navigation";
import { requireRole, requireUser } from "@/lib/authz";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

/**
 * Admin app shell: left sidebar (logo, Projects, Inbox, Settings, profile) per
 * spec/06-ui-ux.md §2. Every route in the (admin) group is ADMIN-only. Missing session
 * cookies are redirected by the proxy middleware before reaching here; this handles
 * expired/invalid tokens (→ /login) and CLIENT users (→ their portal).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireRole("ADMIN");
  } catch {
    const authenticated = await requireUser().catch(() => null);
    redirect(authenticated ? "/portal" : "/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar userName={user.name} userEmail={user.email} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
