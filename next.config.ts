import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connections from any device on the cafe LAN
  allowedDevOrigins: [
    "http://192.168.1.100:3000",
    "http://192.168.1.100:3001",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
