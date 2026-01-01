import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';

export interface FinanceReconciliationDifference {
    对账单号?: string;
    交易单号: string; // 主键
    牵牛花采购单号: string; // 主键
    采购单金额?: number;
    采购单调整金额?: number;
    调整后采购单金额?: number;
    采购单状态?: string;
    对账单收货状态?: string;
    门店仓?: string;
    下单账号?: string;
    交易账单金额?: number;
    同账单对应采购合计金额?: number;
    同采购对应账单合计金额?: number;
    对账单差额?: number;
    记录状态?: string;
    更新时间?: Date;
}

@Injectable()
export class FinanceReconciliationDifferenceService {
    private async getConnection() {
        if (!process.env.DB_PASSWORD) {
            throw new Error('DB_PASSWORD environment variable is required');
        }
        return await mysql.createConnection({
            host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
            user: process.env.DB_USER || 'xitongquanju',
            password: process.env.DB_PASSWORD,
            database: 'sm_zhangdan_caiwu',
            port: parseInt(process.env.DB_PORT || '3306'),
        });
    }

    // 获取所有记录（分页）
    async getAll(
        page: number = 1,
        limit: number = 20,
        search?: string,
        交易单号?: string,
        牵牛花采购单号?: string,
        对账单号?: string,
        记录状态?: string[],
    ): Promise<{ data: FinanceReconciliationDifference[]; total: number }> {
        const connection = await this.getConnection();

        try {
            const offset = (page - 1) * limit;

            // 构建搜索条件
            let whereClause = '1=1';
            const queryParams: any[] = [];

            // 综合搜索（搜索所有可搜索字段）
            if (search) {
                whereClause += ` AND (
          交易单号 LIKE ? OR 
          牵牛花采购单号 LIKE ? OR 
          对账单号 LIKE ? OR 
          \`门店/仓\` LIKE ? OR 
          下单账号 LIKE ? OR
          采购单状态 LIKE ? OR
          对账单收货状态 LIKE ? OR
          记录状态 LIKE ?
        )`;
                queryParams.push(
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`
                );
            }

            // 单独的字段搜索
            if (交易单号) {
                whereClause += ' AND 交易单号 LIKE ?';
                queryParams.push(`%${交易单号}%`);
            }
            if (牵牛花采购单号) {
                whereClause += ' AND 牵牛花采购单号 LIKE ?';
                queryParams.push(`%${牵牛花采购单号}%`);
            }
            if (对账单号) {
                whereClause += ' AND 对账单号 LIKE ?';
                queryParams.push(`%${对账单号}%`);
            }
            if (记录状态 && 记录状态.length > 0) {
                // 使用IN查询支持多选
                const placeholders = 记录状态.map(() => '?').join(',');
                whereClause += ` AND 记录状态 IN (${placeholders})`;
                queryParams.push(...记录状态);
            }

            // 获取总数
            const totalQuery = `
        SELECT COUNT(*) as count 
        FROM \`交易单号绑定采购单记录\` 
        WHERE ${whereClause}
      `;
            const [totalResult]: any = await connection.execute(totalQuery, queryParams);
            const total = totalResult[0].count;

            // 获取数据
            const dataQuery = `
        SELECT 
          对账单号,
          交易单号,
          牵牛花采购单号,
          采购单金额,
          采购单调整金额,
          调整后采购单金额,
          采购单状态,
          对账单收货状态,
          \`门店/仓\` as 门店仓,
          下单账号,
          交易账单金额,
          同账单对应采购合计金额,
          同采购对应账单合计金额,
          对账单差额,
          记录状态,
          更新时间
        FROM \`交易单号绑定采购单记录\`
        WHERE ${whereClause}
        ORDER BY 更新时间 DESC
        LIMIT ? OFFSET ?
      `;

            const [data]: any = await connection.execute(
                dataQuery,
                [...queryParams, limit, offset]
            );

            return {
                data: data.map((row: any) => ({
                    对账单号: row.对账单号 || null,
                    交易单号: row.交易单号,
                    牵牛花采购单号: row.牵牛花采购单号,
                    采购单金额: row.采购单金额 ? Number(row.采购单金额) : null,
                    采购单调整金额: row.采购单调整金额 ? Number(row.采购单调整金额) : null,
                    调整后采购单金额: row.调整后采购单金额 ? Number(row.调整后采购单金额) : null,
                    采购单状态: row.采购单状态 || null,
                    对账单收货状态: row.对账单收货状态 || null,
                    门店仓: row.门店仓 || null,
                    下单账号: row.下单账号 || null,
                    交易账单金额: row.交易账单金额 ? Number(row.交易账单金额) : null,
                    同账单对应采购合计金额: row.同账单对应采购合计金额 ? Number(row.同账单对应采购合计金额) : null,
                    同采购对应账单合计金额: row.同采购对应账单合计金额 ? Number(row.同采购对应账单合计金额) : null,
                    对账单差额: row.对账单差额 ? Number(row.对账单差额) : null,
                    记录状态: row.记录状态 || null,
                    更新时间: row.更新时间 || null,
                })),
                total,
            };
        } catch (error: any) {
            Logger.error('[FinanceReconciliationDifferenceService] Failed to get all:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 获取对账单号维度数据（去重，只显示对账单号维度的字段）
    async getByReconciliationNumber(
        page: number = 1,
        limit: number = 20,
        search?: string,
        对账单号?: string,
        记录状态?: string[],
        对账单收货状态?: string,
        更新时间开始?: string,
        更新时间结束?: string,
    ): Promise<{ data: FinanceReconciliationDifference[]; total: number }> {
        const connection = await this.getConnection();

        try {
            const offset = (page - 1) * limit;

            // 构建搜索条件
            let whereClause = '1=1';
            const queryParams: any[] = [];

            // 综合搜索
            if (search) {
                whereClause += ` AND (
          对账单号 LIKE ? OR 
          对账单收货状态 LIKE ? OR 
          记录状态 LIKE ?
        )`;
                queryParams.push(
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`
                );
            }

            // 单独的字段搜索
            if (对账单号) {
                whereClause += ' AND 对账单号 LIKE ?';
                queryParams.push(`%${对账单号}%`);
            }
            if (记录状态 && 记录状态.length > 0) {
                const placeholders = 记录状态.map(() => '?').join(',');
                whereClause += ` AND 记录状态 IN (${placeholders})`;
                queryParams.push(...记录状态);
            }
            if (对账单收货状态) {
                whereClause += ' AND 对账单收货状态 LIKE ?';
                queryParams.push(`%${对账单收货状态}%`);
            }
            // 时间范围筛选
            if (更新时间开始) {
                whereClause += ' AND 更新时间 >= ?';
                queryParams.push(更新时间开始);
            }
            if (更新时间结束) {
                whereClause += ' AND 更新时间 <= ?';
                queryParams.push(更新时间结束);
            }

            // 获取总数（按对账单号去重）
            const totalQuery = `
        SELECT COUNT(DISTINCT 对账单号) as count 
        FROM \`交易单号绑定采购单记录\` 
        WHERE ${whereClause} AND (对账单号 IS NOT NULL AND 对账单号 <> '')
      `;
            const [totalResult]: any = await connection.execute(totalQuery, queryParams);
            const total = totalResult[0].count;

            // 获取数据（按对账单号去重，只显示对账单号维度的字段）
            const dataQuery = `
        SELECT 
          对账单号,
          MAX(对账单收货状态) as 对账单收货状态,
          MAX(同采购对应账单合计金额) as 交易账单金额,
          MAX(同账单对应采购合计金额) as 同账单对应采购合计金额,
          MAX(同采购对应账单合计金额) as 同采购对应账单合计金额,
          MAX(对账单差额) as 对账单差额,
          MAX(记录状态) as 记录状态,
          MAX(更新时间) as 更新时间
        FROM \`交易单号绑定采购单记录\`
        WHERE ${whereClause} AND (对账单号 IS NOT NULL AND 对账单号 <> '')
        GROUP BY 对账单号
        ORDER BY 更新时间 DESC
        LIMIT ? OFFSET ?
      `;

            const [data]: any = await connection.execute(
                dataQuery,
                [...queryParams, limit, offset]
            );

            return {
                data: data.map((row: any) => ({
                    对账单号: row.对账单号 || null,
                    对账单收货状态: row.对账单收货状态 || null,
                    交易账单金额: row.交易账单金额 ? Number(row.交易账单金额) : null,
                    同账单对应采购合计金额: row.同账单对应采购合计金额 ? Number(row.同账单对应采购合计金额) : null,
                    同采购对应账单合计金额: row.同采购对应账单合计金额 ? Number(row.同采购对应账单合计金额) : null,
                    对账单差额: row.对账单差额 ? Number(row.对账单差额) : null,
                    记录状态: row.记录状态 || null,
                    更新时间: row.更新时间 || null,
                })),
                total,
            };
        } catch (error: any) {
            Logger.error('[FinanceReconciliationDifferenceService] Failed to get by reconciliation number:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 根据对账单号获取子维度数据
    async getDetailsByReconciliationNumber(
        对账单号: string,
        交易单号?: string,
        牵牛花采购单号?: string,
        采购单状态?: string,
        门店仓?: string,
    ): Promise<{ data: FinanceReconciliationDifference[]; total: number }> {
        const connection = await this.getConnection();

        try {
            // 构建搜索条件
            let whereClause = '对账单号 = ?';
            const queryParams: any[] = [对账单号];

            if (交易单号) {
                whereClause += ' AND 交易单号 LIKE ?';
                queryParams.push(`%${交易单号}%`);
            }
            if (牵牛花采购单号) {
                whereClause += ' AND 牵牛花采购单号 LIKE ?';
                queryParams.push(`%${牵牛花采购单号}%`);
            }
            if (采购单状态) {
                whereClause += ' AND 采购单状态 LIKE ?';
                queryParams.push(`%${采购单状态}%`);
            }
            if (门店仓) {
                whereClause += ' AND `门店/仓` LIKE ?';
                queryParams.push(`%${门店仓}%`);
            }

            // 获取总数
            const totalQuery = `
        SELECT COUNT(*) as count 
        FROM \`交易单号绑定采购单记录\` 
        WHERE ${whereClause}
      `;
            const [totalResult]: any = await connection.execute(totalQuery, queryParams);
            const total = totalResult[0].count;

            // 获取数据
            const dataQuery = `
        SELECT 
          对账单号,
          交易单号,
          牵牛花采购单号,
          采购单金额,
          采购单调整金额,
          调整后采购单金额,
          采购单状态,
          \`门店/仓\` as 门店仓,
          下单账号,
          更新时间
        FROM \`交易单号绑定采购单记录\`
        WHERE ${whereClause}
        ORDER BY 更新时间 DESC
      `;

            const [data]: any = await connection.execute(dataQuery, queryParams);

            return {
                data: data.map((row: any) => ({
                    对账单号: row.对账单号 || null,
                    交易单号: row.交易单号,
                    牵牛花采购单号: row.牵牛花采购单号,
                    采购单金额: row.采购单金额 ? Number(row.采购单金额) : null,
                    采购单调整金额: row.采购单调整金额 ? Number(row.采购单调整金额) : null,
                    调整后采购单金额: row.调整后采购单金额 ? Number(row.调整后采购单金额) : null,
                    采购单状态: row.采购单状态 || null,
                    门店仓: row.门店仓 || null,
                    下单账号: row.下单账号 || null,
                    更新时间: row.更新时间 || null,
                })),
                total,
            };
        } catch (error: any) {
            Logger.error('[FinanceReconciliationDifferenceService] Failed to get details by reconciliation number:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }
}

