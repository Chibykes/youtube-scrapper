import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE, getSessionSecret } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get(AUTH_COOKIE)?.value === getSessionSecret();
  redirect(isAuthed ? "/dashboard" : "/login");
}
