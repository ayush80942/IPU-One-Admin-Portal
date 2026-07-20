import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Notice creation was consolidated into /notices — the dashboard root
      // had no other purpose.
      {
        source: "/",
        destination: "/notices",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
