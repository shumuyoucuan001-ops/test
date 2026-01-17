import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 简易权限守卫：读取请求头 x-user-id，允许无头访问；如有 userId 则校验是否具备访问路径的权限
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private prisma: PrismaService) { }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = Number(req.headers['x-user-id'] || 0);
    const path = req.url.split('?')[0];
    
    // 检测是否为 localhost 访问
    const hostname = req.headers['host']?.split(':')[0] || '';
    const isLocalhost = (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      (hostname.startsWith('172.') && 
       parseInt(hostname.split('.')[1] || '0') >= 16 && 
       parseInt(hostname.split('.')[1] || '0') <= 31)
    );
    
    // localhost 环境下直接放行
    if (isLocalhost) {
      return true;
    }
    
    // 放行公共接口（健康检查等）
    if (path.startsWith('/health')) return true;
    // 后台管理接口放行，由前端按钮级权限控制
    if (path.startsWith('/acl')) return true;
    if (!userId) return true; // 未携带用户ID时默认放行（前后端联调阶段）
    try {
      // 查询通过角色获取的权限
      const rolePermissionRows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT DISTINCT p.path FROM sm_xitongkaifa.sys_permissions p
        JOIN sm_xitongkaifa.sys_role_permissions rp ON rp.permission_id = p.id
        JOIN sm_xitongkaifa.sys_user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = ? AND ur.role_id > 0
      `, userId);

      // 查询通过 smallrole_id 直接分配的权限（smallrole_id 是逗号分隔的权限ID字符串）
      const userRoleRows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT smallrole_id FROM sm_xitongkaifa.sys_user_roles WHERE user_id=? AND smallrole_id IS NOT NULL AND smallrole_id != ''`,
        userId
      );

      // 解析所有权限ID
      const permissionIds: number[] = [];
      userRoleRows.forEach(r => {
        if (r.smallrole_id) {
          const ids = String(r.smallrole_id).split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
          permissionIds.push(...ids);
        }
      });

      // 查询这些权限的路径
      let directPermissionRows: any[] = [];
      if (permissionIds.length > 0) {
        const placeholders = permissionIds.map(() => '?').join(',');
        directPermissionRows = await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT path FROM sm_xitongkaifa.sys_permissions WHERE id IN (${placeholders})`,
          ...permissionIds
        );
      }

      // 合并权限路径
      const rows = [...rolePermissionRows, ...directPermissionRows];
      const allowed = new Set(rows.map(r => String(r.path)));
      // 只对 /acl /products ... 这些后端接口做路径级校验
      if (allowed.size === 0) return true; // 未配置权限时默认放行
      // 检查是否有完全匹配的权限路径，或者路径前缀匹配
      const hasExactMatch = allowed.has(path);
      const hasPrefixMatch = Array.from(allowed).some(p => path.startsWith(p + '/') || path === p);
      // 特殊路径：/templates 和 /products 始终放行（向后兼容）
      const isSpecialPath = path.startsWith('/templates') || path.startsWith('/products');
      // /ops-exclusion 需要权限检查
      // 支持两种路径格式：/ops-exclusion（后端API）和 /home/ops-exclusion（前端路由）
      if (path.startsWith('/ops-exclusion')) {
        // 检查后端路径 /ops-exclusion
        if (hasExactMatch || hasPrefixMatch) return true;
        // 检查前端路径 /home/ops-exclusion（路径映射）
        const frontendPath = '/home' + path;
        return allowed.has(frontendPath) || Array.from(allowed).some(p => frontendPath.startsWith(p + '/') || frontendPath === p);
      }
      return hasExactMatch || hasPrefixMatch || isSpecialPath;
    } catch {
      return true;
    }
  }
}


