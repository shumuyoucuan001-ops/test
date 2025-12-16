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
  async createUser(u: { username: string; password: string; display_name: string; code?: string; status?: number; department_id?: string | number; user_id?: string }) {
    await this.ensureSysUsersSchema();
    const username = (u.username || '').trim();
    const password = (u.password || '').trim();
    const displayName = (u.display_name || '').trim();
    const code = (u.code || '').trim();
    const status = u.status ?? 1;
    const departmentId = u.department_id ?? null;
    const userId = (u.user_id || '').trim() || null; // 钉钉员工USERID

    if (username.length < 3 || username.length > 64) throw new BadRequestException('用户名长度需 3-64 个字符');
    if (password.length < 6 || password.length > 128) throw new BadRequestException('密码长度需 6-128 个字符');
    if (displayName.length < 1 || displayName.length > 64) throw new BadRequestException('显示名长度需 1-64 个字符');
    if (code && code.length > 64) throw new BadRequestException('编码长度不能超过 64 个字符');
    if (userId && userId.length > 128) throw new BadRequestException('员工USERID长度不能超过 128 个字符');
    if (![0, 1].includes(Number(status))) throw new BadRequestException('状态仅支持 0 或 1');

    const exists: any[] = await this.prisma.$queryRawUnsafe(`SELECT id FROM sm_xitongkaifa.sys_users WHERE username=? LIMIT 1`, username);
    if (exists.length) throw new BadRequestException('用户名已存在');

    try {
      return await this.prisma.$executeRawUnsafe(
        `INSERT INTO sm_xitongkaifa.sys_users(username,password,display_name,code,status,department_id,user_id) VALUES(?,?,?,?,?,?,?)`,
        username, password, displayName, code || null, status, departmentId, userId
      );
    } catch (e: any) {
      // 兜底：若仍提示列不存在，再次尝试修复一次
      await this.ensureSysUsersSchema();
      return await this.prisma.$executeRawUnsafe(
        `INSERT INTO sm_xitongkaifa.sys_users(username,password,display_name,code,status,department_id,user_id) VALUES(?,?,?,?,?,?,?)`,
        username, password, displayName, code || null, status, departmentId, userId
      );
    }
  }
  async updateUser(id: number, u: { display_name?: string; status?: number; password?: string; code?: string; department_id?: string | number }) {
    await this.ensureSysUsersSchema();

    // 如果要更新 display_name，检查编辑次数
    if (u.display_name !== undefined) {
      const userRows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT display_name, display_name_edit_count FROM sm_xitongkaifa.sys_users WHERE id=? LIMIT 1`,
        id
      );

      if (userRows.length === 0) {
        throw new BadRequestException('用户不存在');
      }

      const currentDisplayName = userRows[0].display_name;
      const editCount = Number(userRows[0].display_name_edit_count || 0);

      // 准备其他字段的更新（无论 display_name 是否变化，都要处理其他字段）
      const otherSets: string[] = [];
      const otherVals: any[] = [];
      if (u.status !== undefined) {
        otherSets.push('status=?');
        otherVals.push(u.status);
        // 当账号被禁用时，立即清空 session_token，强制下线
        if (Number(u.status) === 0) {
          otherSets.push('session_token=NULL');
        }
      }
      if (u.password !== undefined) { otherSets.push('password=?'); otherVals.push(u.password); }
      if (u.code !== undefined) { otherSets.push('code=?'); otherVals.push(u.code); }
      if (u.department_id !== undefined) { otherSets.push('department_id=?'); otherVals.push(u.department_id); }

      // 如果 display_name 有变化，需要更新 display_name
      if (currentDisplayName !== u.display_name) {
        // 检查编辑次数是否超过限制（最多2次）
        if (editCount >= 2) {
          throw new BadRequestException('display_name 最多只能编辑2次，已达到上限');
        }

        // 更新 display_name 和编辑次数
        const newEditCount = editCount + 1;
        otherSets.push('display_name=?');
        otherVals.push(u.display_name);
        otherSets.push('display_name_edit_count=?');
        otherVals.push(newEditCount);

        Logger.log(`[AclService] 用户 ${id} 更新 display_name，编辑次数: ${newEditCount}/2`);
      }

      // 如果有任何字段需要更新，执行更新
      if (otherSets.length > 0) {
        otherVals.push(id);
        await this.prisma.$executeRawUnsafe(
          `UPDATE sm_xitongkaifa.sys_users SET ${otherSets.join(',')} WHERE id=?`,
          ...otherVals
        );
        return Promise.resolve(1);
      }

      // 如果没有任何字段需要更新，返回0
      return Promise.resolve(0);
    }

    // 如果不是更新 display_name，使用原来的逻辑
    const sets: string[] = [];
    const vals: any[] = [];
    if (u.status !== undefined) {
      sets.push('status=?');
      vals.push(u.status);
      // 当账号被禁用时，立即清空 session_token，强制下线
      if (Number(u.status) === 0) {
        sets.push('session_token=NULL');
      }
    }
    if (u.password !== undefined) { sets.push('password=?'); vals.push(u.password); }
    if (u.code !== undefined) { sets.push('code=?'); vals.push(u.code); }
    if (u.department_id !== undefined) { sets.push('department_id=?'); vals.push(u.department_id); }
    if (!sets.length) return Promise.resolve(0);
    vals.push(id);
    return this.prisma.$executeRawUnsafe(`UPDATE sm_xitongkaifa.sys_users SET ${sets.join(',')} WHERE id=?`, ...vals);
  }

  // 获取用户的 display_name 编辑次数信息
  async getUserEditCount(userId: number): Promise<{ editCount: number; remaining: number }> {
    await this.ensureSysUsersSchema();
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT display_name_edit_count FROM sm_xitongkaifa.sys_users WHERE id=? LIMIT 1`,
      userId
    );

    if (rows.length === 0) {
      throw new BadRequestException('用户不存在');
    }

    const editCount = Number(rows[0].display_name_edit_count || 0);
    return {
      editCount,
      remaining: Math.max(0, 2 - editCount)
    };
  }
  deleteUser(id: number) { return this.prisma.$executeRawUnsafe(`DELETE FROM sm_xitongkaifa.sys_users WHERE id=?`, id); }
  setUserRoles(userId: number, roleIds: number[]) {
    return this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(`DELETE FROM sm_xitongkaifa.sys_user_roles WHERE user_id=?`, userId),
      this.prisma.$executeRawUnsafe(`INSERT INTO sm_xitongkaifa.sys_user_roles(user_id,role_id) VALUES ${roleIds.map(() => '(?,?)').join(',')}`,
        ...roleIds.flatMap(rid => [userId, rid]))
    ]);
  }

  // 查询用户已分配的角色ID集合（用于前端展示与预勾选）
  async getUserRoleIds(userId: number) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT role_id FROM sm_xitongkaifa.sys_user_roles WHERE user_id=?`, userId);
    return rows.map(r => Number(r.role_id));
  }

  // 查询用户全部权限（用于前端菜单授权）
  async getUserPermissions(userId: number) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT p.* FROM sm_xitongkaifa.sys_permissions p
      JOIN sm_xitongkaifa.sys_role_permissions rp ON rp.permission_id = p.id
      JOIN sm_xitongkaifa.sys_user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = ?
    `, userId);
    return rows;
  }

  // 登录：简单用户名/密码校验，返回用户基本信息
  // 支持单点登录：同一用户在新设备登录时，旧设备的token会失效
  // 新增：支持钉钉验证，只有企业内成员才能登录
  async login(username: string, password: string, deviceInfo?: string, dingTalkCode?: string) {
    await this.ensureSysUsersSchema();

    // 如果提供了钉钉授权码，先验证钉钉身份
    if (dingTalkCode) {
      try {
        const dingTalkUserInfo = await this.dingTalkService.getUserInfoByCode(dingTalkCode);
        // 验证成功，继续后续流程
        Logger.log(`[AclService] 钉钉验证成功，用户: ${dingTalkUserInfo.name} (${dingTalkUserInfo.userId})`);
      } catch (error: any) {
        throw new BadRequestException(`钉钉验证失败: ${error.message}`);
      }
    } else {
      // 如果没有提供钉钉授权码，检查是否强制要求钉钉登录
      const requireDingTalk = process.env.REQUIRE_DINGTALK_LOGIN === 'true';
      if (requireDingTalk) {
        throw new BadRequestException('请使用钉钉登录');
      }
    }

    Logger.log(`[AclService] 开始登录验证，用户名: ${username}`);

    const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT id, username, display_name, status, password, session_token FROM sm_xitongkaifa.sys_users WHERE username=? LIMIT 1`, username || '');
    if (!rows.length) {
      Logger.log(`[AclService] 登录失败：用户不存在，用户名: ${username}`);
      throw new BadRequestException('用户不存在');
    }
    const u = rows[0];
    if (String(u.password || '') !== String(password || '')) {
      Logger.log(`[AclService] 登录失败：密码错误，用户名: ${username}`);
      throw new BadRequestException('密码错误');
    }
    if (Number(u.status) !== 1) {
      Logger.log(`[AclService] 登录失败：账号已禁用，用户名: ${username}`);
      throw new BadRequestException('账号已禁用');
    }

    // 生成新token
    const token = randomBytes(24).toString('hex');
    const loginTime = new Date();
    const device = deviceInfo || 'unknown';

    Logger.log(`[AclService] 用户验证通过，准备更新session_token，用户ID: ${u.id}`);

    // 更新用户的session_token (单点登录：覆盖旧token)
    try {
      // 先检查字段是否存在，如果不存在则尝试创建
      const hasLastLoginTime = await this.hasCol('last_login_time');
      const hasLastLoginDevice = await this.hasCol('last_login_device');

      if (!hasLastLoginTime || !hasLastLoginDevice) {
        Logger.log(`[AclService] 检测到缺少字段，尝试创建... hasLastLoginTime: ${hasLastLoginTime}, hasLastLoginDevice: ${hasLastLoginDevice}`);
        await this.ensureColumns(); // 重新确保字段存在
      }

      await this.prisma.$executeRawUnsafe(
        `UPDATE sm_xitongkaifa.sys_users SET session_token=?, last_login_time=?, last_login_device=? WHERE id=?`,
        token,
        loginTime,
        device,
        Number(u.id)
      );
      Logger.log(`[AclService] session_token更新成功，用户ID: ${u.id}`);
    } catch (error: any) {
      Logger.error(`[AclService] 更新session_token失败，用户ID: ${u.id}`, error);
      Logger.error(`[AclService] 错误详情: ${error?.message}`);
      Logger.error(`[AclService] SQL错误: ${error?.code}`);

      // 如果更新失败，尝试仅更新session_token（不更新登录时间字段）
      try {
        Logger.log(`[AclService] 尝试仅更新session_token...`);
        await this.prisma.$executeRawUnsafe(
          `UPDATE sm_xitongkaifa.sys_users SET session_token=? WHERE id=?`,
          token,
          Number(u.id)
        );
        Logger.log(`[AclService] session_token更新成功（简化版本），用户ID: ${u.id}`);
      } catch (fallbackError: any) {
        Logger.error(`[AclService] 简化更新也失败: ${fallbackError?.message}`);
        throw new BadRequestException(`更新会话信息失败: ${error?.message || fallbackError?.message}`);
      }
    }

    // 记录登录历史
    try {
      await this.logLogin(Number(u.id), u.username, device, loginTime, token);
    } catch (logError: any) {
      // 登录历史记录失败不影响登录流程，只记录日志
      Logger.warn(`[AclService] 记录登录历史失败，但不影响登录: ${logError?.message}`);
    }

    Logger.log(`[AclService] 登录成功，用户: ${u.username} (ID: ${u.id})`);
    return { id: Number(u.id), username: u.username, display_name: u.display_name, token };
  }

  // 钉钉自动登录：根据钉钉用户信息自动登录
  async dingTalkAutoLogin(dingTalkUserInfo: DingTalkUserInfo, deviceInfo?: string) {
    await this.ensureSysUsersSchema();

    // dingTalkUserId 是从 qyapi_get_member 权限点（topapi/v2/user/get 接口）获取的真实员工 userID
    // 这个 userID 通常由数字组成，是钉钉员工的唯一标识
    const dingTalkUserId = dingTalkUserInfo.userId;
    const mobile = dingTalkUserInfo.mobile;
    const name = dingTalkUserInfo.name || '';

    Logger.log('[AclService] ========== 开始钉钉自动登录 ==========');
    Logger.log('[AclService] 钉钉用户信息（来自 qyapi_get_member 权限点）:', {
      userId: dingTalkUserId,
      name: name,
      mobile: mobile,
      email: dingTalkUserInfo.email,
      deptIdList: dingTalkUserInfo.deptIdList,
      deptNames: dingTalkUserInfo.deptNames,
    });
    Logger.log('[AclService] 钉钉员工 userID（将保存到 sys_users.user_id 字段）:', dingTalkUserId);

    // 获取主部门名称（取第一个部门名称，如果存在多个部门）
    // 存储中文部门名称到 department_id 字段
    const departmentName = dingTalkUserInfo.deptNames && dingTalkUserInfo.deptNames.length > 0
      ? dingTalkUserInfo.deptNames[0]
      : (dingTalkUserInfo.deptIdList && dingTalkUserInfo.deptIdList.length > 0
        ? `部门${dingTalkUserInfo.deptIdList[0]}` // 如果没有名称，使用部门ID作为后备
        : null);

    Logger.log('[AclService] 提取的部门信息:', {
      deptIdList: dingTalkUserInfo.deptIdList,
      deptNames: dingTalkUserInfo.deptNames,
      departmentName: departmentName,
      departmentNameType: typeof departmentName,
    });

    // 优先通过手机号查找用户（如果手机号存在）
    let user: any = null;
    if (mobile) {
      Logger.log('[AclService] 尝试通过手机号查找用户:', mobile);
      // 尝试通过手机号查找用户（假设手机号可能存储在username或display_name字段）
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, username, display_name, status, session_token, code FROM sm_xitongkaifa.sys_users WHERE username=? OR display_name=? LIMIT 1`,
        mobile,
        name || mobile
      );
      Logger.log('[AclService] 通过手机号/姓名查找结果:', rows.length > 0 ? `找到用户: ${rows[0].username}` : '未找到');
      if (rows.length > 0) {
        user = rows[0];
        Logger.log('[AclService] ✓ 通过手机号/姓名找到用户:', user.username);
      }
    }

    // 如果找不到，尝试通过钉钉userId查找（假设存储在code字段）
    if (!user && dingTalkUserId) {
      const codeValue = `dingtalk_${dingTalkUserId}`;
      Logger.log('[AclService] 尝试通过钉钉userId查找用户，code:', codeValue);
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, username, display_name, status, session_token, code FROM sm_xitongkaifa.sys_users WHERE code=? LIMIT 1`,
        codeValue
      );
      Logger.log('[AclService] 通过钉钉userId查找结果:', rows.length > 0 ? `找到用户: ${rows[0].username}` : '未找到');
      if (rows.length > 0) {
        user = rows[0];
        Logger.log('[AclService] ✓ 通过钉钉userId找到用户:', user.username);
      }
    }

    // 如果还是找不到，自动创建用户
    if (!user) {
      Logger.log('[AclService] 未找到用户，开始自动创建新用户...');

      // 生成用户名：优先使用手机号，如果没有则使用钉钉userId
      const username = mobile || `dingtalk_${dingTalkUserId}`;
      // 使用钉钉用户的真实姓名作为display_name，如果没有姓名则使用用户名
      const displayName = name.trim() || username;

      Logger.log('[AclService] 准备创建用户:', {
        username: username,
        display_name: displayName,
        code: `dingtalk_${dingTalkUserId}`,
      });

      // 使用统一的方法创建用户（自动处理用户名冲突）
      user = await this.createDingTalkUser(username, displayName, dingTalkUserId, departmentName);
    }

    // 检查用户状态
    if (Number(user.status) !== 1) {
      throw new BadRequestException('账号已禁用');
    }

    // 生成新token
    const token = randomBytes(24).toString('hex');
    const loginTime = new Date();
    const device = deviceInfo || 'dingtalk_web';

    // 更新用户的session_token和部门信息 (单点登录：覆盖旧token)
    // dingTalkUserId 是从 qyapi_get_member 权限点获取的真实员工 userID，将保存到 user_id 字段
    Logger.log('[AclService] 更新用户信息，userId:', user.id, 'departmentName:', departmentName, 'dingTalkUserId (qyapi_get_member):', dingTalkUserId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE sm_xitongkaifa.sys_users SET session_token=?, last_login_time=?, last_login_device=?, code=?, department_id=?, user_id=? WHERE id=?`,
      token,
      loginTime,
      device,
      `dingtalk_${dingTalkUserId}`,
      departmentName,
      dingTalkUserId, // 保存钉钉员工 userID（来自 qyapi_get_member 权限点，通常由数字组成）
      Number(user.id)
    );

    // 记录登录历史
    await this.logLogin(Number(user.id), user.username, device, loginTime, token);

    Logger.log('[AclService] 钉钉自动登录成功，用户:', user.username);

    return {
      id: Number(user.id),
      username: user.username,
      display_name: user.display_name || name,
      token,
    };
  }

  async validateToken(userId: number, token: string) {
    await this.ensureSysUsersSchema();
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT session_token, status FROM sm_xitongkaifa.sys_users WHERE id=?`,
      userId
    );
    if (!rows.length) return false;
    // 账号被禁用时，无论 token 是否匹配，都视为无效，会触发前端强制退出
    if (Number(rows[0]?.status) !== 1) return false;
    return String(rows[0]?.session_token || '') === String(token || '');
  }

  async logout(userId: number, token: string) {
    if (!(await this.validateToken(userId, token))) return { success: true };
    await this.prisma.$executeRawUnsafe(`UPDATE sm_xitongkaifa.sys_users SET session_token=NULL WHERE id=?`, userId);
    return { success: true };
  }
}


