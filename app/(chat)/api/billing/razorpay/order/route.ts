import { authenticatedRoute } from '@/lib/auth-decorators';
import { createPaymentRecord } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const POST = authenticatedRoute(async (request, context, user) => {
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
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return new ChatSDKError(
        'bad_request:api',
        'Missing Razorpay credentials. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      ).toResponse();
    }

    // Create Razorpay order via REST API (server-side).
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString(
          'base64',
        )}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt: `rcpt_${Date.now()}`,
        notes: {
          planName,
          planType,
          userId: user.id,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let cause = 'Failed to create order';
      try {
        const parsed = JSON.parse(errText);
        const description =
          parsed?.error?.description || parsed?.message || parsed?.error;
        if (description) {
          cause = `${cause}: ${description}`;
        }
      } catch (_) {
        // Fallback to plain text from Razorpay
        if (errText) {
          cause = `${cause}: ${errText}`;
        }
      }
      console.error('Razorpay order error', errText);
      return new ChatSDKError('bad_request:api', cause).toResponse();
    }

    const order = await res.json();

    await createPaymentRecord({
      userId: user.id,
      orderId: order.id,
      amountPaise,
      currency,
    });

    return Response.json({
      orderId: order.id,
      amountPaise,
      currency,
      keyId,
    });
  } catch (error) {
    console.error(error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
});
