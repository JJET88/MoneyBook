/** @type {import('next').NextConfig} */
const nextConfig = {
  // mysql2 is a Node library; keep it out of the bundler.
  serverExternalPackages: ["mysql2"],
  // A backup file is sent to a Server Action when it is restored; the default
  // limit of 1 MB is a little small for a book of many years.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
