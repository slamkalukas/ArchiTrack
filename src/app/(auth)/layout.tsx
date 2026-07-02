/**
 * Minimal placeholder layout for the (auth) route group — login, invite acceptance,
 * password reset. WP-2 owns the real split-screen brand design (spec/06-ui-ux.md §3.1);
 * this just provides a centered container so the routes are usable end-to-end now.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
