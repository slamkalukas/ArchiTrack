import { requireRole } from "@/lib/authz";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

/**
 * Admin app shell: left sidebar (logo, Projects, Inbox, Settings, profile) per
 * spec/06-ui-ux.md §2. Every route in the (admin) group is ADMIN-only.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar userName={user.name} userEmail={user.email} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
