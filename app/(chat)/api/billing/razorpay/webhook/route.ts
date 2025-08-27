import { headers as nextHeaders } from 'next/headers';
import crypto from 'node:crypto';
import { ChatSDKError } from '@/lib/errors';
import {
  addCredit,
  setSubscriptionPlan,
  updatePaymentFromWebhook,
} from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

function verifySignature(payload: string, signature: string | null) {
  if (!signature) return false;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return expected === signature;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const hdrs = await nextHeaders();
  const sig = hdrs.get('x-razorpay-signature');
  if (!verifySignature(raw, sig)) {
    return new ChatSDKError(
      'unauthorized:chat',
      'Invalid signature',
    ).toResponse();
  }

  const event = JSON.parse(raw);
  try {
    if (event.event === 'payment.captured') {
      const paymentEntity = event.payload.payment.entity;
      const orderId: string = paymentEntity.order_id;
      const paymentId: string = paymentEntity.id;

      if (orderId) {
        await updatePaymentFromWebhook({
          orderId,
          paymentId,
          status: 'captured',
        });
      }

      // For MVP: treat captured payments as credit top-ups of full amount * 100 tokens per INR
      // Support both Orders flow (order.notes) and Payment Pages (payment.notes)
      const notesUserIdFromOrder = event.payload.order?.entity?.notes?.userId as
        | string
        | undefined;
      const notesUserIdFromPayment = paymentEntity?.notes?.userId as
        | string
        | undefined;
      const userId = notesUserIdFromOrder || notesUserIdFromPayment;
      const amountPaise = Number(paymentEntity.amount);

      if (userId && Number.isFinite(amountPaise)) {
        const tokens = Math.floor(amountPaise / 100) * 100; // 100 tokens per INR
        await addCredit({ userId, tokensDelta: tokens, reason: 'purchase' });
      }
    }

    if (event.event === 'subscription.activated') {
      const sub = event.payload.subscription.entity;
      const userId = sub.notes?.userId as string | undefined;
      if (userId) {
        await setSubscriptionPlan({
          userId,
          plan: sub.plan_id ?? 'pro',
          status: 'active',
          currentPeriodEnd: new Date(sub.current_end * 1000),
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
}
