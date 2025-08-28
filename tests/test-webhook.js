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
        id: 'pay_RAfHR26aTBQgSt',
        entity: 'payment',
        amount: 100,
        currency: 'INR',
        status: 'captured',
        order_id: 'order_RAfHKMYO5CFUjX',
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
        notes: {
          email: 'inumpudi.lokesh@gmail.com',
          phone: '+919700726389',
        },
        fee: null,
        tax: null,
        error_code: null,
        error_description: null,
        error_source: null,
        error_step: null,
        error_reason: null,
        acquirer_data: {
          rrn: '238165218251',
          upi_transaction_id: 'AB1417F58499F070EB7F817B98992D35',
        },
        created_at: 1756364514,
        upi: {
          vpa: 'success@razorpay',
        },
      },
    },
  },
  created_at: 1756364515,
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
// console.log("Body:", body);
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
