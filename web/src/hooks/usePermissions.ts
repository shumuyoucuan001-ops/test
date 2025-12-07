"use client";

import { useState, useEffect } from 'react';
import { aclApi, SysPermission } from '@/lib/api';

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
    const hasParentPermission = permissions.some(p => {
      return path.startsWith(p.path + '/') || path.startsWith(p.path);
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





