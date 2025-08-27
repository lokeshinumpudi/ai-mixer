import { auth } from '@/app/(auth)/auth';
import { addCredit, updatePaymentFromWebhook } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

// Fallback payment verification for when webhooks fail
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const { paymentId, orderId, signature, amount } = await request.json();

    if (!paymentId || !orderId) {
      return new ChatSDKError(
        'bad_request:api',
        'Missing payment details',
      ).toResponse();
    }

    // Verify payment with Razorpay API
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new ChatSDKError(
        'bad_request:api',
        'Razorpay configuration missing',
      ).toResponse();
    }

    // Verify signature if provided
    if (signature && orderId && paymentId) {
      const body = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(body)
        .digest('hex');

      if (signature !== expectedSignature) {
        return new ChatSDKError(
          'unauthorized:api',
          'Invalid payment signature',
        ).toResponse();
      }
    }

    // Fetch payment details from Razorpay
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString(
      'base64',
    );
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
    );

    if (!paymentResponse.ok) {
      return new ChatSDKError(
        'bad_request:api',
        'Failed to verify payment with Razorpay',
      ).toResponse();
    }

    const paymentData = await paymentResponse.json();

    // Check if payment is captured
    if (paymentData.status !== 'captured') {
      return new ChatSDKError(
        'bad_request:api',
        'Payment not captured',
      ).toResponse();
    }

    // Check if this payment belongs to the current user
    const orderResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${orderId}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
    );

    let userIdFromOrder = null;
    if (orderResponse.ok) {
      const orderData = await orderResponse.json();
      userIdFromOrder = orderData.notes?.userId;
    }

    const userIdFromPayment = paymentData.notes?.userId;
    const userId = userIdFromOrder || userIdFromPayment;

    if (userId !== session.user.id) {
      return new ChatSDKError(
        'forbidden:api',
        'Payment does not belong to current user',
      ).toResponse();
    }

    // Update payment status
    await updatePaymentFromWebhook({
      orderId,
      paymentId,
      status: 'captured',
    });

    // Add credit to user account
    const amountPaise = Number(paymentData.amount);
    if (Number.isFinite(amountPaise)) {
      const tokens = Math.floor(amountPaise / 100) * 100; // 100 tokens per INR
      await addCredit({
        userId: session.user.id,
        tokensDelta: tokens,
        reason: 'purchase',
      });

      return Response.json({
        success: true,
        tokensAdded: tokens,
        paymentId,
        orderId,
        message: 'Payment verified and credit added',
      });
    }

    return new ChatSDKError(
      'bad_request:api',
      'Invalid payment amount',
    ).toResponse();
  } catch (error) {
    console.error('Payment verification error:', error);
    return new ChatSDKError(
      'bad_request:api',
      'Payment verification failed',
    ).toResponse();
  }
}
