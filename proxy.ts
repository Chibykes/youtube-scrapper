import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/scrape(.*)",
  "/api/send(.*)",
  "/api/wallet(.*)",
]);

const isAuthRoute = createRouteMatcher(["/login(.*)", "/signup(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    // Never run protect() on sign-in/up (including /login/tasks/*).
    // protect() treats pending session tasks as signed-out and would
    // bounce those URLs back onto themselves.
    if (isAuthRoute(request)) {
      return;
    }

    if (!isProtectedRoute(request)) {
      return;
    }

    const { sessionStatus } = await auth();
    if (sessionStatus === "pending") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    await auth.protect();
  },
  {
    // Hardcoded so Next.js 16's Node proxy runtime cannot miss
    // NEXT_PUBLIC_CLERK_SIGN_IN_URL and redirect to the current URL.
    signInUrl: "/login",
    signUpUrl: "/signup",
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
