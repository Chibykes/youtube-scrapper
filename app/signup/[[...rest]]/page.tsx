import { SignUp } from "@clerk/nextjs";
import AuthShell from "@/components/AuthShell";

export default function SignupPage() {
  return (
    <AuthShell>
      <SignUp path="/signup" signInUrl="/login" />
    </AuthShell>
  );
}
