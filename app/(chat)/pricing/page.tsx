'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Check } from 'lucide-react';
import { toast } from '@/components/toast';
import { useSession } from 'next-auth/react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Plan {
  name: string;
  price: number;
  amountPaise: number;
  features: string[];
  type: 'subscription' | 'credits';
  popular?: boolean;
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: 0,
    amountPaise: 0,
    features: ['3,000 tokens/month', 'Basic support', 'Standard models'],
    type: 'subscription',
  },
  {
    name: 'Pro',
    price: 499,
    amountPaise: 49900,
    features: [
      '50,000 tokens/month',
      'Priority support',
      'All models',
      'Advanced features',
    ],
    type: 'subscription',
    popular: true,
  },
  {
    name: '10K Credits',
    price: 199,
    amountPaise: 19900,
    features: ['10,000 additional tokens', 'Never expires', 'Use anytime'],
    type: 'credits',
  },
  {
    name: '25K Credits',
    price: 499,
    amountPaise: 49900,
    features: ['25,000 additional tokens', 'Never expires', 'Use anytime'],
    type: 'credits',
  },
  {
    name: '50K Credits',
    price: 999,
    amountPaise: 99900,
    features: ['50,000 additional tokens', 'Never expires', 'Use anytime'],
    type: 'credits',
  },
];

export default function PricingPage() {
  const { data: session } = useSession();

  const handlePurchase = async (plan: Plan) => {
    if (!session?.user?.id) {
      toast({ type: 'error', description: 'Please sign in to purchase' });
      return;
    }

    try {
      // Create order
      const response = await fetch('/api/billing/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: plan.amountPaise,
          currency: 'INR',
          planName: plan.name,
          planType: plan.type,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      const orderData = await response.json();

      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);

        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      // Open Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: plan.amountPaise,
        currency: 'INR',
        name: 'AI Chatbot',
        description: `${plan.name} Plan`,
        order_id: orderData.orderId,
        prefill: {
          email: session.user.email,
        },
        theme: {
          color: '#3B82F6',
        },
        handler: (response: any) => {
          toast({
            type: 'success',
            description: `Payment successful! Payment ID: ${response.razorpay_payment_id}`,
          });
          // Refresh the page or redirect to settings
          window.location.href = '/settings';
        },
        modal: {
          ondismiss: () => {
            console.log('Payment cancelled');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      toast({
        type: 'error',
        description: error.message || 'Failed to create order',
      });
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground">
          Select the perfect plan for your AI chatbot needs
        </p>
      </div>

      {/* Subscription Plans */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Subscription Plans</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {plans
            .filter((plan) => plan.type === 'subscription')
            .map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-3 py-1 text-sm font-medium rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {plan.price > 0 && (
                      <span className="text-2xl font-bold">₹{plan.price}</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {plan.price === 0 ? 'Free forever' : 'per month'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li
                        key={`${plan.name}-feature-${index}`}
                        className="flex items-center gap-2"
                      >
                        <Check className="size-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.price === 0 ? 'outline' : 'default'}
                    disabled={plan.price === 0}
                    onClick={() => handlePurchase(plan)}
                  >
                    {plan.price === 0
                      ? 'Current Plan'
                      : `Subscribe for ₹${plan.price}`}
                  </Button>
                </CardFooter>
              </Card>
            ))}
        </div>
      </div>

      {/* Credit Packs */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Credit Packs</h2>
        <p className="text-muted-foreground">
          Need extra tokens? Purchase credit packs that never expire.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {plans
            .filter((plan) => plan.type === 'credits')
            .map((plan) => (
              <Card key={plan.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    <span className="text-xl font-bold">₹{plan.price}</span>
                  </CardTitle>
                  <CardDescription>One-time purchase</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li
                        key={`${plan.name}-feature-${index}`}
                        className="flex items-center gap-2"
                      >
                        <Check className="size-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handlePurchase(plan)}
                  >
                    Buy ₹{plan.price}
                  </Button>
                </CardFooter>
              </Card>
            ))}
        </div>
      </div>

      {/* Test Mode Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>Test Mode:</strong> This is running in Razorpay test mode. Use
          test card numbers for payments. No real charges will be made.
        </p>
      </div>
    </main>
  );
}
