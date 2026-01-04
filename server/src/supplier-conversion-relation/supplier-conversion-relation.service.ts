
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';
import { OperationLogService } from '../operation-log/operation-log.service';

export interface SupplierConversionRelationItem {
    '供应商编码': string;
    '*SKU编码': string;
    '换算关系': string;
    '二次换算关系': string;
    '数据更新时间': string | Date | null;
}

@Injectable()
export class SupplierConversionRelationService {
    constructor(
        private prisma: PrismaService,
        private operationLogService: OperationLogService,
    ) { }

    private table = '`sm_chaigou`.`供应商推送换算关系变更`';

    async list(
        filters?: {
            供应商编码?: string;
            '*SKU编码'?: string;
            换算关系?: string;
            二次换算关系?: string;
            keyword?: string; // 关键词搜索（全字段）
        },
        page: number = 1,
        limit: number = 20
    ): Promise<{ data: SupplierConversionRelationItem[]; total: number }> {
        const offset = (page - 1) * limit;
        const orderBy = `ORDER BY \`数据更新时间\` DESC, \`供应商编码\`, \`*SKU编码\``;

        // 构建搜索条件
        const clauses: string[] = [];
        const params: any[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // 关键词搜索（OR across all columns）
        if (filters?.keyword?.trim()) {
            const like = buildLike(filters.keyword);
            const whereCondition = `(
                \`供应商编码\` LIKE ? OR 
                \`*SKU编码\` LIKE ? OR 
                \`换算关系\` LIKE ? OR 
                \`二次换算关系\` LIKE ?
            )`;
            clauses.push(whereCondition);
            params.push(like, like, like, like);
        }

        // 按字段精确搜索（AND）
        if (filters?.['供应商编码']?.trim()) {
            clauses.push(`\`供应商编码\` LIKE ?`);
            params.push(buildLike(filters['供应商编码']));
        }
        if (filters?.['*SKU编码']?.trim()) {
            clauses.push(`\`*SKU编码\` LIKE ?`);
            params.push(buildLike(filters['*SKU编码']));
        }
        if (filters?.['换算关系']?.trim()) {
            clauses.push(`\`换算关系\` LIKE ?`);
            params.push(buildLike(filters['换算关系']));
        }
        if (filters?.['二次换算关系']?.trim()) {
            clauses.push(`\`二次换算关系\` LIKE ?`);
            params.push(buildLike(filters['二次换算关系']));
        }

        // 构建 WHERE 条件
        const whereCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        // 构建 SQL
        const countSql = `SELECT COUNT(*) as total 
            FROM ${this.table}
            ${whereCondition}`;
        const sql = `SELECT 
            \`供应商编码\`,
            \`*SKU编码\`,
            \`换算关系\`,
            \`二次换算关系\`,
            DATE_FORMAT(\`数据更新时间\`, '%Y-%m-%d %H:%i:%s') as \`数据更新时间\`
         FROM ${this.table}
         ${whereCondition}
         ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`;

        const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
        const total = Number(countRows?.total || 0);

        const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
        const data = (rows || []).map(r => {
            const 数据更新时间 = r['数据更新时间'] || null;

            return {
                '供应商编码': String(r['供应商编码'] || ''),
                '*SKU编码': String(r['*SKU编码'] || ''),
                '换算关系': String(r['换算关系'] || ''),
                '二次换算关系': String(r['二次换算关系'] || ''),
                '数据更新时间': 数据更新时间,
            };
        });

        return { data, total };
    }

    async create(item: SupplierConversionRelationItem, userId?: number, userName?: string): Promise<void> {
        this.validate(item);

        try {
            await this.prisma.$executeRawUnsafe(
                `INSERT INTO ${this.table} (
                    \`供应商编码\`, \`*SKU编码\`, \`换算关系\`, \`二次换算关系\`, \`数据更新时间\`
                ) VALUES (?, ?, ?, ?, NOW())`,
                item['供应商编码'] || '',
                item['*SKU编码'] || '',
                item['换算关系'] || '',
                item['二次换算关系'] || '',
            );

            // 记录操作日志
            await this.operationLogService.logOperation({
                userId: userId,
                displayName: userName,
                operationType: 'CREATE',
                targetDatabase: 'sm_chaigou',
                targetTable: '供应商推送换算关系变更',
                recordIdentifier: {
                    供应商编码: item['供应商编码'],
                    SKU编码: item['*SKU编码'],
                },
                changes: {},
                operationDetails: { new_data: item },
            });
        } catch (error: any) {
            Logger.error('[SupplierConversionRelationService] Create error:', error);
            // 捕获数据库主键冲突错误（多种格式）
            if (error?.code === 'P2010' ||
                error?.code === 'ER_DUP_ENTRY' ||
                error?.errno === 1062 ||
                (error?.meta?.code === '1062' && error?.meta?.message?.includes('Duplicate entry')) ||
                (error?.message && error.message.includes('Duplicate entry'))) {
                throw new BadRequestException('该记录已存在（供应商编码和SKU编码的组合已存在）');
            }
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error?.message || '创建失败');
        }
    }

    async update(original: SupplierConversionRelationItem, data: SupplierConversionRelationItem, userId?: number, userName?: string): Promise<void> {
        this.validate(data);

        // 供应商编码和*SKU编码是主键，更新时不应该修改这两个字段
        const affected = await this.prisma.$executeRawUnsafe(
            `UPDATE ${this.table}
       SET \`换算关系\`=?, \`二次换算关系\`=?, \`数据更新时间\`=NOW()
       WHERE \`供应商编码\`=? AND \`*SKU编码\`=?`,
            data['换算关系'] || '',
            data['二次换算关系'] || '',
            original['供应商编码'] || '',
            original['*SKU编码'] || '',
        );
        // @ts-ignore Prisma returns number for executeRawUnsafe
        if (!affected) {
            throw new BadRequestException('未找到原记录，更新失败');
        }

        // 记录操作日志
        const changes: Record<string, { old?: any; new?: any }> = {};
        if (original['换算关系'] !== data['换算关系']) {
            changes['换算关系'] = { old: original['换算关系'], new: data['换算关系'] };
        }
        if (original['二次换算关系'] !== data['二次换算关系']) {
            changes['二次换算关系'] = { old: original['二次换算关系'], new: data['二次换算关系'] };
        }

        await this.operationLogService.logOperation({
            userId: userId,
            displayName: userName,
            operationType: 'UPDATE',
            targetDatabase: 'sm_chaigou',
            targetTable: '供应商推送换算关系变更',
            recordIdentifier: {
                供应商编码: original['供应商编码'],
                SKU编码: original['*SKU编码'],
            },
            changes: changes,
            operationDetails: { original, updated: data },
        });
    }

    async remove(item: SupplierConversionRelationItem, userId?: number, userName?: string): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`供应商编码\`=? AND \`*SKU编码\`=?`,
            item['供应商编码'] || '',
            item['*SKU编码'] || '',
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
            targetTable: '供应商推送换算关系变更',
            recordIdentifier: {
                供应商编码: item['供应商编码'],
                SKU编码: item['*SKU编码'],
            },
            changes: {},
            operationDetails: { deleted_data: item },
        });
    }

    async batchRemove(items: SupplierConversionRelationItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; deletedCount: number }> {
        if (!items || items.length === 0) {
            throw new BadRequestException('请选择要删除的记录');
        }

        let deletedCount = 0;
        const errors: string[] = [];

        for (const item of items) {
            try {
                const affected = await this.prisma.$executeRawUnsafe(
                    `DELETE FROM ${this.table} WHERE \`供应商编码\`=? AND \`*SKU编码\`=?`,
                    item['供应商编码'] || '',
                    item['*SKU编码'] || '',
                );
                // @ts-ignore
                if (affected) {
                    deletedCount++;
                }
            } catch (error: any) {
                errors.push(`删除失败: ${item['供应商编码']}/${item['*SKU编码']} - ${error?.message || '未知错误'}`);
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

    async batchCreate(items: SupplierConversionRelationItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> {
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
                await this.create(item);
                createdCount++;
            } catch (error: any) {
                const errorMsg = error?.message || '创建失败';
                errors.push(`${item['供应商编码']}/${item['*SKU编码']}: ${errorMsg}`);
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

    async checkExists(item: SupplierConversionRelationItem): Promise<boolean> {
        // 检查供应商编码和SKU编码的组合是否已存在
        const checkSql = `SELECT * FROM ${this.table} WHERE \`供应商编码\` = ? AND \`*SKU编码\` = ?`;
        const existing: any[] = await this.prisma.$queryRawUnsafe(
            checkSql,
            item['供应商编码'] || '',
            item['*SKU编码'] || ''
        );
        return existing && existing.length > 0;
    }

    async checkBatchExists(items: SupplierConversionRelationItem[]): Promise<{ exists: boolean; duplicateItems: SupplierConversionRelationItem[] }> {
        const duplicateItems: SupplierConversionRelationItem[] = [];
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

    private validate(item: SupplierConversionRelationItem) {
        if (!item['供应商编码'] || !item['供应商编码'].trim()) {
            throw new BadRequestException('供应商编码为必填');
        }
        if (!item['*SKU编码'] || !item['*SKU编码'].trim()) {
            throw new BadRequestException('SKU编码为必填');
        }
        // 换算关系为可选字段，不进行必填验证
        if (!item['二次换算关系'] || !item['二次换算关系'].trim()) {
            throw new BadRequestException('二次换算关系为必填');
        }
    }
}

