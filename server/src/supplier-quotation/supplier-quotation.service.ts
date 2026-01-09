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
  计算后供货价格?: number;
  供应商商品备注?: string;
  数据更新时间?: string | Date;
}

export interface InventorySummary {
  SKU?: string;
  商品名称?: string;
  规格?: string;
  总部零售价?: number;
  最近采购价?: number;
  最低采购价?: number;
  成本单价?: number;
  UPC?: string;
  SKU商品标签?: string;
  '门店/仓库名称'?: string; // 仓店维度专用
  城市?: string; // 城市维度专用
}

export interface SupplierSkuBinding {
  供应商编码?: string;
  供应商商品编码?: string;
  SKU?: string;
  数据更新时间?: string | Date;
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

  private async getShangpingConnection() {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD,
      database: 'sm_shangping',
      port: parseInt(process.env.DB_PORT || '3306'),
    });
  }

  private async getChaigouConnection() {
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
          q.计算后供货价格,
          q.供应商商品备注,
          q.数据更新时间
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

  // 获取城市列表（从仓库优先级表的所属城市字段去重）
  async getCities(): Promise<string[]> {
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
        SELECT DISTINCT \`所属城市\`
        FROM \`仓库优先级\`
        WHERE \`所属城市\` IS NOT NULL AND \`所属城市\` != ''
        ORDER BY \`所属城市\` ASC
      `;

      const [data]: any = await connection.execute(query);
      return (data || []).map((row: any) => row['所属城市']).filter(Boolean);
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询城市列表失败:', error);
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

      // 仓店类型时，支持按门店/仓库名称筛选（单选）
      if (type === '仓店' && storeNames && storeNames.length > 0) {
        // 单选，只取第一个，并去除首尾空格
        const storeName = (storeNames[0] || '').trim();
        if (storeName) {
          whereClause += ` AND \`门店/仓库名称\` = ?`;
          queryParams.push(storeName);
        }
      }

      // 城市类型时，支持按城市筛选（单选）
      if (type === '城市' && storeNames && storeNames.length > 0) {
        // 复用storeNames参数，实际是城市名称（单选），并去除首尾空格
        const cityName = (storeNames[0] || '').trim();
        if (cityName) {
          whereClause += ` AND 城市 = ?`;
          queryParams.push(cityName);
        }
      }

      // 根据类型选择查询字段
      let selectFields = '';
      if (type === '全部') {
        // 全部：查询最低采购价和成本单价
        selectFields = `
          SKU,
          商品名称,
          规格,
          总部零售价,
          最近采购价,
          最低采购价,
          成本单价,
          UPC,
          SKU商品标签
        `;
      } else if (type === '仓店') {
        // 仓店：查询门店/仓库名称字段
        selectFields = `
          SKU,
          商品名称,
          规格,
          总部零售价,
          最近采购价,
          成本单价,
          UPC,
          SKU商品标签,
          \`门店/仓库名称\`
        `;
      } else {
        // 城市：查询城市字段
        selectFields = `
          SKU,
          商品名称,
          规格,
          总部零售价,
          最近采购价,
          成本单价,
          UPC,
          SKU商品标签,
          城市
        `;
      }

      const query = `
        SELECT 
          ${selectFields}
        FROM \`${tableName}\`
        WHERE ${whereClause}
        ORDER BY SKU ASC
      `;

      Logger.log(`[SupplierQuotationService] 执行查询: type=${type}, tableName=${tableName}`);
      Logger.log(`[SupplierQuotationService] 查询SQL: ${query}`);
      Logger.log(`[SupplierQuotationService] 查询参数:`, JSON.stringify(queryParams));

      const [data]: any = await connection.execute(query, queryParams);

      Logger.log(`[SupplierQuotationService] 查询结果数量: ${(data || []).length}`);
      return data || [];
    } catch (error: any) {
      Logger.error('[SupplierQuotationService] 查询库存汇总失败:', error);
      Logger.error('[SupplierQuotationService] 错误详情:', {
        message: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
        sqlState: error?.sqlState,
      });
      throw new Error(`查询库存汇总失败: ${error?.message || '未知错误'}`);
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
          SKU,
          数据更新时间
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

  // 根据供应商编码和UPC条码查询报价比例
  async getPriceRatios(
    supplierCode: string,
    upcCode: string,
  ): Promise<{ 报价比例_供应商商品?: number; 报价比例_牵牛花商品?: number } | null> {
    const connection = await this.getConnection();

    try {
      // 先通过UPC条码找到对应的供应商商品编码
      // 查询供应商报价表，找到匹配的供应商商品编码
      const quotationQuery = `
        SELECT 供应商商品编码
        FROM \`供应商报价\`
        WHERE 供应商编码 = ? AND 最小销售规格UPC商品条码 = ?
        LIMIT 1
      `;
      const [quotationData]: any = await connection.execute(quotationQuery, [supplierCode, upcCode]);

      if (!quotationData || quotationData.length === 0) {
        return null;
      }

      const supplierProductCode = quotationData[0]['供应商商品编码'];

      // 查询报价比例
      const query = `
        SELECT 
          报价比例_供应商商品,
          报价比例_牵牛花商品
        FROM \`供应商编码手动绑定sku\`
        WHERE 供应商编码 = ? AND 供应商商品编码 = ?
        LIMIT 1
      `;

      const [data]: any = await connection.execute(query, [supplierCode, supplierProductCode]);

      if (!data || data.length === 0) {
        return null;
      }

      return {
        报价比例_供应商商品: data[0]['报价比例_供应商商品'] || null,
        报价比例_牵牛花商品: data[0]['报价比例_牵牛花商品'] || null,
      };
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询报价比例失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 保存或更新报价比例
  async updatePriceRatios(
    supplierCode: string,
    upcCode: string,
    supplierRatio: number,
    qianniuhuaRatio: number,
  ): Promise<boolean> {
    const connection = await this.getConnection();

    try {
      // 先通过UPC条码找到对应的供应商商品编码
      const quotationQuery = `
        SELECT 供应商商品编码
        FROM \`供应商报价\`
        WHERE 供应商编码 = ? AND 最小销售规格UPC商品条码 = ?
        LIMIT 1
      `;
      const [quotationData]: any = await connection.execute(quotationQuery, [supplierCode, upcCode]);

      if (!quotationData || quotationData.length === 0) {
        throw new Error('未找到对应的供应商报价记录');
      }

      const supplierProductCode = quotationData[0]['供应商商品编码'];

      // 获取原始供货价格
      const priceQuery = `
        SELECT 供货价格
        FROM \`供应商报价\`
        WHERE 供应商编码 = ? AND 最小销售规格UPC商品条码 = ?
        LIMIT 1
      `;
      const [priceData]: any = await connection.execute(priceQuery, [supplierCode, upcCode]);
      const originalPrice = priceData && priceData.length > 0 ? priceData[0]['供货价格'] : null;

      // 计算计算后供货价格：原供货价格 / 报价比例_供应商商品 * 报价比例_牵牛花商品
      let calculatedPrice: number | null = null;
      if (originalPrice !== null && originalPrice !== undefined && supplierRatio !== 0) {
        calculatedPrice = (originalPrice / supplierRatio) * qianniuhuaRatio;
      }

      // 检查是否存在
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM \`供应商编码手动绑定sku\`
        WHERE 供应商编码 = ? AND 供应商商品编码 = ?
      `;
      const [checkResult]: any = await connection.execute(checkQuery, [supplierCode, supplierProductCode]);
      const exists = checkResult[0].count > 0;

      if (exists) {
        // 更新（不更新SKU字段）
        const updateQuery = `
          UPDATE \`供应商编码手动绑定sku\`
          SET 报价比例_供应商商品 = ?, 报价比例_牵牛花商品 = ?
          WHERE 供应商编码 = ? AND 供应商商品编码 = ?
        `;
        await connection.execute(updateQuery, [supplierRatio, qianniuhuaRatio, supplierCode, supplierProductCode]);
      } else {
        // 插入（不插入SKU字段）
        const insertQuery = `
          INSERT INTO \`供应商编码手动绑定sku\` (供应商编码, 供应商商品编码, 报价比例_供应商商品, 报价比例_牵牛花商品)
          VALUES (?, ?, ?, ?)
        `;
        await connection.execute(insertQuery, [supplierCode, supplierProductCode, supplierRatio, qianniuhuaRatio]);
      }

      // 更新供应商报价表的计算后供货价格
      const updatePriceQuery = `
        UPDATE \`供应商报价\`
        SET 计算后供货价格 = ?
        WHERE 供应商编码 = ? AND 最小销售规格UPC商品条码 = ?
      `;
      await connection.execute(updatePriceQuery, [calculatedPrice, supplierCode, upcCode]);

      return true;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 更新报价比例失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 清空报价比例
  async clearPriceRatios(
    supplierCode: string,
    upcCode: string,
  ): Promise<boolean> {
    const connection = await this.getConnection();

    try {
      // 先通过UPC条码找到对应的供应商商品编码
      const quotationQuery = `
        SELECT 供应商商品编码
        FROM \`供应商报价\`
        WHERE 供应商编码 = ? AND 最小销售规格UPC商品条码 = ?
        LIMIT 1
      `;
      const [quotationData]: any = await connection.execute(quotationQuery, [supplierCode, upcCode]);

      if (!quotationData || quotationData.length === 0) {
        throw new Error('未找到对应的供应商报价记录');
      }

      const supplierProductCode = quotationData[0]['供应商商品编码'];

      // 检查是否存在
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM \`供应商编码手动绑定sku\`
        WHERE 供应商编码 = ? AND 供应商商品编码 = ?
      `;
      const [checkResult]: any = await connection.execute(checkQuery, [supplierCode, supplierProductCode]);
      const exists = checkResult[0].count > 0;

      if (exists) {
        // 更新：将报价比例字段设置为NULL
        const updateQuery = `
          UPDATE \`供应商编码手动绑定sku\`
          SET 报价比例_供应商商品 = NULL, 报价比例_牵牛花商品 = NULL
          WHERE 供应商编码 = ? AND 供应商商品编码 = ?
        `;
        await connection.execute(updateQuery, [supplierCode, supplierProductCode]);
      }

      // 将供应商报价表的计算后供货价格设置为NULL
      const updatePriceQuery = `
        UPDATE \`供应商报价\`
        SET 计算后供货价格 = NULL
        WHERE 供应商编码 = ? AND 最小销售规格UPC商品条码 = ?
      `;
      await connection.execute(updatePriceQuery, [supplierCode, upcCode]);

      return true;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 清空报价比例失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 批量查询SKU绑定标记
  // 直接通过供应商编码和最小销售规格UPC商品条码查询
  async getSkuBindingFlags(
    items: InventorySummary[],
    quotationData: SupplierQuotation[],
    upcToSkuMap?: Record<string, string[]>,
  ): Promise<Record<string, boolean>> {
    if (!items || items.length === 0 || !quotationData || quotationData.length === 0) {
      return {};
    }

    const connection = await this.getConnection();
    const result: Record<string, boolean> = {};

    try {
      // 直接通过供应商编码和供应商商品编码查询绑定表
      // 收集所有唯一的供应商编码和供应商商品编码组合
      const quotationProductMap = new Map<string, { supplierCode: string; supplierProductCode: string }>();
      quotationData.forEach(quotation => {
        if (quotation.供应商编码 && quotation.供应商商品编码) {
          const key = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
          if (!quotationProductMap.has(key)) {
            quotationProductMap.set(key, {
              supplierCode: quotation.供应商编码,
              supplierProductCode: quotation.供应商商品编码,
            });
          }
        }
      });

      if (quotationProductMap.size === 0) {
        Logger.log(`[SupplierQuotationService] 没有找到供应商编码和供应商商品编码组合`);
        return {};
      }

      Logger.log(`[SupplierQuotationService] 查询绑定标记，供应商编码和供应商商品编码组合数量: ${quotationProductMap.size}`);

      // 构建查询条件：直接通过供应商编码和供应商商品编码查询
      const conditions: string[] = [];
      const params: any[] = [];
      quotationProductMap.forEach((info) => {
        conditions.push('(供应商编码 = ? AND 供应商商品编码 = ?)');
        params.push(info.supplierCode, info.supplierProductCode);
      });

      // 查询有计算后供货价格的记录（计算后供货价格不为NULL才显示'转'字）
      const query = `
        SELECT DISTINCT
          供应商编码,
          供应商商品编码
        FROM \`供应商报价\`
        WHERE (${conditions.join(' OR ')})
          AND 计算后供货价格 IS NOT NULL
      `;

      const [data]: any = await connection.execute(query, params);

      Logger.log(`[SupplierQuotationService] 查询到 ${data.length} 条绑定记录`);

      // 构建绑定标记集合（使用供应商编码和供应商商品编码作为key）
      const bindingSet = new Set<string>();
      data.forEach((row: any) => {
        const key = `${row['供应商编码']}_${row['供应商商品编码']}`;
        bindingSet.add(key);
      });

      Logger.log(`[SupplierQuotationService] 绑定标记集合大小: ${bindingSet.size}`);

      // 构建UPC到SKU的映射
      const upcToSkusMap: Record<string, string[]> = {};
      if (upcToSkuMap) {
        Object.assign(upcToSkusMap, upcToSkuMap);
      }

      // 为每个库存汇总项检查是否有绑定
      // 通过SKU找到对应的供应商报价，然后检查是否有绑定
      items.forEach(item => {
        if (item.SKU) {
          let hasBinding = false;

          // 方法1：通过UPC到SKU的映射查找
          if (upcToSkusMap) {
            let matchedUpcs: string[] = [];
            Object.keys(upcToSkusMap).forEach(upc => {
              if (upcToSkusMap[upc].includes(item.SKU!)) {
                matchedUpcs.push(upc);
              }
            });

            // 检查匹配的UPC对应的供应商报价是否有绑定
            matchedUpcs.forEach(upc => {
              quotationData.forEach(quotation => {
                if (quotation.供应商编码 && quotation.供应商商品编码 && quotation.最小销售规格UPC商品条码 === upc) {
                  // 使用供应商编码和供应商商品编码作为key
                  const key = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
                  if (bindingSet.has(key)) {
                    hasBinding = true;
                  }
                }
              });
            });
          }

          // 方法2：直接遍历所有供应商报价，检查是否有匹配的SKU（通过UPC）
          // 如果方法1没有找到，尝试方法2
          if (!hasBinding) {
            quotationData.forEach(quotation => {
              if (quotation.供应商编码 && quotation.供应商商品编码 && quotation.最小销售规格UPC商品条码) {
                const key = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
                if (bindingSet.has(key)) {
                  // 检查这个UPC是否对应当前SKU
                  if (upcToSkusMap && upcToSkusMap[quotation.最小销售规格UPC商品条码]) {
                    if (upcToSkusMap[quotation.最小销售规格UPC商品条码].includes(item.SKU!)) {
                      hasBinding = true;
                    }
                  }
                }
              }
            });
          }

          if (hasBinding) {
            result[item.SKU] = true;
          }
        }
      });

      Logger.log(`[SupplierQuotationService] 查询SKU绑定标记完成，返回 ${Object.keys(result).length} 条记录`);
      return result;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询SKU绑定标记失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 根据UPC条码批量获取SKU编码
  // 返回映射：UPC条码 -> SKU编码数组（一个UPC可能对应多个SKU）
  async getSkuCodesByUpcCodes(upcCodes: string[]): Promise<Record<string, string[]>> {
    if (!upcCodes || upcCodes.length === 0) {
      return {};
    }

    const connection = await this.getShangpingConnection();

    try {
      // 过滤掉空值
      const validUpcCodes = upcCodes.filter(upc => upc && upc.trim() !== '');
      if (validUpcCodes.length === 0) {
        return {};
      }

      // 构建查询条件：商品条码包含任一UPC条码且不包含Z
      // 商品条码字段可能包含多个条码（逗号或中文逗号分隔），需要检查是否包含目标UPC
      const conditions: string[] = [];
      const params: any[] = [];

      validUpcCodes.forEach(upc => {
        // 使用 LIKE 匹配包含关系（商品条码包含UPC条码）
        // 商品条码可能包含多个条码，用逗号或中文逗号分隔，需要检查每个条码
        conditions.push('`商品条码` LIKE ?');
        params.push(`%${upc}%`);
      });

      const query = `
        SELECT DISTINCT
          \`商品条码\`,
          \`SKU编码\`
        FROM \`商品主档销售规格\`
        WHERE (${conditions.join(' OR ')})
          AND \`SKU编码\` IS NOT NULL
          AND \`SKU编码\` != ''
          AND \`商品条码\` NOT LIKE '%Z%'
      `;

      Logger.log(`[SupplierQuotationService] 查询SKU编码，UPC数量: ${validUpcCodes.length}`);
      const [data]: any = await connection.execute(query, params);

      // 构建结果映射：UPC -> SKU编码数组
      const result: Record<string, string[]> = {};

      // 初始化所有UPC的结果数组
      validUpcCodes.forEach(upc => {
        result[upc] = [];
      });

      // 遍历查询结果，为每个UPC找到匹配的SKU
      (data || []).forEach((row: any) => {
        const productCode = row['商品条码'] || '';
        const skuCode = row['SKU编码'] || '';

        if (!skuCode) return;

        // 再次排除商品条码字段包含'Z'的数据（双重检查）
        if (productCode.includes('Z')) {
          return;
        }

        // 检查每个UPC是否包含在商品条码中
        // 商品条码可能包含多个条码（逗号或中文逗号分隔），需要检查每个条码
        // 条件：商品条码包含了UPC条码
        validUpcCodes.forEach(upc => {
          // 将商品条码按逗号或中文逗号分割，检查每个条码是否包含UPC
          const codes = productCode.split(/[,，]/).map((c: string) => c.trim());
          // 商品条码字段中的某个条码包含了UPC条码
          const isMatch = codes.some(code => code.includes(upc));

          if (isMatch && !result[upc].includes(skuCode)) {
            result[upc].push(skuCode);
          }
        });
      });

      Logger.log(`[SupplierQuotationService] 查询结果: ${Object.keys(result).length} 个UPC匹配到SKU`);
      return result;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 根据UPC获取SKU编码失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 批量查询供应商名称
  // 返回格式: { "SKU_门店名称": "供应商名称", "SKU": "供应商名称" }
  async getSupplierNamesForInventory(
    type: '全部' | '仓店' | '城市',
    items: InventorySummary[],
    fields: string[],
  ): Promise<Record<string, string>> {
    if (!items || items.length === 0 || !fields || fields.length === 0) {
      return {};
    }

    // 限制查询的数据量，避免超时
    const MAX_ITEMS = 1000;
    const limitedItems = items.slice(0, MAX_ITEMS);

    Logger.log(`[SupplierQuotationService] 开始查询供应商名称，类型: ${type}, 字段: ${fields.join(',')}, 数据量: ${limitedItems.length}`);

    const connection = await this.getChaigouConnection();
    const result: Record<string, string> = {};

    try {
      // 仓店维度：查询供应商名称
      if (type === '仓店' && fields.includes('供应商名称')) {
        // 构建查询条件：匹配门店/仓库名称和SKU
        const conditions: string[] = [];
        const params: any[] = [];

        limitedItems.forEach(item => {
          if (item.SKU && item['门店/仓库名称']) {
            conditions.push('(`门店/仓名称` = ? AND `商品SKU` = ?)');
            params.push(item['门店/仓库名称'], item.SKU);
          }
        });

        if (conditions.length === 0) {
          return {};
        }

        // 查询直送方式的供应商
        const directQuery = `
          SELECT DISTINCT
            \`门店/仓名称\`,
            \`商品SKU\`,
            \`供应商\`
          FROM \`仓店补货参考\`
          WHERE (${conditions.join(' OR ')})
            AND \`送货方式\` = '直送'
            AND \`供应商\` IS NOT NULL
            AND \`供应商\` != ''
          LIMIT 5000
        `;

        const [directData]: any = await connection.execute(directQuery, params);

        // 获取所有唯一的SKU
        const uniqueSkus = [...new Set(limitedItems.filter(i => i.SKU).map(i => i.SKU!))];

        if (uniqueSkus.length > 0) {
          // 查询配送方式的供应商（从补货参考(中心仓)表）
          const centerQuery = `
            SELECT DISTINCT
              \`商品SKU\`,
              \`供应商\`
            FROM \`补货参考(中心仓)\`
            WHERE \`商品SKU\` IN (${uniqueSkus.map(() => '?').join(',')})
              AND \`供应商\` IS NOT NULL
              AND \`供应商\` != ''
            LIMIT 5000
          `;

          const [centerData]: any = await connection.execute(centerQuery, uniqueSkus);

          // 处理直送数据
          directData.forEach((row: any) => {
            const key = `${row['商品SKU']}_${row['门店/仓名称']}`;
            if (row['供应商'] && !result[key]) {
              result[key] = row['供应商'];
            }
          });

          // 处理配送数据：需要匹配门店/仓库名称
          limitedItems.forEach(item => {
            if (item.SKU && item['门店/仓库名称']) {
              const key = `${item.SKU}_${item['门店/仓库名称']}`;
              if (!result[key]) {
                // 查找配送方式的供应商
                const centerMatch = centerData.find((row: any) => row['商品SKU'] === item.SKU);
                if (centerMatch && centerMatch['供应商']) {
                  result[key] = centerMatch['供应商'];
                }
              }
            }
          });
        }
      }

      // 城市/全部维度：查询供应商名称(最低价)
      if ((type === '城市' || type === '全部') && fields.includes('供应商名称(最低价)')) {
        const skus = [...new Set(limitedItems.filter(i => i.SKU).map(i => i.SKU!))];
        if (skus.length === 0) {
          // 继续处理其他字段
        } else {
          // 使用子查询优化：为每个SKU选择最低价的供应商
          // 先查询直送方式
          const directQuery = `
            SELECT 
              t1.\`商品SKU\`,
              t1.\`供应商\`
            FROM \`仓店补货参考\` t1
            INNER JOIN (
              SELECT 
                \`商品SKU\`,
                MIN(\`采购单价 (基础单位)\`) as min_price
              FROM \`仓店补货参考\`
              WHERE \`商品SKU\` IN (${skus.map(() => '?').join(',')})
                AND \`送货方式\` = '直送'
                AND \`供应商\` IS NOT NULL
                AND \`供应商\` != ''
                AND \`采购单价 (基础单位)\` IS NOT NULL
                AND \`采购单价 (基础单位)\` > 0
              GROUP BY \`商品SKU\`
            ) t2 ON t1.\`商品SKU\` = t2.\`商品SKU\` 
              AND t1.\`采购单价 (基础单位)\` = t2.min_price
            WHERE t1.\`送货方式\` = '直送'
              AND t1.\`供应商\` IS NOT NULL
              AND t1.\`供应商\` != ''
            LIMIT 5000
          `;

          const [directData]: any = await connection.execute(directQuery, [...skus, ...skus]);

          // 查询配送方式：从补货参考(中心仓)表查询
          const centerQuery = `
            SELECT 
              t1.\`商品SKU\`,
              t1.\`供应商\`
            FROM \`补货参考(中心仓)\` t1
            INNER JOIN (
              SELECT 
                \`商品SKU\`,
                MIN(\`采购单价 (基础单位)\`) as min_price
              FROM \`补货参考(中心仓)\`
              WHERE \`商品SKU\` IN (${skus.map(() => '?').join(',')})
                AND \`供应商\` IS NOT NULL
                AND \`供应商\` != ''
                AND \`采购单价 (基础单位)\` IS NOT NULL
                AND \`采购单价 (基础单位)\` > 0
              GROUP BY \`商品SKU\`
            ) t2 ON t1.\`商品SKU\` = t2.\`商品SKU\` 
              AND t1.\`采购单价 (基础单位)\` = t2.min_price
            WHERE t1.\`供应商\` IS NOT NULL
              AND t1.\`供应商\` != ''
            LIMIT 5000
          `;

          const [centerData]: any = await connection.execute(centerQuery, [...skus, ...skus]);

          // 合并数据，为每个SKU选择最低价的供应商
          const skuMap: Record<string, { supplier: string; price: number }> = {};

          // 处理直送数据
          directData.forEach((row: any) => {
            const sku = row['商品SKU'];
            if (sku && row['供应商'] && !skuMap[sku]) {
              skuMap[sku] = {
                supplier: row['供应商'],
                price: 0, // 已经是最低价，不需要再比较
              };
            }
          });

          // 处理配送数据（如果直送没有找到，使用配送的）
          centerData.forEach((row: any) => {
            const sku = row['商品SKU'];
            if (sku && row['供应商'] && !skuMap[sku]) {
              skuMap[sku] = {
                supplier: row['供应商'],
                price: 0,
              };
            }
          });

          // 生成结果
          Object.keys(skuMap).forEach(sku => {
            result[`${sku}_最低价`] = skuMap[sku].supplier;
          });
        }
      }

      // 城市/全部维度：查询供应商名称(最近时间)
      if ((type === '城市' || type === '全部') && fields.includes('供应商名称(最近时间)')) {
        const skus = [...new Set(limitedItems.filter(i => i.SKU).map(i => i.SKU!))];
        if (skus.length === 0) {
          // 继续处理其他字段
        } else {
          // 使用子查询优化：为每个SKU选择最近时间的供应商
          // 先查询直送方式
          const directQuery = `
            SELECT 
              t1.\`商品SKU\`,
              t1.\`供应商\`
            FROM \`仓店补货参考\` t1
            INNER JOIN (
              SELECT 
                \`商品SKU\`,
                MAX(\`上次补货时间\`) as max_time
              FROM \`仓店补货参考\`
              WHERE \`商品SKU\` IN (${skus.map(() => '?').join(',')})
                AND \`送货方式\` = '直送'
                AND \`供应商\` IS NOT NULL
                AND \`供应商\` != ''
                AND \`上次补货时间\` IS NOT NULL
              GROUP BY \`商品SKU\`
            ) t2 ON t1.\`商品SKU\` = t2.\`商品SKU\` 
              AND t1.\`上次补货时间\` = t2.max_time
            WHERE t1.\`送货方式\` = '直送'
              AND t1.\`供应商\` IS NOT NULL
              AND t1.\`供应商\` != ''
            LIMIT 5000
          `;

          const [directData]: any = await connection.execute(directQuery, [...skus, ...skus]);

          // 查询配送方式：从补货参考(中心仓)表查询
          const centerQuery = `
            SELECT 
              t1.\`商品SKU\`,
              t1.\`供应商\`
            FROM \`补货参考(中心仓)\` t1
            INNER JOIN (
              SELECT 
                \`商品SKU\`,
                MAX(\`上次补货时间\`) as max_time
              FROM \`补货参考(中心仓)\`
              WHERE \`商品SKU\` IN (${skus.map(() => '?').join(',')})
                AND \`供应商\` IS NOT NULL
                AND \`供应商\` != ''
                AND \`上次补货时间\` IS NOT NULL
              GROUP BY \`商品SKU\`
            ) t2 ON t1.\`商品SKU\` = t2.\`商品SKU\` 
              AND t1.\`上次补货时间\` = t2.max_time
            WHERE t1.\`供应商\` IS NOT NULL
              AND t1.\`供应商\` != ''
            LIMIT 5000
          `;

          const [centerData]: any = await connection.execute(centerQuery, [...skus, ...skus]);

          // 合并数据，为每个SKU选择最近时间的供应商
          const skuMap: Record<string, string> = {};

          // 处理直送数据
          directData.forEach((row: any) => {
            const sku = row['商品SKU'];
            if (sku && row['供应商'] && !skuMap[sku]) {
              skuMap[sku] = row['供应商'];
            }
          });

          // 处理配送数据（如果直送没有找到，使用配送的）
          centerData.forEach((row: any) => {
            const sku = row['商品SKU'];
            if (sku && row['供应商'] && !skuMap[sku]) {
              skuMap[sku] = row['供应商'];
            }
          });

          // 生成结果
          Object.keys(skuMap).forEach(sku => {
            result[`${sku}_最近时间`] = skuMap[sku];
          });
        }
      }

      Logger.log(`[SupplierQuotationService] 查询供应商名称完成，返回 ${Object.keys(result).length} 条记录`);
      return result;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询供应商名称失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }
}

