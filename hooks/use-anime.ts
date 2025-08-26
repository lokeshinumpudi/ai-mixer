'use client';

import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import type { AnimationParams, TargetsParam } from 'animejs';

export function useAnimeOnMount<T extends HTMLElement = HTMLElement>(
  config: Omit<AnimationParams, 'targets'>,
  dependencies: any[] = [],
) {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    if (elementRef.current) {
      animate(elementRef.current as unknown as TargetsParam, config);
    }
  }, dependencies);

  return elementRef;
}

export function useAnimeControls() {
  const createAnimation = (
    targets: TargetsParam,
    config: Omit<AnimationParams, 'targets'>,
  ) => {
    return animate(targets, config);
  };

  const staggerAnimation = (
    targets: TargetsParam,
    config: Omit<AnimationParams, 'targets' | 'delay'>,
    staggerDelay = 100,
  ) => {
    return animate(targets, { delay: stagger(staggerDelay), ...config });
  };

  const hoverAnimation = (
    element: HTMLElement,
    hoverConfig: Omit<AnimationParams, 'targets'>,
    leaveConfig: Omit<AnimationParams, 'targets'>,
  ) => {
    const handleMouseEnter = () => {
      animate(element as unknown as TargetsParam, hoverConfig);
    };

    const handleMouseLeave = () => {
      animate(element as unknown as TargetsParam, leaveConfig);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  };

  return {
    createAnimation,
    staggerAnimation,
    hoverAnimation,
  };
}

export function useAnimeStagger(
  selector: TargetsParam,
  config: Omit<AnimationParams, 'targets' | 'delay'>,
  staggerDelay = 100,
  trigger = true,
) {
  useEffect(() => {
    if (trigger) {
      animate(selector, { delay: stagger(staggerDelay), ...config });
    }
  }, [selector, staggerDelay, trigger]);
}
