"use client";

import { useClerk } from "@clerk/nextjs";

export default function LogoutButton() {
  const { signOut } = useClerk();

  return (
    <button
      onClick={() => signOut({ redirectUrl: "/login" })}
      className="border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
    >
      Log out
    </button>
  );
}
