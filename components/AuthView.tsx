"use client";

import { useEffect, useState } from "react";
import { SignIn, SignUp, useAuth, useClerk, useSession } from "@clerk/nextjs";

export default function AuthView({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { session } = useSession();
  const { signOut } = useClerk();
  const [gate, setGate] = useState<"wait" | "form">("wait");

  useEffect(() => {
    if (!isLoaded || gate === "form") return;

    // Pending session tasks (MFA, password reset) are handled by the
    // Clerk component on this catch-all route. Do not sign those out.
    if (!isSignedIn || session?.currentTask) {
      setGate("form");
      return;
    }

    // Server rendered this page as signed-out (expired / inactive session)
    // but Clerk JS still has a client session. <SignIn>/<SignUp> refuse to
    // render while signed in and bounce to /dashboard, which protect()
    // sends back here — reload loop. Drop the stale session first.
    void signOut().finally(() => setGate("form"));
  }, [gate, isLoaded, isSignedIn, session?.currentTask, signOut]);

  if (!isLoaded || gate === "wait") {
    return <p className="text-center text-sm text-muted">Loading...</p>;
  }

  if (mode === "sign-up") {
    return (
      <SignUp
        path="/signup"
        routing="path"
        signInUrl="/login"
        fallbackRedirectUrl="/dashboard"
      />
    );
  }

  return (
    <SignIn
      path="/login"
      routing="path"
      signUpUrl="/signup"
      fallbackRedirectUrl="/dashboard"
    />
  );
}
