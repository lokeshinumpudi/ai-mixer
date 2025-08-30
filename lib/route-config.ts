/**
 * Centralized route access control configuration
 *
 * This file defines which routes require authentication and which are public.
 * Add new routes here instead of hardcoding them in middleware.
 */

export interface RouteConfig {
  /** Routes that are completely public (no auth required) */
  public: string[];
  /** Routes that require authentication */
  protected: string[];
  /** Routes that have conditional access (handled by route itself) */
  conditional: string[];
}

export const ROUTE_CONFIG: RouteConfig = {
  /**
   * PUBLIC ROUTES - No authentication required
   * These routes can be accessed by anyone, including external services
   */
  public: [
    // NextAuth.js routes
    '/api/auth/**',

    // Webhooks (external services)
    '/api/billing/razorpay/webhook',
    '/api/billing/stripe/webhook',

    // Health checks and monitoring
    '/api/health',
    '/api/ping',

    // Public data endpoints (if any)
    '/api/public/**',

    // File serving (if public)
    '/api/files/public/**',
  ],

  /**
   * PROTECTED ROUTES - Authentication required
   * These routes require a valid session token
   */
  protected: [
    // Chat functionality
    '/api/chat',
    '/api/chat/**',

    // User data
    '/api/history',
    '/api/usage/**',
    '/api/models',

    // Document management
    '/api/document',
    '/api/suggestions',

    // User actions
    '/api/vote',
    '/api/files/upload',

    // Billing (user-specific)
    '/api/billing/status',
    '/api/billing/razorpay/order',
  ],

  /**
   * CONDITIONAL ROUTES - Access determined by route logic
   * These routes handle their own authentication logic
   * (e.g., guest access with limitations)
   */
  conditional: [
    // Routes that might allow guest access
    '/api/chat/guest',
    '/api/models/public',
  ],
};

/**
 * Check if a route matches any pattern in the given array
 */
function matchesPattern(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Convert glob patterns to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches everything
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/\//g, '\\/'); // Escape forward slashes

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(pathname);
  });
}

/**
 * Determine the access level for a given pathname
 */
export function getRouteAccessLevel(
  pathname: string,
): 'public' | 'protected' | 'conditional' {
  if (matchesPattern(pathname, ROUTE_CONFIG.public)) {
    return 'public';
  }

  if (matchesPattern(pathname, ROUTE_CONFIG.conditional)) {
    return 'conditional';
  }

  if (matchesPattern(pathname, ROUTE_CONFIG.protected)) {
    return 'protected';
  }

  // Default to protected for API routes, public for pages
  return pathname.startsWith('/api/') ? 'protected' : 'public';
}

/**
 * Helper function to add new routes to configuration
 */
export function addPublicRoute(pattern: string) {
  ROUTE_CONFIG.public.push(pattern);
}

export function addProtectedRoute(pattern: string) {
  ROUTE_CONFIG.protected.push(pattern);
}

export function addConditionalRoute(pattern: string) {
  ROUTE_CONFIG.conditional.push(pattern);
}
