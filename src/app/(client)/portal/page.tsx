import { requireUser } from "@/lib/authz";

/**
 * Placeholder client portal route so `/` can redirect CLIENT users somewhere real.
 * WP-7 owns the actual "Prehľad" showpiece home (spec/06-ui-ux.md §3.6).
 */
export default async function PortalPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-serif text-3xl">Vitajte, {user.name}</h1>
      <p className="mt-2 text-muted-foreground">Your project overview will live here.</p>
    </main>
  );
}
