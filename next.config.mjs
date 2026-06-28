/** @type {import('next').NextConfig} */
const nextConfig = {
  // satori / resvg / nodemailer are server-only Node libs — keep them out of the client bundle.
  // @remotion/* ship binaries webpack can't parse — require them at runtime, never bundle
  // (the gated video render in lib/sendgen → lib/video only loads when SEND_GEN_VIDEO is set).
  serverExternalPackages: [
    "@resvg/resvg-js",
    "satori",
    "nodemailer",
    "imapflow",
    "remotion",
    "@remotion/bundler",
    "@remotion/renderer",
  ],
};

export default nextConfig;
