"use client";
// Updated: 2025-10-15 - Fixed delete functionality

import ProductSupplementPage from '../../../components/ProductSupplementPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function ProductSupplementRoute() {
  return (
    <PermissionGuard requiredPath="/home/product-supplement">
      <ProductSupplementPage />
    </PermissionGuard>
  );
}
