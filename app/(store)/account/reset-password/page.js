import AuthPage from "@/components/account/AuthPage";
import { ResetPasswordForm } from "@/components/account/AuthForms";
import { requireCustomerPage } from "@/src/lib/auth";

export const metadata = { title: "Set a new password", robots: { index: false } };

// Reached from the reset email via /auth/callback, which signs the user in first.
export default async function ResetPasswordPage() {
  await requireCustomerPage("/account/reset-password");
  return <AuthPage eyebrow="MY ACCOUNT" title={<>Choose a new<br /><em>password.</em></>}>
    <ResetPasswordForm />
  </AuthPage>;
}
