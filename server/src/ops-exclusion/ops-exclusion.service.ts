
import { BadRequestException, Injectable } from '@nestjs/common';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

export interface OpsExclusionItem {
    '视图名称': string;
    '门店编码': string;
    'SKU编码': string;
    'SPU编码': string;
    '商品名称'?: string | null;
    '商品UPC'?: string | null;
    '规格'?: string | null;
    '采购单价 (基础单位)'?: string | number | null;
    '采购单价 (采购单位)'?: string | number | null;
    '备注'?: string | null;
}

@Injectable()
export class OpsExclusionService {
    constructor(
        private prisma: PrismaService,
        private operationLogService: OperationLogService,
    ) { }

    private table = '`sm_cuxiaohuodong`.`活动视图排除规则`';

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
            Logger.error('[OpsExclusionService] 获取门店列表失败:', error);
            return [];
        }
    }

    async list(
        filters?: {
            视图名称?: string;
            门店编码?: string;
            SKU编码?: string;
            SPU编码?: string;
            keyword?: string; // 关键词搜索（全字段）
        },
        page: number = 1,
        limit: number = 20
    ): Promise<{ data: OpsExclusionItem[]; total: number }> {
        const offset = (page - 1) * limit;
        const orderBy = `ORDER BY t.\`视图名称\`, t.\`门店编码\`, t.\`SKU编码\`, t.\`SPU编码\``;

        // 构建搜索条件
        const clauses: string[] = [];
        const params: any[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // 关键词搜索（OR across all columns）
        if (filters?.keyword?.trim()) {
            const like = buildLike(filters.keyword);
            const whereCondition = `(t.\`视图名称\` LIKE ? OR t.\`门店编码\` LIKE ? OR t.\`SKU编码\` LIKE ? OR t.\`SPU编码\` LIKE ? OR t.\`备注\` LIKE ? OR p.\`商品名称\` LIKE ? OR p.\`商品UPC\` LIKE ? OR p.\`规格\` LIKE ?)`;
            clauses.push(whereCondition);
            params.push(like, like, like, like, like, like, like, like);
        }

        // 按字段精确搜索（AND）
        if (filters?.视图名称?.trim()) {
            const like = buildLike(filters.视图名称);
            clauses.push(`t.\`视图名称\` LIKE ?`);
            params.push(like);
        }
        if (filters?.门店编码?.trim()) {
            const like = buildLike(filters.门店编码);
            clauses.push(`t.\`门店编码\` LIKE ?`);
            params.push(like);
        }
        if (filters?.SKU编码?.trim()) {
            const like = buildLike(filters.SKU编码);
            clauses.push(`t.\`SKU编码\` LIKE ?`);
            params.push(like);
        }
        if (filters?.SPU编码?.trim()) {
            const like = buildLike(filters.SPU编码);
            clauses.push(`t.\`SPU编码\` LIKE ?`);
            params.push(like);
        }

        // 构建 WHERE 条件（主查询使用表别名，count查询去掉表别名）
        const whereCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
        // countSql需要去掉表别名t.
        const countWhereCondition = clauses.length > 0
            ? `WHERE ${clauses.join(' AND ').replace(/t\.`/g, '`')}`
            : '';

        // 构建 SQL
        const countSql = `SELECT COUNT(*) as total 
            FROM ${this.table} t
            LEFT JOIN (
                SELECT 
                    \`商品SKU\`,
                    MAX(\`采购单价 (基础单位)\`) AS \`采购单价 (基础单位)\`,
                    MAX(\`采购单价 (采购单位)\`) AS \`采购单价 (采购单位)\`,
                    MAX(\`商品名称\`) AS \`商品名称\`,
                    MAX(\`商品UPC\`) AS \`商品UPC\`,
                    MAX(\`规格\`) AS \`规格\`
                FROM \`sm_chaigou\`.\`仓店补货参考\`
                GROUP BY \`商品SKU\`
            ) p ON t.\`SKU编码\` = p.\`商品SKU\`
            ${countWhereCondition}`;
        const sql = `SELECT 
            t.\`视图名称\`, 
            t.\`门店编码\`, 
            t.\`SKU编码\`, 
            t.\`SPU编码\`,
            t.\`备注\`,
            p.\`采购单价 (基础单位)\`,
            p.\`采购单价 (采购单位)\`,
            p.\`商品名称\`,
            p.\`商品UPC\`,
            p.\`规格\`
         FROM ${this.table} t
         LEFT JOIN (
             SELECT 
                 \`商品SKU\`,
                 MAX(\`采购单价 (基础单位)\`) AS \`采购单价 (基础单位)\`,
                 MAX(\`采购单价 (采购单位)\`) AS \`采购单价 (采购单位)\`,
                 MAX(\`商品名称\`) AS \`商品名称\`,
                 MAX(\`商品UPC\`) AS \`商品UPC\`,
                 MAX(\`规格\`) AS \`规格\`
             FROM \`sm_chaigou\`.\`仓店补货参考\`
             GROUP BY \`商品SKU\`
         ) p ON t.\`SKU编码\` = p.\`商品SKU\`
         ${whereCondition}
         ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`;

        const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
        const total = Number(countRows?.total || 0);

        const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
        const data = (rows || []).map(r => ({
            '视图名称': String(r['视图名称'] || ''),
            '门店编码': String(r['门店编码'] || ''),
            'SKU编码': String(r['SKU编码'] || ''),
            'SPU编码': String(r['SPU编码'] || ''),
            '备注': r['备注'] ? String(r['备注']) : null,
            '采购单价 (基础单位)': r['采购单价 (基础单位)'] !== null && r['采购单价 (基础单位)'] !== undefined ? r['采购单价 (基础单位)'] : null,
            '采购单价 (采购单位)': r['采购单价 (采购单位)'] !== null && r['采购单价 (采购单位)'] !== undefined ? r['采购单价 (采购单位)'] : null,
            '商品名称': r['商品名称'] ? String(r['商品名称']) : null,
            '商品UPC': r['商品UPC'] ? String(r['商品UPC']) : null,
            '规格': r['规格'] ? String(r['规格']) : null,
        }));

        return { data, total };
    }

    async create(item: OpsExclusionItem, userId?: number, userName?: string): Promise<void> {
        this.validate(item);
        try {
            await this.prisma.$executeRawUnsafe(
                `INSERT INTO ${this.table} (\`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\`, \`备注\`) VALUES (?, ?, ?, ?, ?)`,
                item['视图名称'] || '',
                item['门店编码'] || '',
                item['SKU编码'] || '',
                item['SPU编码'] || '',
                item['备注'] || null,
            );

            // 记录操作日志
            await this.operationLogService.logOperation({
                userId: userId,
                displayName: userName,
                operationType: 'CREATE',
                targetDatabase: 'sm_cuxiaohuodong',
                targetTable: '活动视图排除规则',
                recordIdentifier: {
                    视图名称: item['视图名称'],
                    门店编码: item['门店编码'],
                    SKU编码: item['SKU编码'],
                    SPU编码: item['SPU编码'],
                },
                changes: {},
                operationDetails: { new_data: item },
            });
        } catch (error: any) {
            Logger.error('[OpsExclusionService] Create error:', error);
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

    async update(original: OpsExclusionItem, data: OpsExclusionItem, userId?: number, userName?: string): Promise<void> {
        this.validate(data);
        const affected = await this.prisma.$executeRawUnsafe(
            `UPDATE ${this.table}
       SET \`视图名称\`=?, \`门店编码\`=?, \`SKU编码\`=?, \`SPU编码\`=?, \`备注\`=?
       WHERE \`视图名称\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`SKU编码\`, '') = COALESCE(?, '') AND COALESCE(\`SPU编码\`, '') = COALESCE(?, '')`,
            data['视图名称'] || '', data['门店编码'] || '', data['SKU编码'] || '', data['SPU编码'] || '', data['备注'] || null,
            original['视图名称'] || '', original['门店编码'] || '', original['SKU编码'] || '', original['SPU编码'] || '',
        );
        // @ts-ignore Prisma returns number for executeRawUnsafe
        if (!affected) {
            throw new BadRequestException('未找到原记录，更新失败');
        }

        // 记录操作日志
        const changes: Record<string, { old?: any; new?: any }> = {};
        if (original['视图名称'] !== data['视图名称']) {
            changes['视图名称'] = { old: original['视图名称'], new: data['视图名称'] };
        }
        if (original['门店编码'] !== data['门店编码']) {
            changes['门店编码'] = { old: original['门店编码'], new: data['门店编码'] };
        }
        if (original['SKU编码'] !== data['SKU编码']) {
            changes['SKU编码'] = { old: original['SKU编码'], new: data['SKU编码'] };
        }
        if (original['SPU编码'] !== data['SPU编码']) {
            changes['SPU编码'] = { old: original['SPU编码'], new: data['SPU编码'] };
        }
        if (original['备注'] !== data['备注']) {
            changes['备注'] = { old: original['备注'], new: data['备注'] };
        }

        await this.operationLogService.logOperation({
            userId: userId,
            displayName: userName,
            operationType: 'UPDATE',
            targetDatabase: 'sm_cuxiaohuodong',
            targetTable: '活动视图排除规则',
            recordIdentifier: {
                视图名称: original['视图名称'],
                门店编码: original['门店编码'],
                SKU编码: original['SKU编码'],
                SPU编码: original['SPU编码'],
            },
            changes: changes,
            operationDetails: { original, updated: data },
        });
    }

    async remove(item: OpsExclusionItem, userId?: number, userName?: string): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`视图名称\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`SKU编码\`, '') = COALESCE(?, '') AND COALESCE(\`SPU编码\`, '') = COALESCE(?, '')`,
            item['视图名称'] || '', item['门店编码'] || '', item['SKU编码'] || '', item['SPU编码'] || '',
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
            targetDatabase: 'sm_cuxiaohuodong',
            targetTable: '活动视图排除规则',
            recordIdentifier: {
                视图名称: item['视图名称'],
                门店编码: item['门店编码'],
                SKU编码: item['SKU编码'],
                SPU编码: item['SPU编码'],
            },
            changes: {},
            operationDetails: { deleted_data: item },
        });
    }

    async batchRemove(items: OpsExclusionItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; deletedCount: number }> {
        if (!items || items.length === 0) {
            throw new BadRequestException('请选择要删除的记录');
        }

        let deletedCount = 0;
        const errors: string[] = [];

        for (const item of items) {
            try {
                const affected = await this.prisma.$executeRawUnsafe(
                    `DELETE FROM ${this.table} WHERE \`视图名称\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`SKU编码\`, '') = COALESCE(?, '') AND COALESCE(\`SPU编码\`, '') = COALESCE(?, '')`,
                    item['视图名称'] || '', item['门店编码'] || '', item['SKU编码'] || '', item['SPU编码'] || '',
                );
                // @ts-ignore
                if (affected) {
                    deletedCount++;
                    // 记录操作日志
                    await this.operationLogService.logOperation({
                        userId: userId,
                        displayName: userName,
                        operationType: 'DELETE',
                        targetDatabase: 'sm_cuxiaohuodong',
                        targetTable: '活动视图排除规则',
                        recordIdentifier: {
                            视图名称: item['视图名称'],
                            门店编码: item['门店编码'],
                            SKU编码: item['SKU编码'],
                            SPU编码: item['SPU编码'],
                        },
                        changes: {},
                        operationDetails: { deleted_data: item },
                    });
                }
            } catch (error: any) {
                errors.push(`删除失败: ${item['视图名称']} - ${error?.message || '未知错误'}`);
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

    async batchCreate(items: OpsExclusionItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> {
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
                errors.push(`${item['视图名称']}: ${errorMsg}`);
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

    async checkExists(item: OpsExclusionItem): Promise<boolean> {
        // 仅检查SKU编码是否已存在
        const checkSql = `SELECT * FROM ${this.table} WHERE \`SKU编码\` = ?`;
        const existing: any[] = await this.prisma.$queryRawUnsafe(
            checkSql,
            item['SKU编码'] || ''
        );
        return existing && existing.length > 0;
    }

    async checkBatchExists(items: OpsExclusionItem[]): Promise<{ exists: boolean; duplicateItems: OpsExclusionItem[] }> {
        const duplicateItems: OpsExclusionItem[] = [];
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

    private validate(item: OpsExclusionItem) {
        if (!item['视图名称']) {
            throw new BadRequestException('视图名称为必填');
        }
    }
}
