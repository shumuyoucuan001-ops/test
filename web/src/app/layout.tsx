import type { Metadata } from "next";
// 移除在线谷歌字体，避免构建时解析 @vercel/turbopack-next/internal/font/google/font
import { App as AntApp, ConfigProvider } from "antd";
import "antd/dist/reset.css";
import "./globals.css";

// 使用本地系统 sans/mono 回退，避免外网依赖
const geistSans = { variable: "--font-geist-sans" } as any;
const geistMono = { variable: "--font-geist-mono" } as any;

// 阿里巴巴普惠体（本地字体，需将字体文件放置于 public/fonts/）
// 暂时禁用，使用系统默认字体
// const alibabaPuHuiTi = localFont({
//   src: [
//     { path: "../../public/fonts/AlibabaPuHuiTi--Regular.ttf", weight: "400", style: "normal" },
//     { path: "../../public/fonts/AlibabaPuHuiTi--Medium.ttf", weight: "500", style: "normal" },
//     { path: "../../public/fonts/AlibabaPuHuiTi--Bold.ttf", weight: "700", style: "normal" },
//   ],
//   variable: "--font-alibaba",
//   display: "swap",
// });
const alibabaPuHuiTi = { variable: "--font-alibaba" } as any;

export const metadata: Metadata = {
  title: "术木优选",
  description: "术木优选业务管理系统",
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} ${alibabaPuHuiTi.variable}`}>
        <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
          <AntApp>{children}</AntApp>
        </ConfigProvider>
      </body>
    </html>
  );
}
