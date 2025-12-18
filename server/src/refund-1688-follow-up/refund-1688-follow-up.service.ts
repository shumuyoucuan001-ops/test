import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';
import axios from 'axios';

export interface Refund1688FollowUp {
  id: number;
  收货人姓名?: string;
  订单编号?: string;
  买家会员名?: string;
  订单状态?: string;
  订单详情页?: string;
  http请求url?: string;
  请求获取订单状态?: string;
  请求获取退款状态?: string;
  进度追踪?: string;
  采购单号?: string;
  跟进情况备注?: string;
  出库单号回库?: string;
  差异单出库单详情?: string;
  退款详情?: string;
  跟进相关附件?: string;
  物流单号?: string;
  发货截图?: string;
  跟进人?: string;
}

@Injectable()
export class Refund1688FollowUpService {
  private async getChaigouConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
      user: process.env.DB_USER || 'xitongquanju',
      password: process.env.DB_PASSWORD || 'b4FFS6kVGKV4jV',
      database: 'sm_chaigou',
      port: parseInt(process.env.DB_PORT || '3306'),
    });
  }

  // 获取所有退款跟进记录(包含自动匹配采购单号)
  async findAll(): Promise<Refund1688FollowUp[]> {
    const connection = await this.getChaigouConnection();
    try {
      // 使用LEFT JOIN自动关联采购单号
      const [rows] = await connection.execute(
        `SELECT 
          r.id,
          r.\`收货人姓名\`,
          r.\`订单编号\`,
          r.\`买家会员名\`,
          r.\`订单状态\`,
          r.\`订单详情页\`,
          r.\`http请求(url)\` as http请求url,
          r.\`请求获取订单状态\`,
          r.\`请求获取退款状态\`,
          r.\`进度追踪\`,
          COALESCE(r.\`采购单号\`, p.\`采购单号\`) as 采购单号,
          r.\`跟进情况/备注\` as 跟进情况备注,
          r.\`出库单号（回库）\` as 出库单号回库,
          r.\`差异单/出库单详情\` as 差异单出库单详情,
          r.\`退款详情\`,
          r.\`跟进相关附件\`,
          r.\`物流单号\`,
          r.\`发货截图\`,
          r.\`跟进人\`
        FROM \`1688退款售后\` r
        LEFT JOIN \`采购单信息\` p 
          ON TRIM(r.\`订单编号\`) = TRIM(p.\`渠道订单号\`)
        ORDER BY r.id DESC`,
      );
      
      const results = rows as Refund1688FollowUp[];
      
      // 对于有新匹配到采购单号但数据库中为空的记录,更新到数据库
      for (const row of results) {
        if (row.采购单号 && row.订单编号) {
          // 检查数据库中是否为空,如果为空则更新
          const [checkRows] = await connection.execute(
            `SELECT \`采购单号\` FROM \`1688退款售后\` WHERE id = ?`,
            [row.id],
          );
          const dbRow = (checkRows as any[])[0];
          if (!dbRow['采购单号'] || dbRow['采购单号'].trim() === '') {
            await connection.execute(
              `UPDATE \`1688退款售后\` SET \`采购单号\` = ? WHERE id = ?`,
              [row.采购单号, row.id],
            );
            Logger.log(`[Refund1688FollowUpService] 自动匹配采购单号: ID=${row.id}, 采购单号=${row.采购单号}`);
          }
        }
      }
      
      return results;
    } catch (error) {
      Logger.error('[Refund1688FollowUpService] 查询失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 更新退款跟进记录
  async update(id: number, data: Partial<Refund1688FollowUp>): Promise<void> {
    const connection = await this.getChaigouConnection();
    try {
      // 构建更新语句
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      // 字段映射（TypeScript属性名 -> 数据库字段名）
      const fieldMapping: Record<string, string> = {
        '收货人姓名': '收货人姓名',
        '买家会员名': '买家会员名',
        'http请求url': 'http请求(url)',
        '进度追踪': '进度追踪',
        '跟进情况备注': '跟进情况/备注',
        '出库单号回库': '出库单号（回库）',
        '差异单出库单详情': '差异单/出库单详情',
        '退款详情': '退款详情',
        '跟进相关附件': '跟进相关附件',
        '物流单号': '物流单号',
        '发货截图': '发货截图',
        '跟进人': '跟进人',
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (key in data) {
          updateFields.push(`\`${dbField}\` = ?`);
          updateValues.push(data[key as keyof Refund1688FollowUp]);
        }
      }

      if (updateFields.length === 0) {
        Logger.warn('[Refund1688FollowUpService] 没有可更新的字段');
        return;
      }

      updateValues.push(id);

      const sql = `UPDATE \`1688退款售后\` SET ${updateFields.join(', ')} WHERE id = ?`;
      
      Logger.log('[Refund1688FollowUpService] 执行更新SQL:', sql);
      Logger.log('[Refund1688FollowUpService] 更新参数:', updateValues);

      await connection.execute(sql, updateValues);
      
      Logger.log(`[Refund1688FollowUpService] 更新成功: ID=${id}`);
    } catch (error) {
      Logger.error('[Refund1688FollowUpService] 更新失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 根据订单编号获取订单状态
  async getOrderStatus(id: number): Promise<{ status: string }> {
    const connection = await this.getChaigouConnection();
    try {
      // 先获取记录的http请求url
      const [rows] = await connection.execute(
        `SELECT \`http请求(url)\` as http请求url FROM \`1688退款售后\` WHERE id = ?`,
        [id],
      );

      const record = (rows as any[])[0];
      if (!record || !record.http请求url) {
        throw new Error('未找到HTTP请求URL');
      }

      // 发起HTTP请求获取订单状态
      Logger.log(`[Refund1688FollowUpService] 请求订单状态: ${record.http请求url}`);
      
      const response = await axios.get(record.http请求url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const status = response.data?.status || '';
      
      // 更新订单状态到数据库
      await connection.execute(
        `UPDATE \`1688退款售后\` SET \`订单状态\` = ?, \`请求获取订单状态\` = ? WHERE id = ?`,
        [status, new Date().toISOString(), id],
      );

      Logger.log(`[Refund1688FollowUpService] 订单状态已更新: ID=${id}, status=${status}`);

      return { status };
    } catch (error: any) {
      Logger.error('[Refund1688FollowUpService] 获取订单状态失败:', error?.message || error);
      throw new Error(error?.message || '获取订单状态失败');
    } finally {
      await connection.end();
    }
  }

  // 根据订单编号获取退款状态
  async getRefundStatus(id: number): Promise<{ refundStatus: string }> {
    const connection = await this.getChaigouConnection();
    try {
      // 先获取记录的http请求url
      const [rows] = await connection.execute(
        `SELECT \`http请求(url)\` as http请求url FROM \`1688退款售后\` WHERE id = ?`,
        [id],
      );

      const record = (rows as any[])[0];
      if (!record || !record.http请求url) {
        throw new Error('未找到HTTP请求URL');
      }

      // 发起HTTP请求获取退款状态
      Logger.log(`[Refund1688FollowUpService] 请求退款状态: ${record.http请求url}`);
      
      const response = await axios.get(record.http请求url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      // 尝试获取 refundStatus 或 refundStatusForAs
      const refundStatus = response.data?.refundStatus || response.data?.refundStatusForAs || '';
      
      // 更新退款状态到数据库
      await connection.execute(
        `UPDATE \`1688退款售后\` SET \`请求获取退款状态\` = ? WHERE id = ?`,
        [refundStatus || '无', id],
      );

      Logger.log(`[Refund1688FollowUpService] 退款状态已更新: ID=${id}, refundStatus=${refundStatus}`);

      return { refundStatus };
    } catch (error: any) {
      Logger.error('[Refund1688FollowUpService] 获取退款状态失败:', error?.message || error);
      throw new Error(error?.message || '获取退款状态失败');
    } finally {
      await connection.end();
    }
  }

  // 根据订单编号匹配采购单号
  async matchPurchaseOrderNo(orderNo: string): Promise<string | null> {
    const connection = await this.getChaigouConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT \`采购单号\` 
        FROM \`采购单信息\` 
        WHERE TRIM(\`渠道订单号\`) = TRIM(?)
        LIMIT 1`,
        [orderNo],
      );

      const result = (rows as any[])[0];
      return result ? result['采购单号'] : null;
    } catch (error) {
      Logger.error('[Refund1688FollowUpService] 匹配采购单号失败:', error);
      return null;
    } finally {
      await connection.end();
    }
  }

  // 自动匹配并更新采购单号
  async autoMatchPurchaseOrderNos(): Promise<number> {
    const connection = await this.getChaigouConnection();
    try {
      // 查询所有没有采购单号的记录
      const [rows] = await connection.execute(
        `SELECT id, \`订单编号\` 
        FROM \`1688退款售后\` 
        WHERE \`采购单号\` IS NULL OR \`采购单号\` = ''`,
      );

      const records = rows as any[];
      let updateCount = 0;

      for (const record of records) {
        const purchaseOrderNo = await this.matchPurchaseOrderNo(record['订单编号']);
        if (purchaseOrderNo) {
          await connection.execute(
            `UPDATE \`1688退款售后\` SET \`采购单号\` = ? WHERE id = ?`,
            [purchaseOrderNo, record.id],
          );
          updateCount++;
          Logger.log(`[Refund1688FollowUpService] 已匹配采购单号: ID=${record.id}, 采购单号=${purchaseOrderNo}`);
        }
      }

      Logger.log(`[Refund1688FollowUpService] 自动匹配完成，共更新 ${updateCount} 条记录`);
      return updateCount;
    } catch (error) {
      Logger.error('[Refund1688FollowUpService] 自动匹配采购单号失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }
}

