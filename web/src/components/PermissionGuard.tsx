"use client";

import { Button, Result, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { isLocalhost, setupLocalhostUser } from '../utils/localhost';

interface PermissionGuardProps {
  requiredPath: string;
  children: React.ReactNode;
}

export default function PermissionGuard({ requiredPath, children }: PermissionGuardProps) {
  const { loading, hasPermission } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    // localhost 环境自动设置用户信息
    if (isLocalhost()) {
      setupLocalhostUser();
    }

    // 检查登录状态
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.replace('/login');
      return;
    }
  }, [router]);

  // 加载中显示
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: 300
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // 权限检查
  if (!hasPermission(requiredPath)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面。"
        extra={
          <Button type="primary" onClick={() => router.push('/home')}>
            返回首页
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}





