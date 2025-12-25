"use client";

import FinanceManagementPage from '../../../components/FinanceManagementPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function FinanceManagementRoute() {
  return (
    <PermissionGuard requiredPath="/home/finance-management">
      <FinanceManagementPage />
    </PermissionGuard>
  );
}

