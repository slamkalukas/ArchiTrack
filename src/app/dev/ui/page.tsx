import { notFound } from "next/navigation";
import { DevUiShowcase } from "./showcase";

/**
 * Dev-only component showcase — spec/06-ui-ux.md §6 / spec/07-agent-workplan.md §4.2
 * (wave-2 acceptance milestone). Renders every shared component with mock data in both
 * SK and EN. Not available in production builds.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DevUiShowcase />;
}
