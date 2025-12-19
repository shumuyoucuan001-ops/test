import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';

export interface Refund1688FollowUp {
  订单编号: string; // 主键
  收货人姓名?: string;
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

  // 获取所有退款跟进记录(包含自动匹配采购单号和分页)
  async findAll(
    page: number = 1,
    limit: number = 20,
    filters?: {
      收货人姓名?: string;
      订单编号?: string;
      订单状态?: string;
      买家会员名?: string;
      采购单号?: string;
      物流单号?: string;
      进度追踪?: string;
      keyword?: string; // 关键词搜索
    }
  ): Promise<{ data: Refund1688FollowUp[]; total: number }> {
    const connection = await this.getChaigouConnection();
    try {
      Logger.log('[Refund1688FollowUpService] 开始查询，分页参数:', { page, limit, filters });

      const offset = (page - 1) * limit;

      // 构建搜索条件
      const clauses: string[] = [];
      const params: any[] = [];
      const buildLike = (v?: string) => `%${(v || '').trim()}%`;

      // 关键词搜索（OR across all columns）
      if (filters?.keyword?.trim()) {
        const like = buildLike(filters.keyword);
        clauses.push(`(
          r.\`收货人姓名\` LIKE ? OR
          r.\`订单编号\` LIKE ? OR
          r.\`买家会员名\` LIKE ? OR
          COALESCE(r.\`采购单号\`, p.\`采购单号\`) LIKE ? OR
          r.\`物流单号\` LIKE ?
        )`);
        params.push(like, like, like, like, like);
      }

      // 按字段精确搜索（AND）
      if (filters?.收货人姓名?.trim()) {
        clauses.push(`r.\`收货人姓名\` LIKE ?`);
        params.push(buildLike(filters.收货人姓名));
      }
      if (filters?.订单编号?.trim()) {
        clauses.push(`r.\`订单编号\` LIKE ?`);
        params.push(buildLike(filters.订单编号));
      }
      if (filters?.订单状态?.trim()) {
        clauses.push(`r.\`订单状态\` LIKE ?`);
        params.push(buildLike(filters.订单状态));
      }
      if (filters?.买家会员名?.trim()) {
        clauses.push(`r.\`买家会员名\` LIKE ?`);
        params.push(buildLike(filters.买家会员名));
      }
      if (filters?.采购单号?.trim()) {
        clauses.push(`COALESCE(r.\`采购单号\`, p.\`采购单号\`) LIKE ?`);
        params.push(buildLike(filters.采购单号));
      }
      if (filters?.物流单号?.trim()) {
        clauses.push(`r.\`物流单号\` LIKE ?`);
        params.push(buildLike(filters.物流单号));
      }
      if (filters?.进度追踪?.trim()) {
        clauses.push(`r.\`进度追踪\` = ?`);
        params.push(filters.进度追踪);
      }

      // 添加固定条件：1688平台且最近3个月
      const fixedConditions = `p.\`采购下单渠道\` = '1688采购平台' AND p.\`创建时间\` >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`;

      const searchCondition = clauses.length > 0
        ? `WHERE ${fixedConditions} AND (${clauses.join(' AND ')})`
        : `WHERE ${fixedConditions}`;

      // 获取总数
      const countSql = `SELECT COUNT(*) as total 
        FROM \`sm_chaigou\`.\`1688退款售后\` r
        LEFT JOIN \`sm_chaigou\`.\`采购单信息\` p 
          ON TRIM(r.\`订单编号\`) = TRIM(p.\`渠道订单号\`)
        ${searchCondition}`;

      Logger.log('[Refund1688FollowUpService] 执行计数查询...');
      const [countRows] = await connection.execute(countSql, params);
      const total = Number((countRows as any[])[0]?.total || 0);
      Logger.log(`[Refund1688FollowUpService] 总记录数: ${total}`);

      // 获取分页数据（JOIN sys_users获取跟进人的display_name）
      const dataSql = `SELECT 
          r.\`订单编号\`,
          r.\`收货人姓名\`,
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
          COALESCE(u.\`display_name\`, r.\`跟进人\`) as 跟进人
        FROM \`sm_chaigou\`.\`1688退款售后\` r
        LEFT JOIN \`sm_chaigou\`.\`采购单信息\` p 
          ON TRIM(r.\`订单编号\`) = TRIM(p.\`渠道订单号\`)
        LEFT JOIN \`sm_xitongkaifa\`.\`sys_users\` u
          ON r.\`跟进人\` REGEXP '^[0-9]+$' AND CAST(r.\`跟进人\` AS UNSIGNED) = u.\`id\`
        ${searchCondition}
        ORDER BY r.\`订单编号\` DESC
        LIMIT ${limit} OFFSET ${offset}`;

      Logger.log('[Refund1688FollowUpService] 执行数据查询...');
      const [rows] = await connection.execute(dataSql, params);
      const data = rows as Refund1688FollowUp[];

      Logger.log(`[Refund1688FollowUpService] 查询到 ${data.length} 条记录（第 ${page} 页）`);

      // 同步更新订单状态和退款状态（等待更新完成再返回）
      const updatedData = await this.autoUpdateOrderAndRefundStatus(data);

      return { data: updatedData, total };
    } catch (error) {
      Logger.error('[Refund1688FollowUpService] 查询失败，详细错误:', error);
      Logger.error('[Refund1688FollowUpService] 错误消息:', (error as any)?.message);
      Logger.error('[Refund1688FollowUpService] 错误代码:', (error as any)?.code);
      Logger.error('[Refund1688FollowUpService] SQL状态:', (error as any)?.sqlState);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 更新退款跟进记录
  async update(orderNo: string, data: Partial<Refund1688FollowUp>, userId?: number): Promise<void> {
    const connection = await this.getChaigouConnection();
    try {
      // 如果提供了userId，自动获取跟进人的display_name
      let followUpPerson: string | undefined;
      if (userId) {
        try {
          const [userRows]: any = await connection.execute(
            `SELECT \`display_name\` FROM \`sm_xitongkaifa\`.\`sys_users\` WHERE \`id\` = ?`,
            [userId],
          );
          if (userRows.length > 0 && userRows[0]['display_name']) {
            followUpPerson = userRows[0]['display_name'];
            Logger.log(`[Refund1688FollowUpService] 自动获取跟进人: userId=${userId}, display_name=${followUpPerson}`);
          }
        } catch (error) {
          Logger.warn(`[Refund1688FollowUpService] 获取用户display_name失败: ${error}`);
        }
      }

      // 构建更新语句
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      // 字段映射（TypeScript属性名 -> 数据库字段名）
      // 注意：跟进人字段不在映射中，因为它是自动填充的
      const fieldMapping: Record<string, string> = {
        '采购单号': '采购单号',
        '进度追踪': '进度追踪',
        '跟进情况备注': '跟进情况/备注',
        '出库单号回库': '出库单号（回库）',
        '差异单出库单详情': '差异单/出库单详情',
        '退款详情': '退款详情',
        '物流单号': '物流单号',
        '发货截图': '发货截图',
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (key in data) {
          updateFields.push(`\`${dbField}\` = ?`);
          updateValues.push(data[key as keyof Refund1688FollowUp]);
        }
      }

      // 自动填充跟进人（如果获取到了display_name）
      if (followUpPerson) {
        updateFields.push(`\`跟进人\` = ?`);
        updateValues.push(followUpPerson);
      }

      if (updateFields.length === 0) {
        Logger.warn('[Refund1688FollowUpService] 没有可更新的字段');
        return;
      }

      updateValues.push(orderNo);

      const sql = `UPDATE \`sm_chaigou\`.\`1688退款售后\` SET ${updateFields.join(', ')} WHERE \`订单编号\` = ?`;

      Logger.log('[Refund1688FollowUpService] 执行更新SQL:', sql);
      Logger.log('[Refund1688FollowUpService] 更新参数:', updateValues);

      await connection.execute(sql, updateValues);

      Logger.log(`[Refund1688FollowUpService] 更新成功: 订单编号=${orderNo}`);
    } catch (error) {
      Logger.error('[Refund1688FollowUpService] 更新失败:', error);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 根据订单编号获取订单状态
  async getOrderStatus(orderNo: string): Promise<{ status: string }> {
    const connection = await this.getChaigouConnection();
    try {
      // 先获取记录的http请求url
      const [rows] = await connection.execute(
        `SELECT \`http请求(url)\` as http请求url FROM \`sm_chaigou\`.\`1688退款售后\` WHERE \`订单编号\` = ?`,
        [orderNo],
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

      // 从1688 API的实际JSON结构中提取订单状态（原始英文值）
      const statusEn = response.data?.result?.baseInfo?.status || '';

      // 翻译为中文
      const statusCn = this.translateOrderStatus(statusEn);

      Logger.log(`[Refund1688FollowUpService] 获取到订单状态: ${statusEn} (${statusCn})`);

      // 只更新"请求获取订单状态"字段，不同步到"订单状态"
      await connection.execute(
        `UPDATE \`sm_chaigou\`.\`1688退款售后\` SET \`请求获取订单状态\` = ? WHERE \`订单编号\` = ?`,
        [statusCn, orderNo],
      );

      Logger.log(`[Refund1688FollowUpService] 请求获取订单状态已更新: 订单编号=${orderNo}, status=${statusCn}`);

      return { status: statusCn };
    } catch (error: any) {
      Logger.error('[Refund1688FollowUpService] 获取订单状态失败:', error?.message || error);
      throw new Error(error?.message || '获取订单状态失败');
    } finally {
      await connection.end();
    }
  }

  // 根据订单编号获取退款状态
  async getRefundStatus(orderNo: string): Promise<{ refundStatus: string }> {
    const connection = await this.getChaigouConnection();
    try {
      // 先获取记录的http请求url
      const [rows] = await connection.execute(
        `SELECT \`http请求(url)\` as http请求url FROM \`sm_chaigou\`.\`1688退款售后\` WHERE \`订单编号\` = ?`,
        [orderNo],
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

      // 从1688 API的实际JSON结构中提取退款状态（原始英文值）
      // 尝试从 result.baseInfo.refundStatus 获取，如果没有则尝试 refundStatusForAs
      const refundStatusEn = response.data?.result?.baseInfo?.refundStatus
        || response.data?.result?.baseInfo?.refundStatusForAs
        || '';

      // 翻译为中文
      const refundStatusCn = this.translateRefundStatus(refundStatusEn);

      Logger.log(`[Refund1688FollowUpService] 获取到退款状态: ${refundStatusEn} (${refundStatusCn})`);

      // 更新退款状态到数据库（保存中文）
      await connection.execute(
        `UPDATE \`sm_chaigou\`.\`1688退款售后\` SET \`请求获取退款状态\` = ? WHERE \`订单编号\` = ?`,
        [refundStatusCn, orderNo],
      );

      Logger.log(`[Refund1688FollowUpService] 退款状态已更新: 订单编号=${orderNo}, refundStatus=${refundStatusCn}`);

      return { refundStatus: refundStatusCn };
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
        FROM \`sm_chaigou\`.\`采购单信息\` 
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
        `SELECT \`订单编号\` 
        FROM \`sm_chaigou\`.\`1688退款售后\` 
        WHERE \`采购单号\` IS NULL OR \`采购单号\` = ''`,
      );

      const records = rows as any[];
      let updateCount = 0;

      for (const record of records) {
        const purchaseOrderNo = await this.matchPurchaseOrderNo(record['订单编号']);
        if (purchaseOrderNo) {
          await connection.execute(
            `UPDATE \`sm_chaigou\`.\`1688退款售后\` SET \`采购单号\` = ? WHERE \`订单编号\` = ?`,
            [purchaseOrderNo, record['订单编号']],
          );
          updateCount++;
          Logger.log(`[Refund1688FollowUpService] 已匹配采购单号: 订单编号=${record['订单编号']}, 采购单号=${purchaseOrderNo}`);
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

  // 翻译订单状态为中文
  private translateOrderStatus(status: string): string {
    const statusMap: Record<string, string> = {
      // 订单状态
      'waitbuyerpay': '等待买家付款',
      'waitsellersend': '等待卖家发货',
      'waitlogisticstakein': '等待物流公司揽件',
      'waitbuyerreceive': '等待买家收货',
      'waitbuyersign': '等待买家签收',
      'success': '交易成功',
      'cancel': '交易取消',
      'terminated': '交易终止',
      'waitbuyerconfirmgoods': '等待买家确认收货',
      'confirm_goods': '已确认收货',
      'trade_finished': '交易完成',
      'trade_closed': '交易关闭',
      'refunding': '退款中',
      'refund_success': '退款成功',
      'refund_closed': '退款关闭',
      'confirm_goods_but_not_fund': '确认商品但未支付',
    };
    return statusMap[status?.toLowerCase()] || status || '未知状态';
  }

  // 翻译退款状态为中文
  private translateRefundStatus(refundStatus: string): string {
    const refundStatusMap: Record<string, string> = {
      // 退款状态
      'NO_REFUND': '无退款',
      'WAIT_SELLER_AGREE': '等待卖家同意',
      'WAIT_BUYER_MODIFY': '等待买家修改',
      'WAIT_BUYER_SEND': '等待买家退货',
      'WAIT_SELLER_RECEIVE': '等待卖家确认收货',
      'SELLER_REFUSE_BUYER': '卖家拒绝退款',
      'REFUND_SUCCESS': '退款成功',
      'REFUND_CLOSED': '退款关闭',
      'waitselleragree': '等待卖家同意',
      'waitbuyermodify': '等待买家修改',
      'waitbuyersend': '等待买家退货',
      'waitsellerreceive': '等待卖家确认收货',
      'refundsuccess': '退款成功',
      'refundclose': '退款关闭',
      'refunding': '退款中',
      'success': '退款成功',
      'closed': '退款关闭',
    };
    return refundStatusMap[refundStatus] || refundStatus || '无';
  }

  // 自动更新订单状态和退款状态（同步批量处理，返回更新后的数据）
  private async autoUpdateOrderAndRefundStatus(records: Refund1688FollowUp[]): Promise<Refund1688FollowUp[]> {
    Logger.log(`[Refund1688FollowUpService] 开始自动更新状态，共 ${records.length} 条记录`);

    // 过滤出有 http请求url 的记录
    const recordsWithUrl = records.filter(r => r.http请求url);
    if (recordsWithUrl.length === 0) {
      Logger.log('[Refund1688FollowUpService] 没有记录需要更新状态');
      return records; // 直接返回原始数据
    }

    Logger.log(`[Refund1688FollowUpService] 需要更新 ${recordsWithUrl.length} 条记录`);

    // 存储更新后的状态（订单编号 -> 状态）
    const updatedStatusMap = new Map<string, { requestOrderStatus: string; refundStatus: string }>();

    // 限制并发数，避免同时发起过多请求（每次处理5条）
    const concurrentLimit = 5;
    const connection = await this.getChaigouConnection();

    try {
      for (let i = 0; i < recordsWithUrl.length; i += concurrentLimit) {
        const batch = recordsWithUrl.slice(i, i + concurrentLimit);

        // 并发处理这一批记录
        await Promise.all(
          batch.map(async (record) => {
            try {
              // 发起HTTP请求
              const response = await axios.get(record.http请求url!, {
                timeout: 10000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
              });

              // 提取订单状态和退款状态（原始英文值）
              const statusEn = response.data?.result?.baseInfo?.status || '';
              const refundStatusEn = response.data?.result?.baseInfo?.refundStatus
                || response.data?.result?.baseInfo?.refundStatusForAs
                || '';

              // 翻译为中文
              const statusCn = this.translateOrderStatus(statusEn);
              const refundStatusCn = this.translateRefundStatus(refundStatusEn);

              // 只更新"请求获取订单状态"和"请求获取退款状态"，不同步到"订单状态"
              await connection.execute(
                `UPDATE \`sm_chaigou\`.\`1688退款售后\` 
                 SET \`请求获取订单状态\` = ?, \`请求获取退款状态\` = ? 
                 WHERE \`订单编号\` = ?`,
                [statusCn, refundStatusCn, record.订单编号],
              );

              // 记录更新后的状态（只更新请求获取的状态，不更新订单状态）
              updatedStatusMap.set(record.订单编号, {
                requestOrderStatus: statusCn,
                refundStatus: refundStatusCn,
              });

              Logger.log(`[Refund1688FollowUpService] 已更新状态: 订单编号=${record.订单编号}, 订单状态=${statusEn}(${statusCn}), 退款状态=${refundStatusEn}(${refundStatusCn})`);
            } catch (error: any) {
              // 单条记录更新失败不影响其他记录
              Logger.warn(`[Refund1688FollowUpService] 更新订单 ${record.订单编号} 状态失败: ${error?.message}`);
            }
          })
        );

        // 批次之间稍作延迟，避免请求过快
        if (i + concurrentLimit < recordsWithUrl.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      Logger.log(`[Refund1688FollowUpService] 自动更新状态完成`);
    } catch (error) {
      Logger.error('[Refund1688FollowUpService] 批量更新状态失败:', error);
    } finally {
      await connection.end();
    }

    // 将更新后的状态应用到原始记录中（只更新请求获取的状态字段）
    const updatedRecords = records.map(record => {
      const updated = updatedStatusMap.get(record.订单编号);
      if (updated) {
        return {
          ...record,
          请求获取订单状态: updated.requestOrderStatus,
          请求获取退款状态: updated.refundStatus,
        };
      }
      return record;
    });

    return updatedRecords;
  }
}

