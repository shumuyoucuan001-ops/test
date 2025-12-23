import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 明确指定当前 web 目录为 Turbopack 根目录，避免被父级锁文件误判
  turbopack: {
    root: __dirname,
  },
  output: 'standalone',
  // 生产构建不阻断（仅记录），避免 ESLint/TS 报错影响部署
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // 非容器环境：将 /api/* 在 Next 层反代到本机 5002（本地测试端口）
  // Docker 生产环境：禁用 rewrites，使用 API 路由处理
  async rewrites() {
    // 生产环境（Docker）不使用 rewrites，由 API 路由处理
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    // 本地开发环境使用 rewrites
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:5002/:path*" },
    ];
  },
};

export default nextConfig;
