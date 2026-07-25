import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay badge lands in every visual-check screenshot otherwise.
  devIndicators: false,
};

export default nextConfig;
