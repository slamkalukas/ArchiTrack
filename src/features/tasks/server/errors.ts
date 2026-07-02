/**
 * Domain-level errors for the tasks feature that aren't plain "not authorized" cases
 * (those are `AuthzError` from `src/lib/authz`). Route handlers catch this alongside
 * `AuthzError`/`ZodError` in their try/catch and map it to the shared error envelope.
 */
export class TaskDomainError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TaskDomainError";
    this.status = status;
    this.code = code;
  }
}
