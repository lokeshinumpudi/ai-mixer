'use client';

import { useCallback, useEffect, useState } from 'react';

const ONBOARDING_STORAGE_KEY = 'ai-chat-onboarding-completed';

interface OnboardingState {
  hasSeenOnboarding: boolean;
  shouldShowOnboarding: boolean;
}

export function useOnboarding(): OnboardingState & {
  markOnboardingComplete: () => void;
  resetOnboarding: () => void;
} {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true); // Default to true to prevent flash
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  // Initialize onboarding state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const hasCompleted = completed === 'true';

      setHasSeenOnboarding(hasCompleted);
      setShouldShowOnboarding(!hasCompleted);
    }
  }, []);

  const markOnboardingComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setHasSeenOnboarding(true);
      setShouldShowOnboarding(false);
    }
  }, []);

  const resetOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      setHasSeenOnboarding(false);
      setShouldShowOnboarding(true);
    }
  }, []);

  return {
    hasSeenOnboarding,
    shouldShowOnboarding,
    markOnboardingComplete,
    resetOnboarding,
  };
}
