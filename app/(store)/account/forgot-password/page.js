import AuthPage from "@/components/account/AuthPage";
import { ForgotPasswordForm } from "@/components/account/AuthForms";

export const metadata = { title: "Reset password — Maati Living", robots: { index: false } };

export default function ForgotPasswordPage() {
  return <AuthPage eyebrow="MY ACCOUNT" title={<>Forgot your<br /><em>password?</em></>} intro="Enter your email and we'll send you a link to set a new one.">
    <ForgotPasswordForm />
  </AuthPage>;
}
