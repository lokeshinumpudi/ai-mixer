import { PRICING } from '@/lib/constants';
import {
  createPaymentEvent,
  createRefund,
  createUserNotification,
  getUser,
  setSubscriptionPlan,
  updatePaymentFromWebhook,
  updateRefundStatus,
  upsertServiceDowntime,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { headers as nextHeaders } from 'next/headers';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

// Razorpay webhook event types from official docs
// Reference: https://razorpay.com/docs/webhooks/payloads/payments/
enum RazorpayEvent {
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

// Events that indicate successful payment completion
const PAYMENT_SUCCESS_EVENTS = [
  RazorpayEvent.PAYMENT_CAPTURED,
  RazorpayEvent.ORDER_PAID,
] as const;

// Events we actively process vs just log
const PROCESSED_EVENTS = [
  ...PAYMENT_SUCCESS_EVENTS,
  RazorpayEvent.SUBSCRIPTION_ACTIVATED,
] as const;

function verifySignature(payload: string, signature: string | null) {
  if (!signature) {
    console.log('❌ No signature provided');
    return false;
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return expected === signature;
}

export async function POST(request: Request) {
  const startTime = Date.now();

  let raw: string;
  let hdrs: any;
  let sig: string | null;

  try {
    raw = await request.text();

    hdrs = await nextHeaders();
    sig = hdrs.get('x-razorpay-signature');
  } catch (error) {
    console.error('❌ Failed to read request:', error);
    return new ChatSDKError(
      'bad_request:api',
      'Failed to read webhook payload',
    ).toResponse();
  }

  let parsedEvent: any;
  try {
    parsedEvent = JSON.parse(raw);
  } catch (parseError) {
    console.error('❌ Failed to parse webhook payload:', parseError);
    return new ChatSDKError(
      'bad_request:api',
      'Invalid JSON payload',
    ).toResponse();
  }

  const eventType = parsedEvent.event as RazorpayEvent;
  const webhookId = parsedEvent.account_id || 'unknown';
  const eventId =
    parsedEvent.payload?.payment?.entity?.id ||
    parsedEvent.payload?.order?.entity?.id ||
    'unknown';

  if (!verifySignature(raw, sig)) {
    console.error('❌ Webhook signature verification failed:', {
      event: eventType,
      webhookId,
      hasSignature: !!sig,
    });
    return new ChatSDKError(
      'unauthorized:chat',
      'Invalid signature',
    ).toResponse();
  }

  try {
    // Handle payment success events
    if (PAYMENT_SUCCESS_EVENTS.includes(eventType as any)) {
      const paymentEntity = parsedEvent.payload.payment.entity;
      const orderId: string = paymentEntity.order_id;
      const paymentId: string = paymentEntity.id;
      const email: string = paymentEntity.email;
      const amountPaise = Number(paymentEntity.amount);
      const paymentMethod = paymentEntity.method;
      const paymentStatus = paymentEntity.status;

      // Update payment record if we have an order
      if (orderId) {
        await updatePaymentFromWebhook({
          orderId,
          paymentId,
          status: 'captured',
        });
      }

      // Find user by email since HPP doesn't reliably pass userId in notes
      let userId: string | undefined;

      // First try to get userId from notes (if set correctly)
      const notesUserIdFromOrder = parsedEvent.payload.order?.entity?.notes
        ?.userId as string | undefined;
      const notesUserIdFromPayment = paymentEntity?.notes?.userId as
        | string
        | undefined;
      userId = notesUserIdFromOrder || notesUserIdFromPayment;

      // Fallback: find user by email if userId not in notes
      if (!userId && email) {
        console.log('🔍 Looking up user by email:', email);
        try {
          const users = await getUser(email);
          if (users.length > 0) {
            userId = users[0].id;
            console.log('✅ Found user by email:', {
              email,
              userId,
              userCount: users.length,
            });
          } else {
            console.warn('⚠️ No users found for email:', email);
          }
        } catch (error) {
          console.error('❌ Failed to find user by email:', email, error);
        }
      }

      if (!userId) {
        console.error('❌ No userId found for payment:', {
          paymentId,
          email,
          orderNotes: parsedEvent.payload.order?.entity?.notes,
          paymentNotes: paymentEntity?.notes,
        });
        return Response.json({
          ok: false,
          error: 'User not found',
          paymentId,
          email,
        });
      }

      // Store payment event in database
      if (userId) {
        await createPaymentEvent({
          paymentId,
          orderId,
          userId,
          eventType: eventType.split('.')[1], // 'captured' or 'paid'
          status: paymentStatus,
          amountPaise,
          currency: paymentEntity.currency,
          method: paymentMethod,
          metadata: parsedEvent,
        });
      }

      // Upgrade user plan based on payment amount
      if (userId && Number.isFinite(amountPaise)) {
        console.log('✅ Payment captured successfully:', {
          userId,
          paymentId,
          amountPaise,
          currency: paymentEntity.currency,
          processingTime: `${Date.now() - startTime}ms`,
        });

        // Check if payment amount matches pro plan price
        const amountInRupees = amountPaise / 100;
        if (amountInRupees === PRICING.PAID_TIER.priceInRupees) {
          console.log('💎 Upgrading user to Pro plan:', {
            userId,
            paymentAmount: amountInRupees,
            plan: 'pro',
          });

          // Set subscription to pro plan for 1 month
          const currentPeriodEnd = new Date();
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

          await setSubscriptionPlan({
            userId,
            plan: 'pro',
            status: 'active',
            currentPeriodEnd,
          });

          // Create upgrade notification
          await createUserNotification({
            userId,
            type: 'plan_upgraded',
            title: 'Welcome to Pro!',
            message: `Your Pro plan is now active! You now have ${PRICING.PAID_TIER.monthlyMessages} messages per month and access to all premium models.`,
            metadata: {
              plan: 'pro',
              paymentId,
              amount: amountPaise,
              monthlyMessages: PRICING.PAID_TIER.monthlyMessages,
            },
          });

          console.log('🎉 User successfully upgraded to Pro plan:', {
            userId,
            plan: 'pro',
            currentPeriodEnd: currentPeriodEnd.toISOString(),
            paymentId,
          });
        } else {
          console.warn("⚠️ Payment amount doesn't match any plan:", {
            userId,
            paymentAmount: amountInRupees,
            expectedProPrice: PRICING.PAID_TIER.priceInRupees,
          });
        }
      } else {
        console.error('❌ Invalid payment parameters:', {
          userId,
          amountPaise,
        });
      }
    }

    // Handle other events
    switch (eventType) {
      case RazorpayEvent.PAYMENT_AUTHORIZED: {
        const paymentEntity = parsedEvent.payload.payment.entity;
        console.log('⏳ Payment authorized (waiting for capture):', {
          paymentId: paymentEntity.id,
          amount: paymentEntity.amount,
        });

        // Store authorized event
        const email = paymentEntity.email;
        if (email) {
          const users = await getUser(email);
          if (users.length > 0) {
            await createPaymentEvent({
              paymentId: paymentEntity.id,
              orderId: paymentEntity.order_id,
              userId: users[0].id,
              eventType: 'authorized',
              status: paymentEntity.status,
              amountPaise: paymentEntity.amount,
              currency: paymentEntity.currency,
              method: paymentEntity.method,
              metadata: parsedEvent,
            });
          }
        }
        break;
      }

      case RazorpayEvent.PAYMENT_FAILED: {
        const paymentEntity = parsedEvent.payload.payment.entity;
        console.log('❌ Payment failed:', {
          paymentId: paymentEntity.id,
          errorCode: paymentEntity.error_code,
          errorDescription: paymentEntity.error_description,
        });

        // Store failed event and notify user
        const email = paymentEntity.email;
        if (email) {
          const users = await getUser(email);
          if (users.length > 0) {
            const userId = users[0].id;

            await createPaymentEvent({
              paymentId: paymentEntity.id,
              orderId: paymentEntity.order_id,
              userId,
              eventType: 'failed',
              status: paymentEntity.status,
              amountPaise: paymentEntity.amount,
              currency: paymentEntity.currency,
              method: paymentEntity.method,
              errorCode: paymentEntity.error_code,
              errorDescription: paymentEntity.error_description,
              metadata: parsedEvent,
            });

            // Notify user about failed payment
            await createUserNotification({
              userId,
              type: 'payment_failed',
              title: 'Payment Failed',
              message: `Your payment of ₹${
                paymentEntity.amount / 100
              } could not be processed. ${
                paymentEntity.error_description || 'Please try again.'
              }`,
              metadata: {
                paymentId: paymentEntity.id,
                errorCode: paymentEntity.error_code,
                amount: paymentEntity.amount,
              },
            });
          }
        }
        break;
      }

      // Payment downtime events
      case RazorpayEvent.PAYMENT_DOWNTIME_STARTED: {
        const downtimeEntity = parsedEvent.payload['payment.downtime'].entity;
        console.warn('🚨 Payment downtime started:', {
          downtimeId: downtimeEntity.id,
          method: downtimeEntity.method,
          severity: downtimeEntity.severity,
          instrument: downtimeEntity.instrument,
        });

        // Store downtime and create notifications for admin users
        await upsertServiceDowntime({
          downtimeId: downtimeEntity.id,
          method: downtimeEntity.method,
          status: 'started',
          severity: downtimeEntity.severity,
          instrument: downtimeEntity.instrument,
          startedAt: new Date(downtimeEntity.begin * 1000),
          scheduled: downtimeEntity.scheduled || false,
        });

        // TODO: Notify admin users or display banner
        break;
      }

      case RazorpayEvent.PAYMENT_DOWNTIME_RESOLVED: {
        const downtimeEntity = parsedEvent.payload['payment.downtime'].entity;
        console.log('🔄 Payment downtime resolved:', {
          downtimeId: downtimeEntity.id,
          method: downtimeEntity.method,
          duration: `${downtimeEntity.begin} - ${downtimeEntity.end}`,
        });

        await upsertServiceDowntime({
          downtimeId: downtimeEntity.id,
          method: downtimeEntity.method,
          status: 'resolved',
          severity: downtimeEntity.severity,
          instrument: downtimeEntity.instrument,
          startedAt: new Date(downtimeEntity.begin * 1000),
          resolvedAt: new Date(downtimeEntity.end * 1000),
          scheduled: downtimeEntity.scheduled || false,
        });
        break;
      }

      case RazorpayEvent.PAYMENT_DOWNTIME_UPDATED: {
        const downtimeEntity = parsedEvent.payload['payment.downtime'].entity;
        console.warn('⚠️ Payment downtime updated:', {
          downtimeId: downtimeEntity.id,
          method: downtimeEntity.method,
          severity: downtimeEntity.severity,
        });

        await upsertServiceDowntime({
          downtimeId: downtimeEntity.id,
          method: downtimeEntity.method,
          status: 'updated',
          severity: downtimeEntity.severity,
          instrument: downtimeEntity.instrument,
          scheduled: downtimeEntity.scheduled || false,
        });
        break;
      }

      // Subscription events
      case RazorpayEvent.SUBSCRIPTION_ACTIVATED: {
        console.log('🔄 Processing subscription activation');
        const sub = parsedEvent.payload.subscription.entity;
        const subUserId = sub.notes?.userId as string | undefined;

        if (subUserId) {
          console.log('✅ Activating subscription:', {
            userId: subUserId,
            planId: sub.plan_id,
            subscriptionId: sub.id,
          });

          await setSubscriptionPlan({
            userId: subUserId,
            plan: sub.plan_id ?? 'pro',
            status: 'active',
            currentPeriodEnd: new Date(sub.current_end * 1000),
          });
        } else {
          console.error('❌ No userId in subscription notes:', sub.notes);
        }
        break;
      }

      case RazorpayEvent.SUBSCRIPTION_CHARGED:
        console.log('💰 Subscription charged:', {
          subscriptionId: parsedEvent.payload.subscription?.entity?.id,
          paymentId: parsedEvent.payload.payment?.entity?.id,
          amount: parsedEvent.payload.payment?.entity?.amount,
        });
        break;

      case RazorpayEvent.SUBSCRIPTION_CANCELLED:
      case RazorpayEvent.SUBSCRIPTION_PAUSED:
      case RazorpayEvent.SUBSCRIPTION_HALTED:
      case RazorpayEvent.SUBSCRIPTION_COMPLETED:
        console.log(`🔄 Subscription ${eventType.split('.')[1]}:`, {
          subscriptionId: parsedEvent.payload.subscription?.entity?.id,
          status: parsedEvent.payload.subscription?.entity?.status,
        });
        break;

      // Refund events
      case RazorpayEvent.REFUND_PROCESSED: {
        const refundEntity = parsedEvent.payload.refund.entity;
        console.log('💸 Refund processed:', {
          refundId: refundEntity.id,
          paymentId: refundEntity.payment_id,
          amount: refundEntity.amount,
        });

        // Find user by payment and process refund
        const paymentEntity = parsedEvent.payload.payment?.entity;
        if (paymentEntity?.email) {
          const users = await getUser(paymentEntity.email);
          if (users.length > 0) {
            const userId = users[0].id;

            await createRefund({
              refundId: refundEntity.id,
              paymentId: refundEntity.payment_id,
              userId,
              amountPaise: refundEntity.amount,
              currency: refundEntity.currency || 'INR',
              status: 'processed',
              reason: refundEntity.notes?.reason,
              razorpayCreatedAt: new Date(refundEntity.created_at * 1000),
            });

            // Notify user about refund
            await createUserNotification({
              userId,
              type: 'refund_processed',
              title: 'Refund Processed',
              message: `Your refund of ₹${
                refundEntity.amount / 100
              } has been processed and will reflect in your account within 5-7 business days.`,
              metadata: {
                refundId: refundEntity.id,
                paymentId: refundEntity.payment_id,
                amount: refundEntity.amount,
              },
            });
          }
        }
        break;
      }

      case RazorpayEvent.REFUND_FAILED: {
        const refundEntity = parsedEvent.payload.refund.entity;
        console.error('❌ Refund failed:', {
          refundId: refundEntity.id,
          paymentId: refundEntity.payment_id,
          errorCode: refundEntity.error_code,
        });

        // Update refund status to failed
        await updateRefundStatus({
          refundId: refundEntity.id,
          status: 'failed',
          errorCode: refundEntity.error_code,
        });

        // Notify user about failed refund
        const paymentEntity = parsedEvent.payload.payment?.entity;
        if (paymentEntity?.email) {
          const users = await getUser(paymentEntity.email);
          if (users.length > 0) {
            await createUserNotification({
              userId: users[0].id,
              type: 'refund_failed',
              title: 'Refund Failed',
              message: `Your refund of ₹${
                refundEntity.amount / 100
              } could not be processed. Please contact support.`,
              metadata: {
                refundId: refundEntity.id,
                errorCode: refundEntity.error_code,
                amount: refundEntity.amount,
              },
            });
          }
        }
        break;
      }

      default:
        console.log('ℹ️ Unhandled event type:', {
          event: eventType,
          eventId,
          message: 'Event received but not processed',
        });
    }

    const processingTime = Date.now() - startTime;
    const wasProcessed = PROCESSED_EVENTS.includes(eventType as any);

    console.log('🏁 Webhook processing complete:', {
      event: eventType,
      eventId,
      processed: wasProcessed,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      event: eventType,
      processed: wasProcessed,
      processingTime,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Webhook processing error:', {
      event: eventType,
      eventId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime}ms`,
    });

    return new ChatSDKError(
      'bad_request:api',
      'Webhook processing failed',
    ).toResponse();
  }
}
