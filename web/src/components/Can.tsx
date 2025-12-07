"use client";

import React from "react";

export default function Can({ code, children }: { code: string; children: React.ReactNode }) {
  if (typeof window === 'undefined') return null;
  try {
    const codes: string[] = JSON.parse(localStorage.getItem('permCodes') || '[]');
    if (!codes || codes.length === 0) return children as any; // 未配置时默认放行
    // 仅做页面级权限控制：只有以 menu: 开头的编码参与判断；按钮级一律放行
    if (!code || !code.startsWith('menu:')) return children as any;
    return codes.includes(code) ? (children as any) : null;
  } catch {
    return null;
  }
}


