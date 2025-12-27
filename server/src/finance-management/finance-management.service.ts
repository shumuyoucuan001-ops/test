import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';

export interface FinanceBill {
    transactionNumber: string; // 交易单号（主键之一）
    qianniuhuaPurchaseNumber?: string; // 牵牛花采购单号（主键之一）
    importExceptionRemark?: string; // 导入异常备注
    image?: Buffer | string; // 图片（longblob）
    modifier?: string; // 修改人
    modifyTime?: Date; // 修改时间
    hasImage?: number; // 是否有图片（0: 无, 1: 有）
}

@Injectable()
export class FinanceManagementService {
    private async getConnection() {
        return await mysql.createConnection({
            host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
            user: process.env.DB_USER || 'xitongquanju',
            password: process.env.DB_PASSWORD || 'b4FFS6kVGKV4jV',
            database: 'sm_zhangdan_caiwu',
            port: parseInt(process.env.DB_PORT || '3306'),
        });
    }

    private async getXitongkaifaConnection() {
        return await mysql.createConnection({
            host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
            user: process.env.DB_USER || 'xitongquanju',
            password: process.env.DB_PASSWORD || 'b4FFS6kVGKV4jV',
            database: 'sm_xitongkaifa',
            port: parseInt(process.env.DB_PORT || '3306'),
        });
    }

    // 确保表存在（如果表不存在则创建，但不修改已存在的表结构）
    private async ensureTableExists(connection: any): Promise<void> {
        // 不创建表，因为表已存在，只是确保连接正常
        // 如果表不存在，会在查询时出错，由调用方处理
    }

    // 根据用户ID获取display_name
    private async getDisplayNameByUserId(userId: number): Promise<string | null> {
        const connection = await this.getXitongkaifaConnection();
        try {
            const query = `SELECT display_name FROM sys_users WHERE id = ?`;
            const [result]: any = await connection.execute(query, [userId]);
            if (result.length > 0) {
                return result[0].display_name || null;
            }
            return null;
        } catch (error) {
            Logger.error('[FinanceManagementService] Failed to get display_name:', error);
            return null;
        } finally {
            await connection.end();
        }
    }

    // 获取所有账单（分页）
    async getAllBills(
        page: number = 1,
        limit: number = 20,
        search?: string,
        transactionNumber?: string,
        qianniuhuaPurchaseNumber?: string,
        importExceptionRemark?: string,
        modifier?: string,
    ): Promise<{ data: FinanceBill[]; total: number }> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            const offset = (page - 1) * limit;

            // 构建搜索条件
            let whereClause = '1=1';
            const queryParams: any[] = [];

            // 综合搜索（搜索所有字段，除了图片）
            if (search) {
                whereClause += ' AND (交易单号 LIKE ? OR 牵牛花采购单号 LIKE ? OR 导入异常备注 LIKE ? OR 修改人 LIKE ?)';
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }

            // 单独的字段搜索
            if (transactionNumber) {
                whereClause += ' AND 交易单号 LIKE ?';
                queryParams.push(`%${transactionNumber}%`);
            }
            if (qianniuhuaPurchaseNumber) {
                whereClause += ' AND 牵牛花采购单号 LIKE ?';
                queryParams.push(`%${qianniuhuaPurchaseNumber}%`);
            }
            if (importExceptionRemark) {
                whereClause += ' AND 导入异常备注 LIKE ?';
                queryParams.push(`%${importExceptionRemark}%`);
            }
            if (modifier) {
                whereClause += ' AND 修改人 LIKE ?';
                queryParams.push(`%${modifier}%`);
            }

            // 获取总数
            const totalQuery = `
        SELECT COUNT(*) as count 
        FROM \`手动绑定对账单号\` 
        WHERE ${whereClause}
      `;
            const [totalResult]: any = await connection.execute(totalQuery, queryParams);
            const total = totalResult[0].count;

            // 获取数据（不包含图片，图片太大，但返回是否有图片的标记）
            const dataQuery = `
        SELECT 
          交易单号 as transactionNumber,
          牵牛花采购单号 as qianniuhuaPurchaseNumber,
          导入异常备注 as importExceptionRemark,
          修改人 as modifier,
          修改时间 as modifyTime,
          CASE WHEN 图片 IS NULL THEN 0 ELSE 1 END as hasImage
        FROM \`手动绑定对账单号\`
        WHERE ${whereClause}
        ORDER BY 修改时间 DESC
        LIMIT ? OFFSET ?
      `;

            const [data]: any = await connection.execute(
                dataQuery,
                [...queryParams, limit, offset]
            );

            return {
                data: data.map((row: any) => ({
                    transactionNumber: row.transactionNumber,
                    qianniuhuaPurchaseNumber: row.qianniuhuaPurchaseNumber,
                    importExceptionRemark: row.importExceptionRemark,
                    modifier: row.modifier,
                    modifyTime: row.modifyTime,
                    hasImage: row.hasImage || 0,
                })),
                total,
            };
        } finally {
            await connection.end();
        }
    }

    // 获取单个账单（根据交易单号和牵牛花采购单号，包含图片）
    async getBill(transactionNumber: string, qianniuhuaPurchaseNumber?: string): Promise<FinanceBill | null> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            let query: string;
            let params: any[];

            if (qianniuhuaPurchaseNumber) {
                // 使用复合主键查询
                query = `
          SELECT 
            交易单号 as transactionNumber,
            牵牛花采购单号 as qianniuhuaPurchaseNumber,
            导入异常备注 as importExceptionRemark,
            图片 as image,
            修改人 as modifier,
            修改时间 as modifyTime
          FROM \`手动绑定对账单号\`
          WHERE 交易单号 = ? AND 牵牛花采购单号 = ?
        `;
                params = [transactionNumber, qianniuhuaPurchaseNumber];
            } else {
                // 只根据交易单号查询
                query = `
          SELECT 
            交易单号 as transactionNumber,
            牵牛花采购单号 as qianniuhuaPurchaseNumber,
            导入异常备注 as importExceptionRemark,
            图片 as image,
            修改人 as modifier,
            修改时间 as modifyTime
          FROM \`手动绑定对账单号\`
          WHERE 交易单号 = ?
        `;
                params = [transactionNumber];
            }

            const [result]: any = await connection.execute(query, params);

            if (result.length === 0) {
                return null;
            }

            const row = result[0];
            return {
                transactionNumber: row.transactionNumber,
                qianniuhuaPurchaseNumber: row.qianniuhuaPurchaseNumber,
                importExceptionRemark: row.importExceptionRemark,
                image: row.image ? row.image.toString('base64') : null,
                modifier: row.modifier,
                modifyTime: row.modifyTime,
            };
        } finally {
            await connection.end();
        }
    }

    // 创建账单
    async createBill(data: FinanceBill, userId?: number): Promise<FinanceBill> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            // 获取修改人
            let modifier: string | null = null;
            if (userId) {
                modifier = await this.getDisplayNameByUserId(userId);
            }

            // 处理图片：如果是base64字符串，转换为Buffer
            let imageBuffer: Buffer | null = null;
            if (data.image) {
                if (typeof data.image === 'string') {
                    // base64字符串
                    imageBuffer = Buffer.from(data.image, 'base64');
                } else if (Buffer.isBuffer(data.image)) {
                    imageBuffer = data.image;
                }
            }

            // 验证图片大小（10MB = 10 * 1024 * 1024 bytes）
            if (imageBuffer && imageBuffer.length > 10 * 1024 * 1024) {
                throw new Error('图片大小不能超过10MB');
            }

            const insertQuery = `
        INSERT INTO \`手动绑定对账单号\` 
        (交易单号, 牵牛花采购单号, 导入异常备注, 图片, 修改人)
        VALUES (?, ?, ?, ?, ?)
      `;

            await connection.execute(insertQuery, [
                data.transactionNumber,
                data.qianniuhuaPurchaseNumber || null,
                data.importExceptionRemark || null,
                imageBuffer,
                modifier || null,
            ]);

            // 获取插入的记录
            const bill = await this.getBill(data.transactionNumber, data.qianniuhuaPurchaseNumber || undefined);
            if (!bill) {
                throw new Error('创建账单失败');
            }
            return bill;
        } finally {
            await connection.end();
        }
    }

    // 批量创建账单
    async createBills(bills: FinanceBill[], userId?: number): Promise<{ success: number; failed: number; errors: string[] }> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            // 获取修改人
            let modifier: string | null = null;
            if (userId) {
                modifier = await this.getDisplayNameByUserId(userId);
            }

            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            for (const bill of bills) {
                try {
                    // 处理图片
                    let imageBuffer: Buffer | null = null;
                    if (bill.image) {
                        if (typeof bill.image === 'string') {
                            imageBuffer = Buffer.from(bill.image, 'base64');
                        } else if (Buffer.isBuffer(bill.image)) {
                            imageBuffer = bill.image;
                        }
                    }

                    // 验证图片大小
                    if (imageBuffer && imageBuffer.length > 10 * 1024 * 1024) {
                        throw new Error(`交易单号 ${bill.transactionNumber}: 图片大小不能超过10MB`);
                    }

                    const insertQuery = `
            INSERT INTO \`手动绑定对账单号\` 
            (交易单号, 牵牛花采购单号, 导入异常备注, 图片, 修改人)
            VALUES (?, ?, ?, ?, ?)
          `;

                    await connection.execute(insertQuery, [
                        bill.transactionNumber,
                        bill.qianniuhuaPurchaseNumber || null,
                        bill.importExceptionRemark || null,
                        imageBuffer,
                        modifier || null,
                    ]);

                    success++;
                } catch (error: any) {
                    failed++;
                    errors.push(error.message || `交易单号 ${bill.transactionNumber}: 创建失败`);
                }
            }

            return { success, failed, errors };
        } finally {
            await connection.end();
        }
    }

    // 更新账单（根据交易单号和牵牛花采购单号）
    async updateBill(transactionNumber: string, qianniuhuaPurchaseNumber: string | undefined, data: Partial<FinanceBill>, userId?: number): Promise<FinanceBill> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            // 获取修改人
            let modifier: string | null = null;
            if (userId) {
                modifier = await this.getDisplayNameByUserId(userId);
            }

            // 构建更新字段
            const updateFields: string[] = [];
            const updateValues: any[] = [];

            if (data.qianniuhuaPurchaseNumber !== undefined) {
                updateFields.push('牵牛花采购单号 = ?');
                updateValues.push(data.qianniuhuaPurchaseNumber || null);
            }
            if (data.importExceptionRemark !== undefined) {
                updateFields.push('导入异常备注 = ?');
                updateValues.push(data.importExceptionRemark || null);
            }
            if (data.image !== undefined) {
                // 处理图片
                let imageBuffer: Buffer | null = null;
                if (data.image) {
                    if (typeof data.image === 'string') {
                        imageBuffer = Buffer.from(data.image, 'base64');
                    } else if (Buffer.isBuffer(data.image)) {
                        imageBuffer = data.image;
                    }
                }

                // 验证图片大小
                if (imageBuffer && imageBuffer.length > 10 * 1024 * 1024) {
                    throw new Error('图片大小不能超过10MB');
                }

                updateFields.push('图片 = ?');
                updateValues.push(imageBuffer);
            }

            // 如果有修改，更新修改人和修改时间
            if (modifier) {
                updateFields.push('修改人 = ?');
                updateValues.push(modifier || null);
            }

            if (updateFields.length === 0) {
                throw new Error('没有需要更新的字段');
            }

            // 构建WHERE条件（使用复合主键）
            let whereClause: string;
            if (qianniuhuaPurchaseNumber) {
                whereClause = '交易单号 = ? AND 牵牛花采购单号 = ?';
                updateValues.push(transactionNumber, qianniuhuaPurchaseNumber);
            } else {
                whereClause = '交易单号 = ? AND (牵牛花采购单号 IS NULL OR 牵牛花采购单号 = \'\')';
                updateValues.push(transactionNumber);
            }

            const updateQuery = `
        UPDATE \`手动绑定对账单号\` 
        SET ${updateFields.join(', ')}
        WHERE ${whereClause}
      `;

            await connection.execute(updateQuery, updateValues);

            const bill = await this.getBill(transactionNumber, data.qianniuhuaPurchaseNumber || qianniuhuaPurchaseNumber);
            if (!bill) {
                throw new Error('更新账单失败');
            }
            return bill;
        } finally {
            await connection.end();
        }
    }

    // 删除账单（根据交易单号和牵牛花采购单号）
    async deleteBill(transactionNumber: string, qianniuhuaPurchaseNumber?: string): Promise<boolean> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            let deleteQuery: string;
            let params: any[];

            if (qianniuhuaPurchaseNumber) {
                // 使用复合主键删除
                deleteQuery = `DELETE FROM \`手动绑定对账单号\` WHERE 交易单号 = ? AND 牵牛花采购单号 = ?`;
                params = [transactionNumber, qianniuhuaPurchaseNumber];
            } else {
                // 只根据交易单号删除
                deleteQuery = `DELETE FROM \`手动绑定对账单号\` WHERE 交易单号 = ? AND (牵牛花采购单号 IS NULL OR 牵牛花采购单号 = '')`;
                params = [transactionNumber];
            }

            await connection.execute(deleteQuery, params);
            return true;
        } finally {
            await connection.end();
        }
    }

    // 批量删除账单（根据交易单号和牵牛花采购单号列表）
    async deleteBills(bills: Array<{ transactionNumber: string; qianniuhuaPurchaseNumber?: string }>): Promise<{ success: number; failed: number }> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            if (bills.length === 0) {
                return { success: 0, failed: 0 };
            }

            let success = 0;
            let failed = 0;

            for (const bill of bills) {
                try {
                    await this.deleteBill(bill.transactionNumber, bill.qianniuhuaPurchaseNumber);
                    success++;
                } catch (error) {
                    failed++;
                }
            }

            return { success, failed };
        } finally {
            await connection.end();
        }
    }
}

