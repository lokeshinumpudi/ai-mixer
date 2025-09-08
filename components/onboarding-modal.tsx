"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FREE_MODELS, PRICING, PRO_MODELS } from "@/lib/constants";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Check,
  Crown,
  MessageSquareCode,
  Play,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5, ease: "easeOut" },
};

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [hasStartedTour, setHasStartedTour] = useState(false);

  // Track engagement time for analytics
  const [startTime] = useState(Date.now());
  const [stepStartTime, setStepStartTime] = useState(Date.now());

  useEffect(() => {
    if (currentStep > 0 && !hasStartedTour) {
      setHasStartedTour(true);
    }
    setStepStartTime(Date.now());
  }, [currentStep, hasStartedTour]);

  const steps = [
    {
      title: "🚀 Welcome to AI Mixer",
      subtitle: "Compare AI models like never before",
      content: (
        <div className="space-y-8">
          {/* Hero Section */}
          <motion.div {...scaleIn} className="text-center">
            <div className="mx-auto mb-6 size-20 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg">
              <MessageSquareCode className="size-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Get Better AI Answers
            </h3>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
              Why settle for one AI opinion? Compare responses from multiple
              models and find the perfect answer every time.
            </p>
          </motion.div>

          {/* Interactive Demo */}
          <motion.div
            {...fadeInUp}
            transition={{ delay: 0.3 }}
            className="relative rounded-xl overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 shadow-lg"
          >
            <div className="p-6">
              <div className="space-y-4">
                {/* User Question */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="size-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-green-600">
                      You
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    "Write a Python function to find prime numbers"
                  </p>
                </div>

                {/* AI Responses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border-l-4 border-blue-500"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="size-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-600">
                        GPT-4
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      "Here's an efficient implementation using the Sieve of
                      Eratosthenes..."
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 }}
                    className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 border-l-4 border-purple-500"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="size-4 text-purple-600" />
                      <span className="text-xs font-semibold text-purple-600">
                        Claude
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                        <Star className="size-2 fill-yellow-400 text-yellow-400" />
                        <Star className="size-2 text-gray-300" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      "I'll create a simple prime checker with optimization for
                      larger numbers..."
                    </p>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0 }}
                  className="text-center pt-2"
                >
                  <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-medium">
                    <Trophy className="size-3" />
                    Choose the best answer instantly!
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Value Proposition */}
          <motion.div
            {...fadeInUp}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 px-4 py-2 rounded-full text-sm font-medium text-blue-700 dark:text-blue-300">
              <Sparkles className="size-4" />
              Join 10,000+ users getting better AI answers
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      title: "⚡ Instant Model Comparison",
      subtitle: "See all perspectives at once",
      content: (
        <div className="space-y-6">
          <motion.div {...fadeInUp} className="text-center">
            <div className="mx-auto mb-6 size-18 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Zap className="size-9 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3">
              Compare {FREE_MODELS.length}+ AI Models Side-by-Side
            </h3>
            <p className="text-muted-foreground text-base leading-relaxed">
              Get diverse perspectives on any question. From coding to creative
              writing, see how different AI models approach your problems.
            </p>
          </motion.div>

          {/* Benefits Grid */}
          <motion.div
            variants={{
              animate: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <motion.div
              variants={fadeInUp}
              className="p-4 rounded-lg border bg-card text-center"
            >
              <div className="size-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                <MessageSquareCode className="size-6 text-blue-600" />
              </div>
              <h4 className="font-semibold mb-2">Side-by-Side</h4>
              <p className="text-sm text-muted-foreground">
                Compare responses instantly without switching tabs
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="p-4 rounded-lg border bg-card text-center"
            >
              <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <Star className="size-6 text-green-600" />
              </div>
              <h4 className="font-semibold mb-2">Best Quality</h4>
              <p className="text-sm text-muted-foreground">
                Find the most accurate and helpful response
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="p-4 rounded-lg border bg-card text-center"
            >
              <div className="size-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="size-6 text-purple-600" />
              </div>
              <h4 className="font-semibold mb-2">Save Time</h4>
              <p className="text-sm text-muted-foreground">
                No more copying questions to different AI tools
              </p>
            </motion.div>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            {...fadeInUp}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-4 rounded-lg border text-center"
          >
            <div className="flex items-center justify-center gap-1 mb-2">
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              <Star className="size-4 fill-yellow-400 text-yellow-400" />
              <span className="ml-2 text-sm font-medium">4.9/5 rating</span>
            </div>
            <p className="text-sm text-muted-foreground">
              "Finally! No more switching between ChatGPT and Claude" - Sarah K.
            </p>
          </motion.div>
        </div>
      ),
    },
    {
      title: "🎯 Start Free, Upgrade When Ready",
      subtitle: "Try it risk-free",
      content: (
        <div className="space-y-6">
          <motion.div {...fadeInUp} className="text-center">
            <div className="mx-auto mb-6 size-18 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Crown className="size-9 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3">
              Start Comparing AI Models Right Now
            </h3>
            <p className="text-muted-foreground text-base leading-relaxed">
              Begin with our free plan, then upgrade to Pro when you're ready
              for unlimited comparisons.
            </p>
          </motion.div>

          {/* Pricing Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Free Plan */}
            <motion.div {...fadeInUp} className="p-5 rounded-lg border bg-card">
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">
                  <Zap className="size-4" />
                  Free Plan
                </div>
                <div className="text-2xl font-bold">$0</div>
                <div className="text-sm text-muted-foreground">
                  {PRICING.FREE_TIER.dailyMessages} messages/day
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                {FREE_MODELS.slice(0, 3).map((model) => (
                  <li key={model} className="flex items-center gap-2">
                    <Check className="size-4 text-green-600" />
                    <span>{model.split("/")[1]}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  <span>Compare up to 3 models</span>
                </li>
              </ul>
            </motion.div>

            {/* Pro Plan */}
            <motion.div
              {...fadeInUp}
              transition={{ delay: 0.2 }}
              className="p-5 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 relative"
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  MOST POPULAR
                </div>
              </div>
              <div className="text-center mb-4 mt-2">
                <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full text-sm font-medium text-purple-700 dark:text-purple-300 mb-3">
                  <Crown className="size-4" />
                  Pro Plan
                </div>
                <div className="text-2xl font-bold">
                  ₹{PRICING.PAID_TIER.priceInRupees}
                </div>
                <div className="text-sm text-muted-foreground">
                  {PRICING.PAID_TIER.monthlyMessages} messages/month
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  <span className="font-medium">
                    All {PRO_MODELS.length} premium models
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  <span>Advanced reasoning models</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  <span>File uploads & vision</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  <span>Priority support</span>
                </li>
              </ul>
            </motion.div>
          </div>

          {/* Urgency/Scarcity */}
          <motion.div
            {...fadeInUp}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800"
          >
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-2">
                <Sparkles className="size-4" />
                Limited Time: Try Pro Free
              </div>
              <p className="text-sm text-muted-foreground">
                Start with free plan, upgrade anytime. Cancel within 7 days for
                full refund.
              </p>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      title: "🚀 You're All Set!",
      subtitle: "Start comparing AI models now",
      content: (
        <div className="space-y-6">
          <motion.div {...scaleIn} className="text-center">
            <div className="mx-auto mb-6 size-20 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Play className="size-10 text-white ml-1" />
            </div>
            <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Ready to Get Better AI Answers?
            </h3>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
              Your AI comparison tool is ready! Ask any question and see how
              different models respond.
            </p>
          </motion.div>

          {/* Quick Start CTA */}
          <motion.div
            {...fadeInUp}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-xl border-2 border-dashed border-primary/30"
          >
            <div className="text-center space-y-4">
              <h4 className="font-bold text-lg">Try This First Question:</h4>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border shadow-sm max-w-md mx-auto">
                <p className="text-sm font-medium text-left">
                  "Explain quantum computing in simple terms"
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Watch how different AI models explain the same concept!
              </p>
            </div>
          </motion.div>

          {/* Success Metrics */}
          <motion.div
            {...fadeInUp}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-3 gap-4 text-center"
          >
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">10k+</div>
              <div className="text-xs text-muted-foreground">Happy Users</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">1M+</div>
              <div className="text-xs text-muted-foreground">Comparisons</div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600">4.9★</div>
              <div className="text-xs text-muted-foreground">User Rating</div>
            </div>
          </motion.div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    // Track step completion time
    const timeOnStep = Date.now() - stepStartTime;
    console.log(`Step ${currentStep} completed in ${timeOnStep}ms`);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Track total onboarding time
      const totalTime = Date.now() - startTime;
      console.log(`Onboarding completed in ${totalTime}ms`);
      onClose();
    }
  };

  const handleSkip = () => {
    // Track skip behavior
    const timeBeforeSkip = Date.now() - startTime;
    console.log(
      `Onboarding skipped at step ${currentStep} after ${timeBeforeSkip}ms`
    );
    onClose();
  };

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto w-[95vw] sm:w-full border-2 border-primary/20">
        <div className="sticky top-0 z-10 bg-background px-4 py-4 sm:px-6 border-b">
          <DialogHeader className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {steps[currentStep].title}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {steps[currentStep].subtitle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  {currentStep + 1} of {steps.length}
                </span>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {steps[currentStep].content}
          </motion.div>
        </div>

        <div className="px-4 py-2 sm:px-6">
          <div className="flex justify-center gap-3">
            {steps.map((step, index) => (
              <button
                type="button"
                key={`step-${index}-${step.title}`}
                onClick={() => handleStepClick(index)}
                className={`relative transition-all duration-200 ${
                  index === currentStep
                    ? "w-8 h-2 bg-primary rounded-full"
                    : index < currentStep
                    ? "size-2 bg-primary/60 rounded-full hover:bg-primary/80"
                    : "size-2 bg-muted-foreground/30 rounded-full hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 sm:px-6 border-t">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex gap-2 w-full sm:w-auto">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="w-full sm:w-auto"
                >
                  Previous
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground w-full sm:w-auto"
              >
                Skip Tour
              </Button>
            </div>

            <Button
              onClick={handleNext}
              size="lg"
              className={`${
                currentStep === steps.length - 1
                  ? "bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 shadow-lg"
                  : "bg-primary hover:bg-primary/90"
              } transition-all duration-200 w-full sm:w-auto`}
            >
              {currentStep === steps.length - 1 ? (
                <>
                  Start Comparing Now
                  <ArrowRight className="ml-2 size-4" />
                </>
              ) : (
                "Next"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
