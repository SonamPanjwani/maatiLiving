import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { updateSession } from "@/src/lib/supabase/middleware";

// Only /admin runs through middleware so storefront pages stay static.
// This is the first gate (signed in?); the admin layout and every action also check the admin role.
export async function middleware(request) {
  if (!isSupabaseConfigured) return NextResponse.next();

  const { response, user } = await updateSession(request);
  const isLoginPage = request.nextUrl.pathname === "/admin/login";

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
