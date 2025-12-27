import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';

export interface PurchaseAmountAdjustment {
    purchaseOrderNumber: string; // 采购单号(牵牛花)（主键）
    adjustmentAmount?: number; // 调整金额
    adjustmentReason?: string; // 异常调整原因备注
    image?: Buffer | string; // 图片（longblob）
    financeReviewRemark?: string; // 财务审核意见备注
    financeReviewStatus?: string; // 财务审核状态
    creator?: string; // 创建人
    financeReviewer?: string; // 财务审核人
    dataUpdateTime?: Date; // 数据更新时间
    hasImage?: number; // 是否有图片（0: 无, 1: 有）
}

@Injectable()
export class PurchaseAmountAdjustmentService {
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
            Logger.error('[PurchaseAmountAdjustmentService] Failed to get display_name:', error);
            return null;
        } finally {
            await connection.end();
        }
    }

    // 获取所有调整记录（分页）
    async getAllAdjustments(
        page: number = 1,
        limit: number = 20,
        search?: string,
        purchaseOrderNumber?: string,
        adjustmentAmount?: string,
        creator?: string,
        financeReviewer?: string,
        dataUpdateTime?: string,
    ): Promise<{ data: PurchaseAmountAdjustment[]; total: number }> {
        const connection = await this.getConnection();

        try {
            const offset = (page - 1) * limit;

            // 构建搜索条件
            let whereClause = '1=1';
            const queryParams: any[] = [];

            // 综合搜索（搜索所有字段，除了图片）
            if (search) {
                whereClause += ' AND (`采购单号(牵牛花)` LIKE ? OR `异常调整原因备注` LIKE ? OR `财务审核意见备注` LIKE ? OR `创建人` LIKE ? OR `财务审核人` LIKE ?)';
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }

            // 单独的字段搜索
            if (purchaseOrderNumber) {
                whereClause += ' AND `采购单号(牵牛花)` LIKE ?';
                queryParams.push(`%${purchaseOrderNumber}%`);
            }
            if (adjustmentAmount) {
                whereClause += ' AND `调整金额` LIKE ?';
                queryParams.push(`%${adjustmentAmount}%`);
            }
            if (creator) {
                whereClause += ' AND `创建人` LIKE ?';
                queryParams.push(`%${creator}%`);
            }
            if (financeReviewer) {
                whereClause += ' AND `财务审核人` LIKE ?';
                queryParams.push(`%${financeReviewer}%`);
            }
            if (dataUpdateTime) {
                // 支持日期时间搜索，使用 LIKE 匹配日期时间字符串
                whereClause += ' AND DATE_FORMAT(`数据更新时间`, \'%Y-%m-%d %H:%i:%s\') LIKE ?';
                queryParams.push(`%${dataUpdateTime}%`);
            }

            // 获取总数
            const totalQuery = `
        SELECT COUNT(*) as count 
        FROM \`采购单收货金额异常调整\` 
        WHERE ${whereClause}
      `;
            const [totalResult]: any = await connection.execute(totalQuery, queryParams);
            const total = totalResult[0].count;

            // 获取数据（不包含图片，图片太大，但返回是否有图片的标记）
            const dataQuery = `
        SELECT 
          \`采购单号(牵牛花)\` as purchaseOrderNumber,
          \`调整金额\` as adjustmentAmount,
          \`异常调整原因备注\` as adjustmentReason,
          \`财务审核意见备注\` as financeReviewRemark,
          \`财务审核状态\` as financeReviewStatus,
          \`创建人\` as creator,
          \`财务审核人\` as financeReviewer,
          \`数据更新时间\` as dataUpdateTime,
          CASE WHEN \`图片\` IS NULL THEN 0 ELSE 1 END as hasImage
        FROM \`采购单收货金额异常调整\`
        WHERE ${whereClause}
        ORDER BY \`数据更新时间\` DESC
        LIMIT ? OFFSET ?
      `;

            const [data]: any = await connection.execute(
                dataQuery,
                [...queryParams, limit, offset]
            );

            return {
                data: data.map((row: any) => ({
                    purchaseOrderNumber: row.purchaseOrderNumber,
                    adjustmentAmount: row.adjustmentAmount ? parseFloat(row.adjustmentAmount) : undefined,
                    adjustmentReason: row.adjustmentReason,
                    financeReviewRemark: row.financeReviewRemark,
                    financeReviewStatus: row.financeReviewStatus,
                    creator: row.creator,
                    financeReviewer: row.financeReviewer,
                    dataUpdateTime: row.dataUpdateTime,
                    hasImage: row.hasImage || 0,
                })),
                total,
            };
        } finally {
            await connection.end();
        }
    }

    // 获取单个调整记录（包含图片）
    async getAdjustment(purchaseOrderNumber: string): Promise<PurchaseAmountAdjustment | null> {
        const connection = await this.getConnection();

        try {
            const query = `
          SELECT 
            \`采购单号(牵牛花)\` as purchaseOrderNumber,
            \`调整金额\` as adjustmentAmount,
            \`异常调整原因备注\` as adjustmentReason,
            \`图片\` as image,
            \`财务审核意见备注\` as financeReviewRemark,
            \`财务审核状态\` as financeReviewStatus,
            \`创建人\` as creator,
            \`财务审核人\` as financeReviewer,
            \`数据更新时间\` as dataUpdateTime
          FROM \`采购单收货金额异常调整\`
          WHERE \`采购单号(牵牛花)\` = ?
        `;

            const [result]: any = await connection.execute(query, [purchaseOrderNumber]);

            if (result.length === 0) {
                return null;
            }

            const row = result[0];
            return {
                purchaseOrderNumber: row.purchaseOrderNumber,
                adjustmentAmount: row.adjustmentAmount ? parseFloat(row.adjustmentAmount) : undefined,
                adjustmentReason: row.adjustmentReason,
                image: row.image ? row.image.toString('base64') : null,
                financeReviewRemark: row.financeReviewRemark,
                financeReviewStatus: row.financeReviewStatus,
                creator: row.creator,
                financeReviewer: row.financeReviewer,
                dataUpdateTime: row.dataUpdateTime,
            };
        } finally {
            await connection.end();
        }
    }

    // 创建调整记录
    async createAdjustment(data: PurchaseAmountAdjustment, userId?: number): Promise<PurchaseAmountAdjustment> {
        const connection = await this.getConnection();

        try {
            // 获取创建人
            let creator: string | null = null;
            if (userId) {
                creator = await this.getDisplayNameByUserId(userId);
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
        INSERT INTO \`采购单收货金额异常调整\` 
        (\`采购单号(牵牛花)\`, \`调整金额\`, \`异常调整原因备注\`, \`图片\`, \`财务审核意见备注\`, \`财务审核状态\`, \`创建人\`, \`财务审核人\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

            await connection.execute(insertQuery, [
                data.purchaseOrderNumber,
                data.adjustmentAmount || null,
                data.adjustmentReason || null,
                imageBuffer,
                data.financeReviewRemark || null,
                data.financeReviewStatus || null,
                creator || null,
                data.financeReviewer || null,
            ]);

            // 获取插入的记录
            const adjustment = await this.getAdjustment(data.purchaseOrderNumber);
            if (!adjustment) {
                throw new Error('创建调整记录失败');
            }
            return adjustment;
        } finally {
            await connection.end();
        }
    }

    // 批量创建调整记录
    async createAdjustments(adjustments: PurchaseAmountAdjustment[], userId?: number): Promise<{ success: number; failed: number; errors: string[] }> {
        const connection = await this.getConnection();

        try {
            // 获取创建人
            let creator: string | null = null;
            if (userId) {
                creator = await this.getDisplayNameByUserId(userId);
            }

            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            for (const adjustment of adjustments) {
                try {
                    // 处理图片
                    let imageBuffer: Buffer | null = null;
                    if (adjustment.image) {
                        if (typeof adjustment.image === 'string') {
                            imageBuffer = Buffer.from(adjustment.image, 'base64');
                        } else if (Buffer.isBuffer(adjustment.image)) {
                            imageBuffer = adjustment.image;
                        }
                    }

                    // 验证图片大小
                    if (imageBuffer && imageBuffer.length > 10 * 1024 * 1024) {
                        throw new Error(`采购单号 ${adjustment.purchaseOrderNumber}: 图片大小不能超过10MB`);
                    }

                    const insertQuery = `
            INSERT INTO \`采购单收货金额异常调整\` 
            (\`采购单号(牵牛花)\`, \`调整金额\`, \`异常调整原因备注\`, \`图片\`, \`财务审核意见备注\`, \`财务审核状态\`, \`创建人\`, \`财务审核人\`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

                    await connection.execute(insertQuery, [
                        adjustment.purchaseOrderNumber,
                        adjustment.adjustmentAmount || null,
                        adjustment.adjustmentReason || null,
                        imageBuffer,
                        adjustment.financeReviewRemark || null,
                        adjustment.financeReviewStatus || null,
                        creator || null,
                        adjustment.financeReviewer || null,
                    ]);

                    success++;
                } catch (error: any) {
                    failed++;
                    errors.push(error.message || `采购单号 ${adjustment.purchaseOrderNumber}: 创建失败`);
                }
            }

            return { success, failed, errors };
        } finally {
            await connection.end();
        }
    }

    // 更新调整记录
    async updateAdjustment(purchaseOrderNumber: string, data: Partial<PurchaseAmountAdjustment>, userId?: number): Promise<PurchaseAmountAdjustment> {
        const connection = await this.getConnection();

        try {
            // 构建更新字段
            const updateFields: string[] = [];
            const updateValues: any[] = [];

            if (data.adjustmentAmount !== undefined) {
                updateFields.push('`调整金额` = ?');
                updateValues.push(data.adjustmentAmount || null);
            }
            if (data.adjustmentReason !== undefined) {
                updateFields.push('`异常调整原因备注` = ?');
                updateValues.push(data.adjustmentReason || null);
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

                updateFields.push('`图片` = ?');
                updateValues.push(imageBuffer);
            }
            if (data.financeReviewRemark !== undefined) {
                updateFields.push('`财务审核意见备注` = ?');
                updateValues.push(data.financeReviewRemark || null);
            }
            if (data.financeReviewStatus !== undefined) {
                updateFields.push('`财务审核状态` = ?');
                updateValues.push(data.financeReviewStatus || null);
            }
            if (data.financeReviewer !== undefined) {
                updateFields.push('`财务审核人` = ?');
                updateValues.push(data.financeReviewer || null);
            }

            if (updateFields.length === 0) {
                throw new Error('没有需要更新的字段');
            }

            updateValues.push(purchaseOrderNumber);

            const updateQuery = `
        UPDATE \`采购单收货金额异常调整\` 
        SET ${updateFields.join(', ')}
        WHERE \`采购单号(牵牛花)\` = ?
      `;

            await connection.execute(updateQuery, updateValues);

            const adjustment = await this.getAdjustment(purchaseOrderNumber);
            if (!adjustment) {
                throw new Error('更新调整记录失败');
            }
            return adjustment;
        } finally {
            await connection.end();
        }
    }

    // 删除调整记录
    async deleteAdjustment(purchaseOrderNumber: string): Promise<boolean> {
        const connection = await this.getConnection();

        try {
            const deleteQuery = `DELETE FROM \`采购单收货金额异常调整\` WHERE \`采购单号(牵牛花)\` = ?`;
            await connection.execute(deleteQuery, [purchaseOrderNumber]);
            return true;
        } finally {
            await connection.end();
        }
    }

    // 批量删除调整记录
    async deleteAdjustments(purchaseOrderNumbers: string[]): Promise<{ success: number; failed: number }> {
        const connection = await this.getConnection();

        try {
            if (purchaseOrderNumbers.length === 0) {
                return { success: 0, failed: 0 };
            }

            let success = 0;
            let failed = 0;

            for (const purchaseOrderNumber of purchaseOrderNumbers) {
                try {
                    await this.deleteAdjustment(purchaseOrderNumber);
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

