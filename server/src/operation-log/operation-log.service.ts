import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';

export interface OperationLogData {
  userId?: number;
  displayName?: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  targetDatabase: string;
  targetTable: string;
  recordIdentifier: Record<string, any>;
  changes?: Record<string, { old?: any; new?: any }>;
  operationDetails?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class OperationLogService {
  /**
   * 获取 sm_xitongkaifa 数据库连接
   */
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

  /**
   * 根据用户ID获取用户display_name
   */
  private async getUserDisplayName(connection: any, userId: number): Promise<string | null> {
    try {
      const [rows]: any = await connection.execute(
        'SELECT display_name FROM sys_users WHERE id = ? LIMIT 1',
        [userId]
      );
      return rows && rows.length > 0 ? rows[0].display_name : null;
    } catch (error) {
      Logger.error('[OperationLogService] Failed to get user display_name:', (error as Error)?.message || '未知错误');
      return null;
    }
  }

  /**
   * 记录操作日志
   * @param data 操作日志数据
   */
  async logOperation(data: OperationLogData): Promise<void> {
    const connection = await this.getXitongkaifaConnection();

    try {
      // 如果提供了userId但没有displayName，尝试从数据库获取
      let displayName = data.displayName;
      if (data.userId && !displayName) {
        displayName = await this.getUserDisplayName(connection, data.userId) || null;
      }

      const insertLogQuery = `
        INSERT INTO operation_log 
        (user_id, display_name, operation_type, target_database, target_table, 
         record_identifier, changes, operation_details, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const recordIdentifierJson = JSON.stringify(data.recordIdentifier);
      const changesJson = data.changes ? JSON.stringify(data.changes) : null;
      const operationDetailsJson = data.operationDetails ? JSON.stringify(data.operationDetails) : null;

      await connection.execute(insertLogQuery, [
        data.userId || null,
        displayName || null,
        data.operationType,
        data.targetDatabase,
        data.targetTable,
        recordIdentifierJson,
        changesJson,
        operationDetailsJson,
        data.ipAddress || null,
        data.userAgent || null,
      ]);

      Logger.log('[OperationLogService] Operation log inserted successfully', {
        operationType: data.operationType,
        targetDatabase: data.targetDatabase,
        targetTable: data.targetTable,
        userId: data.userId || null,
        displayName: displayName || null,
      });
    } catch (error) {
      // 不记录完整的错误对象，避免暴露敏感信息
      Logger.error('[OperationLogService] Failed to insert operation log:', (error as Error)?.message || '未知错误');
      // 记录日志失败不应该影响主业务流程，只记录错误但不抛出异常
    } finally {
      await connection.end();
    }
  }

  /**
   * 批量记录操作日志
   * @param logs 操作日志数据数组
   */
  async logOperations(logs: OperationLogData[]): Promise<void> {
    if (!logs || logs.length === 0) {
      return;
    }

    const connection = await this.getXitongkaifaConnection();

    try {
      // 如果有userId但没有displayName，批量获取displayName
      const userIds = [...new Set(logs.filter(log => log.userId && !log.displayName).map(log => log.userId!))];
      const displayNameMap: Record<number, string | null> = {};

      if (userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(',');
        const [rows]: any = await connection.execute(
          `SELECT id, display_name FROM sys_users WHERE id IN (${placeholders})`,
          userIds
        );
        rows.forEach((row: any) => {
          displayNameMap[row.id] = row.display_name || null;
        });
      }

      // 批量插入日志
      const insertLogQuery = `
        INSERT INTO operation_log 
        (user_id, display_name, operation_type, target_database, target_table, 
         record_identifier, changes, operation_details, ip_address, user_agent, created_at)
        VALUES ?
      `;

      const values = logs.map(log => {
        const displayName = log.displayName || (log.userId ? displayNameMap[log.userId] || null : null);
        return [
          log.userId || null,
          displayName || null,
          log.operationType,
          log.targetDatabase,
          log.targetTable,
          JSON.stringify(log.recordIdentifier),
          log.changes ? JSON.stringify(log.changes) : null,
          log.operationDetails ? JSON.stringify(log.operationDetails) : null,
          log.ipAddress || null,
          log.userAgent || null,
        ];
      });

      await connection.query(insertLogQuery, [values]);

      Logger.log('[OperationLogService] Batch operation logs inserted successfully', {
        count: logs.length,
      });
    } catch (error) {
      Logger.error('[OperationLogService] Failed to insert batch operation logs:', (error as Error)?.message || '未知错误');
      // 记录日志失败不应该影响主业务流程
    } finally {
      await connection.end();
    }
  }

  /**
   * 查询操作日志
   * @param filters 查询过滤条件
   * @param limit 限制返回数量，默认100
   * @param offset 偏移量，默认0
   */
  async getOperationLogs(filters: {
    userId?: number;
    displayName?: string;
    operationType?: 'CREATE' | 'UPDATE' | 'DELETE';
    targetDatabase?: string;
    targetTable?: string;
  } = {}, limit: number = 100, offset: number = 0): Promise<any[]> {
    const connection = await this.getXitongkaifaConnection();

    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filters.userId !== undefined) {
        conditions.push('user_id = ?');
        params.push(filters.userId);
      }
      if (filters.displayName) {
        conditions.push('display_name = ?');
        params.push(filters.displayName);
      }
      if (filters.operationType) {
        conditions.push('operation_type = ?');
        params.push(filters.operationType);
      }
      if (filters.targetDatabase) {
        conditions.push('target_database = ?');
        params.push(filters.targetDatabase);
      }
      if (filters.targetTable) {
        conditions.push('target_table = ?');
        params.push(filters.targetTable);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          id,
          user_id as userId,
          display_name as displayName,
          operation_type as operationType,
          target_database as targetDatabase,
          target_table as targetTable,
          record_identifier as recordIdentifier,
          changes,
          operation_details as operationDetails,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt
        FROM operation_log
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);
      const [rows]: any = await connection.execute(query, params);

      // 处理JSON字段（MySQL的JSON字段会被自动解析为JavaScript对象）
      return rows.map((row: any) => ({
        ...row,
        recordIdentifier: typeof row.recordIdentifier === 'string' 
          ? JSON.parse(row.recordIdentifier) 
          : row.recordIdentifier || {},
        changes: typeof row.changes === 'string' 
          ? JSON.parse(row.changes) 
          : row.changes || null,
        operationDetails: typeof row.operationDetails === 'string'
          ? JSON.parse(row.operationDetails)
          : row.operationDetails || null,
      }));
    } catch (error) {
      Logger.error('[OperationLogService] Failed to get operation logs:', (error as Error)?.message || '未知错误');
      throw error;
    } finally {
      await connection.end();
    }
  }

  /**
   * 根据记录标识查询操作日志
   * @param targetDatabase 目标数据库
   * @param targetTable 目标表
   * @param recordIdentifier 记录标识
   * @param limit 限制返回数量，默认100
   */
  async getOperationLogsByRecord(
    targetDatabase: string,
    targetTable: string,
    recordIdentifier: Record<string, any>,
    limit: number = 100
  ): Promise<any[]> {
    const connection = await this.getXitongkaifaConnection();

    try {
      // 使用JSON_CONTAINS查询匹配的记录标识
      const query = `
        SELECT 
          id,
          user_id as userId,
          display_name as displayName,
          operation_type as operationType,
          target_database as targetDatabase,
          target_table as targetTable,
          record_identifier as recordIdentifier,
          changes,
          operation_details as operationDetails,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt
        FROM operation_log
        WHERE target_database = ? 
          AND target_table = ?
          AND JSON_CONTAINS(record_identifier, ?)
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const recordIdentifierJson = JSON.stringify(recordIdentifier);
      const [rows]: any = await connection.execute(query, [
        targetDatabase,
        targetTable,
        recordIdentifierJson,
        limit,
      ]);

      // 处理JSON字段
      return rows.map((row: any) => ({
        ...row,
        recordIdentifier: typeof row.recordIdentifier === 'string' 
          ? JSON.parse(row.recordIdentifier) 
          : row.recordIdentifier || {},
        changes: typeof row.changes === 'string' 
          ? JSON.parse(row.changes) 
          : row.changes || null,
        operationDetails: typeof row.operationDetails === 'string'
          ? JSON.parse(row.operationDetails)
          : row.operationDetails || null,
      }));
    } catch (error) {
      Logger.error('[OperationLogService] Failed to get operation logs by record:', (error as Error)?.message || '未知错误');
      throw error;
    } finally {
      await connection.end();
    }
  }
}
