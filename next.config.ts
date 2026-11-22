import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Needed for the Docker runner image — emits .next/standalone with a
  // minimal server.js so we don't ship the full node_modules tree.
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
