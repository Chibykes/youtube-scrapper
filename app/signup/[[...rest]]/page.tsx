import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import AuthView from "@/components/AuthView";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const { userId, sessionStatus } = await auth();
  if (userId && sessionStatus !== "pending") {
    redirect("/dashboard");
  }

  return (
    <AuthShell>
      <AuthView mode="sign-up" />
    </AuthShell>
  );
}
