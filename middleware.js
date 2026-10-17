import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { updateSession } from "@/src/lib/supabase/middleware";

// Only /admin, /account and /checkout run through middleware so other storefront pages stay static.
// This is the first gate (signed in?); layouts and every server action check again (admin role / own data).
const PUBLIC_ACCOUNT_PAGES = ["/account/login", "/account/signup", "/account/forgot-password"];

function redirectTo(request, pathname, params = {}) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(params).toString();
  return NextResponse.redirect(url);
}

export async function middleware(request) {
  if (!isSupabaseConfigured) return NextResponse.next();

  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin") && path !== "/admin/login" && !user) return redirectTo(request, "/admin/login");
  if (path.startsWith("/account") && !PUBLIC_ACCOUNT_PAGES.includes(path) && !user) return redirectTo(request, "/account/login", { next: path });
  // /checkout: no gate (guest checkout) — only here so the session cookie stays fresh for signed-in customers.
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/checkout"],
};
