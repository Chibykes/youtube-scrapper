import { SignIn } from "@clerk/nextjs";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell>
      <SignIn path="/login" signUpUrl="/signup" />
    </AuthShell>
  );
}
