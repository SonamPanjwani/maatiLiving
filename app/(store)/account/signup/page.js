import { redirect } from "next/navigation";
import AuthPage from "@/components/account/AuthPage";
import { SignupForm } from "@/components/account/AuthForms";
import { getCurrentUser, safeNextPath } from "@/src/lib/auth";

export const metadata = { title: "Create an account — Maati Living", robots: { index: false } };

export default async function SignupPage({ searchParams }) {
  const next = safeNextPath(searchParams?.next);
  if (await getCurrentUser()) redirect(next);
  return <AuthPage eyebrow="MY ACCOUNT" title={<>Make yourself<br /><em>at home.</em></>} intro="An account keeps your orders in one place and remembers your addresses. You can always check out as a guest too.">
    <SignupForm next={next} />
  </AuthPage>;
}
