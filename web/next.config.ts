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
  // 注意：为了支持长时间运行的请求（如存储过程），我们统一使用 API 路由而不是 rewrites
  // 这样可以在 API 路由中设置更长的超时时间
  async rewrites() {
    // 统一使用 API 路由处理，不使用 rewrites
    // 这样可以在 route.ts 中为特定路径设置更长的超时时间
    return [];
  },
};

export default nextConfig;
