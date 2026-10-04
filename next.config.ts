import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` builds into its own folder so a production build can't break a running dev server.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone",
  serverExternalPackages: ["sharp", "@prisma/client"],
  poweredByHeader: false,
};

export default nextConfig;
