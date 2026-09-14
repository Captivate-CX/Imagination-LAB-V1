import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fonts, the PDF slide template and the FSDU blank unit are read from ./assets at runtime.
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/**/*"],
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
