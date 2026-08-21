import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://127.0.0.1:8642/api/:path*",
            },
          ];
        },
      }
    : {
        output: "export",
      }),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;