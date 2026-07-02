import "server-only";

/**
 * Realtime event bus (spec/02-architecture.md §5, spec/05-api.md §7).
 *
 * Single Next.js app container ⇒ a plain in-process EventEmitter is enough; if the app
 * is ever scaled to >1 replica, swap the implementation for Postgres LISTEN/NOTIFY (or
 * Redis pub/sub) behind this same `EventBus` interface — callers never construct the
 * emitter directly, so the swap is localized to this file.
 */

/** Event names fixed by spec/05-api.md §7 (SSE endpoint `GET /api/events`). */
export type AppEventName =
  | "chat.message"
  | "notification.new"
  | "task.updated"
  | "file.added"
  | "typing";

interface BaseEventPayload {
  projectId: string;
  entityId: string;
}

export interface ChatMessageEvent extends BaseEventPayload {
  authorId: string;
}

export interface NotificationNewEvent {
  /** Notifications are per-user, not per-project — projectId is optional context. */
  userId: string;
  projectId?: string;
  entityId: string;
}

export interface TaskUpdatedEvent extends BaseEventPayload {
  status?: string;
}

export interface FileAddedEvent extends BaseEventPayload {
  folderId?: string | null;
}

export interface TypingEvent extends BaseEventPayload {
  userId: string;
}

export interface AppEventPayloads {
  "chat.message": ChatMessageEvent;
  "notification.new": NotificationNewEvent;
  "task.updated": TaskUpdatedEvent;
  "file.added": FileAddedEvent;
  typing: TypingEvent;
}

export type AppEvent<K extends AppEventName = AppEventName> = {
  [P in K]: { name: P; payload: AppEventPayloads[P] };
}[K];

type Listener = (event: AppEvent) => void;

/** Behind-an-interface contract so the SSE route and publishers never touch Node's EventEmitter directly. */
export interface EventBus {
  publish<K extends AppEventName>(name: K, payload: AppEventPayloads[K]): void;
  subscribe(listener: Listener): () => void;
}

class InProcessEventBus implements EventBus {
  private listeners = new Set<Listener>();

  publish<K extends AppEventName>(name: K, payload: AppEventPayloads[K]): void {
    const event = { name, payload } as AppEvent;
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[events] listener threw for "${name}"`, error);
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const globalForEvents = globalThis as unknown as { eventBus: EventBus | undefined };

/**
 * Singleton bus, stashed on `globalThis` for the same reason as `src/lib/db.ts`
 * (survive Next.js dev hot-reload without leaking listeners on every edit).
 */
export const eventBus: EventBus = globalForEvents.eventBus ?? new InProcessEventBus();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.eventBus = eventBus;
}
