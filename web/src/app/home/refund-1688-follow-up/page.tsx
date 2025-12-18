"use client";

import Refund1688FollowUpPage from '../../../components/Refund1688FollowUpPage';
import PermissionGuard from '../../../components/PermissionGuard';

export default function Refund1688FollowUpRoute() {
  return (
    <PermissionGuard requiredPath="/home/refund-1688-follow-up">
      <Refund1688FollowUpPage />
    </PermissionGuard>
  );
}

