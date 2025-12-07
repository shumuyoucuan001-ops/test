"use client";

import { useEffect } from 'react';
import AdminRoles from '../../../components/AdminRoles';

export default function AdminRolesRoute() {
  useEffect(() => {
    // 检查登录状态
    const uid = localStorage.getItem('userId');
    if (!uid) {
      window.location.href = '/login';
      return;
    }
  }, []);

  return <AdminRoles />;
}





