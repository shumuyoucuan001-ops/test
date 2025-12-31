"use client";

import NonPurchaseBillRecordPage from '../../../components/NonPurchaseBillRecordPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function NonPurchaseBillRecordRoute() {
  return (
    <PermissionGuard requiredPath="/home/non-purchase-bill-record">
      <NonPurchaseBillRecordPage />
    </PermissionGuard>
  );
}

