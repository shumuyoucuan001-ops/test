"use client";

import { useEffect } from 'react';
import TemplatesPage from '../../../components/TemplatesPage';

export default function TemplatesRoute() {
  useEffect(() => {
    // 检查登录状态
    const uid = localStorage.getItem('userId');
    if (!uid) {
      window.location.href = '/login';
      return;
    }
  }, []);

  return <TemplatesPage />;
}





