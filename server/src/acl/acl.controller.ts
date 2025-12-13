import { Body, Controller, Get, HttpException, Post, Query } from '@nestjs/common';
import { AclService } from './acl.service';

@Controller('acl')
export class AclController {
  constructor(private service: AclService) { }

  @Post('init') init() { return this.service.initSchema(); }

  // permissions
  @Get('permissions') listPermissions() { return this.service.listPermissions(); }
  @Post('permissions/create') createPermission(@Body() b: any) { return this.service.createPermission(b); }
  @Post('permissions/update') updatePermission(@Body() b: any) { return this.service.updatePermission(Number(b.id), b); }
  @Post('permissions/delete') deletePermission(@Body('id') id: number) { return this.service.deletePermission(Number(id)); }

  // roles
  @Get('roles') listRoles() { return this.service.listRoles(); }
  @Post('roles/create') createRole(@Body() b: any) { return this.service.createRole(b); }
  @Post('roles/update') updateRole(@Body() b: any) { return this.service.updateRole(Number(b.id), b); }
  @Post('roles/delete') deleteRole(@Body('id') id: number) { return this.service.deleteRole(Number(id)); }
  @Post('roles/grant') setRolePermissions(@Body() b: any) { return this.service.setRolePermissions(Number(b.roleId), (b.permissionIds || []).map(Number)); }
  @Get('roles/granted') getRoleGranted(@Query('roleId') roleId: string) { return this.service.getRolePermissionIds(Number(roleId)); }

  // users
  @Get('users') listUsers(@Query('q') q?: string) { return this.service.listUsers(q || ''); }
  @Get('users/debug') async debugUsers() {
    const users = await this.service.listUsers('');
    return {
      count: users.length,
      sample: users.slice(0, 2),
      userWithId3: users.find(u => u.id === 3)
    };
  }
  @Post('users/create') async createUser(@Body() b: any) {
    try { return await this.service.createUser(b); }
    catch (e: any) {
      if (e && e.status && e.message) { throw e; }
      throw new HttpException(e?.message || '创建用户失败', 400);
    }
  }
  @Post('users/update') updateUser(@Body() b: any) { return this.service.updateUser(Number(b.id), b); }
  @Post('users/delete') deleteUser(@Body('id') id: number) { return this.service.deleteUser(Number(id)); }
  @Post('users/assign') setUserRoles(@Body() b: any) { return this.service.setUserRoles(Number(b.userId), (b.roleIds || []).map(Number)); }
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
      if (e && e.status) throw e;
      throw new HttpException(e?.message || '登录失败', 400);
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


