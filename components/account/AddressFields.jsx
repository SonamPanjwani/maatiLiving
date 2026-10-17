import { indianStates } from "@/src/config/shop";

// Shared Indian address inputs (checkout + saved addresses). Field names match validateAddress.
// Pass `value`/`onStateChange` to control the state select (checkout recalculates delivery from it).
export default function AddressFields({ address = {}, stateValue, onStateChange, includeContact = true }) {
  const stateProps = onStateChange
    ? { value: stateValue, onChange: (event) => onStateChange(event.target.value) }
    : { defaultValue: address.state ?? "" };
  return <>
    {includeContact && <div className="field-row">
      <label className="field"><span>Full name</span><input name="name" defaultValue={address.name ?? ""} autoComplete="name" required /></label>
      <label className="field"><span>Mobile</span><input name="phone" type="tel" inputMode="numeric" defaultValue={address.phone ?? ""} autoComplete="tel-national" placeholder="10-digit number" required /></label>
    </div>}
    <label className="field"><span>House / flat, street</span><input name="addressLine1" defaultValue={address.line1 ?? ""} autoComplete="address-line1" required /></label>
    <label className="field"><span>Area, landmark <small>optional</small></span><input name="addressLine2" defaultValue={address.line2 ?? ""} autoComplete="address-line2" /></label>
    <div className="field-row">
      <label className="field"><span>City</span><input name="city" defaultValue={address.city ?? ""} autoComplete="address-level2" required /></label>
      <label className="field"><span>PIN code</span><input name="pincode" defaultValue={address.pincode ?? ""} inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[1-9][0-9]{5}" required /></label>
    </div>
    <label className="field"><span>State</span>
      <select name="state" autoComplete="address-level1" required {...stateProps}>
        <option value="" disabled>Choose a state</option>
        {indianStates.map((state) => <option key={state}>{state}</option>)}
      </select>
    </label>
  </>;
}
