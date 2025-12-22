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
  差异单出库单详情?: string;
  跟进相关附件?: string;
  牵牛花物流单号?: string;
  跟进情况图片?: string; // 列表查询时不返回，需要通过单独接口查询（原发货截图）
  有跟进情况图片?: number; // 列表查询时返回，0表示无图片，1表示有图片
  跟进人?: string;
  跟进时间?: string; // 最后编辑时间
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
      牵牛花物流单号?: string;
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
          r.\`订单详情页\` LIKE ? OR
          r.\`请求获取订单状态\` LIKE ? OR
          r.\`请求获取退款状态\` LIKE ? OR
          r.\`进度追踪\` LIKE ? OR
          r.\`采购单号\` LIKE ? OR
          r.\`跟进情况/备注\` LIKE ? OR
          r.\`差异单/出库单详情\` LIKE ? OR
          r.\`牵牛花物流单号\` LIKE ? OR
          r.\`跟进人\` LIKE ? OR
          r.\`跟进时间\` LIKE ?
        )`);
        params.push(like, like, like, like, like, like, like, like, like, like, like, like, like);
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
        // 订单状态搜索框改为搜索请求获取退款状态字段
        clauses.push(`r.\`请求获取退款状态\` LIKE ?`);
        params.push(buildLike(filters.订单状态));
      }
      if (filters?.买家会员名?.trim()) {
        clauses.push(`r.\`买家会员名\` LIKE ?`);
        params.push(buildLike(filters.买家会员名));
      }
      if (filters?.采购单号?.trim()) {
        clauses.push(`r.\`采购单号\` LIKE ?`);
        params.push(buildLike(filters.采购单号));
      }
      if (filters?.牵牛花物流单号?.trim()) {
        clauses.push(`r.\`牵牛花物流单号\` LIKE ?`);
        params.push(buildLike(filters.牵牛花物流单号));
      }
      if (filters?.进度追踪?.trim()) {
        clauses.push(`r.\`进度追踪\` = ?`);
        params.push(filters.进度追踪);
      }

      // 构建搜索条件（不再需要JOIN采购单信息表）
      const searchCondition = clauses.length > 0
        ? `WHERE ${clauses.join(' AND ')}`
        : '';

      // 获取总数（不再需要JOIN采购单信息表）
      const countSql = `SELECT COUNT(*) as total 
        FROM \`sm_chaigou\`.\`1688退款售后\` r
        ${searchCondition}`;

      Logger.log('[Refund1688FollowUpService] 执行计数查询...');
      const [countRows] = await connection.execute(countSql, params);
      const total = Number((countRows as any[])[0]?.total || 0);
      Logger.log(`[Refund1688FollowUpService] 总记录数: ${total}`);

      // 获取分页数据（只查询1688退款售后表，不JOIN任何其他表）
      // 优化：不返回图片数据，只返回是否有图片的标识，减少数据传输压力
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
          r.\`采购单号\`,
          r.\`跟进情况/备注\` as 跟进情况备注,
          r.\`差异单/出库单详情\` as 差异单出库单详情,
          r.\`跟进相关附件\`,
          r.\`牵牛花物流单号\`,
          CASE WHEN r.\`跟进情况/图片\` IS NOT NULL AND r.\`跟进情况/图片\` != '' THEN 1 ELSE 0 END as 有跟进情况图片,
          r.\`跟进人\`,
          r.\`跟进时间\`
        FROM \`sm_chaigou\`.\`1688退款售后\` r
        ${searchCondition}
        ORDER BY r.\`订单编号\` DESC
        LIMIT ${limit} OFFSET ${offset}`;

      Logger.log('[Refund1688FollowUpService] 执行数据查询...');
      const [rows] = await connection.execute(dataSql, params);
      const data = rows as Refund1688FollowUp[];

      Logger.log(`[Refund1688FollowUpService] 查询到 ${data.length} 条记录（第 ${page} 页）`);

      // 同步更新订单状态和退款状态（等待更新完成再返回，但已优化性能）
      const updatedData = await this.autoUpdateOrderAndRefundStatus(data);

      // 为进度追踪为null的数据设置默认值：等待商家同意退换
      const processedData = updatedData.map(record => {
        if (!record.进度追踪 || record.进度追踪.trim() === '') {
          return {
            ...record,
            进度追踪: '等待商家同意退换'
          };
        }
        return record;
      });

      return { data: processedData, total };
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

  // 检查用户是否有编辑权限
  // 只有当用户的role_id为1、3或4时，才有编辑权限；其他情况都只能查看
  async checkEditPermission(userId: number): Promise<boolean> {
    const connection = await this.getChaigouConnection();
    try {
      // 查询用户的角色ID
      const [roleRows]: any = await connection.execute(
        `SELECT \`role_id\` 
         FROM \`sm_xitongkaifa\`.\`sys_user_roles\` 
         WHERE \`user_id\` = ?`,
        [userId],
      );

      if (roleRows.length === 0) {
        // 如果用户没有分配角色，不允许编辑
        Logger.log(`[Refund1688FollowUpService] 权限检查: userId=${userId}, 未分配角色, 允许编辑=false`);
        return false;
      }

      // 检查是否有允许编辑的角色（1、3、4）
      const allowedRoleIds = [1, 3, 4];
      const hasAllowedRole = roleRows.some((row: any) =>
        allowedRoleIds.includes(Number(row.role_id))
      );

      const roleIds = roleRows.map((row: any) => row.role_id).join(', ');
      Logger.log(`[Refund1688FollowUpService] 权限检查: userId=${userId}, role_ids=[${roleIds}], 允许编辑=${hasAllowedRole}`);

      // 只有当有允许的角色时，才允许编辑
      return hasAllowedRole;
    } catch (error) {
      Logger.error(`[Refund1688FollowUpService] 检查编辑权限失败: ${error}`);
      // 出错时默认不允许编辑，保证安全
      return false;
    } finally {
      await connection.end();
    }
  }

  // 更新退款跟进记录
  async update(orderNo: string, data: Partial<Refund1688FollowUp>, userId?: number): Promise<void> {
    const connection = await this.getChaigouConnection();
    try {
      // 检查编辑权限
      if (userId) {
        const hasPermission = await this.checkEditPermission(userId);
        if (!hasPermission) {
          throw new Error('您的账号没有编辑权限，只能查看数据');
        }
      }

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
        '差异单出库单详情': '差异单/出库单详情',
        '牵牛花物流单号': '牵牛花物流单号',
        '跟进情况图片': '跟进情况/图片',
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (key in data) {
          const value = data[key as keyof Refund1688FollowUp];
          // 对于跟进情况图片字段，空字符串表示要清空
          if (key === '跟进情况图片' && value === '') {
            updateFields.push(`\`${dbField}\` = ?`);
            updateValues.push(null); // 使用 null 来清空数据库字段
          } else if (value !== undefined) {
            updateFields.push(`\`${dbField}\` = ?`);
            updateValues.push(value);
          }
        }
      }

      // 自动填充跟进人（如果获取到了display_name）
      if (followUpPerson) {
        updateFields.push(`\`跟进人\` = ?`);
        updateValues.push(followUpPerson);
      }

      // 自动更新跟进时间（每次编辑时更新为当前时间）
      // 注意：跟进时间使用NOW()函数，不需要参数，所以不添加到updateValues
      updateFields.push(`\`跟进时间\` = NOW()`);

      // 即使没有其他字段更新，至少也会更新跟进时间
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

  // 删除退款跟进记录
  async delete(orderNo: string, userId?: number): Promise<void> {
    const connection = await this.getChaigouConnection();

    try {
      // 检查编辑权限
      if (userId !== undefined) {
        const hasPermission = await this.checkEditPermission(userId);
        if (!hasPermission) {
          throw new Error('您的账号没有编辑权限，无法执行删除操作');
        }
      }

      // 清理订单编号（去除前后空格，确保格式一致）
      const cleanedOrderNo = String(orderNo).trim();

      if (!cleanedOrderNo) {
        throw new Error('订单编号不能为空');
      }

      // 订单编号是主键，直接使用主键匹配（不使用TRIM，以利用主键索引）
      const [existingRecords]: any = await connection.execute(
        `SELECT \`订单编号\` FROM \`sm_chaigou\`.\`1688退款售后\` WHERE \`订单编号\` = ?`,
        [cleanedOrderNo]
      );

      if (!existingRecords || existingRecords.length === 0) {
        throw new Error('记录不存在');
      }

      // 删除记录（直接使用主键匹配）
      await connection.execute(
        `DELETE FROM \`sm_chaigou\`.\`1688退款售后\` WHERE \`订单编号\` = ?`,
        [cleanedOrderNo]
      );

      Logger.log(`[Refund1688FollowUpService] 删除记录成功: 订单编号=${orderNo}`);
    } catch (error: any) {
      Logger.error(`[Refund1688FollowUpService] 删除记录失败: ${error?.message || error}`);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 批量删除退款跟进记录
  async batchDelete(orderNos: string[], userId?: number): Promise<{ success: boolean; message: string; deletedCount: number }> {
    Logger.log(`[Refund1688FollowUpService] 开始批量删除: userId=${userId}, orderNos数量=${orderNos?.length || 0}`);
    Logger.log(`[Refund1688FollowUpService] 订单编号列表:`, orderNos);

    const connection = await this.getChaigouConnection();

    try {
      // 检查编辑权限
      if (userId !== undefined) {
        const hasPermission = await this.checkEditPermission(userId);
        Logger.log(`[Refund1688FollowUpService] 权限检查结果: hasPermission=${hasPermission}`);
        if (!hasPermission) {
          throw new Error('您的账号没有编辑权限，无法执行批量删除操作');
        }
      }

      if (!orderNos || orderNos.length === 0) {
        throw new Error('请选择要删除的记录');
      }

      // 清理订单编号（去除前后空格，确保格式一致）
      const cleanedOrderNos = orderNos.map(no => String(no).trim()).filter(no => no.length > 0);

      if (cleanedOrderNos.length === 0) {
        throw new Error('请选择要删除的记录');
      }

      // 订单编号是主键，直接使用主键匹配（不使用TRIM，以利用主键索引）
      const placeholders = cleanedOrderNos.map(() => '?').join(',');
      const [existingRecords]: any = await connection.execute(
        `SELECT \`订单编号\` FROM \`sm_chaigou\`.\`1688退款售后\` WHERE \`订单编号\` IN (${placeholders})`,
        cleanedOrderNos
      );

      const existingOrderNos = existingRecords.map((row: any) => String(row.订单编号 || '')).filter(no => no.length > 0);
      const notFoundOrderNos = cleanedOrderNos.filter(no => !existingOrderNos.includes(no));

      if (notFoundOrderNos.length > 0) {
        Logger.warn(`[Refund1688FollowUpService] 部分记录不存在: ${notFoundOrderNos.join(', ')}`);
      }

      if (existingOrderNos.length === 0) {
        throw new Error('没有找到要删除的记录');
      }

      // 批量删除记录（直接使用主键匹配）
      const deletePlaceholders = existingOrderNos.map(() => '?').join(',');
      const [deleteResult]: any = await connection.execute(
        `DELETE FROM \`sm_chaigou\`.\`1688退款售后\` WHERE \`订单编号\` IN (${deletePlaceholders})`,
        existingOrderNos
      );

      const deletedCount = deleteResult.affectedRows || 0;
      Logger.log(`[Refund1688FollowUpService] 批量删除记录成功: 共删除 ${deletedCount} 条记录`);

      return {
        success: true,
        message: `成功删除 ${deletedCount} 条记录`,
        deletedCount,
      };
    } catch (error: any) {
      Logger.error(`[Refund1688FollowUpService] 批量删除记录失败: ${error?.message || error}`);
      throw error;
    } finally {
      await connection.end();
    }
  }

  // 根据订单编号获取跟进情况图片（按需查询，原发货截图）
  async getFollowUpImage(orderNo: string): Promise<{ 跟进情况图片: string | null }> {
    const connection = await this.getChaigouConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT CAST(\`跟进情况/图片\` AS CHAR) as 跟进情况图片 FROM \`sm_chaigou\`.\`1688退款售后\` WHERE \`订单编号\` = ?`,
        [orderNo],
      );

      const record = (rows as any[])[0];
      const image = record?.跟进情况图片 || null;

      Logger.log(`[Refund1688FollowUpService] 查询跟进情况图片: 订单编号=${orderNo}, 是否有图片=${!!image}`);

      return { 跟进情况图片: image };
    } catch (error: any) {
      Logger.error('[Refund1688FollowUpService] 获取跟进情况图片失败:', error?.message || error);
      throw new Error(error?.message || '获取跟进情况图片失败');
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
      'confirm_goods_but_not_fund': '已收货未扣款',
      'send_goods_but_not_fund': '已发货未到账',
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

    // 限制并发数，避免同时发起过多请求（每次处理10条，提高并发）
    const concurrentLimit = 10;
    const connection = await this.getChaigouConnection();

    try {
      // 收集所有需要更新的数据
      const updateBatch: Array<{ orderNo: string; statusCn: string; refundStatusCn: string }> = [];

      for (let i = 0; i < recordsWithUrl.length; i += concurrentLimit) {
        const batch = recordsWithUrl.slice(i, i + concurrentLimit);

        // 并发处理这一批记录（只获取数据，不立即更新数据库）
        await Promise.all(
          batch.map(async (record) => {
            try {
              // 发起HTTP请求（减少超时时间到5秒）
              const response = await axios.get(record.http请求url!, {
                timeout: 5000, // 从10秒减少到5秒
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

              // 收集到批量更新列表
              updateBatch.push({
                orderNo: record.订单编号,
                statusCn,
                refundStatusCn,
              });

              // 记录更新后的状态（用于返回数据）
              updatedStatusMap.set(record.订单编号, {
                requestOrderStatus: statusCn,
                refundStatus: refundStatusCn,
              });

              Logger.log(`[Refund1688FollowUpService] 已获取状态: 订单编号=${record.订单编号}, 订单状态=${statusEn}(${statusCn}), 退款状态=${refundStatusEn}(${refundStatusCn})`);
            } catch (error: any) {
              // 单条记录更新失败不影响其他记录
              Logger.warn(`[Refund1688FollowUpService] 获取订单 ${record.订单编号} 状态失败: ${error?.message}`);
            }
          })
        );

        // 批次之间稍作延迟，避免请求过快（减少延迟时间）
        if (i + concurrentLimit < recordsWithUrl.length) {
          await new Promise(resolve => setTimeout(resolve, 200)); // 从500ms减少到200ms
        }
      }

      // 批量执行UPDATE（一次性更新所有记录，而不是循环更新）
      if (updateBatch.length > 0) {
        Logger.log(`[Refund1688FollowUpService] 开始批量更新 ${updateBatch.length} 条记录到数据库...`);

        // 使用事务批量更新
        await connection.beginTransaction();
        try {
          for (const item of updateBatch) {
            await connection.execute(
              `UPDATE \`sm_chaigou\`.\`1688退款售后\` 
               SET \`请求获取订单状态\` = ?, \`请求获取退款状态\` = ? 
               WHERE \`订单编号\` = ?`,
              [item.statusCn, item.refundStatusCn, item.orderNo],
            );
          }
          await connection.commit();
          Logger.log(`[Refund1688FollowUpService] 批量更新完成，共更新 ${updateBatch.length} 条记录`);
        } catch (error) {
          await connection.rollback();
          Logger.error('[Refund1688FollowUpService] 批量更新失败，已回滚:', error);
          throw error;
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

  // 同步数据：从采购单信息表同步采购单号和物流单号到1688退款售后表
  async syncDataFromPurchaseOrder(): Promise<{ success: boolean; updatedCount: number; message: string }> {
    const connection = await this.getChaigouConnection();
    try {
      Logger.log('[Refund1688FollowUpService] 开始同步数据...');

      // 计算3个月前的日期
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 19).replace('T', ' ');

      // 优化：先查询需要更新的记录，然后分批更新，避免长时间锁定
      // 如果1688退款售后的采购单号不为空，则不同步
      const selectSql = `
        SELECT r.\`订单编号\`, p.\`采购单号\`, p.\`物流单号\`
        FROM \`sm_chaigou\`.\`1688退款售后\` r
        INNER JOIN \`sm_chaigou\`.\`采购单信息\` p
          ON TRIM(r.\`订单编号\`) = TRIM(p.\`渠道订单号\`)
        WHERE 
          p.\`采购下单渠道\` = '1688采购平台'
          AND p.\`创建时间\` >= ?
          AND (
            r.\`采购单号\` IS NULL 
            OR r.\`采购单号\` = ''
          )
          AND (
            r.\`牵牛花物流单号\` IS NULL 
            OR r.\`牵牛花物流单号\` = '' 
            OR r.\`牵牛花物流单号\` != p.\`物流单号\`
          )
        LIMIT 1000
      `;

      Logger.log('[Refund1688FollowUpService] 查询需要同步的记录...');
      const [rows]: any = await connection.execute(selectSql, [threeMonthsAgoStr]);
      const recordsToUpdate = rows as Array<{ 订单编号: string; 采购单号: string; 物流单号: string }>;

      if (recordsToUpdate.length === 0) {
        Logger.log('[Refund1688FollowUpService] 没有需要同步的记录');
        return {
          success: true,
          updatedCount: 0,
          message: '没有需要同步的记录',
        };
      }

      Logger.log(`[Refund1688FollowUpService] 找到 ${recordsToUpdate.length} 条需要同步的记录，开始分批更新...`);

      // 分批更新，每批100条，避免长时间锁定
      const batchSize = 100;
      let totalUpdated = 0;

      for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
        const batch = recordsToUpdate.slice(i, i + batchSize);

        // 使用参数化查询，避免SQL注入
        const placeholders = batch.map(() => '?').join(',');
        const orderNos = batch.map(r => r.订单编号);

        const updateSql = `
          UPDATE \`sm_chaigou\`.\`1688退款售后\` r
          INNER JOIN \`sm_chaigou\`.\`采购单信息\` p
            ON TRIM(r.\`订单编号\`) = TRIM(p.\`渠道订单号\`)
          SET 
            r.\`采购单号\` = p.\`采购单号\`,
            r.\`牵牛花物流单号\` = p.\`物流单号\`
          WHERE 
            r.\`订单编号\` IN (${placeholders})
            AND p.\`采购下单渠道\` = '1688采购平台'
            AND p.\`创建时间\` >= ?
            AND (
              r.\`采购单号\` IS NULL 
              OR r.\`采购单号\` = ''
            )
        `;

        try {
          const [result]: any = await connection.execute(updateSql, [...orderNos, threeMonthsAgoStr]);
          const batchUpdated = result.affectedRows || 0;
          totalUpdated += batchUpdated;
          Logger.log(`[Refund1688FollowUpService] 批次 ${Math.floor(i / batchSize) + 1} 完成，更新 ${batchUpdated} 条记录`);

          // 批次之间稍作延迟，减少锁竞争
          if (i + batchSize < recordsToUpdate.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          Logger.error(`[Refund1688FollowUpService] 批次 ${Math.floor(i / batchSize) + 1} 更新失败:`, error?.message || error);
          // 继续处理下一批，不中断整个流程
        }
      }

      Logger.log(`[Refund1688FollowUpService] 同步完成，共更新 ${totalUpdated} 条记录`);

      return {
        success: true,
        updatedCount: totalUpdated,
        message: `同步成功，共更新 ${totalUpdated} 条记录`,
      };
    } catch (error: any) {
      Logger.error('[Refund1688FollowUpService] 同步数据失败:', error?.message || error);
      throw new Error(error?.message || '同步数据失败');
    } finally {
      await connection.end();
    }
  }
}

