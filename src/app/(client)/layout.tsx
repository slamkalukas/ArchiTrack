import { redirect } from "next/navigation";
import { requireRole, requireUser } from "@/lib/authz";
import { ClientTopbar } from "@/components/layout/client-topbar";

/**
 * Client portal app shell: top bar only (logo, language, bell, avatar), content
 * max-width 1100px centered, mobile-first — spec/06-ui-ux.md §2. Missing session
 * cookies are redirected by the proxy middleware; this handles expired/invalid tokens
 * (→ /login) and ADMIN users landing on portal routes (→ dashboard).
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireRole("CLIENT");
  } catch {
    const authenticated = await requireUser().catch(() => null);
    redirect(authenticated ? "/dashboard" : "/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <ClientTopbar userName={user.name} />
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
