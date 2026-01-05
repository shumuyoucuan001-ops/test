"use client";

import { aclApi, SysPermission } from '@/lib/api';
import { useEffect, useState } from 'react';

// 检测是否为 localhost 环境
function isLocalhost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    (hostname.startsWith('172.') && 
     parseInt(hostname.split('.')[1] || '0') >= 16 && 
     parseInt(hostname.split('.')[1] || '0') <= 31)
  );
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<SysPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
          setPermissions([]);
          setLoading(false);
          return;
        }

        // localhost 环境下，返回所有权限（模拟有全部权限）
        if (isLocalhost()) {
          // 返回一个包含所有常见路径的权限列表，确保可以访问所有页面
          setPermissions([
            { id: 1, code: 'home', name: '首页', path: '/home' },
            { id: 2, code: 'all', name: '全部权限', path: '/home' },
          ] as SysPermission[]);
          setLoading(false);
          return;
        }

        const userPermissions = await aclApi.userPermissions(Number(userId));
        setPermissions(userPermissions);
      } catch (error) {
        console.error('加载用户权限失败:', error);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, []);

  // 检查是否有指定路径的权限
  const hasPermission = (path: string): boolean => {
    if (loading) return false;
    if (permissions.length === 0) return false;

    // 检查是否有完全匹配的权限
    const hasExactMatch = permissions.some(p => p.path === path);
    if (hasExactMatch) return true;

    // 检查是否有父级权限（例如 /admin 包含 /admin/users）
    // 修复：只检查 path.startsWith(p.path + '/')，确保是真正的父级路径
    // 避免 /home 匹配 /homepage，以及 /home/supplier-management 匹配 /home/purchase-pass-difference 等情况
    const hasParentPermission = permissions.some(p => {
      // 只有当权限路径是目标路径的前缀，且后面跟着 '/' 时才允许
      // 例如：/home 可以匹配 /home/purchase-pass-difference（父级权限）
      // 但 /home 不能匹配 /homepage，/home/supplier-management 不能匹配 /home/purchase-pass-difference
      return path.startsWith(p.path + '/');
    });

    return hasParentPermission;
  };

  // 检查菜单权限（基于权限代码）
  const hasMenuPermission = (menuCode: string): boolean => {
    if (loading) return false;
    if (permissions.length === 0) return false;

    return permissions.some(p => p.code === menuCode);
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasMenuPermission,
  };
}





