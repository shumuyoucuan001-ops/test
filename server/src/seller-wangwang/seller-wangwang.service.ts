import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';
import { OperationLogService } from '../operation-log/operation-log.service';

export interface SellerWangwangItem {
    '供应商编码': string;
    '卖家旺旺': string;
}

@Injectable()
export class SellerWangwangService {
    constructor(
        private prisma: PrismaService,
        private operationLogService: OperationLogService,
    ) { }

    private table = '`sm_chaigou`.`卖家旺旺`';

    async list(
        filters?: {
            供应商编码?: string;
            卖家旺旺?: string;
            keyword?: string; // 关键词搜索（全字段）
        },
        page: number = 1,
        limit: number = 20
    ): Promise<{ data: SellerWangwangItem[]; total: number }> {
        const offset = (page - 1) * limit;
        const orderBy = `ORDER BY \`供应商编码\`, \`卖家旺旺\``;

        // 构建搜索条件
        const clauses: string[] = [];
        const params: any[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // 关键词搜索（OR across all columns）
        if (filters?.keyword?.trim()) {
            const like = buildLike(filters.keyword);
            const whereCondition = `(
                \`供应商编码\` LIKE ? OR 
                \`卖家旺旺\` LIKE ?
            )`;
            clauses.push(whereCondition);
            params.push(like, like);
        }

        // 按字段精确搜索（AND）
        if (filters?.供应商编码?.trim()) {
            clauses.push(`\`供应商编码\` LIKE ?`);
            params.push(buildLike(filters.供应商编码));
        }
        if (filters?.卖家旺旺?.trim()) {
            clauses.push(`\`卖家旺旺\` LIKE ?`);
            params.push(buildLike(filters.卖家旺旺));
        }

        // 构建 WHERE 条件
        const whereCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        // 构建 SQL
        const countSql = `SELECT COUNT(*) as total 
            FROM ${this.table}
            ${whereCondition}`;
        const sql = `SELECT 
            \`供应商编码\`,
            \`卖家旺旺\`
         FROM ${this.table}
         ${whereCondition}
         ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`;

        const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
        const total = Number(countRows?.total || 0);

        const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
        const data = (rows || []).map(r => {
            return {
                '供应商编码': String(r['供应商编码'] || ''),
                '卖家旺旺': String(r['卖家旺旺'] || ''),
            };
        });

        return { data, total };
    }

    async create(item: SellerWangwangItem, userId?: number, userName?: string): Promise<void> {
        this.validate(item);

        try {
            await this.prisma.$executeRawUnsafe(
                `INSERT INTO ${this.table} (
                    \`供应商编码\`, \`卖家旺旺\`
                ) VALUES (?, ?)`,
                item['供应商编码'] || '',
                item['卖家旺旺'] || '',
            );

            // 记录操作日志
            await this.operationLogService.logOperation({
                userId: userId,
                displayName: userName,
                operationType: 'CREATE',
                targetDatabase: 'sm_chaigou',
                targetTable: '卖家旺旺',
                recordIdentifier: { 
                    供应商编码: item['供应商编码'],
                    卖家旺旺: item['卖家旺旺']
                },
                changes: {},
                operationDetails: { new_data: item },
            });
        } catch (error: any) {
            Logger.error('[SellerWangwangService] Create error:', error);
            // 捕获数据库主键冲突错误（多种格式）
            if (error?.code === 'P2010' ||
                error?.code === 'ER_DUP_ENTRY' ||
                error?.errno === 1062 ||
                (error?.meta?.code === '1062' && error?.meta?.message?.includes('Duplicate entry')) ||
                (error?.message && error.message.includes('Duplicate entry'))) {
                throw new BadRequestException('该记录已存在');
            }
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error?.message || '创建失败');
        }
    }

    async update(original: SellerWangwangItem, data: SellerWangwangItem, userId?: number, userName?: string): Promise<void> {
        this.validate(data);

        // 构建变更记录
        const changes: Record<string, { old?: any; new?: any }> = {};
        if (original['供应商编码'] !== data['供应商编码']) {
            changes['供应商编码'] = { old: original['供应商编码'], new: data['供应商编码'] };
        }
        if (original['卖家旺旺'] !== data['卖家旺旺']) {
            changes['卖家旺旺'] = { old: original['卖家旺旺'], new: data['卖家旺旺'] };
        }

        // 检查主键是否发生变化
        const primaryKeyChanged = original['供应商编码'] !== data['供应商编码'] || original['卖家旺旺'] !== data['卖家旺旺'];

        if (primaryKeyChanged) {
            // 如果主键发生变化，需要先删除旧记录，再创建新记录
            // 检查新记录是否已存在
            const exists = await this.checkExists(data);
            if (exists) {
                throw new BadRequestException('新记录已存在，无法更新');
            }

            // 删除旧记录
            const deleted = await this.prisma.$executeRawUnsafe(
                `DELETE FROM ${this.table} WHERE \`供应商编码\`=? AND \`卖家旺旺\`=?`,
                original['供应商编码'] || '',
                original['卖家旺旺'] || '',
            );
            // @ts-ignore
            if (!deleted) {
                throw new BadRequestException('未找到原记录，更新失败');
            }

            // 创建新记录
            await this.prisma.$executeRawUnsafe(
                `INSERT INTO ${this.table} (
                    \`供应商编码\`, \`卖家旺旺\`
                ) VALUES (?, ?)`,
                data['供应商编码'] || '',
                data['卖家旺旺'] || '',
            );
        } else {
            // 主键未变化，直接更新（虽然在这个表中所有字段都是主键，所以这种情况不会发生）
            // 但为了代码完整性，保留这个逻辑
            const affected = await this.prisma.$executeRawUnsafe(
                `UPDATE ${this.table}
           SET \`供应商编码\`=?, \`卖家旺旺\`=?
           WHERE \`供应商编码\`=? AND \`卖家旺旺\`=?`,
                data['供应商编码'] || '',
                data['卖家旺旺'] || '',
                original['供应商编码'] || '',
                original['卖家旺旺'] || '',
            );
            // @ts-ignore Prisma returns number for executeRawUnsafe
            if (!affected) {
                throw new BadRequestException('未找到原记录，更新失败');
            }
        }

        // 记录操作日志
        await this.operationLogService.logOperation({
            userId: userId,
            displayName: userName,
            operationType: 'UPDATE',
            targetDatabase: 'sm_chaigou',
            targetTable: '卖家旺旺',
            recordIdentifier: { 
                供应商编码: data['供应商编码'],
                卖家旺旺: data['卖家旺旺']
            },
            changes: changes,
            operationDetails: { 
                original_data: original,
                new_data: data 
            },
        });
    }

    async remove(item: SellerWangwangItem, userId?: number, userName?: string): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`供应商编码\`=? AND \`卖家旺旺\`=?`,
            item['供应商编码'] || '',
            item['卖家旺旺'] || '',
        );
        // @ts-ignore
        if (!affected) {
            throw new BadRequestException('未找到记录，删除失败');
        }

        // 记录操作日志
        await this.operationLogService.logOperation({
            userId: userId,
            displayName: userName,
            operationType: 'DELETE',
            targetDatabase: 'sm_chaigou',
            targetTable: '卖家旺旺',
            recordIdentifier: { 
                供应商编码: item['供应商编码'],
                卖家旺旺: item['卖家旺旺']
            },
            changes: {},
            operationDetails: { deleted_data: item },
        });
    }

    async batchRemove(items: SellerWangwangItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; deletedCount: number }> {
        if (!items || items.length === 0) {
            throw new BadRequestException('请选择要删除的记录');
        }

        let deletedCount = 0;
        const errors: string[] = [];

        for (const item of items) {
            try {
                const affected = await this.prisma.$executeRawUnsafe(
                    `DELETE FROM ${this.table} WHERE \`供应商编码\`=? AND \`卖家旺旺\`=?`,
                    item['供应商编码'] || '',
                    item['卖家旺旺'] || '',
                );
                // @ts-ignore
                if (affected) {
                    deletedCount++;
                    // 记录操作日志
                    await this.operationLogService.logOperation({
                        userId: userId,
                        displayName: userName,
                        operationType: 'DELETE',
                        targetDatabase: 'sm_chaigou',
                        targetTable: '卖家旺旺',
                        recordIdentifier: { 
                            供应商编码: item['供应商编码'],
                            卖家旺旺: item['卖家旺旺']
                        },
                        changes: {},
                        operationDetails: { deleted_data: item },
                    });
                }
            } catch (error: any) {
                errors.push(`删除失败: ${item['供应商编码']}/${item['卖家旺旺']} - ${error?.message || '未知错误'}`);
            }
        }

        if (deletedCount === 0 && errors.length > 0) {
            throw new BadRequestException(errors.join('; '));
        }

        return {
            success: true,
            message: errors.length > 0
                ? `成功删除 ${deletedCount} 条记录，${errors.length} 条失败`
                : `成功删除 ${deletedCount} 条记录`,
            deletedCount,
        };
    }

    async batchCreate(items: SellerWangwangItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> {
        if (!items || items.length === 0) {
            throw new BadRequestException('请提供要创建的数据');
        }

        // 验证所有数据
        for (const item of items) {
            this.validate(item);
        }

        let createdCount = 0;
        const errors: string[] = [];

        // 逐条插入，避免批量插入时的错误处理复杂
        for (const item of items) {
            try {
                await this.create(item, userId, userName);
                createdCount++;
            } catch (error: any) {
                const errorMsg = error?.message || '创建失败';
                errors.push(`${item['供应商编码']}/${item['卖家旺旺']}: ${errorMsg}`);
            }
        }

        if (createdCount === 0 && errors.length > 0) {
            throw new BadRequestException(errors.join('; '));
        }

        return {
            success: createdCount > 0,
            message: errors.length > 0
                ? `成功创建 ${createdCount} 条记录，${errors.length} 条失败`
                : `成功创建 ${createdCount} 条记录`,
            createdCount,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    async checkExists(item: SellerWangwangItem): Promise<boolean> {
        // 检查记录是否已存在
        const checkSql = `SELECT * FROM ${this.table} WHERE \`供应商编码\` = ? AND \`卖家旺旺\` = ?`;
        const existing: any[] = await this.prisma.$queryRawUnsafe(
            checkSql,
            item['供应商编码'] || '',
            item['卖家旺旺'] || ''
        );
        return existing && existing.length > 0;
    }

    async checkBatchExists(items: SellerWangwangItem[]): Promise<{ exists: boolean; duplicateItems: SellerWangwangItem[] }> {
        const duplicateItems: SellerWangwangItem[] = [];
        for (const item of items) {
            const exists = await this.checkExists(item);
            if (exists) {
                duplicateItems.push(item);
            }
        }
        return {
            exists: duplicateItems.length > 0,
            duplicateItems
        };
    }

    private validate(item: SellerWangwangItem) {
        if (!item['供应商编码'] || !item['供应商编码'].trim()) {
            throw new BadRequestException('供应商编码为必填');
        }
        if (!item['卖家旺旺'] || !item['卖家旺旺'].trim()) {
            throw new BadRequestException('卖家旺旺为必填');
        }
    }
}

