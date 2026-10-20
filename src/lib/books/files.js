import "server-only";
import { createHash } from "node:crypto";
import { cloudinaryConfig } from "@/src/config/cloudinary";

// Private ("authenticated") Cloudinary files for bills and receipts. They can't be opened without a signed
// URL, and signed URLs are only made here, on the server, for admins (see app/api/books/bill/route.js).

export const BILL_FOLDER = "maati-living/bills";
const PUBLIC_ID = /^maati-living\/bills\/[A-Za-z0-9_/-]+$/;
const FORMATS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"]);

export const isBillPublicId = (value) => PUBLIC_ID.test(String(value ?? ""));

// Cloudinary URL signature: first 8 chars of URL-safe base64 SHA-1 of "<transformation>/<public_id>.<format>" + secret.
function sign(toSign, secret) {
  return createHash("sha1").update(toSign + secret).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").slice(0, 8);
}

// size: "thumb" (small JPG), "view" (large JPG; for PDFs one page), "original" (the file as uploaded).
export function signedBillUrl({ publicId, format, version, size = "view", page = 1 }) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret || !cloudinaryConfig.cloudName) return null;
  if (!isBillPublicId(publicId) || !FORMATS.has(format)) return null;
  const isPdf = format === "pdf";
  const pg = Number.isInteger(page) && page > 0 && page <= 200 ? page : 1;
  const transformation = size === "original" ? ""
    : size === "thumb" ? `c_limit,h_360,w_360/f_jpg,q_auto${isPdf ? `,pg_${pg}` : ""}`
    : `c_limit,w_2000/f_jpg,q_auto${isPdf ? `,pg_${pg}` : ""}`;
  const source = `${publicId}.${format}`;
  const signature = sign(transformation ? `${transformation}/${source}` : source, secret);
  const versionPart = /^\d+$/.test(String(version ?? "")) ? `/v${version}` : "";
  return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/authenticated/s--${signature}--${transformation ? `/${transformation}` : ""}${versionPart}/${source}`;
}
