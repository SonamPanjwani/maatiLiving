import ShippingSettingsForm from "@/components/admin/ShippingSettingsForm";
import { getShippingSettings } from "@/src/lib/settings";

export default async function SettingsPage() {
  const settings = await getShippingSettings();
  return <>
    <div className="admin-heading"><div><p className="eyebrow">STORE</p><h1>Delivery charges</h1></div></div>
    <ShippingSettingsForm settings={settings} />
  </>;
}
