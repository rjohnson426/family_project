import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones/iPads on the same network use the dev server (private LAN ranges only).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // The editor library uses styled-components.
  compiler: { styledComponents: true },
};

export default nextConfig;
