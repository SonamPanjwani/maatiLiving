import AdminBar from "@/components/admin/AdminBar";
import SetupNotice from "@/components/admin/SetupNotice";
import { requireAdminPage } from "@/src/lib/auth";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";

export const dynamic = "force-dynamic";

// Second gate after middleware: signed in AND role = admin.
export default async function AdminPanelLayout({ children }) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  const { user } = await requireAdminPage();
  return <>
    <AdminBar email={user.email} />
    <main className="admin-page">{children}</main>
  </>;
}
