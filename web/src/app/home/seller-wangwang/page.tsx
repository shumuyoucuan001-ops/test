"use client";

import SellerWangwangPage from '../../../components/SellerWangwangPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function SellerWangwangRoute() {
  return (
    <PermissionGuard requiredPath="/home/seller-wangwang">
      <SellerWangwangPage />
    </PermissionGuard>
  );
}

