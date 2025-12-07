"use client";

import { useEffect } from 'react';
import LabelPrint from '../../../components/LabelPrint';

export default function PrintRoute() {
  useEffect(() => {
    // 检查登录状态
    const uid = localStorage.getItem('userId');
    if (!uid) {
      window.location.href = '/login';
      return;
    }
  }, []);

  return <LabelPrint />;
}





