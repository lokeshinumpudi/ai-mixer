'use client';

import type { UserType } from '@/app/(auth)/auth';
import { getDefaultModelForUser } from '@/lib/ai/models';
import { useEffect, useState } from 'react';

/**
 * Get cookie value by name (client-side only)
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Hook to manage the current selected model with cookie persistence
 * and plan-based defaults
 */
export function useCurrentModel(initialModel: string, userType: UserType) {
  // Initialize with plan-based default if initial model is invalid
  const [currentModel, setCurrentModel] = useState(() => {
    // Check if initialModel is valid, otherwise use plan-based default
    const planDefault = getDefaultModelForUser(userType);
    return initialModel || planDefault;
  });

  // Listen for cookie changes (when ModelPicker updates the model)
  useEffect(() => {
    const checkCookieChanges = () => {
      const cookieValue = getCookie('chat-model');

      if (cookieValue && cookieValue !== currentModel) {
        setCurrentModel(cookieValue);
      } else if (!cookieValue) {
        // No cookie found, use plan-based default
        const defaultModel = getDefaultModelForUser(userType);
        if (defaultModel !== currentModel) {
          setCurrentModel(defaultModel);
        }
      }
    };

    // Check immediately
    checkCookieChanges();

    // Set up polling to detect cookie changes (when ModelPicker updates)
    const interval = setInterval(checkCookieChanges, 500);

    return () => clearInterval(interval);
  }, [currentModel, userType]);

  return {
    currentModel,
  };
}
