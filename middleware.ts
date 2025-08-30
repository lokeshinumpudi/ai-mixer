import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { isDevelopmentEnvironment } from './lib/constants';
import { getRouteAccessLevel } from './lib/route-config';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Determine route access level using centralized configuration
  const accessLevel = getRouteAccessLevel(pathname);

  // Public routes bypass all authentication
  if (accessLevel === 'public') {
    return NextResponse.next();
  }

  // Get authentication token for protected and conditional routes
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? '',
    secureCookie: !isDevelopmentEnvironment,
  });

  // Handle login page based on authentication status
  if (pathname === '/login') {
    if (token) {
      // Authenticated users trying to access login should go to home
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Unauthenticated users can access login
    return NextResponse.next();
  }

  // Redirect old register route to unified login
  if (pathname === '/register') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Conditional routes handle their own auth logic
  if (accessLevel === 'conditional') {
    return NextResponse.next();
  }

  // Protected routes require authentication
  if (accessLevel === 'protected' && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/api/:path*',
    '/login',
    '/register', // Keep for redirect to login

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
