"use client";

import PurchasePage from '../../../components/PurchasePage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function PurchaseRoute() {
  return (
    <PermissionGuard requiredPath="/home/purchase">
      <PurchasePage />
    </PermissionGuard>
  );
}
