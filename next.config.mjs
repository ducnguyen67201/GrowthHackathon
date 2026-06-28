/** @type {import('next').NextConfig} */
const nextConfig = {
  // satori / resvg / nodemailer are server-only Node libs — keep them out of the client bundle.
  serverExternalPackages: ["@resvg/resvg-js", "satori", "nodemailer", "imapflow"],
};

export default nextConfig;
