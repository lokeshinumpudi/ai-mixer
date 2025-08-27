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
import { Check, ArrowLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { PRICING, FREE_MODELS, PRO_MODELS } from '@/lib/constants';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export default function PricingPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const [isLoading, setIsLoading] = useState(false);
  const hostedPageUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || '';
  }, []);

  async function handleUpgrade() {
    if (!isLoggedIn) return;

    try {
      setIsLoading(true);
      if (!hostedPageUrl) {
        alert(
          'Payment page not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL.',
        );
        return;
      }

      const url = new URL(hostedPageUrl);
      if (session?.user?.name)
        url.searchParams.set('prefill[name]', session.user.name);
      const email = (session?.user as any)?.email as string | undefined;
      if (email) url.searchParams.set('prefill[email]', email);
      if (session?.user?.id) {
        url.searchParams.set('notes[userId]', session.user.id);
      }
      url.searchParams.set('notes[plan]', PRICING.PAID_TIER.name);
      if (session?.user?.id) {
        url.searchParams.set(
          'reference_id',
          `${session.user.id}-${Date.now()}`,
        );
      }

      // Optional: add return_url so HPP redirects back after payment; also configure in Dashboard
      url.searchParams.set(
        'redirect_url',
        `${window.location.origin}/billing/success`,
      );
      url.searchParams.set(
        'cancel_url',
        `${window.location.origin}/billing/failure`,
      );
      window.location.href = url.toString();
    } catch (error) {
      console.error(error);
      alert('Payment initiation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} />
              Back to Chat
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose between our free tier with basic models or pro tier with all
            models and higher limits
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="text-2xl">
                {PRICING.FREE_TIER.name}
              </CardTitle>
              <CardDescription>{PRICING.FREE_TIER.description}</CardDescription>
              <div className="text-3xl font-bold">₹0</div>
              <div className="text-sm text-muted-foreground">Forever free</div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>
                    {PRICING.FREE_TIER.dailyMessages} messages per day
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>{FREE_MODELS.length} free models</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>Basic support</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>Export chat history</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Free Models Include:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Grok 3 Mini (Fast & Reasoning)</li>
                  <li>• GPT-3.5 Turbo</li>
                  <li>• Llama 3.1 8B</li>
                  <li>• Gemma2 9B</li>
                  <li>• Nova Micro</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant="outline"
                disabled={!isLoggedIn}
              >
                {isLoggedIn ? 'Current Plan' : 'Sign Up to Start'}
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className="relative border-primary/50 shadow-lg">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">
                {PRICING.PAID_TIER.name}
              </CardTitle>
              <CardDescription>{PRICING.PAID_TIER.description}</CardDescription>
              <div className="text-3xl font-bold">
                ₹{PRICING.PAID_TIER.priceInRupees}
              </div>
              <div className="text-sm text-muted-foreground">per month</div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>
                    {PRICING.PAID_TIER.monthlyMessages} messages per month
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>
                    All {FREE_MODELS.length + PRO_MODELS.length} models
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>Priority support</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>Advanced features</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  <span>Everything in Free</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Pro Models Include:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Grok 3 (Advanced Reasoning)</li>
                  <li>• GPT-4o Mini</li>
                  <li>• Claude 3.5 Haiku</li>
                  <li>• Gemini 2.0 Flash</li>
                  <li>• Nova Lite</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              {isLoggedIn ? (
                <Button
                  className="w-full"
                  onClick={handleUpgrade}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing…' : 'Upgrade to Pro'}
                </Button>
              ) : (
                <Button className="w-full" asChild>
                  <Link href="/login">Sign Up for Pro</Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  What counts as a message?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Each question you send to the AI counts as one message. The
                  AI's response doesn't count against your limit. Tool calls
                  (like search) may consume additional credits.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Can I change plans anytime?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time.
                  Changes take effect immediately, and you'll be charged or
                  credited on a pro-rated basis.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  What happens if I exceed my message limit?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Free users will need to wait until their daily limit resets.
                  Pro users who exceed their monthly limit can continue using
                  free models or upgrade to a higher tier.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We offer a 7-day money-back guarantee for all paid plans. If
                  you're not satisfied, contact our support team for a full
                  refund.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center">
          <div className="bg-muted/50 rounded-2xl p-12">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of users who are already using AI to boost their
              productivity
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href={isLoggedIn ? '/settings' : '/login'}>
                  {isLoggedIn ? 'Manage Subscription' : 'Start Free Trial'}
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/">Try Free Models</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
