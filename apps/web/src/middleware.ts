import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'zion8_access';
const REFRESH_COOKIE = 'zion8_refresh';

export function middleware(request: NextRequest): NextResponse {
  const hasAccess = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const hasRefresh = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!hasAccess && !hasRefresh) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/workspace/:path*',
    '/onboarding/:path*',
    '/home',
    '/people/:path*',
    '/people',
    '/community/:path*',
    '/memory/:path*',
    '/memory',
    '/sermons/:path*',
    '/sermons',
    '/accounting/:path*',
    '/accounting',
  ],
};
