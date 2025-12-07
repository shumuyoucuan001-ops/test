import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

@Injectable()
export class SupplierManagementService {
  private async getXitongkaifaConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD || 'b4FFS6kVGKV4jV',
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
  private async logChange(connection: any, data: {
    supplierCode: string;
    action: string;
    changes: Record<string, any>;
    userId?: number;
    userName?: string;
  }): Promise<void> {
    try {
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
    } catch (error) {
      console.error('[SupplierManagementService] Failed to insert log:', error);
      throw error;
    }
  }

  // 创建或更新供应商管理信息
  async createOrUpdateSupplierManagement(data: {
    supplierCode: string;
    minOrderAmount?: number;
    minOrderQuantity?: number;
    orderRemarks?: string;
    userId?: number;
    userName?: string;
  }): Promise<any> {
    const connection = await this.getXitongkaifaConnection();
    
    try {
      await this.ensureLogTableExists(connection);

      // 检查记录是否存在
      const existsQuery = `
        SELECT * 
        FROM supplier_management 
        WHERE supplier_code = ?
      `;
      const [existsResult]: any = await connection.execute(existsQuery, [data.supplierCode]);
      
      const action = existsResult.length > 0 ? 'update' : 'create';
      const changes: Record<string, any> = {};

      if (existsResult.length > 0) {
        // 记录变更
        const oldRecord = existsResult[0];
        const fieldMap: Record<string, string> = {
          minOrderAmount: 'min_order_amount',
          minOrderQuantity: 'min_order_quantity',
          orderRemarks: 'order_remarks',
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
          UPDATE supplier_management 
          SET 
            min_order_amount = ?,
            min_order_quantity = ?,
            order_remarks = ?
          WHERE supplier_code = ?
        `;
        await connection.execute(updateQuery, [
          data.minOrderAmount || null,
          data.minOrderQuantity || null,
          data.orderRemarks || null,
          data.supplierCode
        ]);
      } else {
        // 插入
        const insertQuery = `
          INSERT INTO supplier_management 
          (supplier_code, min_order_amount, min_order_quantity, order_remarks)
          VALUES (?, ?, ?, ?)
        `;
        await connection.execute(insertQuery, [
          data.supplierCode,
          data.minOrderAmount || null,
          data.minOrderQuantity || null,
          data.orderRemarks || null
        ]);
      }

      // 记录日志
      await this.logChange(connection, {
        supplierCode: data.supplierCode,
        action,
        changes,
        userId: data.userId,
        userName: data.userName,
      });

      return { success: true };
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
          console.error('[SupplierManagementService] Failed to query sys_users:', error);
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
      console.error('[SupplierManagementService] 获取变更日志失败:', error);
      return [];
    } finally {
      await connection.end();
    }
  }
}


