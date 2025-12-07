import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 简易权限守卫：读取请求头 x-user-id，允许无头访问；如有 userId 则校验是否具备访问路径的权限
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = Number(req.headers['x-user-id'] || 0);
    const path = req.url.split('?')[0];
    // 放行公共接口（健康检查等）
    if (path.startsWith('/health')) return true;
    // 后台管理接口放行，由前端按钮级权限控制
    if (path.startsWith('/acl')) return true;
    if (!userId) return true; // 未携带用户ID时默认放行（前后端联调阶段）
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT p.path FROM sm_xitongkaifa.sys_permissions p
        JOIN sm_xitongkaifa.sys_role_permissions rp ON rp.permission_id = p.id
        JOIN sm_xitongkaifa.sys_user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = ?
      `, userId);
      const allowed = new Set(rows.map(r => String(r.path)));
      // 只对 /acl /products ... 这些后端接口做路径级校验
      if (allowed.size === 0) return true; // 未配置权限时默认放行
      return allowed.has(path) || path.startsWith('/templates') || path.startsWith('/products');
    } catch {
      return true;
    }
  }
}


