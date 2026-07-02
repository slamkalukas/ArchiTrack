/**
 * Public exports of the notifications feature module. `NotificationBellContainer` is
 * meant to be dropped into WP-2's `AdminSidebar` / `ClientTopbar` (or their successors)
 * to replace the static/empty bell with a live one — see this module's README note in
 * the WP-6 final report for the exact integration point.
 */
export { NotificationBellContainer } from "@/features/notifications/components/notification-bell-container";
export { useNotifications } from "@/features/notifications/hooks/use-notifications";
export { useLiveEvents } from "@/features/notifications/hooks/use-live-events";
export type { UseLiveEventsOptions } from "@/features/notifications/hooks/use-live-events";
export { runDailyDigest } from "@/features/notifications/server/digest";
export {
  notifyTaskStatusChanged,
  notifyFileAdded,
  notifyPhaseDone,
  notifyMilestoneReached,
  notifyInviteEvent,
  notifyExpiryWarning,
} from "@/features/notifications/server/triggers";
export { notifyUsers } from "@/features/notifications/server/notify";
export * from "@/features/notifications/schemas";
