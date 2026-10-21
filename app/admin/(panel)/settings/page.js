import { sendTestEmailAction } from "@/app/admin/actions";
import ShippingSettingsForm from "@/components/admin/ShippingSettingsForm";
import SubmitButton from "@/components/admin/SubmitButton";
import { isEmailConfigured } from "@/src/lib/email";
import { getShippingSettings } from "@/src/lib/settings";

export default async function SettingsPage({ searchParams }) {
  const settings = await getShippingSettings();
  const from = process.env.MAIL_FROM || "";
  return <>
    <div className="admin-heading"><div><p className="eyebrow">STORE</p><h1>Delivery charges</h1></div></div>
    <ShippingSettingsForm settings={settings} />

    <section id="email" className="admin-panel email-settings">
      <h2 className="eyebrow">ORDER EMAILS</h2>
      {isEmailConfigured
        ? <p className="admin-note">On. Order, payment and shipping emails go from <strong>{from}</strong>.</p>
        : <p className="admin-note">Off: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM aren't all set on the server (docs/DEPLOY.md, “Email”). Orders still work without email.</p>}
      {searchParams?.email === "sent" && <p className="admin-success" role="status">Test email sent to {searchParams.to}. Check the inbox (and spam) in a minute.</p>}
      {searchParams?.email === "error" && <p className="admin-error" role="alert">The test email didn't go: {searchParams.message}</p>}
      {isEmailConfigured && <form action={sendTestEmailAction} className="admin-filters">
        <label className="field" htmlFor="test-to"><span>Send a test email to <small>blank = your admin email</small></span><input id="test-to" type="email" name="to" autoComplete="email" /></label>
        <SubmitButton pendingLabel="Sending…">Send test email</SubmitButton>
      </form>}
    </section>
  </>;
}
