/**
 * Session Configuration Constants
 *
 * Centralized configuration for session management across the application.
 * These values are critical for security and should be carefully managed.
 */

export const SESSION_CONFIG = {
  /**
   * Session expiry durations in milliseconds
   */
  EXPIRY: {
    /** Standard session duration - 24 hours */
    DEFAULT: 24 * 60 * 60 * 1000,

    /** Short session for sensitive operations - 1 hour */
    SHORT: 60 * 60 * 1000,

    /** Extended session for trusted environments - 7 days */
    EXTENDED: 7 * 24 * 60 * 60 * 1000,

    /** Remember me session - 30 days */
    REMEMBER_ME: 30 * 24 * 60 * 60 * 1000,

    /** Guest session for unauthenticated users - 2 hours */
    GUEST: 2 * 60 * 60 * 1000,
  },

  /**
   * Session expiry in human-readable format
   */
  EXPIRY_LABELS: {
    DEFAULT: '24 hours',
    SHORT: '1 hour',
    EXTENDED: '7 days',
    REMEMBER_ME: '30 days',
    GUEST: '2 hours',
  },

  /**
   * Session refresh thresholds
   */
  REFRESH: {
    /** Refresh session when less than 2 hours remain */
    THRESHOLD: 2 * 60 * 60 * 1000,

    /** Grace period for session refresh - 5 minutes */
    GRACE_PERIOD: 5 * 60 * 1000,
  },

  /**
   * Data retention and analysis periods
   */
  ANALYTICS: {
    /** Usage history tracking period - 30 days */
    USAGE_HISTORY: 30 * 24 * 60 * 60 * 1000,

    /** Activity log retention - 90 days */
    ACTIVITY_LOG: 90 * 24 * 60 * 60 * 1000,

    /** Audit trail retention - 1 year */
    AUDIT_TRAIL: 365 * 24 * 60 * 60 * 1000,
  },

  /**
   * Payment and billing timeouts
   */
  PAYMENTS: {
    /** Payment verification window - 1 hour (accounts for processing delays and testing) */
    VERIFICATION_WINDOW: 60 * 60 * 1000,

    /** Webhook processing timeout - 30 seconds */
    WEBHOOK_TIMEOUT: 30 * 1000,

    /** Payment completion grace period - 5 minutes */
    COMPLETION_GRACE: 5 * 60 * 1000,
  },
} as const;

/**
 * Session utility functions
 */
export const SessionUtils = {
  /**
   * Generate session expiry date from now
   */
  getExpiryDate(
    durationType: keyof typeof SESSION_CONFIG.EXPIRY = 'DEFAULT',
  ): string {
    const duration = SESSION_CONFIG.EXPIRY[durationType];
    return new Date(Date.now() + duration).toISOString();
  },

  /**
   * Check if session is near expiry
   */
  isNearExpiry(expires: string): boolean {
    const expiryTime = new Date(expires).getTime();
    const now = Date.now();
    const timeRemaining = expiryTime - now;

    return timeRemaining <= SESSION_CONFIG.REFRESH.THRESHOLD;
  },

  /**
   * Check if session is expired
   */
  isExpired(expires: string): boolean {
    const expiryTime = new Date(expires).getTime();
    const now = Date.now();

    return now >= expiryTime;
  },

  /**
   * Get remaining time in session
   */
  getRemainingTime(expires: string): number {
    const expiryTime = new Date(expires).getTime();
    const now = Date.now();

    return Math.max(0, expiryTime - now);
  },

  /**
   * Create a session object with proper expiry
   */
  createSession(
    user: any,
    durationType: keyof typeof SESSION_CONFIG.EXPIRY = 'DEFAULT',
  ) {
    return {
      user,
      expires: this.getExpiryDate(durationType),
    };
  },
} as const;

/**
 * Type definitions for session configuration
 */
export type SessionDurationType = keyof typeof SESSION_CONFIG.EXPIRY;
export type SessionExpiryConfig = typeof SESSION_CONFIG.EXPIRY;
export type SessionConfig = typeof SESSION_CONFIG;
