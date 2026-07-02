/**
 * Barrel export for the projects feature module (spec/02-architecture.md §2 feature-module
 * convention). Route handlers under `src/app/api` and admin pages under
 * `src/app/(admin)` import from here rather than reaching into `server/*` files directly.
 */
export * from "./schemas";
export * from "./types";
export * from "./server/slug";
export * from "./server/template";
export * from "./server/aggregates";
export * from "./server/queries";
export * from "./server/notify";
