import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

// { admin: true } only for a signed-in admin (session cookie checked on the server, role read from the database).
// Used by the storefront header to show "Admin panel"; the admin pages are guarded on their own regardless.
export async function GET() {
  const admin = Boolean(await getCurrentAdmin());
  return NextResponse.json({ admin }, { headers: { "Cache-Control": "private, no-store" } });
}
