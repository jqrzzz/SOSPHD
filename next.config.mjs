/** @type {import('next').NextConfig} */
const nextConfig = {
  // The isolated gstack browser reaches the local dev server via loopback IP.
  // Keep this development allowance host-specific; production is unaffected.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
