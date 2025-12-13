import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

export interface LabelDataItem {
  skuCode: string;
  spuCode?: string;
  productName?: string;
  spec?: string;
  productCode?: string; // 商品条码
  printBarcode?: string; // 打印条码
  labelRaw: Record<string, any>;
}

@Injectable()
export class LabelDataService {
  constructor(private prisma: PrismaService) { }

  private async getXitongkaifaConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD || 'b4FFS6kVGKV4jV',
      database: 'sm_xitongkaifa',
      port: parseInt(process.env.DB_PORT || '3306'),
    });
  }

  private async queryLabelRowsBySku(sku: string): Promise<any[] | null> {
    const candidates = ['SKU', 'SKU编码', 'sku'];
    for (const col of candidates) {
      try {
        const rows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM \`sm_shangping\`\.\`商品标签\` WHERE \`${col}\` = ? LIMIT 500`,
          sku,
        );
        if (rows && rows.length > 0) return rows;
      } catch (_) { }
    }
    return null;
  }

  private async queryAllLabelRows(limit: number): Promise<any[]> {
    // 安全兜底：读取前若干条，避免一次性全量
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM \`sm_shangping\`\.\`商品标签\` LIMIT ${Math.max(1, Math.min(limit, 2000))}`,
    );
    return rows || [];
  }

  private pick(row: any, keys: string[]): any {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(row, k)) return row[k];
    }
    return undefined;
  }

  async testDatabaseConnection(): Promise<any> {
    const connection = await this.getXitongkaifaConnection();

    try {
      const [rows]: any = await connection.execute('SELECT COUNT(*) as count FROM label_data_audit LIMIT 1');
      return { count: rows[0].count, message: 'Database connection successful' };
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    } finally {
      await connection.end();
    }
  }

  async getSuppliersBySku(sku: string): Promise<string[]> {
    if (!sku) return [];

    Logger.log('[LabelDataService] Getting suppliers for SKU:', sku);
    const connection = await this.getXitongkaifaConnection();

    try {
      // 查询该SKU的所有供应商
      const query = `
        SELECT DISTINCT supplier_name as supplierName
        FROM label_data_audit 
        WHERE sku = ?
        ORDER BY supplier_name
      `;

      const [rows]: any = await connection.execute(query, [sku]);
      Logger.log('[LabelDataService] Suppliers query result:', rows);

      const suppliers = rows.map((row: any) => row.supplierName).filter((s: string) => s);
      Logger.log('[LabelDataService] Found suppliers:', suppliers);

      return suppliers;
    } catch (error) {
      Logger.error('[LabelDataService] 查询供应商列表失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  async getBySkuAndSupplierName(sku: string, supplierName: string): Promise<Record<string, any> | null> {
    if (!sku || !supplierName) return null;

    Logger.log('[LabelDataService] Connecting to database...');
    const connection = await this.getXitongkaifaConnection();

    try {
      Logger.log('[LabelDataService] Executing query with params:', { sku, supplierName });

      // 从 sm_xitongkaifa.label_data_audit 表查询数据
      const query = `
        SELECT 
          sku,
          supplier_name as supplierName,
          header_info as headerInfo,
          execution_standard as executionStandard,
          product_name as productName,
          manufacturer_name as manufacturerName,
          address_info as addressInfo,
          material as material,
          other_info as otherInfo,
          created_at as createdAt,
          updated_at as updatedAt
        FROM label_data_audit 
        WHERE sku = ? AND supplier_name = ?
        LIMIT 1
      `;

      const [rows]: any = await connection.execute(query, [sku, supplierName]);
      Logger.log('[LabelDataService] Query result:', rows);

      if (rows && rows.length > 0) {
        const result = rows[0];
        // 添加从sm_shangping库获取的规格信息
        const productSpec = await this.getProductSpecBySku(result.sku);
        if (productSpec) {
          result.productSpec = productSpec;
        }
        Logger.log('[LabelDataService] Final result:', result);
        return result;
      }

      Logger.log('[LabelDataService] No data found');
      return null;
    } catch (error) {
      Logger.error('[LabelDataService] 查询标签资料失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  private async fetchProductBriefBySku(sku: string): Promise<{
    spuCode?: string;
    productName?: string;
    spec?: string;
    productCode?: string;
  } | undefined> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT \`SPU编码\` AS spuCode, \`商品名称\` AS productName, \`规格\` AS spec, \`商品条码\` AS productCode
         FROM \`sm_shangping\`.\`商品主档销售规格\`
         WHERE \`SKU编码\` = ?
         LIMIT 1`,
        sku,
      );
      if (rows && rows.length > 0) return rows[0];
    } catch (_) { }
    return undefined;
  }

  // 新增：通过SKU获取规格信息的专用方法
  private async getProductSpecBySku(sku: string): Promise<string | null> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT \`规格名称\` AS spec
         FROM \`sm_shangping\`.\`商品主档销售规格\`
         WHERE \`SKU编码\` = ?
         LIMIT 1`,
        sku,
      );
      if (rows && rows.length > 0) {
        return rows[0].spec || null;
      }
    } catch (error) {
      Logger.error('获取产品规格失败:', error);
    }
    return null;
  }

  async list(params: { sku?: string; q?: string; limit?: number }): Promise<LabelDataItem[]> {
    const { sku, q, limit = 500 } = params || {};

    let rows: any[] | null = null;
    if (sku) {
      rows = await this.queryLabelRowsBySku(sku);
    }
    if (!rows) {
      rows = await this.queryAllLabelRows(limit);
    }

    const kw = (q || '').trim();
    const result: LabelDataItem[] = [];
    for (const r of rows) {
      const skuCode = String(this.pick(r, ['SKU', 'SKU编码', 'sku']) || '');
      const brief = skuCode ? await this.fetchProductBriefBySku(skuCode) : undefined;

      // 关键词过滤（SPU编码/商品名称）
      if (kw) {
        const passSPU = String(brief?.spuCode || '').includes(kw);
        const passName = String(brief?.productName || '').includes(kw);
        const passSku = skuCode.includes(kw);
        if (!(passSPU || passName || passSku)) continue;
      }

      // 打印条码：商品条码首段
      let printBarcode: string | undefined;
      const pcRaw = brief?.productCode || undefined;
      if (pcRaw) {
        const idxComma = pcRaw.indexOf(',');
        const idxCComma = pcRaw.indexOf('，');
        const sepIdx = idxComma >= 0 ? idxComma : idxCComma;
        printBarcode = sepIdx >= 0 ? pcRaw.substring(0, sepIdx) : pcRaw;
        printBarcode = printBarcode.trim();
      }

      result.push({
        skuCode,
        spuCode: brief?.spuCode,
        productName: brief?.productName,
        spec: brief?.spec,
        productCode: brief?.productCode,
        printBarcode,
        labelRaw: r,
      });
    }

    // 按 SPU编码 排序
    result.sort((a, b) => String(a.spuCode || '').localeCompare(String(b.spuCode || '')));
    return result;
  }

  async getColumns(): Promise<{ name: string; type?: string }[]> {
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS type
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = 'sm_shangping' AND TABLE_NAME = '商品标签'
       ORDER BY ORDINAL_POSITION`
    );
    return rows || [];
  }

  private async getSkuColumnName(): Promise<string | undefined> {
    const cols = await this.getColumns();
    const candidates = ['SKU编码', 'SKU', 'sku'];
    for (const c of candidates) {
      if (cols.find(x => x.name === c)) return c;
    }
    return cols[0]?.name; // 兜底
  }

  private sanitizeValues(values: Record<string, any>, allow: string[]) {
    const out: Record<string, any> = {};
    for (const k of Object.keys(values || {})) {
      if (allow.includes(k)) out[k] = values[k];
    }
    return out;
  }

  async upsertBySku(input: { sku: string; values: Record<string, any> }) {
    const skuCol = await this.getSkuColumnName();
    if (!skuCol) throw new Error('未找到商品标签表结构');

    const cols = await this.getColumns();
    const allowCols = cols.map(c => c.name);
    const body = this.sanitizeValues(input.values || {}, allowCols);
    // 确保写入SKU列
    body[skuCol] = input.sku;

    // 复合主键：SKU + 供应商名称
    if (!('供应商名称' in body) || !body['供应商名称']) {
      throw new Error('供应商名称为必填');
    }

    // 是否存在
    const existsRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM \`sm_shangping\`\.\`商品标签\` WHERE \`${skuCol}\` = ? AND \`供应商名称\` = ? LIMIT 1`,
      input.sku,
      body['供应商名称'],
    );

    // 组装动态SQL
    const keys = Object.keys(body);
    const placeholders = keys.map(() => '?');
    const vals = keys.map(k => body[k]);

    if (existsRows && existsRows.length > 0) {
      const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
      const updateVals = keys.map(k => body[k]);
      await this.prisma.$executeRawUnsafe(
        `UPDATE \`sm_shangping\`\.\`商品标签\` SET ${setClause} WHERE \`${skuCol}\` = ? AND \`供应商名称\` = ?`,
        ...updateVals,
        input.sku,
        body['供应商名称'],
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO \`sm_shangping\`\.\`商品标签\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders.join(', ')})`,
        ...vals,
      );
    }

    // 写入审计日志（到 sm_xitongkaifa）
    try {
      await this.prisma.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`sm_xitongkaifa\``);
      await this.prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS \`sm_xitongkaifa\`\.\`label_data_audit\` (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            action VARCHAR(20),
            sku VARCHAR(128),
            payload JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO \`sm_xitongkaifa\`\.\`label_data_audit\` (action, sku, payload) VALUES ('upsert', ?, CAST(? AS JSON))`,
        input.sku,
        JSON.stringify(body)
      );
    } catch (_) { }

    return { success: true };
  }

  async deleteBySkuAndSupplier(input: { sku: string; supplier: string }) {
    const skuCol = await this.getSkuColumnName();
    if (!skuCol) throw new Error('未找到商品标签表结构');
    if (!input.supplier) throw new Error('供应商名称为必填');

    const res: any = await this.prisma.$executeRawUnsafe(
      `DELETE FROM \`sm_shangping\`\.\`商品标签\` WHERE \`${skuCol}\` = ? AND \`供应商名称\` = ?`,
      input.sku,
      input.supplier,
    );

    // 审计
    try {
      await this.prisma.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`sm_xitongkaifa\``);
      await this.prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS \`sm_xitongkaifa\`\.\`label_data_audit\` (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            action VARCHAR(20),
            sku VARCHAR(128),
            payload JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO \`sm_xitongkaifa\`\.\`label_data_audit\` (action, sku, payload) VALUES ('delete', ?, CAST(? AS JSON))`,
        input.sku,
        JSON.stringify({ supplier: input.supplier })
      );
    } catch (_) { }

    return { success: true };
  }

  // 新增方法：获取所有标签数据（从 sm_xitongkaifa.label_data_audit 表）
  async getAllLabelData(params: {
    limit: number;
    offset: number;
    sku?: string;
    supplierName?: string;
  }): Promise<{ data: any[]; total: number }> {
    const connection = await this.getXitongkaifaConnection();

    try {
      // 构建搜索条件
      let whereClause = '1=1';
      const queryParams: any[] = [];

      if (params.sku) {
        whereClause += ' AND sku LIKE ?';
        queryParams.push(`%${params.sku}%`);
      }

      if (params.supplierName) {
        whereClause += ' AND supplier_name LIKE ?';
        queryParams.push(`%${params.supplierName}%`);
      }

      // 获取总数
      const totalQuery = `SELECT COUNT(*) as count FROM label_data_audit WHERE ${whereClause}`;
      const [totalResult]: any = await connection.execute(totalQuery, queryParams);
      const total = totalResult[0].count;

      // 获取数据（不包含product_spec）
      const dataQuery = `
        SELECT 
          sku,
          supplier_name as supplierName,
          header_info as headerInfo,
          execution_standard as executionStandard,
          product_name as productName,
          manufacturer_name as manufacturerName,
          address_info as addressInfo,
          material as material,
          other_info as otherInfo,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updatedAt
        FROM label_data_audit 
        WHERE ${whereClause}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `;

      const [data]: any = await connection.execute(
        dataQuery,
        [...queryParams, params.limit, params.offset]
      );

      // 为每条记录添加从sm_shangping库获取的规格信息
      const enrichedData = await Promise.all(
        (data || []).map(async (item: any) => {
          const productSpec = await this.getProductSpecBySku(item.sku);
          return {
            ...item,
            productSpec: productSpec || '未找到规格信息'
          };
        })
      );

      return {
        data: enrichedData,
        total,
      };
    } finally {
      await connection.end();
    }
  }

  // 新增方法：获取统计信息
  async getStatistics(): Promise<{
    totalRecords: number;
    totalSuppliers: number;
    totalSkus: number;
  }> {
    const connection = await this.getXitongkaifaConnection();

    try {
      // 总记录数
      const totalQuery = `SELECT COUNT(*) as count FROM label_data_audit`;
      const [totalResult]: any = await connection.execute(totalQuery);

      // 供应商数量
      const supplierQuery = `SELECT COUNT(DISTINCT supplier_name) as count FROM label_data_audit WHERE supplier_name IS NOT NULL`;
      const [supplierResult]: any = await connection.execute(supplierQuery);

      // SKU数量
      const skuQuery = `SELECT COUNT(DISTINCT sku) as count FROM label_data_audit WHERE sku IS NOT NULL`;
      const [skuResult]: any = await connection.execute(skuQuery);

      return {
        totalRecords: totalResult[0].count,
        totalSuppliers: supplierResult[0].count,
        totalSkus: skuResult[0].count,
      };
    } finally {
      await connection.end();
    }
  }

  // 新增方法：获取供应商列表
  async getSuppliers(): Promise<string[]> {
    const connection = await this.getXitongkaifaConnection();

    try {
      const query = `
        SELECT DISTINCT supplier_name as supplierName 
        FROM label_data_audit 
        WHERE supplier_name IS NOT NULL AND supplier_name != ''
        ORDER BY supplier_name
      `;

      const [result]: any = await connection.execute(query);
      return result.map((row: any) => row.supplierName);
    } finally {
      await connection.end();
    }
  }

  // 新增方法：创建或更新标签数据
  async createOrUpdateLabelData(data: {
    sku: string;
    supplierName: string;
    productName?: string;
    headerInfo?: string;
    executionStandard?: string;
    manufacturerName?: string;
    addressInfo?: string;
    material?: string;
    otherInfo?: string;
    userId?: number;
    userName?: string;
  }): Promise<any> {
    const connection = await this.getXitongkaifaConnection();

    try {
      // 确保日志表存在
      await this.ensureLabelDataLogTableExists(connection);

      // 检查记录是否存在
      const existsQuery = `
        SELECT * 
        FROM label_data_audit 
        WHERE sku = ? AND supplier_name = ?
      `;
      const [existsResult]: any = await connection.execute(existsQuery, [data.sku, data.supplierName]);

      const action = existsResult[0]?.count > 0 ? 'update' : 'create';
      const changes: Record<string, any> = {};

      if (existsResult.length > 0) {
        // 记录变更
        const oldRecord = existsResult[0];
        const fieldMap: Record<string, string> = {
          productName: 'product_name',
          headerInfo: 'header_info',
          executionStandard: 'execution_standard',
          manufacturerName: 'manufacturer_name',
          addressInfo: 'address_info',
          material: 'material',
          otherInfo: 'other_info',
        };

        for (const [key, dbField] of Object.entries(fieldMap)) {
          const oldValue = oldRecord[dbField];
          const newValue = data[key as keyof typeof data] || null;
          if (oldValue !== newValue) {
            changes[key] = { old: oldValue, new: newValue };
          }
        }

        // 更新
        const updateQuery = `
          UPDATE label_data_audit 
          SET 
            product_name = ?,
            header_info = ?,
            execution_standard = ?,
            manufacturer_name = ?,
            address_info = ?,
            material = ?,
            other_info = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE sku = ? AND supplier_name = ?
        `;
        await connection.execute(updateQuery, [
          data.productName || null,
          data.headerInfo || null,
          data.executionStandard || null,
          data.manufacturerName || null,
          data.addressInfo || null,
          data.material || null,
          data.otherInfo || null,
          data.sku,
          data.supplierName
        ]);
      } else {
        // 插入
        const insertQuery = `
          INSERT INTO label_data_audit 
          (sku, supplier_name, product_name, header_info, execution_standard, 
           manufacturer_name, address_info, material, other_info, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        await connection.execute(insertQuery, [
          data.sku,
          data.supplierName,
          data.productName || null,
          data.headerInfo || null,
          data.executionStandard || null,
          data.manufacturerName || null,
          data.addressInfo || null,
          data.material || null,
          data.otherInfo || null
        ]);
      }

      // 记录日志
      Logger.log('[LabelDataService] Recording change log:', {
        sku: data.sku,
        supplierName: data.supplierName,
        action,
        changeCount: Object.keys(changes).length,
        changes
      });

      await this.logLabelDataChange(connection, {
        sku: data.sku,
        supplierName: data.supplierName,
        action,
        changes,
        userId: data.userId,
        userName: data.userName,
      });

      Logger.log('[LabelDataService] Change log recorded successfully');

      return { success: true };
    } finally {
      await connection.end();
    }
  }

  // 新增方法：删除标签数据
  async deleteLabelData(sku: string, supplierName: string): Promise<any> {
    const connection = await this.getXitongkaifaConnection();

    try {
      const deleteQuery = `
        DELETE FROM label_data_audit 
        WHERE sku = ? AND supplier_name = ?
      `;

      await connection.execute(deleteQuery, [sku, supplierName]);
      return { success: true };
    } finally {
      await connection.end();
    }
  }

  // 根据SKU和供应商名称获取审核数据
  async getAuditDataBySkuAndSupplier(sku: string, supplierName: string): Promise<any> {
    const connection = await this.getXitongkaifaConnection();

    try {
      const query = `
        SELECT 
          sku,
          supplier_name,
          header_info,
          execution_standard,
          product_name,
          manufacturer_name,
          address_info,
          material,
          other_info
        FROM label_data_audit 
        WHERE sku = ? AND supplier_name = ?
        LIMIT 1
      `;

      const [rows]: any = await connection.execute(query, [sku, supplierName]);

      if (rows && rows.length > 0) {
        return rows[0];
      }

      return null;
    } catch (error) {
      Logger.error('[LabelDataService] 获取审核数据失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 确保日志表存在
  private async ensureLabelDataLogTableExists(connection: any): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS label_data_change_log (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        sku VARCHAR(128) NOT NULL,
        supplier_name VARCHAR(128) NOT NULL,
        action VARCHAR(20) NOT NULL COMMENT 'create, update, delete',
        changes JSON COMMENT '变更内容',
        user_id INT COMMENT '操作用户ID',
        user_name VARCHAR(128) COMMENT '操作用户名称',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sku_supplier (sku, supplier_name),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签资料变更日志表'
    `;

    await connection.execute(createTableQuery);
  }

  // 记录标签数据变更日志
  private async logLabelDataChange(connection: any, data: {
    sku: string;
    supplierName: string;
    action: string;
    changes: Record<string, any>;
    userId?: number;
    userName?: string;
  }): Promise<void> {
    try {
      const insertLogQuery = `
        INSERT INTO label_data_change_log 
        (sku, supplier_name, action, changes, user_id, user_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const changesJson = JSON.stringify(data.changes);
      Logger.log('[LabelDataService] Inserting log:', {
        sku: data.sku,
        supplierName: data.supplierName,
        action: data.action,
        changesJson,
        userId: data.userId || null,
        userName: data.userName || null,
      });

      await connection.execute(insertLogQuery, [
        data.sku,
        data.supplierName,
        data.action,
        changesJson,
        data.userId || null,
        data.userName || null,
      ]);

      Logger.log('[LabelDataService] Log inserted successfully');

      // 删除超过30条的旧记录
      const deleteOldLogsQuery = `
        DELETE FROM label_data_change_log
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id 
            FROM label_data_change_log 
            WHERE sku = ? AND supplier_name = ?
            ORDER BY created_at DESC 
            LIMIT 30
          ) AS recent_logs
        )
        AND sku = ? AND supplier_name = ?
      `;

      await connection.execute(deleteOldLogsQuery, [
        data.sku,
        data.supplierName,
        data.sku,
        data.supplierName,
      ]);

      Logger.log('[LabelDataService] Old logs cleaned up (keeping max 30 records)');
    } catch (error) {
      Logger.error('[LabelDataService] Failed to insert log:', error);
      throw error;
    }
  }

  // 获取标签数据变更日志
  async getLabelDataLogs(sku: string, supplierName: string): Promise<any[]> {
    const connection = await this.getXitongkaifaConnection();

    try {
      // 确保日志表存在
      await this.ensureLabelDataLogTableExists(connection);

      Logger.log('[LabelDataService] Querying logs for SKU:', sku, 'Supplier:', supplierName || '(all)');

      // 如果参数为空，直接返回空数组
      if (!sku) {
        Logger.log('[LabelDataService] Missing SKU parameter');
        return [];
      }

      // 如果没有提供supplierName，查询该SKU的所有记录
      let query: string;
      let queryParams: any[];

      if (!supplierName) {
        Logger.log('[LabelDataService] No supplier name provided, querying all logs for SKU');
        query = `
          SELECT 
            id,
            sku,
            supplier_name as supplierName,
            action,
            changes,
            user_id as userId,
            user_name as userName,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt
          FROM label_data_change_log 
          WHERE sku = ?
          ORDER BY created_at DESC
          LIMIT 100
        `;
        queryParams = [sku];
      } else {
        query = `
          SELECT 
            id,
            sku,
            supplier_name as supplierName,
            action,
            changes,
            user_id as userId,
            user_name as userName,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt
          FROM label_data_change_log 
          WHERE sku = ? AND supplier_name = ?
          ORDER BY created_at DESC
          LIMIT 100
        `;
        queryParams = [sku, supplierName];
      }

      Logger.log('[LabelDataService] Executing query with values:', queryParams);
      Logger.log('[LabelDataService] Full query:', query.replace(/\s+/g, ' ').trim());

      const [rows]: any = await connection.execute(query, queryParams);

      Logger.log('[LabelDataService] Log query result:', rows.length, 'records');

      // 如果没有结果，尝试查询该SKU的所有记录看看实际数据
      if (rows.length === 0 && sku) {
        const [allRows]: any = await connection.execute(
          'SELECT supplier_name, COUNT(*) as count FROM label_data_change_log WHERE sku = ? GROUP BY supplier_name',
          [sku]
        );
        Logger.log('[LabelDataService] Available suppliers for this SKU:', allRows);
      }

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
          Logger.error('[LabelDataService] Failed to query sys_users:', error);
        }
      }

      return (rows || []).map((row: any) => ({
        ...row,
        // MySQL会自动将JSON列解析为对象，如果已经是对象就不需要再parse
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
      Logger.error('[LabelDataService] 获取变更日志失败:', error);
      return [];
    } finally {
      await connection.end();
    }
  }

  // 调试方法：获取某个SKU的所有日志（不过滤supplier）
  async getLogsDebug(sku: string): Promise<any[]> {
    const connection = await this.getXitongkaifaConnection();

    try {
      await this.ensureLabelDataLogTableExists(connection);

      const query = `
        SELECT 
          id,
          sku,
          supplier_name,
          LENGTH(supplier_name) as supplier_name_length,
          HEX(supplier_name) as supplier_name_hex,
          action,
          user_id,
          user_name,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt
        FROM label_data_change_log 
        WHERE sku = ?
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const [rows]: any = await connection.execute(query, [sku]);
      Logger.log('[LabelDataService] Debug query for SKU', sku, ':', rows.length, 'records');

      return rows || [];
    } catch (error) {
      Logger.error('[LabelDataService] Debug query failed:', error);
      return [];
    } finally {
      await connection.end();
    }
  }
}


