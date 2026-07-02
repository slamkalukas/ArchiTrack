import { apiError, handleApiError } from "@/lib/api-error";
import { TaskDomainError } from "@/features/tasks/server/errors";

/**
 * Route handlers in this feature can't edit `src/lib/api-error.ts` (owned by WP-1), so
 * this wraps `handleApiError` to also translate `TaskDomainError` into the shared
 * `{ error: { code, message } }` envelope before falling back to the generic handler.
 */
export function handleTaskApiError(error: unknown) {
  if (error instanceof TaskDomainError) {
    return apiError(error.status, error.code, error.message);
  }
  return handleApiError(error);
}
