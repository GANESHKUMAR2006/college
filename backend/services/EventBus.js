const EventEmitter = require('events');

/**
 * Global application Event Bus (Singleton) for decoupled event-driven service execution.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow many active dashboard subscriptions/schedulers
  }

  /**
   * Publishes an event to all registered listeners and logs the dispatch.
   * @param {string} eventName - Event identifier (e.g. 'StudentUpdated')
   * @param {object} payload - Event payload
   */
  emit(eventName, payload) {
    // Print audit log for internal tracking
    console.log(`[EventBus] Dispatching event: "${eventName}"`, JSON.stringify(payload || {}));
    return super.emit(eventName, payload);
  }
}

// Export a singleton instance
module.exports = new EventBus();
