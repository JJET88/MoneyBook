// Sent with every page: the browser is told not to guess file types, not to
// show the app inside another site's frame (so no one can trick a click), to
// keep the address of the page out of links to other sites, and to use HTTPS
// from now on once it has seen the site over HTTPS.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // mysql2 is a Node library; keep it out of the bundler.
  serverExternalPackages: ["mysql2"],
  // A backup file is sent to a Server Action when it is restored; the default
  // limit of 1 MB is a little small for a book of many years.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
