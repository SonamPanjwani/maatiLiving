import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import SetupNotice from "@/components/admin/SetupNotice";
import { getCurrentAdmin } from "@/src/lib/auth";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { siteConfig } from "@/src/config/site";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  if (await getCurrentAdmin()) redirect("/admin/products");

  const initialError = searchParams?.error === "not-admin" ? "This account doesn't have admin access." : null;
  return <div className="admin-login">
    <div className="admin-login-panel">
      <img className="admin-login-logo" src={siteConfig.logoUrl} alt="Maati Living" />
      <p className="eyebrow">ADMIN</p>
      <h1>Welcome<br /><em>back.</em></h1>
      <LoginForm initialError={initialError} />
    </div>
  </div>;
}
