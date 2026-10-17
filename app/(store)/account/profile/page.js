import AccountShell from "@/components/account/AccountShell";
import { ResetPasswordForm } from "@/components/account/AuthForms";
import ProfileForm from "@/components/account/ProfileForm";
import { requireCustomerPage } from "@/src/lib/auth";

export const metadata = { title: "My profile", robots: { index: false } };

export default async function ProfilePage({ searchParams }) {
  const { user, profile } = await requireCustomerPage("/account/profile");
  return <AccountShell active="/account/profile" name={profile?.full_name} title={<>Your<br /><em>details.</em></>}>
    {searchParams?.password === "updated" && <p className="admin-success" role="status">Password updated.</p>}
    <div className="account-panel"><h2 className="eyebrow">PROFILE</h2><ProfileForm profile={profile} email={user.email} /></div>
    <div className="account-panel"><h2 className="eyebrow">CHANGE PASSWORD</h2><ResetPasswordForm /></div>
  </AccountShell>;
}
