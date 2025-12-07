"use client";

import { useEffect } from 'react';
import AdminUsers from '../../../components/AdminUsers';

export default function AdminUsersRoute() {
  useEffect(() => {
    // 检查登录状态
    const uid = localStorage.getItem('userId');
    if (!uid) {
      window.location.href = '/login';
      return;
    }
  }, []);

  return <AdminUsers />;
}





