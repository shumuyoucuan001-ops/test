"use client";

import FinanceReconciliationDifferencePage from '../../../components/FinanceReconciliationDifferencePage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function FinanceReconciliationDifferenceRoute() {
  return (
    <PermissionGuard requiredPath="/home/finance-reconciliation-difference">
      <FinanceReconciliationDifferencePage />
    </PermissionGuard>
  );
}

