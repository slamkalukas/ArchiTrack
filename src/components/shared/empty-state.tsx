import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Empty state with a one-line explanation + thin-line illustration slot, per
 * spec/06-ui-ux.md §4.3 ("empty states teach"). Pass an icon (lucide, stroke-width 1)
 * for the illustration; falls back to a simple architectural sketch mark.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground [&_svg]:size-6 [&_svg]:stroke-[1.25]">
        {icon ?? <DefaultSketch />}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="font-serif text-base text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function DefaultSketch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
