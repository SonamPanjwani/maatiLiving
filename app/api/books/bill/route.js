import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/src/lib/auth";
import { signedBillUrl } from "@/src/lib/books/files";

// Opens a private bill/receipt file: admins only, redirected to a freshly signed Cloudinary URL.
// The page never contains signed links; this route makes one per click/thumbnail.
// GET ?id=<publicId>&f=<format>&v=<version>&size=thumb|view|original&page=<n>
export async function GET(request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const url = signedBillUrl({
    publicId: params.get("id"),
    format: String(params.get("f") ?? "").toLowerCase(),
    version: params.get("v"),
    size: ["thumb", "view", "original"].includes(params.get("size")) ? params.get("size") : "view",
    page: Number(params.get("page") ?? 1),
  });
  if (!url) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
