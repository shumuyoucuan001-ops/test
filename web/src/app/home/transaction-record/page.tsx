"use client";

import TransactionRecordPage from '../../../components/TransactionRecordPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function TransactionRecordRoute() {
  return (
    <PermissionGuard requiredPath="/home/transaction-record">
      <TransactionRecordPage />
    </PermissionGuard>
  );
}

