import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getSessionSecret } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const session = request.cookies.get(AUTH_COOKIE)?.value;
  const isAuthed = session === getSessionSecret();

  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/dashboard");

  if (isProtected && !isAuthed) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
