/**
 * Minimal placeholder layout for the (admin) route group. WP-2 owns the real sidebar
 * shell (spec/06-ui-ux.md §2).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
