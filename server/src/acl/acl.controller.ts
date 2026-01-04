import { Body, Controller, Get, Headers, HttpException, Post, Query } from '@nestjs/common';
import { AclService } from './acl.service';

@Controller('acl')
export class AclController {
  constructor(private service: AclService) { }

  @Post('init') init() { return this.service.initSchema(); }

  // permissions
  @Get('permissions') listPermissions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    return this.service.listPermissions(pageNum, limitNum, search);
  }
  @Post('permissions/create') createPermission(@Body() b: any, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.createPermission(b, userIdNum); 
  }
  @Post('permissions/update') updatePermission(@Body() b: any, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.updatePermission(Number(b.id), b, userIdNum); 
  }
  @Post('permissions/delete') deletePermission(@Body('id') id: number, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.deletePermission(Number(id), userIdNum); 
  }

  // roles
  @Get('roles') listRoles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    return this.service.listRoles(pageNum, limitNum, search);
  }
  @Post('roles/create') createRole(@Body() b: any, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.createRole(b, userIdNum); 
  }
  @Post('roles/update') updateRole(@Body() b: any, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.updateRole(Number(b.id), b, userIdNum); 
  }
  @Post('roles/delete') deleteRole(@Body('id') id: number, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.deleteRole(Number(id), userIdNum); 
  }
  @Post('roles/grant') setRolePermissions(@Body() b: any, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.setRolePermissions(Number(b.roleId), (b.permissionIds || []).map(Number), userIdNum); 
  }
  @Get('roles/granted') getRoleGranted(@Query('roleId') roleId: string) { return this.service.getRolePermissionIds(Number(roleId)); }

  // users
  @Get('users') listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    return this.service.listUsers(pageNum, limitNum, q || '');
  }
  @Get('users/debug') async debugUsers() {
    const result = await this.service.listUsers(1, 100, '');
    return {
      count: result.total,
      sample: result.data.slice(0, 2),
      userWithId3: result.data.find(u => u.id === 3)
    };
  }
  @Post('users/create') async createUser(@Body() b: any, @Headers('x-user-id') userId?: string) {
    try { 
      const userIdNum = userId ? parseInt(userId, 10) : undefined;
      return await this.service.createUser(b, userIdNum);
    }
    catch (e: any) {
      if (e && e.status && e.message) { throw e; }
      throw new HttpException(e?.message || '创建用户失败', 400);
    }
  }
  @Post('users/update') updateUser(@Body() b: any, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.updateUser(Number(b.id), b, userIdNum); 
  }
  @Post('users/delete') deleteUser(@Body('id') id: number, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.deleteUser(Number(id), userIdNum); 
  }
  @Post('users/assign') setUserRoles(@Body() b: any, @Headers('x-user-id') userId?: string) { 
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.setUserRoles(Number(b.userId), (b.roleIds || []).map(Number), userIdNum); 
  }
  @Get('users/assigned') getUserRoleIds(@Query('userId') userId: string) { return this.service.getUserRoleIds(Number(userId)); }
  @Get('users/edit-count') getUserEditCount(@Query('userId') userId: string) { return this.service.getUserEditCount(Number(userId)); }

  // user permission list
  @Get('user-permissions') getUserPerms(@Query('userId') userId: string) { return this.service.getUserPermissions(Number(userId)); }

  // login
  @Post('login') async login(@Body() b: any) {
    try {
      return await this.service.login(b.username, b.password, b.deviceInfo, b.dingTalkCode);
    }
    catch (e: any) {
      // 记录详细错误信息以便调试
      console.error('[AclController] 登录失败:', e);
      console.error('[AclController] 错误堆栈:', e?.stack);
      console.error('[AclController] 错误详情:', {
        message: e?.message,
        status: e?.status,
        response: e?.response,
        name: e?.name,
      });

      if (e && e.status) throw e;
      // 返回500而不是400，因为可能是服务器内部错误
      const statusCode = e?.status || (e?.message?.includes('数据库') || e?.message?.includes('连接') ? 500 : 400);
      throw new HttpException(e?.message || '登录失败', statusCode);
    }
  }

  @Post('logout') async logout(@Body() b: any) {
    try { return await this.service.logout(Number(b.userId), b.token); }
    catch (e: any) { if (e && e.status) throw e; throw new HttpException(e?.message || '退出失败', 400); }
  }

  // validate token (用于前端心跳校验/单点登录)
  @Post('validate-token') async validate(@Body() b: any) {
    try { return await this.service.validateToken(Number(b.userId), String(b.token || '')); }
    catch { return false; }
  }
}


