import AccountShell from "@/components/account/AccountShell";
import AddressForm from "@/components/account/AddressForm";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { deleteAddress, setDefaultAddress } from "@/app/(store)/account/actions";
import { requireCustomerPage } from "@/src/lib/auth";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const metadata = { title: "My addresses", robots: { index: false } };

export default async function AddressesPage({ searchParams }) {
  const { profile } = await requireCustomerPage("/account/addresses");
  const { data: addresses } = await createSupabaseServerClient().from("addresses").select("*")
    .order("is_default", { ascending: false }).order("created_at");
  const editing = addresses?.find((address) => address.id === searchParams?.edit) ?? null;

  return <AccountShell active="/account/addresses" name={profile?.full_name} title={<>Saved<br /><em>addresses.</em></>}>
    {searchParams?.saved && <p className="admin-success" role="status">Address saved.</p>}
    {addresses?.length > 0 && <ul className="address-list">
      {addresses.map((address) => <li key={address.id} className={address.id === editing?.id ? "is-editing" : ""}>
        {address.is_default && <span className="address-default">Default</span>}
        <address className="order-address">{address.name}<br />{address.line1}<br />{address.line2 && <>{address.line2}<br /></>}{address.city}, {address.state} {address.pincode}<br />{address.phone}</address>
        <div className="address-actions">
          <a className="text-link" href={`/account/addresses?edit=${address.id}`}>Edit</a>
          {!address.is_default && <form action={setDefaultAddress}><input type="hidden" name="id" value={address.id} /><button type="submit" className="text-link">Make default</button></form>}
          <form action={deleteAddress}><input type="hidden" name="id" value={address.id} /><ConfirmSubmit message="Delete this address?" className="text-link">Delete</ConfirmSubmit></form>
        </div>
      </li>)}
    </ul>}
    <div className="account-panel">
      <h2 className="eyebrow">{editing ? "EDIT ADDRESS" : "ADD AN ADDRESS"}</h2>
      <AddressForm address={editing} />
    </div>
  </AccountShell>;
}
