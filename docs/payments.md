# Payment Flow - Razorpay Hosted Payment Pages

## Architecture Overview

```mermaid
flowchart TD
  U["User"]
  P["Pricing Page (/pricing) builds HPP URL<br/>- prefill: email, name, full_name<br/>- notes: userId, plan, reference_id<br/>- redirects: success/failure"]
  H["Razorpay Hosted Payment Page"]
  RZ["Razorpay Platform"]
  WH["Webhook /api/billing/razorpay/webhook<br/>- verify signature<br/>- read notes.userId<br/>- add credit (amount→tokens)<br/>- optional: set subscription"]
  DB["DB (Payment, CreditLedger, Subscription)"]
  SUC["Success Page (/billing/success)<br/>- shows IDs<br/>- polls verification status"]
  STATUS["Status API /api/billing/status<br/>- checks recent 'purchase' credits since t-5m"]
  SET["Settings Page (/settings)"]
  FAIL["Failure Page (/billing/failure)"]

  U -->|"Click Upgrade"| P
  P -->|"Redirect to HPP"| H
  H -->|"User completes payment"| RZ
  RZ -->|"payment.captured webhook"| WH
  WH -->|"Update"| DB

  H -->|"Success redirect_url"| SUC
  SUC -->|"Poll every 5s"| STATUS
  STATUS -->|"hasRecentPurchaseCredit = true"| SUC
  SUC -->|"Show confirmed"| SET

  H -->|"Cancel/Failure cancel_url"| FAIL
```

## Key Components

- **Hosted Payment Page**: Razorpay-hosted checkout with prefilled user data
- **Webhook**: Source of truth for payment verification and user crediting
- **Success Verification**: Polls DB status until webhook processes payment
- **Database Tables**: Payment, CreditLedger, Subscription for tracking
