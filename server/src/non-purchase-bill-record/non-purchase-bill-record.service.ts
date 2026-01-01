import { BadRequestException, Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Logger } from '../utils/logger.util';

export interface NonPurchaseBillRecord {
    账单流水: string; // 主键
    记账金额?: number;
    账单类型?: string;
    所属仓店?: string;
    账单流水备注?: string;
    图片?: string; // base64编码的图片数据
    财务记账凭证号?: string;
    财务审核状态?: string;
    记录修改人?: string;
    财务审核人?: string;
    记录增加时间?: Date;
    最近修改时间?: Date;
}

@Injectable()
export class NonPurchaseBillRecordService {
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

    private async getXitongkaifaConnection() {
        if (!process.env.DB_PASSWORD) {
            throw new Error('DB_PASSWORD environment variable is required');
        }
        return await mysql.createConnection({
            host: process.env.DB_HOST || 'guishumu999666.rwlb.rds.aliyuncs.com',
            user: process.env.DB_USER || 'xitongquanju',
            password: process.env.DB_PASSWORD,
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
            Logger.error('[NonPurchaseBillRecordService] Failed to get display_name:', error);
            return null;
        } finally {
            await connection.end();
        }
    }

    // 获取所有记录（分页）
    async getAllRecords(
        page: number = 1,
        limit: number = 20,
        search?: string,
        账单流水?: string,
        账单类型?: string,
        所属仓店?: string,
        财务审核状态?: string,
        记录修改人?: string,
    ): Promise<{ data: NonPurchaseBillRecord[]; total: number }> {
        const connection = await this.getConnection();

        try {
            const offset = (page - 1) * limit;

            // 构建搜索条件
            let whereClause = '1=1';
            const queryParams: any[] = [];

            // 综合搜索（搜索所有字段）
            if (search) {
                whereClause += ' AND (账单流水 LIKE ? OR 账单类型 LIKE ? OR 所属仓店 LIKE ? OR 账单流水备注 LIKE ? OR 财务记账凭证号 LIKE ? OR 记录修改人 LIKE ? OR 财务审核人 LIKE ?)';
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }

            // 单独的字段搜索
            if (账单流水) {
                whereClause += ' AND 账单流水 LIKE ?';
                queryParams.push(`%${账单流水}%`);
            }
            if (账单类型) {
                whereClause += ' AND 账单类型 LIKE ?';
                queryParams.push(`%${账单类型}%`);
            }
            if (所属仓店) {
                whereClause += ' AND 所属仓店 LIKE ?';
                queryParams.push(`%${所属仓店}%`);
            }
            if (财务审核状态) {
                whereClause += ' AND 财务审核状态 LIKE ?';
                queryParams.push(`%${财务审核状态}%`);
            }
            if (记录修改人) {
                whereClause += ' AND 记录修改人 LIKE ?';
                queryParams.push(`%${记录修改人}%`);
            }

            // 获取总数
            const totalQuery = `
                SELECT COUNT(*) as count 
                FROM \`非采购单流水记录\` 
                WHERE ${whereClause}
            `;
            const [totalResult]: any = await connection.execute(totalQuery, queryParams);
            const total = totalResult[0].count;

            // 获取数据
            const dataQuery = `
                SELECT 
                    账单流水,
                    记账金额,
                    账单类型,
                    所属仓店,
                    账单流水备注,
                    图片,
                    财务记账凭证号,
                    财务审核状态,
                    记录修改人,
                    财务审核人,
                    记录增加时间,
                    最近修改时间
                FROM \`非采购单流水记录\`
                WHERE ${whereClause}
                ORDER BY 最近修改时间 DESC, 记录增加时间 DESC
                LIMIT ? OFFSET ?
            `;

            const [data]: any = await connection.execute(
                dataQuery,
                [...queryParams, limit, offset]
            );

            return {
                data: data.map((row: any) => ({
                    账单流水: row.账单流水,
                    记账金额: row.记账金额 ? Number(row.记账金额) : undefined,
                    账单类型: row.账单类型 || undefined,
                    所属仓店: row.所属仓店 || undefined,
                    账单流水备注: row.账单流水备注 || undefined,
                    图片: row.图片 ? Buffer.from(row.图片).toString('base64') : undefined,
                    财务记账凭证号: row.财务记账凭证号 || undefined,
                    财务审核状态: row.财务审核状态 || undefined,
                    记录修改人: row.记录修改人 || undefined,
                    财务审核人: row.财务审核人 || undefined,
                    记录增加时间: row.记录增加时间 || undefined,
                    最近修改时间: row.最近修改时间 || undefined,
                })),
                total,
            };
        } catch (error: any) {
            Logger.error('[NonPurchaseBillRecordService] Failed to get all records:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 获取单个记录
    async getRecord(账单流水: string): Promise<NonPurchaseBillRecord | null> {
        const connection = await this.getConnection();

        try {
            const query = `
                SELECT 
                    账单流水,
                    记账金额,
                    账单类型,
                    所属仓店,
                    账单流水备注,
                    图片,
                    财务记账凭证号,
                    财务审核状态,
                    记录修改人,
                    财务审核人,
                    记录增加时间,
                    最近修改时间
                FROM \`非采购单流水记录\`
                WHERE 账单流水 = ?
            `;

            const [result]: any = await connection.execute(query, [账单流水]);

            if (result.length === 0) {
                return null;
            }

            const row = result[0];
            return {
                账单流水: row.账单流水,
                记账金额: row.记账金额 ? Number(row.记账金额) : undefined,
                账单类型: row.账单类型 || undefined,
                所属仓店: row.所属仓店 || undefined,
                账单流水备注: row.账单流水备注 || undefined,
                图片: row.图片 ? Buffer.from(row.图片).toString('base64') : undefined,
                财务记账凭证号: row.财务记账凭证号 || undefined,
                财务审核状态: row.财务审核状态 || undefined,
                记录修改人: row.记录修改人 || undefined,
                财务审核人: row.财务审核人 || undefined,
                记录增加时间: row.记录增加时间 || undefined,
                最近修改时间: row.最近修改时间 || undefined,
            };
        } catch (error: any) {
            Logger.error('[NonPurchaseBillRecordService] Failed to get record:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 创建记录
    async createRecord(data: NonPurchaseBillRecord, userId?: number): Promise<NonPurchaseBillRecord> {
        const connection = await this.getConnection();

        try {
            // 获取修改人
            let 记录修改人: string | null = null;
            if (userId) {
                记录修改人 = await this.getDisplayNameByUserId(userId);
            }

            // 检查是否已存在（根据账单流水）
            const checkSql = `SELECT * FROM \`非采购单流水记录\` WHERE \`账单流水\` = ?`;
            const [existing]: any = await connection.execute(checkSql, [data.账单流水]);

            if (existing && existing.length > 0) {
                throw new BadRequestException('该账单流水已存在');
            }

            const insertQuery = `
                INSERT INTO \`非采购单流水记录\` 
                (账单流水, 记账金额, 账单类型, 所属仓店, 账单流水备注, 图片, 财务记账凭证号, 财务审核状态, 记录修改人, 财务审核人)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // 处理图片：将base64字符串转换为Buffer
            let imageBuffer: Buffer | null = null;
            if (data.图片) {
                imageBuffer = Buffer.from(data.图片, 'base64');
            }

            await connection.execute(insertQuery, [
                data.账单流水,
                data.记账金额 || null,
                data.账单类型 || null,
                data.所属仓店 || null,
                data.账单流水备注 || null,
                imageBuffer,
                data.财务记账凭证号 || null,
                data.财务审核状态 || '0', // 新增时默认为"0"
                记录修改人 || null,
                data.财务审核人 || null,
            ]);

            // 获取插入的记录
            const record = await this.getRecord(data.账单流水);
            if (!record) {
                throw new Error('创建记录失败');
            }
            return record;
        } catch (error: any) {
            Logger.error('[NonPurchaseBillRecordService] Failed to create record:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error?.message || '创建失败');
        } finally {
            await connection.end();
        }
    }

    // 批量创建记录
    async createRecords(records: NonPurchaseBillRecord[], userId?: number): Promise<{ success: number; failed: number; errors: string[] }> {
        const connection = await this.getConnection();

        try {
            // 获取修改人
            let 记录修改人: string | null = null;
            if (userId) {
                记录修改人 = await this.getDisplayNameByUserId(userId);
            }

            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            for (const record of records) {
                try {
                    // 检查是否已存在（根据账单流水）
                    const checkSql = `SELECT * FROM \`非采购单流水记录\` WHERE \`账单流水\` = ?`;
                    const [existing]: any = await connection.execute(checkSql, [record.账单流水]);

                    if (existing && existing.length > 0) {
                        throw new BadRequestException('该账单流水已存在');
                    }

                    const insertQuery = `
                        INSERT INTO \`非采购单流水记录\` 
                        (账单流水, 记账金额, 账单类型, 所属仓店, 账单流水备注, 图片, 财务记账凭证号, 财务审核状态, 记录修改人, 财务审核人)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    // 处理图片：将base64字符串转换为Buffer
                    let imageBuffer: Buffer | null = null;
                    if (record.图片) {
                        imageBuffer = Buffer.from(record.图片, 'base64');
                    }

                    await connection.execute(insertQuery, [
                        record.账单流水,
                        record.记账金额 || null,
                        record.账单类型 || null,
                        record.所属仓店 || null,
                        record.账单流水备注 || null,
                        imageBuffer,
                        record.财务记账凭证号 || null,
                        record.财务审核状态 || '0', // 批量新增时默认为"0"
                        记录修改人 || null,
                        record.财务审核人 || null,
                    ]);

                    success++;
                } catch (error: any) {
                    failed++;
                    if (error instanceof BadRequestException) {
                        errors.push(`账单流水 ${record.账单流水}: ${error.message}`);
                    } else {
                        errors.push(error.message || `账单流水 ${record.账单流水}: 创建失败`);
                    }
                }
            }

            return { success, failed, errors };
        } catch (error: any) {
            Logger.error('[NonPurchaseBillRecordService] Failed to create records:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 更新记录
    async updateRecord(账单流水: string, data: Partial<NonPurchaseBillRecord>, userId?: number): Promise<NonPurchaseBillRecord> {
        const connection = await this.getConnection();

        try {
            // 获取修改人
            let 记录修改人: string | null = null;
            if (userId) {
                记录修改人 = await this.getDisplayNameByUserId(userId);
            }

            // 构建更新字段
            const updateFields: string[] = [];
            const updateValues: any[] = [];

            if (data.记账金额 !== undefined) {
                updateFields.push('记账金额 = ?');
                updateValues.push(data.记账金额 || null);
            }
            if (data.账单类型 !== undefined) {
                updateFields.push('账单类型 = ?');
                updateValues.push(data.账单类型 || null);
            }
            if (data.所属仓店 !== undefined) {
                updateFields.push('所属仓店 = ?');
                updateValues.push(data.所属仓店 || null);
            }
            if (data.账单流水备注 !== undefined) {
                updateFields.push('账单流水备注 = ?');
                updateValues.push(data.账单流水备注 || null);
            }
            if (data.图片 !== undefined) {
                updateFields.push('图片 = ?');
                // 处理图片：将base64字符串转换为Buffer
                if (data.图片 && data.图片 !== '') {
                    updateValues.push(Buffer.from(data.图片, 'base64'));
                } else {
                    // 空字符串或undefined/null都表示清空图片
                    updateValues.push(null);
                }
            }
            if (data.财务记账凭证号 !== undefined) {
                updateFields.push('财务记账凭证号 = ?');
                updateValues.push(data.财务记账凭证号 || null);
            }
            if (data.财务审核状态 !== undefined) {
                updateFields.push('财务审核状态 = ?');
                updateValues.push(data.财务审核状态 || null);
            }
            if (data.财务审核人 !== undefined) {
                updateFields.push('财务审核人 = ?');
                updateValues.push(data.财务审核人 || null);
            }

            // 如果有修改，更新修改人和修改时间
            if (记录修改人) {
                updateFields.push('记录修改人 = ?');
                updateValues.push(记录修改人);
            }

            if (updateFields.length === 0) {
                throw new Error('没有需要更新的字段');
            }

            updateValues.push(账单流水);

            const updateQuery = `
                UPDATE \`非采购单流水记录\` 
                SET ${updateFields.join(', ')}
                WHERE 账单流水 = ?
            `;

            await connection.execute(updateQuery, updateValues);

            const record = await this.getRecord(账单流水);
            if (!record) {
                throw new Error('更新记录失败');
            }
            return record;
        } catch (error: any) {
            Logger.error('[NonPurchaseBillRecordService] Failed to update record:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 删除记录
    async deleteRecord(账单流水: string): Promise<boolean> {
        const connection = await this.getConnection();

        try {
            const deleteQuery = `DELETE FROM \`非采购单流水记录\` WHERE 账单流水 = ?`;
            await connection.execute(deleteQuery, [账单流水]);
            return true;
        } catch (error: any) {
            Logger.error('[NonPurchaseBillRecordService] Failed to delete record:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    // 批量删除记录
    async deleteRecords(账单流水列表: string[]): Promise<{ success: number; failed: number }> {
        const connection = await this.getConnection();

        try {
            if (账单流水列表.length === 0) {
                return { success: 0, failed: 0 };
            }

            let success = 0;
            let failed = 0;

            for (const 账单流水 of 账单流水列表) {
                try {
                    await this.deleteRecord(账单流水);
                    success++;
                } catch (error) {
                    failed++;
                }
            }

            return { success, failed };
        } catch (error: any) {
            Logger.error('[NonPurchaseBillRecordService] Failed to delete records:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }
}

