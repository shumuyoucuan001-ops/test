import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';

export interface FinanceBill {
    id?: number;
    transactionNumber: string; // 交易单号
    qianniuhuaPurchaseNumber?: string; // 牵牛花采购单号
    importExceptionRemark?: string; // 导入异常备注
    image?: Buffer | string; // 图片（longblob）
    modifier?: string; // 修改人
    modifyTime?: Date; // 修改时间
}

@Injectable()
export class FinanceManagementService {
    private async getConnection() {
        return await mysql.createConnection({
            host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
            user: process.env.DB_USER || 'xitongquanju',
            password: process.env.DB_PASSWORD || 'b4FFS6kVGKV4jV',
            database: 'sm_chaigou',
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

    // 确保表存在
    private async ensureTableExists(connection: any): Promise<void> {
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS sm_zhangdan_caiwu (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        交易单号 VARCHAR(128) NOT NULL UNIQUE COMMENT '交易单号',
        牵牛花采购单号 VARCHAR(128) NULL COMMENT '牵牛花采购单号',
        导入异常备注 TEXT NULL COMMENT '导入异常备注',
        图片 LONGBLOB NULL COMMENT '图片',
        修改人 VARCHAR(128) NULL COMMENT '修改人',
        修改时间 TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
        INDEX idx_交易单号 (交易单号),
        INDEX idx_牵牛花采购单号 (牵牛花采购单号),
        INDEX idx_修改时间 (修改时间)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='财务账单表'
    `;

        await connection.execute(createTableQuery);
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
    ): Promise<{ data: FinanceBill[]; total: number }> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            const offset = (page - 1) * limit;

            // 构建搜索条件
            let whereClause = '1=1';
            const queryParams: any[] = [];

            if (search) {
                whereClause += ' AND (交易单号 LIKE ? OR 牵牛花采购单号 LIKE ?)';
                queryParams.push(`%${search}%`, `%${search}%`);
            }

            // 获取总数
            const totalQuery = `
        SELECT COUNT(*) as count 
        FROM sm_zhangdan_caiwu 
        WHERE ${whereClause}
      `;
            const [totalResult]: any = await connection.execute(totalQuery, queryParams);
            const total = totalResult[0].count;

            // 获取数据（不包含图片，图片太大）
            const dataQuery = `
        SELECT 
          id,
          交易单号 as transactionNumber,
          牵牛花采购单号 as qianniuhuaPurchaseNumber,
          导入异常备注 as importExceptionRemark,
          修改人 as modifier,
          修改时间 as modifyTime
        FROM sm_zhangdan_caiwu
        WHERE ${whereClause}
        ORDER BY 修改时间 DESC, id DESC
        LIMIT ? OFFSET ?
      `;

            const [data]: any = await connection.execute(
                dataQuery,
                [...queryParams, limit, offset]
            );

            return {
                data: data.map((row: any) => ({
                    id: row.id,
                    transactionNumber: row.transactionNumber,
                    qianniuhuaPurchaseNumber: row.qianniuhuaPurchaseNumber,
                    importExceptionRemark: row.importExceptionRemark,
                    modifier: row.modifier,
                    modifyTime: row.modifyTime,
                })),
                total,
            };
        } finally {
            await connection.end();
        }
    }

    // 获取单个账单（包含图片）
    async getBillById(id: number): Promise<FinanceBill | null> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            const query = `
        SELECT 
          id,
          交易单号 as transactionNumber,
          牵牛花采购单号 as qianniuhuaPurchaseNumber,
          导入异常备注 as importExceptionRemark,
          图片 as image,
          修改人 as modifier,
          修改时间 as modifyTime
        FROM sm_zhangdan_caiwu
        WHERE id = ?
      `;

            const [result]: any = await connection.execute(query, [id]);

            if (result.length === 0) {
                return null;
            }

            const row = result[0];
            return {
                id: row.id,
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
        INSERT INTO sm_zhangdan_caiwu 
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
            const [result]: any = await connection.execute(
                'SELECT id FROM sm_zhangdan_caiwu WHERE 交易单号 = ?',
                [data.transactionNumber]
            );

            const bill = await this.getBillById(result[0].id);
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
            INSERT INTO sm_zhangdan_caiwu 
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

    // 更新账单
    async updateBill(id: number, data: Partial<FinanceBill>, userId?: number): Promise<FinanceBill> {
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

            if (data.transactionNumber !== undefined) {
                updateFields.push('交易单号 = ?');
                updateValues.push(data.transactionNumber);
            }
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

            updateValues.push(id);

            const updateQuery = `
        UPDATE sm_zhangdan_caiwu 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

            await connection.execute(updateQuery, updateValues);

            const bill = await this.getBillById(id);
            if (!bill) {
                throw new Error('更新账单失败');
            }
            return bill;
        } finally {
            await connection.end();
        }
    }

    // 删除账单
    async deleteBill(id: number): Promise<boolean> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            const deleteQuery = `DELETE FROM sm_zhangdan_caiwu WHERE id = ?`;

            await connection.execute(deleteQuery, [id]);
            return true;
        } finally {
            await connection.end();
        }
    }

    // 批量删除账单
    async deleteBills(ids: number[]): Promise<{ success: number; failed: number }> {
        const connection = await this.getConnection();

        try {
            await this.ensureTableExists(connection);

            if (ids.length === 0) {
                return { success: 0, failed: 0 };
            }

            const placeholders = ids.map(() => '?').join(',');
            const deleteQuery = `DELETE FROM sm_zhangdan_caiwu WHERE id IN (${placeholders})`;

            const [result]: any = await connection.execute(deleteQuery, ids);

            return {
                success: result.affectedRows || 0,
                failed: ids.length - (result.affectedRows || 0),
            };
        } finally {
            await connection.end();
        }
    }
}

