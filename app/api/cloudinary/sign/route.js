import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/src/lib/auth";

// Signs Cloudinary upload-widget requests for admins only, so the API secret never reaches the browser.
// Contract (next-cloudinary): POST { paramsToSign } → { signature }.
export async function POST(request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });

  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret) return NextResponse.json({ error: "CLOUDINARY_API_SECRET is not set" }, { status: 500 });

  const { paramsToSign } = await request.json();
  if (!paramsToSign || typeof paramsToSign !== "object") return NextResponse.json({ error: "Missing paramsToSign" }, { status: 400 });
  if (!String(paramsToSign.folder ?? "").startsWith("maati-living/")) {
    return NextResponse.json({ error: "Uploads must go into a maati-living/ folder" }, { status: 400 });
  }

  // Cloudinary signature: sorted key=value pairs joined by &, secret appended, SHA-1 hex.
  const payload = Object.keys(paramsToSign)
    .filter((key) => paramsToSign[key] !== undefined && paramsToSign[key] !== null && paramsToSign[key] !== "")
    .sort()
    .map((key) => `${key}=${Array.isArray(paramsToSign[key]) ? paramsToSign[key].join(",") : paramsToSign[key]}`)
    .join("&");
  const signature = createHash("sha1").update(payload + secret).digest("hex");

  return NextResponse.json({ signature });
}
