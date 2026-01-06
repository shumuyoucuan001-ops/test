import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';

export interface SupplierQuotation {
  序号?: number;
  供应商编码?: string;
  供应商名称?: string;
  商品名称?: string;
  商品规格?: string;
  最小销售单位?: string;
  商品型号?: string;
  供应商商品编码?: string;
  最小销售规格UPC商品条码?: string;
  中包或整件销售规格条码?: string;
  供货价格?: number;
  供应商商品备注?: string;
}

export interface InventorySummary {
  SKU?: string;
  商品名称?: string;
  规格?: string;
  覆盖门店数?: number;
  总部零售价?: number;
  最近采购价?: number;
  最低采购价?: number;
  成本单价?: number;
  UPC?: string;
  SKU商品标签?: string;
}

export interface SupplierSkuBinding {
  供应商编码?: string;
  供应商商品编码?: string;
  SKU?: string;
}

@Injectable()
export class SupplierQuotationService {
  private async getConnection() {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD,
      database: 'sm_gongyingshang',
      port: parseInt(process.env.DB_PORT || '3306'),
    });
  }

  private async getKucunConnection() {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD,
      database: 'sm_kucun',
      port: parseInt(process.env.DB_PORT || '3306'),
    });
  }

  // 获取所有供应商编码列表（去重）
  async getAllSupplierCodes(): Promise<string[]> {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT DISTINCT \`供应商编码\`
        FROM \`供应商报价\`
        WHERE \`供应商编码\` IS NOT NULL AND \`供应商编码\` != ''
        ORDER BY \`供应商编码\` ASC
      `;

      const [data]: any = await connection.execute(query);
      return (data || []).map((row: any) => row['供应商编码']).filter(Boolean);
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询供应商编码列表失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 获取供应商报价列表
  async getSupplierQuotations(
    page: number = 1,
    limit: number = 20,
    search?: string,
    supplierCodes?: string[],
  ): Promise<{ data: SupplierQuotation[]; total: number }> {
    const connection = await this.getConnection();

    try {
      const offset = (page - 1) * limit;

      // 构建搜索条件
      let whereClause = '1=1';
      const queryParams: any[] = [];

      // 如果指定了供应商编码列表，使用IN查询
      if (supplierCodes && supplierCodes.length > 0) {
        const placeholders = supplierCodes.map(() => '?').join(',');
        whereClause += ` AND q.\`供应商编码\` IN (${placeholders})`;
        queryParams.push(...supplierCodes);
      }

      if (search) {
        whereClause += ' AND (q.供应商编码 LIKE ? OR q.商品名称 LIKE ? OR q.商品规格 LIKE ? OR q.供应商商品编码 LIKE ?)';
        queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      // 获取总数
      const totalQuery = `
        SELECT COUNT(*) as count 
        FROM \`供应商报价\` q
        ${supplierCodes && supplierCodes.length > 0 ? 'LEFT JOIN `供应商属性信息` s ON q.`供应商编码` = s.`供应商编码`' : ''}
        WHERE ${whereClause}
      `;
      const [totalResult]: any = await connection.execute(totalQuery, queryParams);
      const total = totalResult[0].count;

      // 获取数据，JOIN供应商属性信息表获取供应商名称
      const dataQuery = `
        SELECT 
          q.序号,
          q.供应商编码,
          COALESCE(s.\`供应商名称\`, '') as \`供应商名称\`,
          q.商品名称,
          q.商品规格,
          q.最小销售单位,
          q.商品型号,
          q.供应商商品编码,
          q.最小销售规格UPC商品条码,
          q.中包或整件销售规格条码,
          q.供货价格,
          q.供应商商品备注
        FROM \`供应商报价\` q
        LEFT JOIN \`供应商属性信息\` s ON q.\`供应商编码\` = s.\`供应商编码\`
        WHERE ${whereClause}
        ORDER BY q.\`供应商编码\` ASC, q.序号 ASC
        LIMIT ? OFFSET ?
      `;

      const [data]: any = await connection.execute(
        dataQuery,
        [...queryParams, limit, offset]
      );

      return {
        data: data || [],
        total,
      };
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询供应商报价失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 获取仓库优先级列表（门店/仓名称）
  async getWarehousePriorities(): Promise<string[]> {
    // 需要连接到 sm_chaigou 数据库
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD,
      database: 'sm_chaigou',
      port: parseInt(process.env.DB_PORT || '3306'),
    });

    try {
      const query = `
        SELECT DISTINCT \`门店/仓名称\`
        FROM \`仓库优先级\`
        WHERE \`门店/仓名称\` IS NOT NULL AND \`门店/仓名称\` != ''
        ORDER BY \`门店/仓名称\` ASC
      `;

      const [data]: any = await connection.execute(query);
      return (data || []).map((row: any) => row['门店/仓名称']).filter(Boolean);
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询仓库优先级失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 获取库存汇总数据（根据类型：全部、仓店、城市）
  async getInventorySummary(
    type: '全部' | '仓店' | '城市',
    upc?: string,
    storeNames?: string[],
  ): Promise<InventorySummary[]> {
    const connection = await this.getKucunConnection();

    try {
      let tableName = '';
      switch (type) {
        case '全部':
          tableName = '库存汇总(全部)';
          break;
        case '仓店':
          tableName = '库存汇总(仓店)';
          break;
        case '城市':
          tableName = '库存汇总(城市)';
          break;
        default:
          tableName = '库存汇总(全部)';
      }

      let whereClause = '1=1';
      const queryParams: any[] = [];

      if (upc) {
        whereClause += ' AND UPC LIKE ?';
        queryParams.push(`%${upc}%`);
      }

      // 仓店类型时，支持按门店/仓库名称筛选
      if (type === '仓店' && storeNames && storeNames.length > 0) {
        const placeholders = storeNames.map(() => '?').join(',');
        whereClause += ` AND \`门店/仓库名称\` IN (${placeholders})`;
        queryParams.push(...storeNames);
      }

      // 根据类型选择查询字段
      let selectFields = '';
      if (type === '全部') {
        // 全部：查询最低采购价和成本单价
        selectFields = `
          SKU,
          商品名称,
          规格,
          覆盖门店数,
          总部零售价,
          最近采购价,
          最低采购价,
          成本单价,
          UPC,
          SKU商品标签
        `;
      } else {
        // 仓店/城市：只查询成本单价（没有最低采购价字段）
        selectFields = `
          SKU,
          商品名称,
          规格,
          覆盖门店数,
          总部零售价,
          最近采购价,
          成本单价,
          UPC,
          SKU商品标签
        `;
      }

      const query = `
        SELECT 
          ${selectFields}
        FROM \`${tableName}\`
        WHERE ${whereClause}
        ORDER BY SKU ASC
      `;

      const [data]: any = await connection.execute(query, queryParams);

      return data || [];
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询库存汇总失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 根据供应商编码和供应商商品编码获取SKU绑定信息
  async getSkuBindings(
    supplierCode: string,
    supplierProductCode: string,
  ): Promise<SupplierSkuBinding[]> {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT 
          供应商编码,
          供应商商品编码,
          SKU
        FROM \`供应商编码手动绑定sku\`
        WHERE 供应商编码 = ? AND 供应商商品编码 = ?
      `;

      const [data]: any = await connection.execute(query, [supplierCode, supplierProductCode]);

      return data || [];
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询SKU绑定失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 更新SKU绑定信息
  async updateSkuBinding(
    supplierCode: string,
    supplierProductCode: string,
    sku: string,
  ): Promise<boolean> {
    const connection = await this.getConnection();

    try {
      // 先检查是否存在
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM \`供应商编码手动绑定sku\`
        WHERE 供应商编码 = ? AND 供应商商品编码 = ?
      `;
      const [checkResult]: any = await connection.execute(checkQuery, [supplierCode, supplierProductCode]);
      const exists = checkResult[0].count > 0;

      if (exists) {
        // 更新
        const updateQuery = `
          UPDATE \`供应商编码手动绑定sku\`
          SET SKU = ?
          WHERE 供应商编码 = ? AND 供应商商品编码 = ?
        `;
        await connection.execute(updateQuery, [sku, supplierCode, supplierProductCode]);
      } else {
        // 插入
        const insertQuery = `
          INSERT INTO \`供应商编码手动绑定sku\` (供应商编码, 供应商商品编码, SKU)
          VALUES (?, ?, ?)
        `;
        await connection.execute(insertQuery, [supplierCode, supplierProductCode, sku]);
      }

      return true;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 更新SKU绑定失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }
}

