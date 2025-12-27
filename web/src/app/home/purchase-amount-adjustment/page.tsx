"use client";

import PurchaseAmountAdjustmentPage from '../../../components/PurchaseAmountAdjustmentPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function PurchaseAmountAdjustmentRoute() {
  return (
    <PermissionGuard requiredPath="/home/purchase-amount-adjustment">
      <PurchaseAmountAdjustmentPage />
    </PermissionGuard>
  );
}

