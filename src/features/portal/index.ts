/**
 * Public surface of the portal feature module (WP-7, spec/07-agent-workplan.md).
 * Route handlers under src/app/(client)/portal/** import from here rather than reaching
 * into internals.
 */
export * from "@/features/portal/types";
export * from "@/features/portal/server/selectors";
export * from "@/features/portal/server/home";
export * from "@/features/portal/server/gdpr";
