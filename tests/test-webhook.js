import crypto from 'node:crypto';

// Configuration
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'lowkeys_test';
const webhookUrl = 'http://localhost:3000/api/billing/razorpay/webhook';

// Test payload
const testPayload = {
  entity: 'event',
  account_id: 'acc_R9ZOTETFCiXg8w',
  event: 'payment.captured',
  contains: ['payment'],
  payload: {
    payment: {
      entity: {
        id: 'pay_RBAddDEID5zYY2',
        entity: 'payment',
        amount: 24900,
        currency: 'INR',
        status: 'captured',
        order_id: 'order_RBAdRXO3yGTfgS',
        invoice_id: null,
        international: false,
        method: 'upi',
        amount_refunded: 0,
        refund_status: null,
        captured: true,
        description: null,
        card_id: null,
        bank: null,
        wallet: null,
        vpa: 'success@razorpay',
        email: 'inumpudi.lokesh@gmail.com',
        contact: '+919700726389',
        notes: { email: 'inumpudi.lokesh@gmail.com', phone: '9700726389' },
        fee: 3,
        tax: 0,
        error_code: null,
        error_description: null,
        error_source: null,
        error_step: null,
        error_reason: null,
        acquirer_data: {
          rrn: '535725148146',
          upi_transaction_id: '181B40072B9FDB1A2B603D66A5044048',
        },
        created_at: 1756474945,
        reward: null,
        upi: { vpa: 'success@razorpay' },
        base_amount: 24900,
      },
    },
  },
  created_at: 1756474946,
};

// Generate signature
const body = JSON.stringify(testPayload);
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(body)
  .digest('hex');

console.log('Webhook Test Data:');
console.log('===================');
console.log('URL:', webhookUrl);
console.log('Secret:', webhookSecret);
console.log('Body:', body);
console.log('Signature:', signature);
console.log('');

// Generate curl command
const curlCommand = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-razorpay-signature: ${signature}" \\
  -d '${body}'`;

console.log('Curl Command:');
console.log('=============');
console.log(curlCommand);
