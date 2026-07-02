import { requireRole } from "@/lib/authz";

/**
 * Placeholder admin dashboard route so `/` can redirect ADMIN users somewhere real.
 * WP-3 owns the actual dashboard (project cards, aggregates, inbox — spec/04-features.md §2).
 */
export default async function DashboardPage() {
  const user = await requireRole("ADMIN");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-serif text-3xl">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Signed in as {user.email}. The project dashboard will live here.</p>
    </main>
  );
}
