const isDevelopment = process.env.NODE_ENV !== 'production';

const performanceTimers = new Map();

/**
 * Enterprise-grade structured logging utility.
 */
export const logger = {
  debug(message, ...args) {
    if (isDevelopment) {
      console.log(`%c[DEBUG] ${message}`, 'color: #94a3b8', ...args);
    }
  },

  info(message, ...args) {
    console.log(`%c[INFO] ${message}`, 'color: #3b82f6; font-weight: bold', ...args);
  },

  warn(message, ...args) {
    console.warn(`%c[WARN] ${message}`, 'color: #eab308; font-weight: bold', ...args);
  },

  error(message, errorObject, ...args) {
    console.error(
      `%c[ERROR] ${message}`,
      'color: #ef4444; font-weight: bold',
      errorObject?.message || errorObject,
      ...args
    );
  },

  time(label) {
    performanceTimers.set(label, performance.now());
  },

  timeEnd(label) {
    const startTime = performanceTimers.get(label);
    if (startTime !== undefined) {
      const duration = (performance.now() - startTime).toFixed(2);
      performanceTimers.delete(label);
      this.info(`[Performance] ${label} completed in ${duration}ms`);
      return Number(duration);
    }
    return 0;
  }
};
