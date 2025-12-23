# NestJS 后端架构详解 - 控制器、服务、模块关系

本文档详细解释 shumu-main 项目中 NestJS 后端架构，包括控制器、业务逻辑（服务）、模块定义之间的关系，以及它们与其他文件的关系。

## 📋 目录

1. [核心概念](#核心概念)
2. [三层架构关系](#三层架构关系)
3. [代码示例详解](#代码示例详解)
4. [依赖注入机制](#依赖注入机制)
5. [模块导入导出](#模块导入导出)
6. [其他相关文件](#其他相关文件)
7. [完整请求流程](#完整请求流程)

---

## 核心概念

### 1. **模块 (Module)** - 组织单元
- **作用**: 将相关的控制器、服务、提供者组织在一起
- **文件**: `*.module.ts`
- **职责**: 
  - 声明该模块包含哪些控制器
  - 声明该模块提供哪些服务
  - 声明该模块需要导入哪些其他模块
  - 声明该模块导出哪些服务供其他模块使用

### 2. **控制器 (Controller)** - 请求处理层
- **作用**: 处理 HTTP 请求，定义路由和端点
- **文件**: `*.controller.ts`
- **职责**:
  - 接收 HTTP 请求
  - 调用服务层处理业务逻辑
  - 返回 HTTP 响应
  - 参数验证和转换

### 3. **服务 (Service)** - 业务逻辑层
- **作用**: 包含核心业务逻辑
- **文件**: `*.service.ts`
- **职责**:
  - 实现业务逻辑
  - 数据库操作（通过 PrismaService）
  - 调用其他服务
  - 数据处理和转换

### 4. **DTO (Data Transfer Object)** - 数据传输对象
- **作用**: 定义请求和响应的数据结构
- **文件**: `dto/*.dto.ts`
- **职责**:
  - 验证请求数据
  - 类型安全
  - API 文档生成

---

## 三层架构关系

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP 请求                              │
│              (GET /acl/users?q=admin)                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Controller (控制器)                                      │
│  - 接收请求参数                                           │
│  - 调用 Service                                          │
│  - 返回响应                                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Service (服务/业务逻辑)                                  │
│  - 实现业务逻辑                                           │
│  - 调用 PrismaService 操作数据库                         │
│  - 调用其他 Service                                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  PrismaService (数据库服务)                               │
│  - 执行 SQL 查询                                         │
│  - 返回数据                                              │
└─────────────────────────────────────────────────────────┘
```

---

## 代码示例详解

### 示例：ACL 模块（权限控制模块）

#### 1. 模块定义 (`acl.module.ts`)

```1:13:server/src/acl/acl.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { DingTalkModule } from '../dingtalk/dingtalk.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AclController } from './acl.controller';
import { AclService } from './acl.service';

@Module({
  imports: [PrismaModule, forwardRef(() => DingTalkModule)], // 使用forwardRef解决循环依赖
  controllers: [AclController],
  providers: [AclService],
  exports: [AclService], // 导出AclService供其他模块使用
})
export class AclModule { }
```

**关键点解析**:

1. **`imports`**: 导入依赖的模块
   - `PrismaModule`: 提供数据库服务
   - `DingTalkModule`: 提供钉钉服务（使用 `forwardRef` 解决循环依赖）

2. **`controllers`**: 声明该模块包含的控制器
   - `AclController`: 处理 `/acl/*` 路由的请求

3. **`providers`**: 声明该模块提供的服务
   - `AclService`: 业务逻辑服务

4. **`exports`**: 导出服务供其他模块使用
   - `AclService`: 其他模块可以注入使用

#### 2. 控制器 (`acl.controller.ts`)

```1:45:server/src/acl/acl.controller.ts
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
```

**关键点解析**:

1. **`@Controller('acl')`**: 定义控制器的基础路由前缀
   - 所有方法的路由都会以 `/acl` 开头

2. **依赖注入**: `constructor(private service: AclService)`
   - NestJS 自动注入 `AclService` 实例
   - 通过模块的 `providers` 配置实现

3. **路由装饰器**:
   - `@Get('users')`: 处理 `GET /acl/users` 请求
   - `@Post('login')`: 处理 `POST /acl/login` 请求
   - `@Query('q')`: 获取查询参数
   - `@Body()`: 获取请求体

4. **调用服务**: `this.service.listUsers(q || '')`
   - 控制器只负责接收请求和返回响应
   - 业务逻辑都在 Service 中

#### 3. 服务 (`acl.service.ts`)

```1:313:server/src/acl/acl.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DingTalkService, DingTalkUserInfo } from '../dingtalk/dingtalk.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

@Injectable()
export class AclService {
  constructor(
    private prisma: PrismaService,
    private dingTalkService: DingTalkService,
  ) { }

  // 私有方法：检查列是否存在
  private async hasCol(columnName: string): Promise<boolean> {
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='sm_xitongkaifa' AND TABLE_NAME='sys_users' AND COLUMN_NAME=? LIMIT 1`,
      columnName
    );
    return rows.length > 0;
  }

  // 私有方法：确保必要的列存在
  private async ensureColumns() {
    const columns = [
      { name: 'password', sql: `ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN password VARCHAR(128) NULL AFTER username` },
      { name: 'display_name', sql: `ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN display_name VARCHAR(64) NULL` },
      { name: 'status', sql: `ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN status TINYINT NULL DEFAULT 1` },
      { name: 'code', sql: `ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN code VARCHAR(64) NULL` },
      { name: 'session_token', sql: `ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN session_token VARCHAR(128) NULL` },
      { name: 'last_login_time', sql: `ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN last_login_time DATETIME NULL` },
      { name: 'last_login_device', sql: `ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN last_login_device VARCHAR(255) NULL` },
      { name: 'display_name_edit_count', sql: `ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN display_name_edit_count INT NULL DEFAULT 0` },
    ];

    for (const col of columns) {
      if (!(await this.hasCol(col.name))) {
        try {
          await this.prisma.$executeRawUnsafe(col.sql);
        } catch { }
      }
    }

    // department_id 需要特殊处理（有日志输出）
    if (!(await this.hasCol('department_id'))) {
      try {
        await this.prisma.$executeRawUnsafe(`ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN department_id INT NULL`);
        Logger.log('[AclService] ✓ 已创建 department_id 字段');
      } catch (e: any) {
        Logger.error('[AclService] ✗ 创建 department_id 字段失败:', e.message);
      }
    }

    // user_id 字段用于存储钉钉员工USERID（有日志输出）
    if (!(await this.hasCol('user_id'))) {
      try {
        await this.prisma.$executeRawUnsafe(`ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN user_id VARCHAR(128) NULL`);
        Logger.log('[AclService] ✓ 已创建 user_id 字段');
      } catch (e: any) {
        Logger.error('[AclService] ✗ 创建 user_id 字段失败:', e.message);
      }
    }

    // token_expires_at 字段用于存储token过期时间（7天有效期）
    if (!(await this.hasCol('token_expires_at'))) {
      try {
        await PrismaService.$executeRawUnsafe(`ALTER TABLE sm_xitongkaifa.sys_users ADD COLUMN token_expires_at DATETIME NULL`);
        Logger.log('[AclService] ✓ 已创建 token_expires_at 字段');
      } catch (e: any) {
        Logger.error('[AclService] ✗ 创建 token_expires_at 字段失败:', e.message);
      }
    }

    // 放宽 code 可空
    try {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE sm_xitongkaifa.sys_users MODIFY code VARCHAR(64) NULL`);
    } catch { }
  }

  // 私有方法：记录登录历史
  private async logLogin(userId: number, username: string, device: string, loginTime: Date, token: string) {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO sm_xitongkaifa.login_records (user_id, username, device_info, login_time, token) VALUES (?, ?, ?, ?, ?)`,
        userId,
        username,
        device,
        loginTime,
        token
      );
    } catch (e) {
      // 如果login_records表不存在，忽略错误
      Logger.log('[AclService] 登录记录表不存在，跳过记录');
    }
  }

  // 私有方法：自动分配角色
  private async assignDefaultRole(userId: number, roleId: number = 2) {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO sm_xitongkaifa.sys_user_roles(user_id, role_id) VALUES(?, ?)`,
        userId,
        roleId
      );
      Logger.log('[AclService] ✓ 自动分配角色成功，user_id:', userId, `role_id: ${roleId}`);
    } catch (roleError: any) {
      // 如果角色已存在或其他错误，记录日志但不影响登录流程
      Logger.warn('[AclService] 分配角色失败（可能已存在）:', roleError.message);
    }
  }

  // 私有方法：创建钉钉用户（处理用户名冲突）
  private async createDingTalkUser(
    username: string,
    displayName: string,
    dingTalkUserId: string,
    departmentName: string | null
  ): Promise<any> {
    // 检查用户名是否已存在
    const exists: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM sm_xitongkaifa.sys_users WHERE username=? LIMIT 1`,
      username
    );

    let finalUsername = username;
    if (exists.length > 0) {
      // 如果用户名已存在，使用钉钉userId作为用户名
      finalUsername = `dingtalk_${dingTalkUserId}`;
      Logger.log('[AclService] 用户名已存在，使用备用用户名:', finalUsername);

      const altExists: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM sm_xitongkaifa.sys_users WHERE username=? LIMIT 1`,
        finalUsername
      );

      if (altExists.length > 0) {
        throw new BadRequestException(`无法创建用户：用户名 ${username} 和 ${finalUsername} 都已存在`);
      }
    }

    // 创建用户
    // dingTalkUserId 是从 qyapi_get_member 权限点获取的真实员工 userID，将保存到 user_id 字段
    Logger.log('[AclService] 创建用户，username:', finalUsername, 'departmentName:', departmentName, 'dingTalkUserId (qyapi_get_member):', dingTalkUserId);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO sm_xitongkaifa.sys_users(username, password, display_name, code, status, department_id, user_id) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      finalUsername,
      null, // 钉钉登录不需要密码，设为NULL
      displayName,
      `dingtalk_${dingTalkUserId}`,
      1,
      departmentName,
      dingTalkUserId // 保存钉钉员工 userID（来自 qyapi_get_member 权限点，通常由数字组成）
    );

    // 查询新创建的用户
    const newUserRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, username, display_name, status FROM sm_xitongkaifa.sys_users WHERE username=? LIMIT 1`,
      finalUsername
    );
    const user = newUserRows[0];

    Logger.log('[AclService] ✓ 自动创建用户成功:', {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
    });

    // 自动分配角色
    await this.assignDefaultRole(Number(user.id), 2);

    return user;
  }

  async initSchema() {
    // 在系统库创建所需表（若不存在）
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sm_xitongkaifa.sys_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        password VARCHAR(128),
        display_name VARCHAR(64),
        code VARCHAR(64),
        session_token VARCHAR(128),
        last_login_time DATETIME,
        last_login_device VARCHAR(255),
        status TINYINT DEFAULT 1,
        department_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // 若已有历史表且 code 为 NOT NULL，则放宽为可空
    try { await this.prisma.$executeRawUnsafe(`ALTER TABLE sm_xitongkaifa.sys_users MODIFY code VARCHAR(64) NULL`); } catch { }
    // 兼容历史表缺少列/索引：通过 information_schema 判断
    await this.ensureColumns();
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sm_xitongkaifa.sys_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(64) UNIQUE NOT NULL,
        remark VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sm_xitongkaifa.sys_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(128) UNIQUE NOT NULL,
        name VARCHAR(128) NOT NULL,
        path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sm_xitongkaifa.sys_user_roles (
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        PRIMARY KEY(user_id, role_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sm_xitongkaifa.sys_role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        PRIMARY KEY(role_id, permission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  private async ensureSysUsersSchema() {
    // 动态校验并补齐列
    await this.ensureColumns();
  }

  // 权限CRUD
  listPermissions() {
    return this.prisma.$queryRawUnsafe(`SELECT * FROM sm_xitongkaifa.sys_permissions ORDER BY id DESC`);
  }
  createPermission(p: { code: string; name: string; path: string }) {
    return this.prisma.$executeRawUnsafe(
      `INSERT INTO sm_xitongkaifa.sys_permissions(code,name,path) VALUES(?,?,?)`,
      p.code,
      p.name,
      p.path,
    );
  }
  updatePermission(id: number, p: { code?: string; name?: string; path?: string }) {
    const sets: string[] = [];
    const vals: any[] = [];
    if (p.code !== undefined) { sets.push('code=?'); vals.push(p.code); }
    if (p.name !== undefined) { sets.push('name=?'); vals.push(p.name); }
    if (p.path !== undefined) { sets.push('path=?'); vals.push(p.path); }
    if (!sets.length) return Promise.resolve(0);
    vals.push(id);
    return this.prisma.$executeRawUnsafe(`UPDATE sm_xitongkaifa.sys_permissions SET ${sets.join(',')} WHERE id=?`, ...vals);
  }
  deletePermission(id: number) {
    return this.prisma.$executeRawUnsafe(`DELETE FROM sm_xitongkaifa.sys_permissions WHERE id=?`, id);
  }

  // 角色与授权
  listRoles() {
    return this.prisma.$queryRawUnsafe(`SELECT * FROM sm_xitongkaifa.sys_roles ORDER BY id DESC`);
  }
  createRole(r: { name: string; remark?: string }) {
    return this.prisma.$executeRawUnsafe(`INSERT INTO sm_xitongkaifa.sys_roles(name,remark) VALUES(?,?)`, r.name, r.remark || null);
  }
  updateRole(id: number, r: { name?: string; remark?: string }) {
    const sets: string[] = []; const vals: any[] = [];
    if (r.name !== undefined) { sets.push('name=?'); vals.push(r.name); }
    if (r.remark !== undefined) { sets.push('remark=?'); vals.push(r.remark); }
    if (!sets.length) return Promise.resolve(0);
    vals.push(id);
    return this.prisma.$executeRawUnsafe(`UPDATE sm_xitongkaifa.sys_roles SET ${sets.join(',')} WHERE id=?`, ...vals);
  }
  deleteRole(id: number) { return this.prisma.$executeRawUnsafe(`DELETE FROM sm_xitongkaifa.sys_roles WHERE id=?`, id); }

  setRolePermissions(roleId: number, permissionIds: number[]) {
    return this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(`DELETE FROM sm_xitongkaifa.sys_role_permissions WHERE role_id=?`, roleId),
      this.prisma.$executeRawUnsafe(
        `INSERT INTO sm_xitongkaifa.sys_role_permissions(role_id,permission_id) VALUES ${permissionIds.map(() => '(?,?)').join(',')}`,
        ...permissionIds.flatMap(pid => [roleId, pid])
      )
    ]);
  }

  async getRolePermissionIds(roleId: number) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT permission_id FROM sm_xitongkaifa.sys_role_permissions WHERE role_id=?`, roleId);
    return rows.map(r => Number(r.permission_id));
  }

  // 账号管理
  async listUsers(q = '') {
    let users: any[];
    if (!q) {
      users = await this.prisma.$queryRawUnsafe(`SELECT * FROM sm_xitongkaifa.sys_users ORDER BY id DESC`);
    } else {
      const like = `%${q}%`;
      users = await this.prisma.$queryRawUnsafe(`SELECT * FROM sm_xitongkaifa.sys_users WHERE username LIKE ? OR display_name LIKE ? ORDER BY id DESC`, like, like);
    }

    // 为每个用户获取角色信息
    for (const user of users) {
      const roleRows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT r.id, r.name 
        FROM sm_xitongkaifa.sys_roles r
        JOIN sm_xitongkaifa.sys_user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = ?
      `, user.id);
      user.roles = roleRows;
    }

    return users;
  }
```

**关键点解析**:

1. **`@Injectable()`**: 标记为可注入的服务
   - NestJS 依赖注入系统可以管理这个类

2. **依赖注入**: `constructor(private prisma: PrismaService, private dingTalkService: DingTalkService)`
   - 注入 `PrismaService` 用于数据库操作
   - 注入 `DingTalkService` 用于钉钉相关操作

3. **数据库操作**: `this.prisma.$queryRawUnsafe(...)`
   - 使用 Prisma 执行原始 SQL 查询
   - 支持参数化查询防止 SQL 注入

4. **业务逻辑**: 所有业务逻辑都在 Service 中实现
   - 数据验证
   - 业务规则
   - 数据处理

---

## 依赖注入机制

### 工作原理

```typescript
// 1. 模块声明提供者
@Module({
  providers: [AclService],  // 告诉 NestJS 如何创建 AclService
  imports: [PrismaModule],   // 导入 PrismaModule 以使用 PrismaService
})
export class AclModule {}

// 2. 服务声明依赖
@Injectable()
export class AclService {
  constructor(
    private prisma: PrismaService,  // NestJS 自动注入
  ) {}
}

// 3. 控制器使用服务
@Controller('acl')
export class AclController {
  constructor(
    private service: AclService,  // NestJS 自动注入
  ) {}
}
```

### 依赖注入流程

```
1. 应用启动
   ↓
2. 加载 AppModule
   ↓
3. 加载所有导入的模块（AclModule, PrismaModule 等）
   ↓
4. 创建所有 providers 的实例
   ↓
5. 解析依赖关系（PrismaService → AclService → AclController）
   ↓
6. 注入依赖到构造函数
   ↓
7. 应用就绪，可以处理请求
```

---

## 模块导入导出

### 主模块 (`app.module.ts`)

```27:53:server/src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TemplateModule,
    ProductModule,
    ReceiptModule,
    LabelDataModule,
    LabelPrintModule,
    SupplierManagementModule,
    AclModule,
    SupplierModule,
    VersionModule,
    DingTalkModule,
    OpsExclusionModule,
    OpsShelfExclusionModule,
    StoreRejectionModule,
    MaxPurchaseQuantityModule,
    MaxStoreSkuInventoryModule,
    PurchasePassDifferenceModule,
    Refund1688FollowUpModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule { }
```

**关键点**:

1. **`imports`**: 导入所有功能模块
   - 每个模块都是独立的业务单元
   - 模块之间通过 `exports` 共享服务

2. **全局模块**: `ConfigModule.forRoot({ isGlobal: true })`
   - 全局模块可以在任何地方使用，无需导入

3. **模块顺序**: 通常不重要，但循环依赖时需要 `forwardRef`

### 模块导出示例

```typescript
// PrismaModule 导出 PrismaService
@Module({
  providers: [PrismaService],
  exports: [PrismaService],  // 导出供其他模块使用
})
export class PrismaModule {}

// AclModule 使用 PrismaService
@Module({
  imports: [PrismaModule],  // 导入后可以使用 PrismaService
  providers: [AclService],
})
export class AclModule {}
```

---

## 其他相关文件

### 1. DTO (数据传输对象)

```1:23:server/src/template/dto/create-template.dto.ts
import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  contentTspl?: string; // 新增：TSPL 模板

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  productCode?: string;
}
```

**作用**:
- 定义请求数据的结构
- 使用装饰器进行验证
- 提供类型安全

**使用方式**:
```typescript
@Post('create')
async create(@Body() dto: CreateTemplateDto) {
  // dto 已经通过验证
  return this.service.create(dto);
}
```

### 2. Guard (守卫)

```1:47:server/src/security/roles.guard.ts
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
```

**作用**:
- 在请求到达控制器之前进行拦截
- 实现权限验证、身份认证等功能
- 返回 `true` 允许通过，`false` 拒绝请求

### 3. PrismaService (数据库服务)

```1:15:server/src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // 启动期不主动连接数据库，等第一次查询时 Prisma 会自动连接
    return;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

**作用**:
- 封装 Prisma Client
- 管理数据库连接生命周期
- 提供数据库操作方法

### 4. 应用入口 (`main.ts`)

```1:57:server/src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { Logger } from './utils/logger.util';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // 确保所有 HTTP 方法（包括 DELETE）都能正确解析 JSON body，并放宽请求体大小限制以支持图片等大字段
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 启用静态文件服务（用于托管APK下载）
    app.useStaticAssets(join(__dirname, '..', 'public'), {
      prefix: '/downloads/',
    });

    app.enableCors({
      origin: true, // 允许所有来源（生产环境建议配置具体域名）
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
    });

    // 添加 CORS 日志（开发环境）
    if (process.env.NODE_ENV !== 'production') {
      Logger.log('[Bootstrap] CORS 已启用，允许所有来源');
    }
    const port = process.env.PORT ? parseInt(process.env.PORT) : 5002; // 后端使用端口5002进行本地测试
    await app.listen(port, '0.0.0.0');
    Logger.log(`[Bootstrap] 后端服务已启动，端口: ${port}`);
    Logger.log(`[Bootstrap] APK下载地址: http://localhost:${port}/downloads/`);
  } catch (error: any) {
    Logger.error('[Bootstrap] 启动失败:', error);
    Logger.error('[Bootstrap] 错误堆栈:', error?.stack);
    process.exit(1);
  }
}

// 添加全局未捕获异常处理
process.on('uncaughtException', (error: Error) => {
  Logger.error('[UncaughtException] 未捕获的异常:', error);
  Logger.error('[UncaughtException] 错误堆栈:', error.stack);
  // 不立即退出，让应用继续运行以便记录更多信息
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  Logger.error('[UnhandledRejection] 未处理的Promise拒绝:', reason);
  Logger.error('[UnhandledRejection] Promise:', promise);
});

bootstrap();
```

**作用**:
- 创建 NestJS 应用实例
- 配置中间件（JSON 解析、CORS 等）
- 启动 HTTP 服务器

---

## 完整请求流程

### 示例：获取用户列表

```
1. 客户端发送请求
   GET /acl/users?q=admin
   Headers: { x-user-id: 1 }
   ↓

2. NestJS 路由匹配
   - 匹配到 @Controller('acl') 的 AclController
   - 匹配到 @Get('users') 的 listUsers 方法
   ↓

3. 执行中间件（如果有）
   - CORS 处理
   - JSON 解析
   - Guard 验证（RolesGuard）
   ↓

4. 进入控制器方法
   @Get('users')
   listUsers(@Query('q') q?: string) {
     return this.service.listUsers(q || '');
   }
   ↓

5. 调用服务方法
   async listUsers(q = '') {
     // 执行数据库查询
     const users = await this.prisma.$queryRawUnsafe(...);
     // 处理业务逻辑
     for (const user of users) {
       // 获取角色信息
     }
     return users;
   }
   ↓

6. 返回响应
   {
     "id": 1,
     "username": "admin",
     "display_name": "管理员",
     "roles": [...]
   }
   ↓

7. 客户端接收响应
```

### 代码执行顺序

```typescript
// 1. 请求到达
GET /acl/users?q=admin

// 2. 路由匹配
AclController.listUsers()

// 3. 参数提取
@Query('q') q = 'admin'

// 4. 调用服务
AclService.listUsers('admin')

// 5. 数据库查询
PrismaService.$queryRawUnsafe('SELECT * FROM ...')

// 6. 业务处理
// 为每个用户添加角色信息

// 7. 返回结果
return users

// 8. 序列化为 JSON
// NestJS 自动处理

// 9. 发送 HTTP 响应
HTTP/1.1 200 OK
Content-Type: application/json
{ ... }
```

---

## 总结

### 核心关系

1. **Module** → 组织 Controller 和 Service
2. **Controller** → 接收请求，调用 Service
3. **Service** → 实现业务逻辑，操作数据库
4. **DTO** → 定义和验证数据结构
5. **Guard** → 拦截请求进行权限验证

### 依赖关系

```
AppModule (主模块)
  ├── AclModule
  │     ├── AclController (依赖 AclService)
  │     └── AclService (依赖 PrismaService, DingTalkService)
  ├── PrismaModule
  │     └── PrismaService (数据库服务)
  └── DingTalkModule
        └── DingTalkService (钉钉服务)
```

### 设计原则

1. **单一职责**: 每个类只负责一个功能
2. **依赖注入**: 通过构造函数注入依赖
3. **模块化**: 功能按模块组织
4. **可测试性**: 依赖注入便于单元测试
5. **类型安全**: TypeScript 提供类型检查

---

**最后更新**: 2025年1月

