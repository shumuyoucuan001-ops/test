
import { BadRequestException, Injectable } from '@nestjs/common';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

export interface OpsShelfExclusionItem {
    'SPU': string;
    '门店编码': string;
    '渠道编码': string;
    '备注'?: string | null;
}

@Injectable()
export class OpsShelfExclusionService {
    constructor(
        private prisma: PrismaService,
        private operationLogService: OperationLogService,
    ) { }

    private table = '`sm_shangping`.`商品上下架排除规则`';

    // 获取门店列表（用于下拉选择）
    async getStoreList(): Promise<Array<{ storeId: string; storeName: string }>> {
        try {
            const rows: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT DISTINCT \`门店ID\` AS storeId, \`门店名称\` AS storeName
                 FROM \`sm_shezhijichuxinxi\`.\`门店信息\`
                 WHERE \`门店ID\` IS NOT NULL AND TRIM(\`门店ID\`) <> ''
                   AND \`门店名称\` IS NOT NULL AND TRIM(\`门店名称\`) <> ''
                 ORDER BY \`门店ID\``
            );
            return (rows || []).map(r => ({
                storeId: String(r.storeId || '').trim(),
                storeName: String(r.storeName || '').trim(),
            })).filter(item => item.storeId && item.storeName);
        } catch (error) {
            Logger.error('[OpsShelfExclusionService] 获取门店列表失败:', error);
            return [];
        }
    }

    async list(
        filters?: {
            门店编码?: string;
            SPU?: string;
            渠道编码?: string;
            keyword?: string; // 关键词搜索（全字段）
        },
        page: number = 1,
        limit: number = 20
    ): Promise<{ data: OpsShelfExclusionItem[]; total: number }> {
        const offset = (page - 1) * limit;
        const orderBy = `ORDER BY \`SPU\`, \`门店编码\`, \`渠道编码\``;

        // 构建搜索条件
        const clauses: string[] = [];
        const params: any[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // 关键词搜索（OR across all columns）
        if (filters?.keyword?.trim()) {
            const like = buildLike(filters.keyword);
            const whereCondition = `(\`SPU\` LIKE ? OR \`门店编码\` LIKE ? OR \`渠道编码\` LIKE ? OR \`备注\` LIKE ?)`;
            clauses.push(whereCondition);
            params.push(like, like, like, like);
        }

        // 按字段精确搜索（AND）
        // 支持多选：如果值包含逗号，则分割并使用IN查询
        if (filters?.SPU?.trim()) {
            clauses.push(`\`SPU\` LIKE ?`);
            params.push(buildLike(filters.SPU));
        }
        if (filters?.门店编码?.trim()) {
            const values = filters.门店编码.split(',').map(v => v.trim());
            // 保留空字符串，因为空字符串代表"全部门店"
            const nonEmptyValues = values.filter(v => v);
            if (values.length > 0) {
                // 处理"全部门店"的特殊情况（空字符串或"全部门店"）
                const hasAllStores = values.includes('') || values.includes('全部门店');
                const storeIds = nonEmptyValues.filter(v => v !== '全部门店');

                if (hasAllStores && storeIds.length === 0) {
                    // 只选择了"全部门店"，只查询门店编码='全部门店'的数据
                    clauses.push(`\`门店编码\` = '全部门店'`);
                } else if (hasAllStores && storeIds.length > 0) {
                    // 同时选择了"全部门店"和其他门店
                    const placeholders = storeIds.map(() => '?').join(',');
                    clauses.push(`(\`门店编码\` = '全部门店' OR \`门店编码\` IN (${placeholders}))`);
                    params.push(...storeIds);
                } else {
                    // 只选择了具体门店
                    if (storeIds.length === 1) {
                        clauses.push(`\`门店编码\` = ?`);
                        params.push(storeIds[0]);
                    } else {
                        const placeholders = storeIds.map(() => '?').join(',');
                        clauses.push(`\`门店编码\` IN (${placeholders})`);
                        params.push(...storeIds);
                    }
                }
            }
        }
        if (filters?.渠道编码?.trim()) {
            clauses.push(`\`渠道编码\` LIKE ?`);
            params.push(buildLike(filters.渠道编码));
        }

        // 构建 WHERE 条件
        const whereCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        // 构建 SQL
        const countSql = `SELECT COUNT(*) as total FROM ${this.table} ${whereCondition}`;
        const sql = `SELECT \`SPU\`, \`门店编码\`, \`渠道编码\`, \`备注\`
         FROM ${this.table}
         ${whereCondition}
         ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`;

        const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
        const total = Number(countRows?.total || 0);

        const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
        const data = (rows || []).map(r => ({
            'SPU': String(r['SPU'] || ''),
            '门店编码': String(r['门店编码'] || ''),
            '渠道编码': String(r['渠道编码'] || ''),
            '备注': r['备注'] ? String(r['备注']) : null,
        }));

        return { data, total };
    }

    async create(item: OpsShelfExclusionItem, userId?: number, userName?: string): Promise<void> {
        this.validate(item, true); // 单独新增时，SPU不是必填项
        try {
            await this.prisma.$executeRawUnsafe(
                `INSERT INTO ${this.table} (\`SPU\`, \`门店编码\`, \`渠道编码\`, \`备注\`) VALUES (?, ?, ?, ?)`,
                item['SPU'] || '',
                item['门店编码'] || '',
                item['渠道编码'] || '',
                item['备注'] || null,
            );

            // 记录操作日志
            await this.operationLogService.logOperation({
                userId: userId,
                displayName: userName,
                operationType: 'CREATE',
                targetDatabase: 'sm_shangping',
                targetTable: '商品上下架排除规则',
                recordIdentifier: {
                    SPU: item['SPU'],
                    门店编码: item['门店编码'],
                    渠道编码: item['渠道编码'],
                },
                changes: {},
                operationDetails: { new_data: item },
            });
        } catch (error: any) {
            Logger.error('[OpsShelfExclusionService] Create error:', error);
            // 捕获数据库主键冲突错误（多种格式）
            if (error?.code === 'P2010' ||
                error?.code === 'ER_DUP_ENTRY' ||
                error?.errno === 1062 ||
                (error?.meta?.code === '1062' && error?.meta?.message?.includes('Duplicate entry')) ||
                (error?.message && error.message.includes('Duplicate entry'))) {
                throw new BadRequestException('该数据已存在');
            }
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error?.message || '创建失败');
        }
    }

    async update(original: OpsShelfExclusionItem, data: OpsShelfExclusionItem, userId?: number, userName?: string): Promise<void> {
        this.validate(data, true); // 更新时，SPU不是必填项
        const affected = await this.prisma.$executeRawUnsafe(
            `UPDATE ${this.table}
       SET \`SPU\`=?, \`门店编码\`=?, \`渠道编码\`=?, \`备注\`=?
       WHERE \`SPU\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`渠道编码\`, '') = COALESCE(?, '')`,
            data['SPU'] || '', data['门店编码'] || '', data['渠道编码'] || '', data['备注'] || null,
            original['SPU'] || '', original['门店编码'] || '', original['渠道编码'] || '',
        );
        // @ts-ignore Prisma returns number for executeRawUnsafe
        if (!affected) {
            throw new BadRequestException('未找到原记录，更新失败');
        }

        // 记录操作日志
        const changes: Record<string, { old?: any; new?: any }> = {};
        if (original['SPU'] !== data['SPU']) {
            changes['SPU'] = { old: original['SPU'], new: data['SPU'] };
        }
        if (original['门店编码'] !== data['门店编码']) {
            changes['门店编码'] = { old: original['门店编码'], new: data['门店编码'] };
        }
        if (original['渠道编码'] !== data['渠道编码']) {
            changes['渠道编码'] = { old: original['渠道编码'], new: data['渠道编码'] };
        }
        if (original['备注'] !== data['备注']) {
            changes['备注'] = { old: original['备注'], new: data['备注'] };
        }

        await this.operationLogService.logOperation({
            userId: userId,
            displayName: userName,
            operationType: 'UPDATE',
            targetDatabase: 'sm_shangping',
            targetTable: '商品上下架排除规则',
            recordIdentifier: {
                SPU: original['SPU'],
                门店编码: original['门店编码'],
                渠道编码: original['渠道编码'],
            },
            changes: changes,
            operationDetails: { original, updated: data },
        });
    }

    async remove(item: OpsShelfExclusionItem, userId?: number, userName?: string): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`SPU\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`渠道编码\`, '') = COALESCE(?, '')`,
            item['SPU'] || '', item['门店编码'] || '', item['渠道编码'] || '',
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
            targetDatabase: 'sm_shangping',
            targetTable: '商品上下架排除规则',
            recordIdentifier: {
                SPU: item['SPU'],
                门店编码: item['门店编码'],
                渠道编码: item['渠道编码'],
            },
            changes: {},
            operationDetails: { deleted_data: item },
        });
    }

    async batchRemove(items: OpsShelfExclusionItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; deletedCount: number }> {
        if (!items || items.length === 0) {
            throw new BadRequestException('请选择要删除的记录');
        }

        let deletedCount = 0;
        const errors: string[] = [];

        for (const item of items) {
            try {
                const affected = await this.prisma.$executeRawUnsafe(
                    `DELETE FROM ${this.table} WHERE \`SPU\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`渠道编码\`, '') = COALESCE(?, '')`,
                    item['SPU'] || '', item['门店编码'] || '', item['渠道编码'] || '',
                );
                // @ts-ignore
                if (affected) {
                    deletedCount++;
                    // 记录操作日志
                    await this.operationLogService.logOperation({
                        userId: userId,
                        displayName: userName,
                        operationType: 'DELETE',
                        targetDatabase: 'sm_shangping',
                        targetTable: '商品上下架排除规则',
                        recordIdentifier: {
                            SPU: item['SPU'],
                            门店编码: item['门店编码'],
                            渠道编码: item['渠道编码'],
                        },
                        changes: {},
                        operationDetails: { deleted_data: item },
                    });
                }
            } catch (error: any) {
                errors.push(`删除失败: ${item['SPU']} - ${error?.message || '未知错误'}`);
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

    async batchCreate(items: OpsShelfExclusionItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> {
        if (!items || items.length === 0) {
            throw new BadRequestException('请提供要创建的数据');
        }

        // 验证所有数据（批量新增时，SPU不是必填项）
        for (const item of items) {
            this.validate(item, true);
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
                errors.push(`${item['SPU']}: ${errorMsg}`);
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

    async checkExists(item: OpsShelfExclusionItem): Promise<boolean> {
        // 仅检查SPU是否已存在
        const checkSql = `SELECT * FROM ${this.table} WHERE \`SPU\` = ?`;
        const existing: any[] = await this.prisma.$queryRawUnsafe(
            checkSql,
            item['SPU'] || ''
        );
        return existing && existing.length > 0;
    }

    async checkBatchExists(items: OpsShelfExclusionItem[]): Promise<{ exists: boolean; duplicateItems: OpsShelfExclusionItem[] }> {
        const duplicateItems: OpsShelfExclusionItem[] = [];
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

    private validate(item: OpsShelfExclusionItem, allowEmptySPU: boolean = false) {
        if (!allowEmptySPU && !item['SPU']) {
            throw new BadRequestException('SPU为必填');
        }
    }
}

