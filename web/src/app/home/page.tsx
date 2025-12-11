"use client";

import React, { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // 检查URL参数中是否有钉钉回调的code（回调地址为/home时）
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code) {
      // 如果有code参数，重定向到登录页面处理钉钉回调
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('code', code);
      if (state) {
        loginUrl.searchParams.set('state', state);
      }
      window.location.href = loginUrl.toString();
      return;
    }

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