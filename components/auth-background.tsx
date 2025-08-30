'use client';

import React from 'react';

/**
 * Background for auth pages. Uses layered radial gradients and a subtle grid.
 * Sits behind page content and is fully non-interactive.
 */
export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Base subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--foreground)/0.05) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)/0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage:
            'radial-gradient(ellipse at 50% 35%, black 60%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 50% 35%, black 60%, transparent 100%)',
        }}
      />

      {/* Soft glow blobs */}
      <div className="absolute -top-40 -left-40 size-[520px] rounded-full bg-blue-400/25 blur-3xl" />
      <div className="absolute top-1/2 -right-40 size-[460px] -translate-y-1/2 rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="absolute -bottom-48 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-fuchsia-400/20 blur-3xl" />

      {/* Vignette to focus center */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.25) 100%)',
        }}
      />
    </div>
  );
}

export default AuthBackground;
