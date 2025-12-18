"use client";

import PermissionGuard from '../../../components/PermissionGuard';
import PurchasePassDifferencePage from '../../../components/PurchasePassDifferencePage';

export default function PurchasePassDifferenceRoute() {
  return (
    <PermissionGuard requiredPath="/home/purchase-pass-difference">
      <PurchasePassDifferencePage />
    </PermissionGuard>
  );
}

