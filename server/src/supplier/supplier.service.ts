import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';
import { SupplierFullInfo, SupplierManagement } from './supplier.controller';

@Injectable()
export class SupplierService {
  private async getConnection() {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD,
      database: 'sm_chaigou',
      port: parseInt(process.env.DB_PORT || '3306'),
    });
  }

  private async getXitongkaifaConnection() {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD,
      database: 'sm_xitongkaifa',
      port: parseInt(process.env.DB_PORT || '3306'),
    });
  }

  // 确保日志表存在
  private async ensureLogTableExists(connection: any): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS supplier_management_change_log (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        supplier_code VARCHAR(128) NOT NULL,
        action VARCHAR(20) NOT NULL COMMENT 'create, update, delete',
        changes JSON COMMENT '变更内容',
        user_id INT COMMENT '操作用户ID',
        user_name VARCHAR(128) COMMENT '操作用户显示名称',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_supplier_code (supplier_code),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商管理变更日志表'
    `;

    await connection.execute(createTableQuery);
  }

  // 记录变更日志
  private async logChange(data: {
    supplierCode: string;
    action: string;
    changes: Record<string, any>;
    userId?: number;
    userName?: string;
  }): Promise<void> {
    const connection = await this.getXitongkaifaConnection();

    try {
      await this.ensureLogTableExists(connection);

      const insertLogQuery = `
        INSERT INTO supplier_management_change_log 
        (supplier_code, action, changes, user_id, user_name, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      await connection.execute(insertLogQuery, [
        data.supplierCode,
        data.action,
        JSON.stringify(data.changes),
        data.userId || null,
        data.userName || null,
      ]);

      // 删除超过30条的旧记录
      const deleteOldLogsQuery = `
        DELETE FROM supplier_management_change_log
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id 
            FROM supplier_management_change_log 
            WHERE supplier_code = ?
            ORDER BY created_at DESC 
            LIMIT 30
          ) AS recent_logs
        )
        AND supplier_code = ?
      `;

      await connection.execute(deleteOldLogsQuery, [
        data.supplierCode,
        data.supplierCode,
      ]);

      Logger.log('[SupplierService] Old logs cleaned up (keeping max 30 records)');
    } catch (error) {
      // 不记录完整的错误对象，避免暴露敏感信息
      Logger.error('[SupplierService] Failed to insert log:', (error as Error)?.message || '未知错误');
    } finally {
      await connection.end();
    }
  }

  async getAllSuppliers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    contactPerson?: string,
    officeAddress?: string,
  ): Promise<{ data: SupplierFullInfo[]; total: number }> {
    const connection = await this.getConnection();

    try {
      const offset = (page - 1) * limit;

      // 构建搜索条件
      let whereClause = '1=1';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (sb.供应商编码 LIKE ? OR sb.供应商名称 LIKE ?)';
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      // 如果contactPerson和officeAddress参数值相同，使用OR逻辑合并搜索
      if (contactPerson && officeAddress && contactPerson === officeAddress) {
        whereClause += ' AND (sb.联系人 LIKE ? OR sb.办公地址 LIKE ?)';
        queryParams.push(`%${contactPerson}%`, `%${contactPerson}%`);
      } else {
        // 否则保持原有逻辑，分别处理
        if (contactPerson) {
          whereClause += ' AND sb.联系人 LIKE ?';
          queryParams.push(`%${contactPerson}%`);
        }

        if (officeAddress) {
          whereClause += ' AND sb.办公地址 LIKE ?';
          queryParams.push(`%${officeAddress}%`);
        }
      }

      // 获取总数
      const totalQuery = `
        SELECT COUNT(*) as count 
        FROM \`供应商基础资料\` sb 
        WHERE ${whereClause}
      `;
      const [totalResult]: any = await connection.execute(totalQuery, queryParams);
      const total = totalResult[0].count;

      // 获取数据
      const dataQuery = `
        SELECT 
          sb.供应商编码 as supplierCode,
          sb.供应商名称 as supplierName,
          CAST(sb.到货天数 as UNSIGNED) as deliveryDays,
          sb.办公地址 as officeAddress,
          sb.联系人 as contactPerson,
          sb.联系电话 as contactPhone,
          sm.供应商起订金额 as minOrderAmount,
          sm.供应商起订数量 as minOrderQuantity,
          sm.供应商下单备注 as orderRemarks,
          sm.旺旺消息 as wangwangMessage,
          sm.供应商下单策略 as orderStrategy,
          sm.内部供应商维护备注信息 as internalRemarks
        FROM \`供应商基础资料\` sb
        LEFT JOIN \`供应商管理\` sm ON sb.供应商编码 = sm.供应商编码
        WHERE ${whereClause}
        ORDER BY sb.供应商编码
        LIMIT ? OFFSET ?
      `;

      const [data]: any = await connection.execute(
        dataQuery,
        [...queryParams, limit, offset]
      );

      return {
        data: data.map((row: any) => ({
          supplierCode: row.supplierCode,
          supplierName: row.supplierName,
          deliveryDays: row.deliveryDays,
          officeAddress: row.officeAddress,
          contactPerson: row.contactPerson,
          contactPhone: row.contactPhone,
          minOrderAmount: row.minOrderAmount,
          minOrderQuantity: row.minOrderQuantity,
          orderRemarks: row.orderRemarks,
          wangwangMessage: row.wangwangMessage,
          orderStrategy: row.orderStrategy,
          internalRemarks: row.internalRemarks,
        })),
        total,
      };
    } finally {
      await connection.end();
    }
  }

  async getSupplierByCode(supplierCode: string): Promise<SupplierFullInfo | null> {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT 
          sb.供应商编码 as supplierCode,
          sb.供应商名称 as supplierName,
          CAST(sb.到货天数 as UNSIGNED) as deliveryDays,
          sb.办公地址 as officeAddress,
          sb.联系人 as contactPerson,
          sb.联系电话 as contactPhone,
          sm.供应商起订金额 as minOrderAmount,
          sm.供应商起订数量 as minOrderQuantity,
          sm.供应商下单备注 as orderRemarks,
          sm.旺旺消息 as wangwangMessage,
          sm.供应商下单策略 as orderStrategy,
          sm.内部供应商维护备注信息 as internalRemarks
        FROM \`供应商基础资料\` sb
        LEFT JOIN \`供应商管理\` sm ON sb.供应商编码 = sm.供应商编码
        WHERE sb.供应商编码 = ?
      `;

      const [result]: any = await connection.execute(query, [supplierCode]);

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        supplierCode: row.supplierCode,
        supplierName: row.supplierName,
        deliveryDays: row.deliveryDays,
        officeAddress: row.officeAddress,
        contactPerson: row.contactPerson,
        contactPhone: row.contactPhone,
        minOrderAmount: row.minOrderAmount,
        minOrderQuantity: row.minOrderQuantity,
        orderRemarks: row.orderRemarks,
        wangwangMessage: row.wangwangMessage,
        orderStrategy: row.orderStrategy,
        internalRemarks: row.internalRemarks,
      };
    } finally {
      await connection.end();
    }
  }

  // 确保供应商管理表有旺旺消息字段
  private async ensureWangwangMessageColumn(connection: any): Promise<void> {
    try {
      const checkColumnQuery = `
        SELECT COUNT(*) as count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'sm_chaigou' 
        AND TABLE_NAME = '供应商管理' 
        AND COLUMN_NAME = '旺旺消息'
      `;
      const [result]: any = await connection.execute(checkColumnQuery);

      if (result[0].count === 0) {
        const addColumnQuery = `
          ALTER TABLE \`供应商管理\` 
          ADD COLUMN \`旺旺消息\` TEXT NULL COMMENT '下单后联系供应商话术'
        `;
        await connection.execute(addColumnQuery);
        Logger.log('[SupplierService] 已添加旺旺消息字段到供应商管理表');
      }
    } catch (error) {
      Logger.error('[SupplierService] 检查/添加旺旺消息字段失败:', error);
      // 不抛出错误，允许继续执行
    }
  }

  async upsertSupplierManagement(
    data: SupplierManagement,
    userId?: number,
    userName?: string
  ): Promise<SupplierManagement> {
    const connection = await this.getConnection();

    try {
      // 确保旺旺消息字段存在
      await this.ensureWangwangMessageColumn(connection);
      // 检查供应商编码是否存在于基础资料表
      const basicInfoQuery = `
        SELECT COUNT(*) as count 
        FROM \`供应商基础资料\` 
        WHERE 供应商编码 = ?
      `;
      const [basicInfoResult]: any = await connection.execute(basicInfoQuery, [data.supplierCode]);

      if (basicInfoResult[0].count === 0) {
        throw new Error('供应商编码不存在');
      }

      // 检查管理表中是否已存在，并获取旧数据
      const existsQuery = `
        SELECT * 
        FROM \`供应商管理\` 
        WHERE 供应商编码 = ?
      `;
      const [existsResult]: any = await connection.execute(existsQuery, [data.supplierCode]);

      const action = existsResult.length > 0 ? 'update' : 'create';
      const changes: Record<string, any> = {};

      if (existsResult.length > 0) {
        // 记录变更
        const oldRecord = existsResult[0];
        const fieldMap: Record<string, string> = {
          minOrderAmount: '供应商起订金额',
          minOrderQuantity: '供应商起订数量',
          orderRemarks: '供应商下单备注',
          wangwangMessage: '旺旺消息',
          orderStrategy: '供应商下单策略',
          internalRemarks: '内部供应商维护备注信息',
        };

        for (const [key, dbField] of Object.entries(fieldMap)) {
          const oldValue = oldRecord[dbField];
          const newValue = data[key as keyof typeof data] || null;
          if (String(oldValue) !== String(newValue)) {
            changes[key] = { old: oldValue, new: newValue };
          }
        }

        // 更新
        const updateQuery = `
          UPDATE \`供应商管理\` 
          SET 
            供应商起订金额 = ?,
            供应商起订数量 = ?,
            供应商下单备注 = ?,
            旺旺消息 = ?,
            供应商下单策略 = ?,
            内部供应商维护备注信息 = ?
          WHERE 供应商编码 = ?
        `;
        await connection.execute(
          updateQuery,
          [
            data.minOrderAmount || null,
            data.minOrderQuantity || null,
            data.orderRemarks || null,
            data.wangwangMessage || null,
            data.orderStrategy || null,
            data.internalRemarks || null,
            data.supplierCode
          ]
        );
      } else {
        // 插入
        const insertQuery = `
          INSERT INTO \`供应商管理\` 
          (供应商编码, 供应商起订金额, 供应商起订数量, 供应商下单备注, 旺旺消息, 供应商下单策略, 内部供应商维护备注信息)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(
          insertQuery,
          [
            data.supplierCode,
            data.minOrderAmount || null,
            data.minOrderQuantity || null,
            data.orderRemarks || null,
            data.wangwangMessage || null,
            data.orderStrategy || null,
            data.internalRemarks || null
          ]
        );
      }

      // 记录日志
      await this.logChange({
        supplierCode: data.supplierCode,
        action,
        changes,
        userId,
        userName,
      });

      return data;
    } finally {
      await connection.end();
    }
  }

  async deleteSupplierManagement(supplierCode: string): Promise<boolean> {
    const connection = await this.getConnection();

    try {
      const deleteQuery = `
        DELETE FROM \`供应商管理\` 
        WHERE 供应商编码 = ?
      `;

      await connection.execute(deleteQuery, [supplierCode]);
      return true;
    } finally {
      await connection.end();
    }
  }

  async getStatistics(): Promise<{
    totalSuppliers: number;
    managedSuppliers: number;
    averageDeliveryDays: number;
  }> {
    const connection = await this.getConnection();

    try {
      // 总供应商数
      const totalQuery = `SELECT COUNT(*) as count FROM \`供应商基础资料\``;
      const [totalResult]: any = await connection.execute(totalQuery);

      // 已管理供应商数
      const managedQuery = `SELECT COUNT(*) as count FROM \`供应商管理\``;
      const [managedResult]: any = await connection.execute(managedQuery);

      // 平均到货天数
      const avgQuery = `SELECT AVG(CAST(到货天数 as UNSIGNED)) as avg FROM \`供应商基础资料\``;
      const [avgResult]: any = await connection.execute(avgQuery);

      return {
        totalSuppliers: totalResult[0].count,
        managedSuppliers: managedResult[0].count,
        averageDeliveryDays: Math.round(avgResult[0].avg || 0),
      };
    } finally {
      await connection.end();
    }
  }

  // 获取供应商管理变更日志
  async getSupplierManagementLogs(supplierCode: string): Promise<any[]> {
    const connection = await this.getXitongkaifaConnection();

    try {
      await this.ensureLogTableExists(connection);

      const query = `
        SELECT 
          id,
          supplier_code as supplierCode,
          action,
          changes,
          user_id as userId,
          user_name as userName,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt
        FROM supplier_management_change_log 
        WHERE supplier_code = ?
        ORDER BY created_at DESC
        LIMIT 100
      `;

      const [rows]: any = await connection.execute(query, [supplierCode]);

      // 对于有 user_id 的记录，从 sys_users 表查询 username 并组合显示
      const userIds = rows
        .filter((row: any) => row.userId)
        .map((row: any) => row.userId);

      const userNameMap: Record<number, string> = {};
      if (userIds.length > 0) {
        try {
          const uniqueUserIds = [...new Set(userIds)];
          const userQuery = `
            SELECT id, username 
            FROM sm_xitongkaifa.sys_users 
            WHERE id IN (${uniqueUserIds.join(',')})
          `;
          const [users]: any = await connection.execute(userQuery);
          users.forEach((user: any) => {
            userNameMap[user.id] = user.username;
          });
        } catch (error) {
          Logger.error('[SupplierService] Failed to query sys_users:', error);
        }
      }

      return (rows || []).map((row: any) => ({
        ...row,
        changes: typeof row.changes === 'string' ? JSON.parse(row.changes) : (row.changes || {}),
        // 组合显示：如果有 user_name 和 username，显示为 "user_name（username）"
        userName: (() => {
          const displayName = row.userName;
          const username = row.userId ? userNameMap[row.userId] : null;

          if (displayName && username) {
            return `${displayName}（${username}）`;
          } else if (displayName) {
            return displayName;
          } else if (username) {
            return username;
          } else {
            return null;
          }
        })(),
      }));
    } catch (error) {
      Logger.error('[SupplierService] 获取变更日志失败:', error);
      return [];
    } finally {
      await connection.end();
    }
  }
}
