import { Injectable, OnModuleInit } from '@nestjs/common';
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
  '供应商-门店关系'?: number; // 供应商-门店关系数量
}

export interface SupplierSkuBinding {
  供应商编码?: string;
  供应商商品编码?: string;
  SKU?: string;
  数据更新时间?: string | Date;
}

@Injectable()
export class SupplierQuotationService implements OnModuleInit {
  // 供应商名称缓存Map（供应商编码 -> 供应商名称）
  private supplierNameMap: Map<string, string> = new Map();
  private supplierNameMapLoaded: boolean = false;

  // 模块初始化时预加载供应商名称映射（可选，首次查询时也会自动加载）
  async onModuleInit(): Promise<void> {
    // 异步加载，不阻塞应用启动
    this.loadSupplierNameMap().catch((error) => {
      Logger.error('[SupplierQuotationService] 启动时加载供应商名称映射失败:', error);
      // 不抛出错误，允许应用继续启动，首次查询时会重试
    });
  }

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

  // 加载供应商名称映射到内存缓存
  async loadSupplierNameMap(): Promise<void> {
    if (this.supplierNameMapLoaded) return;

    const connection = await this.getConnection();
    try {
      const query = `SELECT 供应商编码, 供应商名称 FROM \`供应商属性信息\``;
      const [data]: any = await connection.execute(query);
      this.supplierNameMap.clear();
      (data || []).forEach((row: any) => {
        this.supplierNameMap.set(row.供应商编码, row.供应商名称 || '');
      });
      this.supplierNameMapLoaded = true;
      Logger.log(`[SupplierQuotationService] 供应商名称映射已加载: ${this.supplierNameMap.size} 条`);
    } catch (error) {
      Logger.error('[SupplierQuotationService] 加载供应商名称映射失败:', error);
      // 失败时不抛出错误，允许后续查询继续（只是没有供应商名称）
    } finally {
      await connection.end();
    }
  }

  // 刷新供应商名称映射（用于数据更新后）
  async refreshSupplierNameMap(): Promise<void> {
    this.supplierNameMapLoaded = false;
    await this.loadSupplierNameMap();
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
    supplierName?: string,
    supplierCode?: string,
    productName?: string,
    upcCode?: string,
  ): Promise<{ data: SupplierQuotation[]; total: number }> {
    const startTime = Date.now();
    const connection = await this.getConnection();

    try {
      // 确保供应商名称映射已加载
      await this.loadSupplierNameMap();

      const offset = (page - 1) * limit;

      // 构建搜索条件
      let whereClause = '1=1';
      const queryParams: any[] = [];
      const countQueryParams: any[] = [];

      // 如果指定了供应商编码列表，使用IN查询
      if (supplierCodes && supplierCodes.length > 0) {
        const placeholders = supplierCodes.map(() => '?').join(',');
        whereClause += ` AND q.\`供应商编码\` IN (${placeholders})`;
        queryParams.push(...supplierCodes);
        countQueryParams.push(...supplierCodes);
      }

      // 处理供应商名称搜索：需要从缓存的Map中查找匹配的供应商编码
      let matchedSupplierCodes: string[] | undefined;
      if (supplierName && supplierName.trim()) {
        const searchPattern = supplierName.trim().toLowerCase();
        matchedSupplierCodes = Array.from(this.supplierNameMap.entries())
          .filter(([_, name]) => name.toLowerCase().includes(searchPattern))
          .map(([code, _]) => code);

        if (matchedSupplierCodes.length === 0) {
          // 如果没有匹配的供应商，直接返回空结果
          return { data: [], total: 0 };
        }

        const placeholders = matchedSupplierCodes.map(() => '?').join(',');
        whereClause += ` AND q.\`供应商编码\` IN (${placeholders})`;
        queryParams.push(...matchedSupplierCodes);
        countQueryParams.push(...matchedSupplierCodes);
      }

      // 兼容旧的search参数（如果提供了新的单独参数，则忽略search）
      if (search && !supplierName && !supplierCode && !productName && !upcCode) {
        whereClause += ' AND (q.供应商编码 LIKE ? OR q.商品名称 LIKE ? OR q.商品规格 LIKE ? OR q.供应商商品编码 LIKE ?)';
        const likePattern = `%${search}%`;
        queryParams.push(likePattern, likePattern, likePattern, likePattern);
        countQueryParams.push(likePattern, likePattern, likePattern, likePattern);
      } else {
        // 使用新的单独搜索参数
        if (supplierCode && supplierCode.trim()) {
          whereClause += ' AND q.供应商编码 LIKE ?';
          const likePattern = `%${supplierCode.trim()}%`;
          queryParams.push(likePattern);
          countQueryParams.push(likePattern);
        }
        if (productName && productName.trim()) {
          whereClause += ' AND q.商品名称 LIKE ?';
          const likePattern = `%${productName.trim()}%`;
          queryParams.push(likePattern);
          countQueryParams.push(likePattern);
        }
        if (upcCode && upcCode.trim()) {
          whereClause += ' AND q.最小销售规格UPC商品条码 LIKE ?';
          const likePattern = `%${upcCode.trim()}%`;
          queryParams.push(likePattern);
          countQueryParams.push(likePattern);
        }
      }

      // COUNT查询：不再需要JOIN供应商属性信息表，因为供应商名称搜索已在应用层处理
      const countStartTime = Date.now();
      const totalQuery = `
        SELECT COUNT(*) as count 
        FROM \`供应商报价\` q
        WHERE ${whereClause}
      `;
      const [totalResult]: any = await connection.execute(totalQuery, countQueryParams);
      const total = totalResult[0].count;
      const countDuration = Date.now() - countStartTime;

      // 数据查询：移除供应商属性信息表的JOIN，改为从内存Map获取供应商名称
      const dataStartTime = Date.now();
      const dataQuery = `
        SELECT 
          q.序号,
          q.供应商编码,
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
        LEFT JOIN \`供应商编码手动绑定sku\` b ON q.\`供应商编码\` = b.\`供应商编码\` AND q.\`供应商商品编码\` = b.\`供应商商品编码\`
        WHERE ${whereClause}
        ORDER BY q.\`供应商编码\` ASC, q.序号 ASC
        LIMIT ? OFFSET ?
      `;

      const [data]: any = await connection.execute(
        dataQuery,
        [...queryParams, limit, offset]
      );
      const dataDuration = Date.now() - dataStartTime;

      // 从内存Map填充供应商名称
      const enrichStartTime = Date.now();
      const enrichedData = (data || []).map((row: any) => ({
        ...row,
        供应商名称: this.supplierNameMap.get(row.供应商编码) || '',
      }));
      const enrichDuration = Date.now() - enrichStartTime;

      const totalDuration = Date.now() - startTime;
      Logger.log(
        `[SupplierQuotationService] 查询供应商报价完成 - 总耗时: ${totalDuration}ms, ` +
        `COUNT: ${countDuration}ms, 数据查询: ${dataDuration}ms, 数据填充: ${enrichDuration}ms, ` +
        `结果数: ${enrichedData.length}, 总数: ${total}`
      );

      return {
        data: enrichedData,
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

  // 批量查询供应商-门店关系数据
  async getSupplierStoreRelations(
    supplierCodes: string[],
    type: '全部' | '仓店' | '城市',
    storeName?: string, // 仓店维度时需要传递门店名称
    city?: string, // 城市维度时需要传递城市名称
    skuSupplierMap?: Array<{ supplierCode: string; sku: string }>, // 供应商编码和SKU的映射，用于查询默认供货关系
  ): Promise<Record<string, number | string | any>> {
    Logger.log(`[SupplierQuotationService] 开始查询供应商-门店关系，供应商编码数量: ${supplierCodes?.length || 0}, 维度: ${type}, 门店名称: ${storeName || '无'}, 城市: ${city || '无'}`);

    if (!supplierCodes || supplierCodes.length === 0) {
      Logger.log('[SupplierQuotationService] 供应商编码为空，返回空结果');
      return {};
    }

    // 全部/城市维度：对供应商编码去重
    const uniqueSupplierCodes = type === '全部' || type === '城市'
      ? Array.from(new Set(supplierCodes))
      : supplierCodes;

    if (type === '全部' || type === '城市') {
      Logger.log(`[SupplierQuotationService] 去重后供应商编码数量: ${uniqueSupplierCodes.length} (原始: ${supplierCodes.length})`);
    }

    const shangpingConnection = await this.getShangpingConnection();

    try {
      // 构建供应商编码到关系值的映射
      // 对于全部维度和城市维度，完全基于商品供货关系表统计，不再查询多维度供应商编码对应数量表
      // 对于仓店维度，仍然使用多维度供应商编码对应数量表
      const supplierRelationMap: Record<string, number | string | any> = {};

      if (type === '仓店') {
        // 仓店维度：需要匹配门店名称，使用多维度供应商编码对应数量表
        if (!storeName || storeName.trim() === '') {
          Logger.log('[SupplierQuotationService] 仓店维度缺少门店名称，返回空结果');
          return {};
        }

        const placeholders = uniqueSupplierCodes.map(() => '?').join(',');
        const query = `
          SELECT 
            供应商编码,
            \`仓店维度结果\` AS relationValue
          FROM \`多维度供应商编码对应数量\`
          WHERE 供应商编码 IN (${placeholders})
            AND \`门店/仓名称\` = ?
        `;
        const queryParams = [...uniqueSupplierCodes, storeName.trim()];

        Logger.log(`[SupplierQuotationService] 执行SQL查询: ${query.substring(0, 200)}...`);
        const [relationData]: any = await shangpingConnection.execute(query, queryParams);
        Logger.log(`[SupplierQuotationService] 查询结果数量: ${(relationData || []).length}`);

        // 对于仓店维度，先初始化所有供应商编码为"否"（如果查询不到数据，默认为"否"）
        uniqueSupplierCodes.forEach(code => {
          supplierRelationMap[code] = '否';
        });

        (relationData || []).forEach((row: any) => {
          const supplierCode = row['供应商编码'];
          const relationValue = row['relationValue'];
          if (supplierCode && relationValue !== null && relationValue !== undefined) {
            // 如果已经存在，跳过（确保每个供应商编码只保留一条记录）
            if (!supplierRelationMap[supplierCode] || supplierRelationMap[supplierCode] === '否') {
              // 仓店维度：保持原始值（可能是"是"/"否"字符串）
              supplierRelationMap[supplierCode] = String(relationValue);
            }
          }
        });

        Logger.log(`[SupplierQuotationService] 仓店维度供应商-门店关系查询完成，返回 ${Object.keys(supplierRelationMap).length} 条记录`);
      } else {
        // 全部维度和城市维度：初始化所有供应商编码为0（将在后续基于商品供货关系表统计）
        uniqueSupplierCodes.forEach(code => {
          supplierRelationMap[code] = {
            relationValue: 0,
            skuStoreCount: {},
          };
        });
        Logger.log(`[SupplierQuotationService] ${type}维度初始化供应商编码数量: ${uniqueSupplierCodes.length}`);
      }

      // 如果提供了SKU和供应商编码的映射，查询商品供货关系
      // 对于全部维度和城市维度，必须要有SKU映射才能查询商品供货关系表
      if (skuSupplierMap && skuSupplierMap.length > 0) {
        Logger.log(`[SupplierQuotationService] 开始查询默认供货关系，SKU-供应商映射数量: ${skuSupplierMap.length}`);
        // 调试日志：记录前5条映射数据
        const sampleMap = skuSupplierMap.slice(0, 5);
        Logger.log(`[SupplierQuotationService] SKU-供应商映射示例（前5条）: ${JSON.stringify(sampleMap)}`);

        try {
          // 查询商品供货关系表
          const skuSupplierConditions: string[] = [];
          const skuSupplierParams: any[] = [];

          skuSupplierMap.forEach(({ supplierCode, sku }) => {
            if (supplierCode && sku) {
              skuSupplierConditions.push('(供应商编码 = ? AND SKU编码 = ?)');
              skuSupplierParams.push(supplierCode, sku);
            }
          });

          Logger.log(`[SupplierQuotationService] 构建的查询条件数量: ${skuSupplierConditions.length}, 参数数量: ${skuSupplierParams.length}`);

          if (skuSupplierConditions.length > 0) {
            // 查询商品供货关系
            // 根据维度决定是否查询门店字段和添加过滤条件
            // 全部维度和城市维度都需要门店字段来统计去重后的门店数量
            let selectFields = '供应商编码, SKU编码, `门店/仓名称`';
            let whereConditions = `(${skuSupplierConditions.join(' OR ')})`;

            if (type === '城市' && city) {
              // 城市维度：需要门店字段来过滤，并在SQL层面过滤
              whereConditions += ' AND `门店/仓名称` LIKE ?';
            } else if (type === '仓店' && storeName) {
              // 仓店维度：需要门店字段来过滤，并在SQL层面过滤
              whereConditions += ' AND `门店/仓名称` = ?';
            }

            const supplyRelationQuery = `
              SELECT 
                ${selectFields}
              FROM \`商品供货关系\`
              WHERE ${whereConditions}
            `;

            // 根据维度添加额外的查询参数
            let finalQueryParams = [...skuSupplierParams];
            if (type === '城市' && city) {
              finalQueryParams.push(`%${city}%`);
            } else if (type === '仓店' && storeName) {
              finalQueryParams.push(storeName);
            }

            const [supplyRelationData]: any = await shangpingConnection.execute(
              supplyRelationQuery,
              finalQueryParams
            );

            Logger.log(`[SupplierQuotationService] 商品供货关系查询结果数量: ${(supplyRelationData || []).length}`);
            // 调试日志：记录查询结果示例（前3条）
            if (supplyRelationData && supplyRelationData.length > 0) {
              const sampleResults = supplyRelationData.slice(0, 3);
              Logger.log(`[SupplierQuotationService] 查询结果示例（前3条）: ${JSON.stringify(sampleResults.map((r: any) => ({
                供应商编码: r['供应商编码'],
                SKU编码: r['SKU编码'],
                门店仓名称: r['门店/仓名称'] || '无',
              })))}`);
            }

            // 根据维度处理供货关系数据
            if (type === '全部') {
              // 全部维度：统计每个供应商编码和SKU组合的去重门店数量
              // 通过门店/仓名称去重后统计数量
              const supplierSkuStoreCount: Record<string, Record<string, number>> = {};

              (supplyRelationData || []).forEach((row: any) => {
                const supplierCode = row['供应商编码'];
                const sku = row['SKU编码'];
                const storeName = row['门店/仓名称'];

                if (!supplierCode || !sku || !storeName) return;

                if (!supplierSkuStoreCount[supplierCode]) {
                  supplierSkuStoreCount[supplierCode] = {};
                }

                // 使用Set来去重门店名称
                if (!supplierSkuStoreCount[supplierCode][sku]) {
                  supplierSkuStoreCount[supplierCode][sku] = 0;
                }
              });

              // 对每个供应商编码和SKU组合，统计去重后的门店数量
              const supplierSkuStoreSet: Record<string, Record<string, Set<string>>> = {};
              (supplyRelationData || []).forEach((row: any) => {
                const supplierCode = row['供应商编码'];
                const sku = row['SKU编码'];
                const storeName = row['门店/仓名称'];

                if (!supplierCode || !sku || !storeName) return;

                if (!supplierSkuStoreSet[supplierCode]) {
                  supplierSkuStoreSet[supplierCode] = {};
                }

                if (!supplierSkuStoreSet[supplierCode][sku]) {
                  supplierSkuStoreSet[supplierCode][sku] = new Set<string>();
                }

                supplierSkuStoreSet[supplierCode][sku].add(storeName);
              });

              // 计算每个供应商编码和SKU组合的门店数量
              Object.keys(supplierSkuStoreSet).forEach(supplierCode => {
                Object.keys(supplierSkuStoreSet[supplierCode]).forEach(sku => {
                  supplierSkuStoreCount[supplierCode][sku] = supplierSkuStoreSet[supplierCode][sku].size;
                });
              });

              // 计算每个供应商编码的门店数量（所有SKU的门店去重后的总数）
              const supplierStoreCount: Record<string, number> = {};
              Object.keys(supplierSkuStoreSet).forEach(supplierCode => {
                const allStores = new Set<string>();
                Object.values(supplierSkuStoreSet[supplierCode]).forEach((storeSet: Set<string>) => {
                  storeSet.forEach(store => allStores.add(store));
                });
                supplierStoreCount[supplierCode] = allStores.size;
              });

              // 调试日志：记录统计结果
              Logger.log(`[SupplierQuotationService] 全部维度 - 统计到的供应商编码数量: ${Object.keys(supplierStoreCount).length}`);
              Object.keys(supplierStoreCount).forEach(supplierCode => {
                Logger.log(`[SupplierQuotationService] 供应商编码 ${supplierCode} 的门店数量: ${supplierStoreCount[supplierCode]}`);
                const skuKeys = Object.keys(supplierSkuStoreCount[supplierCode] || {});
                skuKeys.forEach(sku => {
                  Logger.log(`[SupplierQuotationService] 供应商编码 ${supplierCode}, SKU ${sku}: 门店数量=${supplierSkuStoreCount[supplierCode][sku]}`);
                });
              });

              // 将统计信息添加到返回结果中
              Object.keys(supplierStoreCount).forEach(supplierCode => {
                const storeCount = supplierStoreCount[supplierCode];
                const skuStats = supplierSkuStoreCount[supplierCode] || {};

                const finalData = {
                  relationValue: storeCount,
                  skuStoreCount: skuStats,
                };

                supplierRelationMap[supplierCode] = finalData;

                // 调试日志：记录最终返回的数据结构
                Logger.log(`[SupplierQuotationService] 全部维度 - 供应商编码 ${supplierCode} 的最终数据:`, {
                  relationValue: finalData.relationValue,
                  skuStoreCountKeys: Object.keys(finalData.skuStoreCount || {}),
                });
              });
            } else if (type === '城市') {
              // 城市维度：只查询门店/仓名称LIKE城市的记录
              // 已经在SQL层面过滤了，这里统计去重后的门店数量
              // 统计每个供应商编码和SKU在该城市门店中的去重门店数量
              const supplierSkuStoreSet: Record<string, Record<string, Set<string>>> = {};

              (supplyRelationData || []).forEach((row: any) => {
                const supplierCode = row['供应商编码'];
                const sku = row['SKU编码'];
                const storeName = row['门店/仓名称'];

                if (!supplierCode || !sku || !storeName) return;

                if (!supplierSkuStoreSet[supplierCode]) {
                  supplierSkuStoreSet[supplierCode] = {};
                }

                if (!supplierSkuStoreSet[supplierCode][sku]) {
                  supplierSkuStoreSet[supplierCode][sku] = new Set<string>();
                }

                supplierSkuStoreSet[supplierCode][sku].add(storeName);
              });

              // 计算每个供应商编码和SKU组合的门店数量
              const supplierSkuStoreCount: Record<string, Record<string, number>> = {};
              Object.keys(supplierSkuStoreSet).forEach(supplierCode => {
                supplierSkuStoreCount[supplierCode] = {};
                Object.keys(supplierSkuStoreSet[supplierCode]).forEach(sku => {
                  supplierSkuStoreCount[supplierCode][sku] = supplierSkuStoreSet[supplierCode][sku].size;
                });
              });

              // 计算每个供应商编码的门店数量（所有SKU的门店去重后的总数）
              const supplierStoreCount: Record<string, number> = {};
              Object.keys(supplierSkuStoreSet).forEach(supplierCode => {
                const allStores = new Set<string>();
                Object.values(supplierSkuStoreSet[supplierCode]).forEach((storeSet: Set<string>) => {
                  storeSet.forEach(store => allStores.add(store));
                });
                supplierStoreCount[supplierCode] = allStores.size;
              });

              Logger.log(`[SupplierQuotationService] 城市维度 - 城市: ${city}, 查询结果数量: ${(supplyRelationData || []).length}, 统计到的供应商编码数量: ${Object.keys(supplierStoreCount).length}`);

              // 调试日志：记录每个供应商编码和SKU的统计详情
              Object.keys(supplierStoreCount).forEach(supplierCode => {
                Logger.log(`[SupplierQuotationService] 城市维度 - 供应商编码 ${supplierCode} 的门店数量: ${supplierStoreCount[supplierCode]}`);
                const skuKeys = Object.keys(supplierSkuStoreCount[supplierCode] || {});
                skuKeys.forEach(sku => {
                  Logger.log(`[SupplierQuotationService] 城市维度 - 供应商编码 ${supplierCode}, SKU ${sku}: 门店数量=${supplierSkuStoreCount[supplierCode][sku]}`);
                });
              });

              // 将统计信息添加到返回结果中
              Object.keys(supplierStoreCount).forEach(supplierCode => {
                const storeCount = supplierStoreCount[supplierCode];
                const skuStats = supplierSkuStoreCount[supplierCode] || {};

                const finalData = {
                  relationValue: storeCount,
                  skuStoreCount: skuStats,
                };

                supplierRelationMap[supplierCode] = finalData;

                // 调试日志：记录最终返回的数据结构
                Logger.log(`[SupplierQuotationService] 城市维度 - 供应商编码 ${supplierCode} 的最终数据:`, {
                  relationValue: finalData.relationValue,
                  skuStoreCountKeys: Object.keys(finalData.skuStoreCount || {}),
                });
              });
            } else if (type === '仓店') {
              // 仓店维度：查询具体门店的SKU供货关系
              // 已经在SQL层面过滤了该门店的记录，这里直接处理
              // 匹配逻辑：获取供应商报价.供应商编码,匹配出的SKU和筛选的仓店参数去'商品供货关系'表匹配一致的'供应商编码'和'SKU编码'和'门店/仓名称'
              // 匹配出数据就显示是,否则显示否
              if (storeName) {
                // 查询每个SKU在该门店的供货关系状态
                const skuStoreStatus: Record<string, Record<string, { isDefault: boolean | null; hasRecord: boolean }>> = {};

                (supplyRelationData || []).forEach((row: any) => {
                  const supplierCode = row['供应商编码'];
                  const sku = row['SKU编码'];

                  if (!skuStoreStatus[supplierCode]) {
                    skuStoreStatus[supplierCode] = {};
                  }

                  // 初始化或更新状态
                  if (!skuStoreStatus[supplierCode][sku]) {
                    skuStoreStatus[supplierCode][sku] = {
                      isDefault: null,
                      hasRecord: false,
                    };
                  }

                  // 只要匹配到数据就标记为有记录（显示"是"）
                  skuStoreStatus[supplierCode][sku].hasRecord = true;
                  // 如果找到默认供货关系的记录，标记为默认
                  if (row['是否默认供货关系'] === '默认') {
                    skuStoreStatus[supplierCode][sku].isDefault = true;
                  } else {
                    skuStoreStatus[supplierCode][sku].isDefault = false;
                  }
                });

                Logger.log(`[SupplierQuotationService] 仓店维度 - 门店: ${storeName}, 查询结果数量: ${(supplyRelationData || []).length}, 统计到的供应商编码数量: ${Object.keys(skuStoreStatus).length}`);

                // 将状态信息添加到返回结果中
                Object.keys(skuStoreStatus).forEach(supplierCode => {
                  if (supplierRelationMap[supplierCode] !== undefined) {
                    const existingValue = supplierRelationMap[supplierCode];
                    if (typeof existingValue === 'object' && existingValue !== null && !Array.isArray(existingValue)) {
                      supplierRelationMap[supplierCode] = {
                        ...(existingValue as any),
                        skuStoreStatus: skuStoreStatus[supplierCode],
                      };
                    } else {
                      supplierRelationMap[supplierCode] = {
                        relationValue: existingValue,
                        skuStoreStatus: skuStoreStatus[supplierCode],
                      };
                    }
                  }
                });
              }
            }
          }
        } catch (error: any) {
          Logger.error('[SupplierQuotationService] 查询商品供货关系失败:', error);
          // 不抛出错误，避免影响主流程
        }
      } else if (type === '全部' || type === '城市') {
        // 对于全部维度和城市维度，如果没有SKU映射，将供应商编码的门店数量设置为0
        // 因为无法查询商品供货关系表
        Logger.log(`[SupplierQuotationService] ${type}维度没有SKU映射，将供应商编码的门店数量设置为0`);
        uniqueSupplierCodes.forEach(supplierCode => {
          if (!supplierRelationMap[supplierCode]) {
            supplierRelationMap[supplierCode] = {
              relationValue: 0,
              skuStoreCount: {},
            };
          } else {
            // 如果已经有值，确保是对象格式
            const existingValue = supplierRelationMap[supplierCode];
            if (typeof existingValue !== 'object' || existingValue === null || Array.isArray(existingValue)) {
              supplierRelationMap[supplierCode] = {
                relationValue: 0,
                skuStoreCount: {},
              };
            }
          }
        });
      }

      return supplierRelationMap;
    } catch (error: any) {
      Logger.error('[SupplierQuotationService] 查询供应商-门店关系失败:', error);
      throw new Error(`查询供应商-门店关系失败: ${error?.message || '未知错误'}`);
    } finally {
      await shangpingConnection.end();
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

  // 批量根据供应商编码和供应商商品编码获取SKU绑定信息
  async getSkuBindingsBatch(
    items: Array<{ supplierCode: string; supplierProductCode: string }>,
  ): Promise<Record<string, string>> {
    const connection = await this.getConnection();

    try {
      if (!items || items.length === 0) {
        return {};
      }

      // 构建查询条件
      const conditions: string[] = [];
      const params: any[] = [];

      items.forEach((item) => {
        conditions.push('(供应商编码 = ? AND 供应商商品编码 = ?)');
        params.push(item.supplierCode, item.supplierProductCode);
      });

      const query = `
        SELECT 
          供应商编码,
          供应商商品编码,
          SKU
        FROM \`供应商编码手动绑定sku\`
        WHERE (${conditions.join(' OR ')})
          AND SKU IS NOT NULL
      `;

      const [data]: any = await connection.execute(query, params);

      // 构建映射：key为"供应商编码_供应商商品编码"，value为SKU
      const result: Record<string, string> = {};
      data.forEach((row: any) => {
        const key = `${row['供应商编码']}_${row['供应商商品编码']}`;
        if (row['SKU']) {
          result[key] = row['SKU'];
        }
      });

      return result;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 批量查询SKU绑定失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 更新SKU绑定信息
  // 使用供应商编码和最小销售规格UPC商品条码来查找和更新记录
  async updateSkuBinding(
    supplierCode: string,
    upcCode: string,
    sku: string,
  ): Promise<boolean> {
    const connection = await this.getConnection();

    try {
      // 先检查是否存在（使用供应商编码和最小销售规格UPC商品条码）
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM \`供应商编码手动绑定sku\`
        WHERE 供应商编码 = ? AND 供应商商品编码 = ?
      `;
      const [checkResult]: any = await connection.execute(checkQuery, [supplierCode, upcCode]);
      const exists = checkResult[0].count > 0;

      // 如果SKU为空字符串，将SKU字段设置为NULL（不删除记录）
      if (sku === '' || sku === null || sku === undefined) {
        if (exists) {
          // 更新：将SKU字段设置为NULL
          const updateQuery = `
            UPDATE \`供应商编码手动绑定sku\`
            SET SKU = NULL
            WHERE 供应商编码 = ? AND 供应商商品编码 = ?
          `;
          await connection.execute(updateQuery, [supplierCode, upcCode]);
        } else {
          // 如果不存在，插入一条记录，SKU字段为NULL
          const insertQuery = `
            INSERT INTO \`供应商编码手动绑定sku\` (供应商编码, 供应商商品编码, SKU)
            VALUES (?, ?, NULL)
          `;
          await connection.execute(insertQuery, [supplierCode, upcCode]);
        }
      } else {
        if (exists) {
          // 更新
          const updateQuery = `
            UPDATE \`供应商编码手动绑定sku\`
            SET SKU = ?
            WHERE 供应商编码 = ? AND 供应商商品编码 = ?
          `;
          await connection.execute(updateQuery, [sku, supplierCode, upcCode]);
        } else {
          // 插入
          const insertQuery = `
            INSERT INTO \`供应商编码手动绑定sku\` (供应商编码, 供应商商品编码, SKU)
            VALUES (?, ?, ?)
          `;
          await connection.execute(insertQuery, [supplierCode, upcCode, sku]);
        }
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

  // 根据供应商编码获取采购下单渠道
  async getSupplierOrderChannel(supplierCode: string): Promise<string | null> {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT \`采购下单渠道\`
        FROM \`供应商属性信息\`
        WHERE \`供应商编码\` = ?
        LIMIT 1
      `;

      const [result]: any = await connection.execute(query, [supplierCode]);

      if (result.length === 0) {
        return null;
      }

      return result[0]['采购下单渠道'] || null;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 查询采购下单渠道失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 根据SKU编码获取商品供货关系（按供应商编码去重）
  async getProductSupplyRelations(sku: string): Promise<any[]> {
    const connection = await this.getShangpingConnection();

    try {
      Logger.log(`[SupplierQuotationService] 开始查询商品供货关系，SKU: ${sku}`);

      const query = `
        SELECT DISTINCT
          \`SPU编码\`,
          \`商品名称\`,
          \`SKU编码\`,
          \`采购规格\`,
          \`基础单位\`,
          \`供货关系编码\`,
          \`采购单位\`,
          \`转换比例\`,
          \`供应商编码\`,
          \`供应商名称\`,
          \`采购下单渠道\`,
          \`渠道店铺\`,
          \`供应商到货天数\`,
          \`最小起订量\`,
          \`是否默认供货关系\`,
          \`采购价（元）\`,
          \`结算方式\`,
          \`付款方式\`,
          \`1688商品offerid\`,
          \`供应商商品 编码\`,
          \`下单比例-供应商商品\`,
          \`下单比例-牵牛花商品\`,
          \`供应商商品 名称\`,
          \`供应商商品 规格\`,
          \`供应商商品 备注\`,
          \`供应商商品 链接\`,
          \`1688下单方式\`,
          \`数据更新时间\`
        FROM \`商品供货关系\`
        WHERE \`SKU编码\` = ?
        ORDER BY \`供应商编码\`
      `;

      Logger.log(`[SupplierQuotationService] 执行SQL查询，SKU: ${sku}`);
      const [result]: any = await connection.execute(query, [sku]);

      Logger.log(`[SupplierQuotationService] 查询结果数量: ${result?.length || 0}`);
      if (result && result.length > 0) {
        Logger.log(`[SupplierQuotationService] 查询结果示例（第一条）:`, {
          SKU编码: result[0]['SKU编码'],
          供应商编码: result[0]['供应商编码'],
          供应商名称: result[0]['供应商名称'],
        });
      } else {
        Logger.warn(`[SupplierQuotationService] 未找到SKU ${sku} 的商品供货关系数据`);
      }

      return result || [];
    } catch (error) {
      Logger.error(`[SupplierQuotationService] 查询商品供货关系失败，SKU: ${sku}`, error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 根据供应商编码和SKU查询供应商商品供应信息的备注
  async getSupplierProductRemark(
    supplierCode: string,
    sku: string,
  ): Promise<string | null> {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT \`供应商SKU备注\`
        FROM \`供应商商品供应信息\`
        WHERE \`供应商编码\` = ? AND \`SKU\` = ?
        LIMIT 1
      `;

      const [result]: any = await connection.execute(query, [supplierCode, sku]);

      if (result && result.length > 0) {
        return result[0]['供应商SKU备注'] || null;
      }

      return null;
    } catch (error) {
      Logger.error(
        `[SupplierQuotationService] 查询供应商商品供应信息备注失败，供应商编码: ${supplierCode}, SKU: ${sku}`,
        error,
      );
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 批量查询供应商商品供应信息的备注
  async getSupplierProductRemarks(
    items: Array<{ supplierCode: string; sku: string }>,
  ): Promise<Record<string, string>> {
    const connection = await this.getConnection();

    try {
      if (!items || items.length === 0) {
        return {};
      }

      // 构建查询条件
      const conditions: string[] = [];
      const params: any[] = [];

      items.forEach((item) => {
        conditions.push('(\`供应商编码\` = ? AND \`SKU\` = ?)');
        params.push(item.supplierCode, item.sku);
      });

      const query = `
        SELECT \`供应商编码\`, \`SKU\`, \`供应商SKU备注\`
        FROM \`供应商商品供应信息\`
        WHERE ${conditions.join(' OR ')}
      `;

      const [result]: any = await connection.execute(query, params);

      const remarks: Record<string, string> = {};
      if (result && result.length > 0) {
        result.forEach((row: any) => {
          const key = `${row['供应商编码']}_${row['SKU']}`;
          remarks[key] = row['供应商SKU备注'] || '';
        });
      }

      return remarks;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 批量查询供应商商品供应信息备注失败', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 保存或更新供应商商品供应信息的备注（使用REPLACE INTO）
  async saveSupplierProductRemark(
    supplierCode: string,
    sku: string,
    remark: string,
  ): Promise<boolean> {
    const connection = await this.getConnection();

    try {
      // 使用REPLACE INTO，如果记录存在则更新，不存在则插入
      const query = `
        REPLACE INTO \`供应商商品供应信息\`
        (\`供应商编码\`, \`SKU\`, \`供应商SKU备注\`)
        VALUES (?, ?, ?)
      `;

      await connection.execute(query, [supplierCode, sku, remark || '']);

      Logger.log(
        `[SupplierQuotationService] 保存供应商商品供应信息备注成功，供应商编码: ${supplierCode}, SKU: ${sku}`,
      );

      return true;
    } catch (error) {
      Logger.error(
        `[SupplierQuotationService] 保存供应商商品供应信息备注失败，供应商编码: ${supplierCode}, SKU: ${sku}`,
        error,
      );
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 批量查询内部sku备注
  // 根据SKU从sm_shangping.内部sku备注表中查询备注
  async getInternalSkuRemarks(
    skus: string[],
  ): Promise<Record<string, string>> {
    const shangpingConnection = await this.getShangpingConnection();

    try {
      if (!skus || skus.length === 0) {
        return {};
      }

      // 过滤掉空值
      const validSkus = skus.filter(sku => sku && sku.trim() !== '');
      if (validSkus.length === 0) {
        return {};
      }

      // 构建查询条件
      const placeholders = validSkus.map(() => '?').join(',');
      const query = `
        SELECT \`SKU\`, \`备注\`
        FROM \`内部sku备注\`
        WHERE \`SKU\` IN (${placeholders})
      `;

      const [result]: any = await shangpingConnection.execute(query, validSkus);

      const remarks: Record<string, string> = {};
      if (result && result.length > 0) {
        result.forEach((row: any) => {
          const sku = row['SKU'];
          if (sku) {
            remarks[sku] = row['备注'] || '';
          }
        });
      }

      return remarks;
    } catch (error) {
      Logger.error('[SupplierQuotationService] 批量查询内部sku备注失败', error);
      throw error;
    } finally {
      await shangpingConnection.end();
    }
  }

  // 保存或更新内部sku备注（使用REPLACE INTO）
  async saveInternalSkuRemark(
    sku: string,
    remark: string,
  ): Promise<boolean> {
    const shangpingConnection = await this.getShangpingConnection();

    try {
      // 使用REPLACE INTO，如果记录存在则更新，不存在则插入
      const query = `
        REPLACE INTO \`内部sku备注\`
        (\`SKU\`, \`备注\`)
        VALUES (?, ?)
      `;

      await shangpingConnection.execute(query, [sku, remark || '']);

      Logger.log(
        `[SupplierQuotationService] 保存内部sku备注成功，SKU: ${sku}`,
      );

      return true;
    } catch (error) {
      Logger.error(
        `[SupplierQuotationService] 保存内部sku备注失败，SKU: ${sku}`,
        error,
      );
      throw error;
    } finally {
      await shangpingConnection.end();
    }
  }

  // 批量创建供应商报价
  async batchCreateSupplierQuotations(
    items: Array<{
      序号?: number;
      供应商编码: string;
      商品名称?: string;
      商品规格?: string;
      最小销售单位?: string;
      商品型号?: string;
      供应商商品编码: string;
      最小销售规格UPC商品条码?: string;
      中包或整件销售规格条码?: string;
      供货价格?: number;
      供应商商品备注?: string;
    }>,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const connection = await this.getConnection();

    try {
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const item of items) {
        try {
          // 验证必填字段
          if (!item.供应商编码 || !item.供应商商品编码) {
            failed++;
            errors.push(`供应商编码和供应商商品编码为必填项`);
            continue;
          }

          // 插入数据
          const insertQuery = `
            INSERT INTO \`供应商报价\` (
              \`序号\`,
              \`供应商编码\`,
              \`商品名称\`,
              \`商品规格\`,
              \`最小销售单位\`,
              \`商品型号\`,
              \`供应商商品编码\`,
              \`最小销售规格UPC商品条码\`,
              \`中包或整件销售规格条码\`,
              \`供货价格\`,
              \`供应商商品备注\`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          await connection.execute(insertQuery, [
            item.序号 || null,
            item.供应商编码,
            item.商品名称 || null,
            item.商品规格 || null,
            item.最小销售单位 || null,
            item.商品型号 || null,
            item.供应商商品编码,
            item.最小销售规格UPC商品条码 || null,
            item.中包或整件销售规格条码 || null,
            item.供货价格 || null,
            item.供应商商品备注 || null,
          ]);

          success++;
        } catch (error: any) {
          failed++;
          let errorMessage = error?.message || '未知错误';
          // 处理重复键错误
          if (errorMessage.includes("for key 'PRIMARY'")) {
            errorMessage = errorMessage.replace(/for key 'PRIMARY'/g, '已存在');
          }
          // 清理其他可能包含'for key'的错误信息
          errorMessage = errorMessage.replace(/for key '[^']*'/g, '已存在');
          errors.push(
            `供应商编码: ${item.供应商编码}, 供应商商品编码: ${item.供应商商品编码} - ${errorMessage}`,
          );
          Logger.error(
            `[SupplierQuotationService] 批量创建供应商报价失败:`,
            error,
          );
        }
      }

      return { success, failed, errors };
    } catch (error) {
      Logger.error(
        '[SupplierQuotationService] 批量创建供应商报价失败:',
        error,
      );
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 根据SKU搜索供应商报价（新逻辑）
  // 1. 先搜索供应商编码手动绑定sku表的SKU字段
  // 2. 如果没找到，搜索商品主档销售规格表的SKU编码，然后用商品条码搜索
  async searchSupplierQuotationBySku(sku: string): Promise<{
    data: SupplierQuotation[];
    matchedSku?: string; // 匹配到的SKU（用于显示在右栏）
  }> {
    const connection = await this.getConnection();

    try {
      // 第一步：搜索供应商编码手动绑定sku表的SKU字段
      const bindingQuery = `
        SELECT 
          供应商编码,
          供应商商品编码,
          SKU
        FROM \`供应商编码手动绑定sku\`
        WHERE SKU = ?
        LIMIT 100
      `;

      const [bindingData]: any = await connection.execute(bindingQuery, [sku]);

      Logger.log(`[SupplierQuotationService] 查询供应商编码手动绑定sku表，SKU: ${sku}, 查询结果数量: ${bindingData ? bindingData.length : 0}`);

      // 收集从绑定表查询到的供应商报价数据
      let bindingQuotationData: any[] = [];
      let hasBindingData = false;

      if (bindingData && bindingData.length > 0) {
        hasBindingData = true;
        Logger.log(`[SupplierQuotationService] 在供应商编码手动绑定sku表中找到 ${bindingData.length} 条记录`);
        // 找到绑定记录，使用供应商编码和最小销售规格UPC商品条码查询供应商报价
        // 查询条件：供应商报价.供应商编码 = 供应商编码手动绑定sku.供应商编码 
        // AND 供应商报价.最小销售规格UPC商品条码 = 供应商编码手动绑定sku.供应商商品编码
        const supplierCodes = [...new Set(bindingData.map((row: any) => row['供应商编码']))];
        const conditions: string[] = [];
        const params: any[] = [];

        for (const row of bindingData) {
          conditions.push('(q.供应商编码 = ? AND q.最小销售规格UPC商品条码 = ?)');
          params.push(row['供应商编码'], row['供应商商品编码']);
        }

        const quotationQuery = `
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
          WHERE (${conditions.join(' OR ')})
          ORDER BY q.\`供应商编码\` ASC, q.序号 ASC
        `;

        const [quotationDataFromBinding]: any = await connection.execute(
          quotationQuery,
          params,
        );

        bindingQuotationData = quotationDataFromBinding || [];
        Logger.log(`[SupplierQuotationService] 从供应商编码手动绑定sku匹配到的供应商报价数量: ${bindingQuotationData.length}`);
        if (bindingQuotationData.length === 0 && bindingData.length > 0) {
          Logger.warn(`[SupplierQuotationService] 警告: 在供应商编码手动绑定sku表中找到 ${bindingData.length} 条记录，但在供应商报价表中未找到匹配的数据`);
          Logger.log(`[SupplierQuotationService] 绑定表查询到的数据示例:`, bindingData.slice(0, 3).map((row: any) => ({
            供应商编码: row['供应商编码'],
            供应商商品编码: row['供应商商品编码'],
            SKU: row['SKU']
          })));
          Logger.log(`[SupplierQuotationService] 使用的查询条件: 供应商编码 = ? AND 最小销售规格UPC商品条码 = ?`);
        }
      }

      // 第二步：无论是否在绑定表找到数据，都去搜索商品主档销售规格表
      const shangpingConnection = await this.getShangpingConnection();
      let masterQuotationData: any[] = [];

      try {
        const skuQuery = `
          SELECT 
            SKU编码,
            商品条码
          FROM \`商品主档销售规格\`
          WHERE SKU编码 = ?
          LIMIT 1
        `;

        const [skuData]: any = await shangpingConnection.execute(skuQuery, [
          sku,
        ]);

        if (skuData && skuData.length > 0) {
          const productBarcode = skuData[0]['商品条码'];
          if (productBarcode) {
            // 商品条码可能有多个值，用逗号或中文逗号分隔，需要拆开逐个搜索
            const barcodes = String(productBarcode)
              .split(/[,，]/)
              .map((b) => b.trim())
              .filter((b) => b.length > 0);

            if (barcodes.length > 0) {
              // 构建查询条件：使用LIKE匹配，因为商品条码可能包含多个值
              const conditions: string[] = [];
              const params: any[] = [];

              for (const barcode of barcodes) {
                // 使用LIKE匹配，因为供应商报价的最小销售规格UPC商品条码可能包含这个条码
                conditions.push('最小销售规格UPC商品条码 LIKE ?');
                params.push(`%${barcode}%`);
              }

              const quotationQuery = `
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
                WHERE (${conditions.join(' OR ')})
                ORDER BY q.\`供应商编码\` ASC, q.序号 ASC
              `;

              const [quotationDataFromMaster]: any = await connection.execute(
                quotationQuery,
                params,
              );

              masterQuotationData = quotationDataFromMaster || [];
              Logger.log(`[SupplierQuotationService] 从商品主档销售规格匹配到的供应商报价数量: ${masterQuotationData.length}`);
            }
          }
        }
      } catch (error) {
        Logger.error(
          '[SupplierQuotationService] 查询商品主档销售规格失败:',
          error,
        );
        // 如果主档查询失败，不影响绑定表的结果
      } finally {
        await shangpingConnection.end();
      }

      // 合并两个查询结果，去重（根据供应商编码和供应商商品编码去重）
      const allQuotationData = [...bindingQuotationData];
      const existingKeys = new Set<string>();

      // 添加绑定表的数据的key
      bindingQuotationData.forEach((item: any) => {
        const key = `${item.供应商编码}_${item.供应商商品编码}`;
        existingKeys.add(key);
      });

      // 添加主档数据，排除重复项
      if (masterQuotationData && masterQuotationData.length > 0) {
        masterQuotationData.forEach((item: any) => {
          const key = `${item.供应商编码}_${item.供应商商品编码}`;
          if (!existingKeys.has(key)) {
            allQuotationData.push(item);
            existingKeys.add(key);
          }
        });
      }

      // 对合并后的数据进行排序
      allQuotationData.sort((a, b) => {
        if (a.供应商编码 !== b.供应商编码) {
          return (a.供应商编码 || '').localeCompare(b.供应商编码 || '');
        }
        return (a.序号 || 0) - (b.序号 || 0);
      });

      Logger.log(`[SupplierQuotationService] 合并后的供应商报价总数: ${allQuotationData.length} (绑定表: ${bindingQuotationData.length}, 主档表: ${masterQuotationData.length})`);

      return {
        data: allQuotationData,
        matchedSku: sku, // 显示搜索的SKU
      };
    } catch (error) {
      Logger.error(
        '[SupplierQuotationService] 根据SKU搜索供应商报价失败:',
        error,
      );
      throw error;
    } finally {
      await connection.end();
    }
  }
}

