// middleware.ts
import { withAuth, NextRequestWithAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

function getDashboardPath(role: UserRole | undefined): string {
  console.log('[MIDW_GET_DASHBOARD_PATH] Input role:', role);
  switch (role) {
    case UserRole.SUPER_ADMIN: return '/super-admin/dashboard';
    case UserRole.SCHOOL_ADMIN: return '/school-admin/dashboard';
    case UserRole.TEACHER: return '/teacher/dashboard';
    case UserRole.STUDENT: return '/student/dashboard';
    default:
      console.log('[MIDW_GET_DASHBOARD_PATH] Role not recognized or undefined, defaulting to /auth/login');
      return '/login';
  }
}

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    console.log(`[MIDDLEWARE_MAIN] Pathname: ${pathname}`);
    console.log(`[MIDDLEWARE_MAIN] Token:`, JSON.stringify(token, null, 2));

    if (!token) {
      // This case should ideally be caught by `authorized` callback,
      // but acts as a failsafe.
      console.log('[MIDDLEWARE_MAIN] No token found, redirecting to login.');
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname === '/') {
      const dashboardPath = getDashboardPath(token.role as UserRole);
      console.log(`[MIDDLEWARE_MAIN] User at root. Redirecting to their dashboard: ${dashboardPath}`);
      return NextResponse.redirect(new URL(dashboardPath, req.url));
    }

    if (pathname.startsWith('/super-admin') && token.role !== UserRole.SUPER_ADMIN) {
      const userDashboard = getDashboardPath(token.role as UserRole);
      console.log(`[MIDDLEWARE_MAIN] Role mismatch for /super-admin. User role: ${token.role}. Redirecting to ${userDashboard}`);
      return NextResponse.redirect(new URL(userDashboard, req.url));
    }
    if (pathname.startsWith('/school-admin') && token.role !== UserRole.SCHOOL_ADMIN) {
      const userDashboard = getDashboardPath(token.role as UserRole);
      console.log(`[MIDDLEWARE_MAIN] Role mismatch for /school-admin. User role: ${token.role}. Redirecting to ${userDashboard}`);
      return NextResponse.redirect(new URL(userDashboard, req.url));
    }
    // Add other role checks similarly with logging

    console.log(`[MIDDLEWARE_MAIN] All checks passed for path: ${pathname}. Allowing request.`);
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        console.log(`[MIDDLEWARE_AUTHORIZED_CB] Path: ${pathname}, Token exists: ${!!token}`);
        if (token) {
          console.log(`[MIDDLEWARE_AUTHORIZED_CB] Token role: ${token.role}`);
        }

        if (pathname.startsWith('/auth/')) {
          console.log('[MIDDLEWARE_AUTHORIZED_CB] Allowing /auth path.');
          return true; // Allow access to auth pages
        }
        const isAuthorized = !!token; // User is authorized if they have a token (for non-auth pages)
        console.log(`[MIDDLEWARE_AUTHORIZED_CB] Authorization result for ${pathname}: ${isAuthorized}`);
        return isAuthorized;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\..*).*)',
  ],
};