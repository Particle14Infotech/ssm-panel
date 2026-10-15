import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and internal next routes are skipped
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Token retrieval from cookies or authorization header
  const token =
    request.cookies.get("authToken")?.value ||
    request.cookies.get("token")?.value;

  const role = request.cookies.get("userRole")?.value;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password");

  const isProtectedCustomerRoute =
    pathname.startsWith("/app") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/wallet") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/services-catalog") ||
    pathname.startsWith("/new-order");

  const isProtectedAdminRoute = pathname.startsWith("/admin");

  // 1. Unauthenticated users cannot access customer or admin areas
  if (!token && (isProtectedCustomerRoute || isProtectedAdminRoute)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Non-admin users cannot access admin routes
  if (token && isProtectedAdminRoute && role && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  // 3. Authenticated users visiting login/register get redirected to dashboard
  if (token && isAuthPage) {
    if (role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  // Add no-store cache headers for all dynamic routes
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/orders/:path*",
    "/wallet/:path*",
    "/support/:path*",
    "/services-catalog/:path*",
    "/new-order/:path*",
    "/login",
    "/register",
  ],
};
