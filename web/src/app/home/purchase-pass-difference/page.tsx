"use client";

import PurchasePassDifferencePage from '../../../components/PurchasePassDifferencePage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function PurchasePassDifferenceRoute() {
  return (
    <PermissionGuard requiredPath="/home/purchase-pass-difference">
      <PurchasePassDifferencePage />
    </PermissionGuard>
  );
}

