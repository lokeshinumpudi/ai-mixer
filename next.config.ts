import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable PPR for fully client-side rendering
  experimental: {
    ppr: false,
    serverComponentsExternalPackages: ["pino"],
  },

  // Optimize for client-side rendering
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
    ],
  },

  // Client-side optimizations
  compiler: {
    // removeConsole: process.env.NODE_ENV === 'production',
  },

  // Reduce server load by minimizing server-side rendering
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },

  // Optimize bundle splitting for better client-side performance
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side specific optimizations
      config.optimization.splitChunks.chunks = "all";
    }
    return config;
  },
};

export default nextConfig;
