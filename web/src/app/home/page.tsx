"use client";

import React, { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // 检查登录状态
    const uid = localStorage.getItem('userId');
    if (!uid) {
      window.location.href = '/login';
      return;
    }
  }, []);

  return (
    <div style={{ padding: 24, minHeight: 360, background: '#ffffff', borderRadius: 8 }}>
      <h2>欢迎使用术木优选系统</h2>
      <p>请从左侧菜单选择功能模块</p>
    </div>
  );
}