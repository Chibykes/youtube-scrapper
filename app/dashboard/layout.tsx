import { currentUser } from "@clerk/nextjs/server";
import LogoutButton from "@/components/LogoutButton";
import Logo from "@/components/Logo";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-4">
            {email && (
              <span className="hidden text-sm text-muted sm:block">
                {email}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
