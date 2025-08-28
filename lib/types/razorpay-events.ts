/**
 * Razorpay Webhook Event Types
 *
 * This file contains all the event types that Razorpay sends via webhooks.
 * These enums ensure type safety and consistency across the application.
 *
 * @see https://razorpay.com/docs/webhooks/payloads/payments/
 */

/**
 * All possible Razorpay webhook event types
 */
export enum RazorpayEvent {
  // Payment events
  PAYMENT_AUTHORIZED = 'payment.authorized',
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_FAILED = 'payment.failed',

  // Order events
  ORDER_PAID = 'order.paid',

  // Payment downtime events
  PAYMENT_DOWNTIME_STARTED = 'payment.downtime.started',
  PAYMENT_DOWNTIME_RESOLVED = 'payment.downtime.resolved',
  PAYMENT_DOWNTIME_UPDATED = 'payment.downtime.updated',

  // Subscription events (if using subscriptions)
  SUBSCRIPTION_ACTIVATED = 'subscription.activated',
  SUBSCRIPTION_CHARGED = 'subscription.charged',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_PAUSED = 'subscription.paused',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  SUBSCRIPTION_PENDING = 'subscription.pending',
  SUBSCRIPTION_HALTED = 'subscription.halted',
  SUBSCRIPTION_COMPLETED = 'subscription.completed',

  // Refund events (if handling refunds)
  REFUND_PROCESSED = 'refund.processed',
  REFUND_FAILED = 'refund.failed',
  REFUND_SPEED_CHANGED = 'refund.speed.changed',
}

/**
 * Events that indicate successful payment completion and should trigger credit addition
 */
export const PAYMENT_SUCCESS_EVENTS = [
  RazorpayEvent.PAYMENT_CAPTURED,
  RazorpayEvent.ORDER_PAID,
] as const;

/**
 * Events that our webhook actively processes (not just logs)
 */
export const PROCESSED_EVENTS = [
  ...PAYMENT_SUCCESS_EVENTS,
  RazorpayEvent.PAYMENT_AUTHORIZED,
  RazorpayEvent.PAYMENT_FAILED,
  RazorpayEvent.SUBSCRIPTION_ACTIVATED,
  RazorpayEvent.REFUND_PROCESSED,
  RazorpayEvent.REFUND_FAILED,
  RazorpayEvent.PAYMENT_DOWNTIME_STARTED,
  RazorpayEvent.PAYMENT_DOWNTIME_RESOLVED,
  RazorpayEvent.PAYMENT_DOWNTIME_UPDATED,
] as const;

/**
 * Events related to payment failures that should trigger user notifications
 */
export const PAYMENT_FAILURE_EVENTS = [
  RazorpayEvent.PAYMENT_FAILED,
  RazorpayEvent.REFUND_FAILED,
] as const;

/**
 * Events related to subscription lifecycle
 */
export const SUBSCRIPTION_EVENTS = [
  RazorpayEvent.SUBSCRIPTION_ACTIVATED,
  RazorpayEvent.SUBSCRIPTION_CHARGED,
  RazorpayEvent.SUBSCRIPTION_CANCELLED,
  RazorpayEvent.SUBSCRIPTION_PAUSED,
  RazorpayEvent.SUBSCRIPTION_RESUMED,
  RazorpayEvent.SUBSCRIPTION_PENDING,
  RazorpayEvent.SUBSCRIPTION_HALTED,
  RazorpayEvent.SUBSCRIPTION_COMPLETED,
] as const;

/**
 * Events related to service downtime that may affect payment processing
 */
export const DOWNTIME_EVENTS = [
  RazorpayEvent.PAYMENT_DOWNTIME_STARTED,
  RazorpayEvent.PAYMENT_DOWNTIME_RESOLVED,
  RazorpayEvent.PAYMENT_DOWNTIME_UPDATED,
] as const;

/**
 * Type guard to check if an event is a payment success event
 */
export function isPaymentSuccessEvent(
  event: string,
): event is (typeof PAYMENT_SUCCESS_EVENTS)[number] {
  return PAYMENT_SUCCESS_EVENTS.includes(event as any);
}

/**
 * Type guard to check if an event is a processed event
 */
export function isProcessedEvent(
  event: string,
): event is (typeof PROCESSED_EVENTS)[number] {
  return PROCESSED_EVENTS.includes(event as any);
}

/**
 * Type guard to check if an event is a subscription event
 */
export function isSubscriptionEvent(
  event: string,
): event is (typeof SUBSCRIPTION_EVENTS)[number] {
  return SUBSCRIPTION_EVENTS.includes(event as any);
}

/**
 * Type guard to check if an event is a downtime event
 */
export function isDowntimeEvent(
  event: string,
): event is (typeof DOWNTIME_EVENTS)[number] {
  return DOWNTIME_EVENTS.includes(event as any);
}
