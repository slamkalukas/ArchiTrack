/**
 * Minimal placeholder layout for the (client) route group. WP-2 owns the real top-bar
 * shell (spec/06-ui-ux.md §2).
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
