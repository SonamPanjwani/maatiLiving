/** @type {import('next').NextConfig} */

// Baseline security headers. (A full Content-Security-Policy is left out on purpose: Razorpay
// Checkout, Cloudinary's upload widget and Supabase need several origins; add one after launch
// once the exact list is confirmed in production.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Only features nothing on the site uses; camera/payment are left alone for Cloudinary's widget and Razorpay.
  { key: "Permissions-Policy", value: "microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  // NEXT_DIST_DIR lets a production build run in its own folder (e.g. .next-prod) without touching the .next
  // that a running `npm run dev` uses — building into the same folder corrupts dev ("Cannot find module './NNNN.js'").
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
