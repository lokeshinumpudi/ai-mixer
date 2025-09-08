'use client';

import type { ReactNode } from 'react';

interface LoadingStateProps {
  children?: ReactNode;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  className = '',
}: Omit<LoadingStateProps, 'children' | 'message'>) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-b-2 border-gray-900 ${sizeClasses[size]}`}
      />
    </div>
  );
}

export function PageLoadingState({
  message = 'Loading...',
  size = 'lg',
  className = '',
}: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center min-h-screen ${className}`}
    >
      <LoadingSpinner size={size} />
      {message && <p className="mt-4 text-gray-600 text-sm">{message}</p>}
    </div>
  );
}

export function InlineLoadingState({
  message,
  size = 'sm',
  className = '',
}: LoadingStateProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LoadingSpinner size={size} />
      {message && <span className="text-gray-600 text-sm">{message}</span>}
    </div>
  );
}

export function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-gray-200 rounded size-full" />
    </div>
  );
}

interface ErrorStateProps {
  error: string | Error;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  error,
  onRetry,
  className = '',
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-screen p-8 ${className}`}
    >
      <div className="text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-6 max-w-md">{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center min-h-screen p-8 ${className}`}
    >
      <div className="text-center">
        {icon && <div className="text-6xl mb-4">{icon}</div>}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        {description && (
          <p className="text-gray-600 mb-6 max-w-md">{description}</p>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// Hook for managing async operations with loading/error states
export function useAsyncState() {
  return {
    loading: false,
    error: null as string | null,
    data: null as any,
  };
}
