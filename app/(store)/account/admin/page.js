import { redirect } from "next/navigation";

// Convenience: people naturally try /account/admin. The admin panel lives at /admin (it checks the role itself).
export default function AccountAdminRedirect() {
  redirect("/admin");
}
