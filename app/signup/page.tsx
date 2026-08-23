"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SocialAuthButtons from "@/components/SocialAuthButtons";

/**
 * UI-only for now — swap this form for Clerk's <SignUp /> once auth is wired up.
 */
export default function SignupPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-2xl text-foreground">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Sign-up is opening soon — this is a preview of what it&apos;ll look
          like.
        </p>
      </div>

      <div className="border border-border bg-surface p-6">
        <SocialAuthButtons />

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm text-muted">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Jordan Lee"
              className="w-full border border-border bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full border border-border bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-muted"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full border border-border bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          {submitted ? (
            <p className="border border-border bg-surface-2 px-4 py-2.5 text-center text-sm text-muted">
              Sign-up isn&apos;t live yet — check back soon.
            </p>
          ) : (
            <button
              type="submit"
              className="w-full bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Create account
            </button>
          )}
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have access?{" "}
        <Link href="/login" className="text-foreground hover:text-accent">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
