"use client";

import { useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { cloudinaryConfig, isCloudinaryUploadConfigured } from "@/src/config/cloudinary";
import { billFileUrl } from "@/src/lib/books/purchases";

const FOLDER = "maati-living/bills";
const MAX_BYTES = 10_000_000;

// Uploads bill photos / PDFs straight to Cloudinary as PRIVATE ("authenticated") files, signed by our
// admin-only /api/cloudinary/sign. Keeps the list as JSON in a hidden input for the form's server action.
async function uploadBill(file) {
  if (!/^image\/|^application\/pdf$/.test(file.type)) throw new Error(`${file.name}: only photos and PDFs can be attached.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 10 MB. Please use a smaller photo or PDF.`);
  const paramsToSign = { folder: FOLDER, timestamp: Math.floor(Date.now() / 1000), type: "authenticated" };
  const signed = await fetch("/api/cloudinary/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paramsToSign }) });
  if (!signed.ok) throw new Error("Couldn't start the upload. Please sign in again and retry.");
  const { signature } = await signed.json();

  const body = new FormData();
  body.append("file", file);
  for (const [key, value] of Object.entries(paramsToSign)) body.append(key, String(value));
  body.append("api_key", cloudinaryConfig.apiKey);
  body.append("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`, { method: "POST", body });
  const info = await response.json().catch(() => ({}));
  if (!response.ok || info.error) throw new Error(`${file.name}: ${info.error?.message ?? "upload failed"}.`);
  if (info.resource_type !== "image") throw new Error(`${file.name}: only photos and PDFs can be attached.`);
  return { publicId: info.public_id, format: info.format, version: String(info.version), pages: info.pages ?? 1, name: file.name.slice(0, 120) };
}

export default function BillUploader({ name = "attachments", initialFiles = [], label = "Bill photo or PDF", max = 20, note = "Private: only admins can open these. Removing a file here takes it off the purchase.", onBusyChange }) {
  const [files, setFiles] = useState(initialFiles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onPick = async (event) => {
    const picked = [...event.target.files];
    event.target.value = "";
    if (!picked.length) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    for (const file of picked) {
      if (files.length >= max) { setError(`Up to ${max} files.`); break; }
      try {
        const uploaded = await uploadBill(file);
        setFiles((current) => [...current, uploaded]);
      } catch (uploadError) {
        setError(uploadError.message);
      }
    }
    setBusy(false);
    onBusyChange?.(false);
  };

  return <div className="bill-uploader">
    <input type="hidden" name={name} value={JSON.stringify(files)} />
    {files.length > 0 && <ul className="bill-files">
      {files.map((file, index) => <li key={`${file.publicId}-${index}`}>
        <a href={billFileUrl(file)} target="_blank" rel="noreferrer" className="bill-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-only signed redirect, not optimisable */}
          <img src={billFileUrl(file, { size: "thumb" })} alt="" loading="lazy" />
          <span>{file.format === "pdf" ? <FileText size={13} aria-hidden="true" /> : null}{file.name || `File ${index + 1}`}</span>
        </a>
        <button type="button" className="text-link" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${file.name || `file ${index + 1}`}`}><Trash2 size={14} /> Remove</button>
      </li>)}
    </ul>}
    {isCloudinaryUploadConfigured
      ? <label className={`admin-upload ${busy ? "is-busy" : ""}`}>
          <Paperclip size={16} aria-hidden="true" />
          {busy ? "Uploading…" : files.length ? "Add another file" : label}
          <input type="file" accept="image/*,application/pdf" multiple onChange={onPick} disabled={busy} className="sr-only" />
        </label>
      : <p className="admin-note">Bill uploads aren't switched on yet. Ask your developer to add the Cloudinary upload keys.</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    <p className="admin-note">{note}</p>
  </div>;
}
