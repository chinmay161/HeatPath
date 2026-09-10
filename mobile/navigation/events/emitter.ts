import {
  NavigationEvents,
  type NavigationEventType,
  type NavigationEventPayloadMap,
} from '../models';

export type EventHandler<E extends NavigationEventType> = (
  payload: NavigationEventPayloadMap[E]
) => void;

type AnyHandler = (payload: unknown) => void;

/**
 * Type-safe pub/sub event emitter for internal navigation domain events.
 */
export class NavigationEventEmitter {
  private readonly listeners: Map<NavigationEventType, Set<AnyHandler>> = new Map();

  /**
   * Subscribe to a navigation event. Returns an unsubscribe function.
   */
  public on<E extends NavigationEventType>(
    event: E,
    handler: EventHandler<E>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as AnyHandler);

    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Unsubscribe a handler from a navigation event.
   */
  public off<E extends NavigationEventType>(
    event: E,
    handler: EventHandler<E>
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler as AnyHandler);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit a navigation event with its strongly-typed payload.
   */
  public emit<E extends NavigationEventType>(
    event: E,
    payload: NavigationEventPayloadMap[E]
  ): void {
    const set = this.listeners.get(event);
    if (set && set.size > 0) {
      const handlers = Array.from(set);
      for (const handler of handlers) {
        try {
          (handler as EventHandler<E>)(payload);
        } catch (error) {
          if (__DEV__) {
            console.error(`[NavigationEventEmitter] Error in listener for event '${event}':`, error);
          }
        }
      }
    }
  }

  /**
   * Remove all listeners across all events.
   */
  public clear(): void {
    this.listeners.clear();
  }
}

export { NavigationEvents };
