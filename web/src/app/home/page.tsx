"use client";

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // 检查URL参数中是否有钉钉回调的code（回调地址为/home时）
    const urlParams = new URLSearchParams(window.location.search);
    // 优先使用code参数（authCode是钉钉自动添加的冗余参数，值相同）
    const code = urlParams.get('code') || urlParams.get('authCode');
    const state = urlParams.get('state');

    if (code) {
      // 如果有code参数，立即重定向到登录页面处理钉钉回调
      // 只传递code参数，不传递authCode（避免冗余）
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('code', code);
      if (state) {
        loginUrl.searchParams.set('state', state);
      }
      // 使用replace而不是href，避免在历史记录中留下/home?code=xxx&authCode=xxx
      window.location.replace(loginUrl.toString());
      return;
    }

    // 检查登录状态（只有在没有code参数时才检查）
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