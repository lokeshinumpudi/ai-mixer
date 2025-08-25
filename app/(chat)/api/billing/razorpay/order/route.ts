import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import { createPaymentRecord } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let body: {
    amountPaise: number;
    currency?: string;
    planName?: string;
    planType?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const amountPaise = Math.max(1, Math.floor(Number(body.amountPaise || 0)));
  const currency = body.currency || 'INR';
  const planName = body.planName || 'Unknown Plan';
  const planType = body.planType || 'credits';

  try {
    // Create Razorpay order via REST API (server-side).
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
        ).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt: `rcpt_${Date.now()}`,
        notes: {
          planName,
          planType,
          userId: session.user.id,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Razorpay order error', err);
      return new ChatSDKError(
        'bad_request:api',
        'Failed to create order',
      ).toResponse();
    }

    const order = await res.json();

    await createPaymentRecord({
      userId: session.user.id,
      orderId: order.id,
      amountPaise,
      currency,
    });

    return Response.json({
      orderId: order.id,
      amountPaise,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error(error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
}
