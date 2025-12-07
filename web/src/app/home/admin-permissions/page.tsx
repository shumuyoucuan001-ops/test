"use client";

import AdminPermissions from '../../../components/AdminPermissions';
import PermissionGuard from '../../../components/PermissionGuard';

export default function AdminPermissionsRoute() {
  return (
    <PermissionGuard requiredPath="/home/admin-permissions">
      <AdminPermissions />
    </PermissionGuard>
  );
}
