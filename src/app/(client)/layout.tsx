import { requireRole } from "@/lib/authz";
import { ClientTopbar } from "@/components/layout/client-topbar";

/**
 * Client portal app shell: top bar only (logo, language, bell, avatar), content
 * max-width 1100px centered, mobile-first — spec/06-ui-ux.md §2.
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("CLIENT");

  return (
    <div className="min-h-screen bg-background">
      <ClientTopbar userName={user.name} />
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
