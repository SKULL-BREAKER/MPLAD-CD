/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow larger request bodies for base64 image uploads from public and mobile
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Webpack mode (required on this machine due to SWC native binary policy block)
  // Use: npx next build --webpack
};

export default nextConfig;
