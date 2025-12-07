"use client";

import SupplierManagementPage from '../../../components/SupplierManagementPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function SupplierManagementRoute() {
  return (
    <PermissionGuard requiredPath="/home/supplier-management">
      <SupplierManagementPage />
    </PermissionGuard>
  );
}
