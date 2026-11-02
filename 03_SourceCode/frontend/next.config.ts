import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/dashboard/sinh-vien/chuong-trinh-dao-tao",
        destination: "/ctdt-cua-toi",
        permanent: false,
      },
    ];
  },
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
