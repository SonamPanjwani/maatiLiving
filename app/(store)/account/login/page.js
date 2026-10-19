import { redirect } from "next/navigation";
import AuthPage from "@/components/account/AuthPage";
import { LoginForm } from "@/components/account/AuthForms";
import { getCurrentUser, safeNextPath } from "@/src/lib/auth";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }) {
  const next = safeNextPath(searchParams?.next);
  const current = await getCurrentUser();
  if (current) redirect(current.profile?.role === "admin" && next === "/account" ? "/admin" : next);
  const initialError = searchParams?.error === "link" ? "That link has expired or was already used. Please try again." : null;
  return <AuthPage eyebrow="MY ACCOUNT" title={<>Welcome<br /><em>back.</em></>} intro="Sign in to see your orders and use your saved addresses.">
    <LoginForm next={next} initialError={initialError} />
  </AuthPage>;
}
