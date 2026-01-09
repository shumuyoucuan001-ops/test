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

      // 获取数据，JOIN供应商属性信息表获取供应商名称，JOIN供应商编码手动绑定sku表获取计算后供货价格
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
          COALESCE(b.\`计算后供货价格\`, NULL) as \`计算后供货价格\`,
          q.供应商商品备注,
          q.数据更新时间
        FROM \`供应商报价\` q
        LEFT JOIN \`供应商属性信息\` s ON q.\`供应商编码\` = s.\`供应商编码\`
        LEFT JOIN \`供应商编码手动绑定sku\` b ON q.\`供应商编码\` = b.\`供应商编码\` AND q.\`供应商商品编码\` = b.\`供应商商品编码\`
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
        // 更新（不更新SKU字段），同时更新计算后供货价格
        const updateQuery = `
          UPDATE \`供应商编码手动绑定sku\`
          SET 报价比例_供应商商品 = ?, 报价比例_牵牛花商品 = ?, 计算后供货价格 = ?
          WHERE 供应商编码 = ? AND 供应商商品编码 = ?
        `;
        await connection.execute(updateQuery, [supplierRatio, qianniuhuaRatio, calculatedPrice, supplierCode, supplierProductCode]);
      } else {
        // 插入（不插入SKU字段），同时插入计算后供货价格
        const insertQuery = `
          INSERT INTO \`供应商编码手动绑定sku\` (供应商编码, 供应商商品编码, 报价比例_供应商商品, 报价比例_牵牛花商品, 计算后供货价格)
          VALUES (?, ?, ?, ?, ?)
        `;
        await connection.execute(insertQuery, [supplierCode, supplierProductCode, supplierRatio, qianniuhuaRatio, calculatedPrice]);
      }

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
        // 更新：将报价比例字段和计算后供货价格设置为NULL
        const updateQuery = `
          UPDATE \`供应商编码手动绑定sku\`
          SET 报价比例_供应商商品 = NULL, 报价比例_牵牛花商品 = NULL, 计算后供货价格 = NULL
          WHERE 供应商编码 = ? AND 供应商商品编码 = ?
        `;
        await connection.execute(updateQuery, [supplierCode, supplierProductCode]);
      }

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
      // 从供应商编码手动绑定sku表查询
      const query = `
        SELECT DISTINCT
          供应商编码,
          供应商商品编码
        FROM \`供应商编码手动绑定sku\`
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
  // 返回格式: { "SKU_门店名称": "供应商名称", "SKU_最低价": "供应商名称", "SKU_最近时间": "供应商名称" }
  async getSupplierNamesForInventory(
    type: '全部' | '仓店' | '城市',
    items: InventorySummary[],
    fields: string[],
    city?: string, // 城市维度时传递的城市名称，用于门店筛选
  ): Promise<Record<string, string>> {
    if (!items || items.length === 0 || !fields || fields.length === 0) {
      return {};
    }

    // 使用前端传递的所有数据，不再限制数据量
    // 注意：前端已经限制了数据量（全部维度1000条，仓店维度200条），后端不再重复限制
    // 如果前端没有限制，则使用所有传递的数据
    const limitedItems = items;

    Logger.log(`[SupplierQuotationService] 开始查询供应商名称，类型: ${type}, 字段: ${fields.join(',')}, 城市: ${city || '无'}, 数据量: ${limitedItems.length}`);

    const connection = await this.getChaigouConnection();
    const result: Record<string, string> = {};

    try {
      // 仓店维度：查询供应商名称
      if (type === '仓店' && fields.includes('供应商名称')) {
        // 优化：分批处理，避免OR条件过多导致SQL过长和超时
        const validItems = limitedItems.filter(item => item.SKU && item['门店/仓库名称']);
        if (validItems.length === 0) {
          return {};
        }

        // 分批处理，每批最多30个条件，避免SQL过长和超时
        // 仓店维度使用条件对（门店名称+SKU），查询更复杂，需要减少批次大小以提高性能
        const BATCH_SIZE = 30;
        const allDirectData: any[] = [];

        // 构建映射：用于将查询结果映射回原始item
        const itemMap = new Map<string, { sku: string; storeName: string }>();
        validItems.forEach(item => {
          if (item.SKU && item['门店/仓库名称']) {
            const mapKey = `${item.SKU}_${item['门店/仓库名称']}`;
            itemMap.set(mapKey, { sku: item.SKU, storeName: item['门店/仓库名称'] });
          }
        });

        for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
          const batch = validItems.slice(i, i + BATCH_SIZE);
          const conditions: string[] = [];
          const params: any[] = [];
          const batchMap = new Map<string, { sku: string; storeName: string }>();

          batch.forEach(item => {
            if (item.SKU && item['门店/仓库名称']) {
              conditions.push('(`门店/仓名称` = ? AND `商品SKU` = ?)');
              params.push(item['门店/仓库名称'], item.SKU);
              // 存储批次内的映射关系
              const mapKey = `${item.SKU}_${item['门店/仓库名称']}`;
              batchMap.set(mapKey, { sku: item.SKU, storeName: item['门店/仓库名称'] });
            }
          });

          if (conditions.length > 0) {
            // 查询直送方式的供应商
            Logger.log(`[SupplierQuotationService] 执行仓店维度查询，批次: ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validItems.length / BATCH_SIZE)}, 条件数量: ${conditions.length}`);
            const startTime = Date.now();
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
              ORDER BY \`门店/仓名称\`, \`商品SKU\`
              LIMIT 3000
            `;

            const [directData]: any = await connection.execute(directQuery, params);
            const queryTime = Date.now() - startTime;
            Logger.log(`[SupplierQuotationService] 仓店维度查询完成，批次: ${Math.floor(i / BATCH_SIZE) + 1}, 耗时: ${queryTime}ms，返回记录数: ${directData.length}`);

            // 优化：使用Map构建查询结果的索引，避免O(n²)查找
            const directDataMap = new Map<string, string>();
            directData.forEach((row: any) => {
              const sku = row['商品SKU'];
              const storeName = row['门店/仓名称'];
              if (sku && storeName && row['供应商']) {
                // 使用数据库返回的字段名作为key
                const mapKey = `${sku}_${storeName}`;
                if (!directDataMap.has(mapKey)) {
                  directDataMap.set(mapKey, row['供应商']);
                }
              }
            });

            // 处理查询结果，使用查询参数中的值构建key（确保与前端匹配）
            batch.forEach(item => {
              if (item.SKU && item['门店/仓库名称']) {
                // 查找匹配的查询结果（SKU和门店名称都匹配）
                // 注意：数据库字段是"门店/仓名称"，库存汇总字段是"门店/仓库名称"
                // 如果值相同，可以直接匹配
                const mapKey = `${item.SKU}_${item['门店/仓库名称']}`;
                const supplier = directDataMap.get(mapKey);
                if (supplier) {
                  // 使用库存汇总的字段名构建key，确保与前端匹配
                  const resultKey = `${item.SKU}_${item['门店/仓库名称']}`;
                  if (!result[resultKey]) {
                    result[resultKey] = supplier;
                  }
                }
              }
            });

            allDirectData.push(...directData);
          }
        }

        // 仓店维度只查询直送方式，不再查询配送方式
      }

      // 城市/全部维度：查询供应商名称(最低价)
      if ((type === '城市' || type === '全部') && fields.includes('供应商名称(最低价)')) {
        // 确保SKU是字符串格式，避免类型不匹配
        const skus = [...new Set(limitedItems.filter(i => i.SKU).map(i => String(i.SKU!).trim()))];
        if (skus.length === 0) {
          // 继续处理其他字段
        } else {
          // 分批处理SKU列表，避免IN子句参数过多导致MySQL通信包错误
          const BATCH_SIZE = 200;
          const skuBatches: string[][] = [];
          for (let i = 0; i < skus.length; i += BATCH_SIZE) {
            skuBatches.push(skus.slice(i, i + BATCH_SIZE));
          }

          // 合并数据，为每个SKU选择最低价的供应商
          const skuMap: Record<string, string> = {};

          // 城市维度需要添加门店筛选条件
          const cityFilterClause = type === '城市' && city ? `AND \`门店/仓名称\` LIKE ?` : '';
          const cityFilterParams = type === '城市' && city ? [`%${city}%`] : [];

          // 分批查询，只查询直送方式
          for (const skuBatch of skuBatches) {
            // 使用窗口函数优化查询，确保每个SKU只返回一条记录
            let whereClause = `\`商品SKU\` IN (${skuBatch.map(() => '?').join(',')})
                AND \`送货方式\` = '直送'
                AND \`供应商\` IS NOT NULL
                AND \`供应商\` != ''
                AND \`采购单价 (基础单位)\` IS NOT NULL
                AND \`采购单价 (基础单位)\` > 0`;

            const queryParams: any[] = [...skuBatch];

            // 城市维度添加门店筛选
            if (cityFilterClause) {
              whereClause += ` ${cityFilterClause}`;
              queryParams.push(...cityFilterParams);
            }

            // 使用窗口函数ROW_NUMBER()来优化查询，确保每个SKU只返回价格最低的那条记录
            // 如果有多个相同最低价的供应商，取第一个（按供应商名称排序）
            const query = `
              SELECT 
                \`商品SKU\`,
                \`供应商\`
              FROM (
                SELECT 
                  \`商品SKU\`,
                  \`供应商\`,
                  \`采购单价 (基础单位)\`,
                  ROW_NUMBER() OVER (
                    PARTITION BY \`商品SKU\` 
                    ORDER BY \`采购单价 (基础单位)\` ASC, \`供应商\` ASC
                  ) as rn
                FROM \`仓店补货参考\`
                WHERE ${whereClause}
              ) t
              WHERE t.rn = 1
              LIMIT 5000
            `;

            Logger.log(`[SupplierQuotationService] 执行最低价查询，SKU数量: ${skuBatch.length}`);
            const startTime = Date.now();
            const [data]: any = await connection.execute(query, queryParams);
            const queryTime = Date.now() - startTime;
            Logger.log(`[SupplierQuotationService] 最低价查询完成，耗时: ${queryTime}ms，返回记录数: ${data.length}`);

            // 处理查询结果
            data.forEach((row: any) => {
              const sku = row['商品SKU'];
              // 确保SKU是字符串格式，避免类型不匹配
              const skuStr = sku ? String(sku).trim() : '';
              if (skuStr && row['供应商']) {
                const supplier = String(row['供应商']).trim();
                if (supplier && !skuMap[skuStr]) {
                  skuMap[skuStr] = supplier;
                }
              }
            });
          }

          // 生成结果（确保SKU格式一致）
          Object.keys(skuMap).forEach(sku => {
            const skuStr = String(sku).trim();
            result[`${skuStr}_最低价`] = skuMap[sku];
          });
        }
      }

      // 城市/全部维度：查询供应商名称(最近时间)
      if ((type === '城市' || type === '全部') && fields.includes('供应商名称(最近时间)')) {
        // 确保SKU是字符串格式，避免类型不匹配
        const skus = [...new Set(limitedItems.filter(i => i.SKU).map(i => String(i.SKU!).trim()))];

        // 调试日志：检查输入的SKU列表
        const testSkus = ['1946496732548804617', '1852634076041908275', '1722537865550049340'];
        Logger.log(`[SupplierQuotationService] 最近时间查询 - 输入SKU列表（前20个）: ${skus.slice(0, 20).join(', ')}`);
        Logger.log(`[SupplierQuotationService] 最近时间查询 - SKU总数: ${skus.length}`);

        // 检查特定的SKU是否在输入列表中
        testSkus.forEach(testSku => {
          const inList = skus.includes(testSku);
          Logger.log(`[SupplierQuotationService] 测试SKU ${testSku} 是否在输入列表中: ${inList}`);
        });

        if (skus.length === 0) {
          // 继续处理其他字段
        } else {
          // 分批处理SKU列表，避免IN子句参数过多导致MySQL通信包错误
          const BATCH_SIZE = 200;
          const skuBatches: string[][] = [];
          for (let i = 0; i < skus.length; i += BATCH_SIZE) {
            skuBatches.push(skus.slice(i, i + BATCH_SIZE));
          }

          // 合并数据，为每个SKU选择最近时间的供应商
          const skuMap: Record<string, string> = {};

          // 获取今天的日期（格式：YYYY-MM-DD）
          // 注意：使用本地时区，确保日期正确
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          Logger.log(`[SupplierQuotationService] 最近时间查询，今天日期: ${todayStr}`);

          // 城市维度需要添加门店筛选条件
          const cityFilterClause = type === '城市' && city ? `AND \`门店/仓名称\` LIKE ?` : '';
          const cityFilterParams = type === '城市' && city ? [`%${city}%`] : [];

          // 分批查询，只查询直送方式
          for (const skuBatch of skuBatches) {
            // 使用窗口函数优化查询，确保每个SKU只返回一条记录
            let whereClause = `\`商品SKU\` IN (${skuBatch.map(() => '?').join(',')})
                AND \`送货方式\` = '直送'
                AND \`供应商\` IS NOT NULL
                AND \`供应商\` != ''
                AND \`上次补货时间\` IS NOT NULL
                AND DATE(\`上次补货时间\`) <= ?`;

            const queryParams: any[] = [...skuBatch, todayStr];

            // 城市维度添加门店筛选
            if (cityFilterClause) {
              whereClause += ` ${cityFilterClause}`;
              queryParams.push(...cityFilterParams);
            }

            // 使用窗口函数ROW_NUMBER()来优化查询，确保每个SKU只返回时间最近的那条记录
            // 如果有多个相同最近时间的供应商，取第一个（按供应商名称排序）
            const query = `
              SELECT 
                \`商品SKU\`,
                \`供应商\`
              FROM (
                SELECT 
                  \`商品SKU\`,
                  \`供应商\`,
                  \`上次补货时间\`,
                  ROW_NUMBER() OVER (
                    PARTITION BY \`商品SKU\` 
                    ORDER BY \`上次补货时间\` DESC, \`供应商\` ASC
                  ) as rn
                FROM \`仓店补货参考\`
                WHERE ${whereClause}
              ) t
              WHERE t.rn = 1
              LIMIT 5000
            `;

            Logger.log(`[SupplierQuotationService] 执行最近时间查询，SKU数量: ${skuBatch.length}`);
            const startTime = Date.now();
            const [data]: any = await connection.execute(query, queryParams);
            const queryTime = Date.now() - startTime;
            Logger.log(`[SupplierQuotationService] 最近时间查询完成，耗时: ${queryTime}ms，返回记录数: ${data.length}`);

            // 处理查询结果
            data.forEach((row: any) => {
              const sku = row['商品SKU'];
              // 确保SKU是字符串格式，避免类型不匹配
              const skuStr = sku ? String(sku).trim() : '';
              if (skuStr && row['供应商']) {
                const supplier = String(row['供应商']).trim();
                if (supplier && !skuMap[skuStr]) {
                  skuMap[skuStr] = supplier;
                }
              }
            });
          }

          // 生成结果（确保SKU格式一致）
          Object.keys(skuMap).forEach(sku => {
            const skuStr = String(sku).trim();
            result[`${skuStr}_最近时间`] = skuMap[sku];
          });

          // 调试日志：检查生成的最终结果
          Logger.log(`[SupplierQuotationService] 最近时间查询 - skuMap大小: ${Object.keys(skuMap).length}`);
          Logger.log(`[SupplierQuotationService] 最近时间查询 - result大小: ${Object.keys(result).length}`);

          // 检查特定的SKU是否在最终结果中
          testSkus.forEach(testSku => {
            const resultKey = `${testSku}_最近时间`;
            const resultValue = result[resultKey];
            const inSkuMap = testSku in skuMap;
            const skuMapValue = skuMap[testSku];
            Logger.log(`[SupplierQuotationService] 测试SKU ${testSku} 最终结果: resultKey=${resultKey}, resultValue=${resultValue}, inSkuMap=${inSkuMap}, skuMapValue=${skuMapValue}`);
          });

          // 调试日志：检查特定SKU的数据和查询结果
          const testSku = '1852628840871190615';
          const testSkuInList = skus.some(s => String(s).trim() === testSku);
          const testSkuInMap = testSku in skuMap || Object.keys(skuMap).some(k => String(k).trim() === testSku);
          const testSkuMapKey = Object.keys(skuMap).find(k => String(k).trim() === testSku);
          const testSkuInLimitedItems = limitedItems.some(item => item.SKU && String(item.SKU).trim() === testSku);

          Logger.log(`[SupplierQuotationService] 调试SKU ${testSku} (最近时间查询):`, {
            inLimitedItems: testSkuInLimitedItems,
            inSkuList: testSkuInList,
            skuListSample: skus.slice(0, 10),
            skuListTotal: skus.length,
            inSkuMap: testSkuInMap,
            skuMapKey: testSkuMapKey,
            skuMapValue: testSkuMapKey ? skuMap[testSkuMapKey] : null,
            skuMapSize: Object.keys(skuMap).length,
            allSkuMapKeysSample: Object.keys(skuMap).slice(0, 10),
            resultKey: `${testSku}_最近时间`,
            resultValue: result[`${testSku}_最近时间`],
            resultKeysSample: Object.keys(result).filter(k => k.includes('最近时间')).slice(0, 10),
            resultTotal: Object.keys(result).length,
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

