"use client";

import SupplierConversionRelationPage from '../../../components/SupplierConversionRelationPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function SupplierConversionRelationRoute() {
  return (
    <PermissionGuard requiredPath="/home/supplier-conversion-relation">
      <SupplierConversionRelationPage />
    </PermissionGuard>
  );
}

