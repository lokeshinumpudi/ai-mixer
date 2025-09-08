'use client';

import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import { CheckCircleFillIcon, DiamondIcon, WarningIcon } from './icons';

import { Button } from './ui/button';

const iconsByType: Record<'success' | 'error', ReactNode> = {
  success: <CheckCircleFillIcon />,
  error: <WarningIcon />,
};

export function toast(props: Omit<ToastProps, 'id'>) {
  return sonnerToast.custom((id) => (
    <Toast id={id} type={props.type} description={props.description} />
  ));
}

export function upgradeToast(props: Omit<UpgradeToastProps, 'id'>) {
  return sonnerToast.custom(
    (id) => (
      <UpgradeToast
        id={id}
        title={props.title}
        description={props.description}
        actionText={props.actionText}
      />
    ),
    {
      duration: 8000, // Show longer for upgrade toasts
    },
  );
}

function Toast(props: ToastProps) {
  const { id, type, description } = props;

  const descriptionRef = useRef<HTMLDivElement>(null);
  const [multiLine, setMultiLine] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;

    const update = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      const lines = Math.round(el.scrollHeight / lineHeight);
      setMultiLine(lines > 1);
    };

    update(); // initial check
    const ro = new ResizeObserver(update); // re-check on width changes
    ro.observe(el);

    return () => ro.disconnect();
  }, [description]);

  useEffect(() => {
    const prefersReduced = matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const el = containerRef.current;
    if (!el) return;
    if (prefersReduced) return;

    // Mount animation
    let raf = 0;
    const start = () => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px)';
      raf = requestAnimationFrame(() => {
        el.style.transition =
          'opacity 220ms ease-out, transform 220ms ease-out';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    };

    start();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="flex w-full toast-mobile:w-[356px] justify-center">
      <div
        ref={containerRef}
        data-testid="toast"
        key={id}
        className={cn(
          'bg-zinc-100 p-3 rounded-lg w-full toast-mobile:w-fit flex flex-row gap-3',
          multiLine ? 'items-start' : 'items-center',
        )}
      >
        <div
          data-type={type}
          className={cn(
            'data-[type=error]:text-red-600 data-[type=success]:text-green-600',
            { 'pt-1': multiLine },
          )}
        >
          {iconsByType[type]}
        </div>
        <div ref={descriptionRef} className="text-zinc-950 text-sm">
          {description}
        </div>
      </div>
    </div>
  );
}

function UpgradeToast(props: UpgradeToastProps) {
  const { id, title, description, actionText } = props;
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const el = containerRef.current;
    if (!el) return;
    if (prefersReduced) return;

    // Mount animation
    let raf = 0;
    const start = () => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px)';
      raf = requestAnimationFrame(() => {
        el.style.transition =
          'opacity 220ms ease-out, transform 220ms ease-out';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    };

    start();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="flex w-full toast-mobile:w-[400px] justify-center">
      <div
        ref={containerRef}
        data-testid="upgrade-toast"
        key={id}
        className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-lg w-full shadow-lg"
      >
        <div className="flex items-start gap-3">
          <div className="text-amber-600 mt-0.5">
            <DiamondIcon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-amber-800 mb-1">{title}</div>
            <div className="text-sm text-amber-700 mb-3">{description}</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  sonnerToast.dismiss(id);
                  if (actionText === 'Upgrade to Pro') {
                    const paymentUrl =
                      process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || '';
                    if (paymentUrl) {
                      window.open(paymentUrl, '_blank');
                    } else {
                      console.error(
                        'Payment URL not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL.',
                      );
                      // Fallback to settings page
                      window.location.href = '/settings';
                    }
                  } else {
                    // Fallback to login for other action texts
                    window.location.href = '/login';
                  }
                }}
              >
                {actionText}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-amber-700 hover:text-amber-800 hover:bg-amber-100 text-xs h-8"
                onClick={() => sonnerToast.dismiss(id)}
              >
                Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToastProps {
  id: string | number;
  type: 'success' | 'error';
  description: string;
}

interface UpgradeToastProps {
  id: string | number;
  title: string;
  description: string;
  actionText: string;
}
