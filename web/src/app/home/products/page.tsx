"use client";
// Updated: 2025-10-15 - Fixed delete functionality

import { useEffect } from 'react';
import ProductMasterPage from '../../../components/ProductMasterPage';

export default function ProductsRoute() {
  useEffect(() => {
    // 检查登录状态
    const uid = localStorage.getItem('userId');
    if (!uid) {
      window.location.href = '/login';
      return;
    }
  }, []);

  return <ProductMasterPage />;
}





