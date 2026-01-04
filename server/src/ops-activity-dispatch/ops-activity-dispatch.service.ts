
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';
import { OperationLogService } from '../operation-log/operation-log.service';

export interface OpsActivityDispatchItem {
    'SKU': string;
    '活动价': string | number | null;
    '最低活动价': string | number | null;
    '活动类型': string | null;
    '门店名称': string | null;
    '活动备注': string | null;
    '剩余活动天数': string | number | null;
    '活动确认人': string | null;
    '结束时间': string | Date | null;
    '数据更新时间': string | Date | null;
    // 从仓店补货参考表关联的字段
    '商品名称'?: string | null;
    '商品UPC'?: string | null;
    '规格'?: string | null;
    '采购单价 (基础单位)'?: string | number | null;
    '采购单价 (采购单位)'?: string | number | null;
}

@Injectable()
export class OpsActivityDispatchService {
    constructor(
        private prisma: PrismaService,
        private operationLogService: OperationLogService,
    ) { }

    private table = '`sm_cuxiaohuodong`.`手动强制活动分发`';

    async list(
        filters?: {
            SKU?: string;
            活动价?: string;
            最低活动价?: string;
            活动类型?: string;
            门店名称?: string;
            活动备注?: string;
            剩余活动天数?: string;
            活动确认人?: string;
            keyword?: string; // 关键词搜索（全字段）
        },
        page: number = 1,
        limit: number = 20
    ): Promise<{ data: OpsActivityDispatchItem[]; total: number }> {
        const offset = (page - 1) * limit;
        const orderBy = `ORDER BY \`数据更新时间\` DESC, \`SKU\``;

        // 构建搜索条件
        const clauses: string[] = [];
        const params: any[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // 关键词搜索（OR across all columns）
        if (filters?.keyword?.trim()) {
            const like = buildLike(filters.keyword);
            const whereCondition = `(
                a.\`SKU\` LIKE ? OR 
                a.\`活动价\` LIKE ? OR 
                a.\`最低活动价\` LIKE ? OR 
                a.\`活动类型\` LIKE ? OR 
                a.\`门店名称\` LIKE ? OR 
                a.\`活动备注\` LIKE ? OR 
                a.\`剩余活动天数\` LIKE ? OR 
                a.\`活动确认人\` LIKE ? OR
                c.\`商品名称\` LIKE ? OR
                c.\`商品UPC\` LIKE ? OR
                c.\`规格\` LIKE ?
            )`;
            clauses.push(whereCondition);
            params.push(like, like, like, like, like, like, like, like, like, like, like);
        }

        // 按字段精确搜索（AND）
        if (filters?.SKU?.trim()) {
            clauses.push(`a.\`SKU\` LIKE ?`);
            params.push(buildLike(filters.SKU));
        }
        if (filters?.活动价?.trim()) {
            clauses.push(`a.\`活动价\` LIKE ?`);
            params.push(buildLike(filters.活动价));
        }
        if (filters?.最低活动价?.trim()) {
            clauses.push(`a.\`最低活动价\` LIKE ?`);
            params.push(buildLike(filters.最低活动价));
        }
        if (filters?.活动类型?.trim()) {
            clauses.push(`a.\`活动类型\` LIKE ?`);
            params.push(buildLike(filters.活动类型));
        }
        if (filters?.门店名称?.trim()) {
            clauses.push(`a.\`门店名称\` LIKE ?`);
            params.push(buildLike(filters.门店名称));
        }
        if (filters?.活动备注?.trim()) {
            clauses.push(`a.\`活动备注\` LIKE ?`);
            params.push(buildLike(filters.活动备注));
        }
        if (filters?.剩余活动天数?.trim()) {
            clauses.push(`a.\`剩余活动天数\` LIKE ?`);
            params.push(buildLike(filters.剩余活动天数));
        }
        if (filters?.活动确认人?.trim()) {
            clauses.push(`a.\`活动确认人\` LIKE ?`);
            params.push(buildLike(filters.活动确认人));
        }

        // 构建 WHERE 条件
        const whereCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        // 构建 SQL - 左连接仓店补货参考表
        const countSql = `SELECT COUNT(*) as total 
            FROM ${this.table} a
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
            ) c ON a.\`SKU\` = c.\`商品SKU\`
            ${whereCondition}`;
        const sql = `SELECT 
            a.\`SKU\`,
            a.\`活动价\`,
            a.\`最低活动价\`,
            a.\`活动类型\`,
            a.\`门店名称\`,
            a.\`活动备注\`,
            a.\`剩余活动天数\`,
            a.\`活动确认人\`,
            DATE_FORMAT(a.\`结束时间\`, '%Y-%m-%d') as \`结束时间\`,
            DATE_FORMAT(a.\`数据更新时间\`, '%Y-%m-%d %H:%i:%s') as \`数据更新时间\`,
            c.\`采购单价 (基础单位)\`,
            c.\`采购单价 (采购单位)\`,
            c.\`商品名称\`,
            c.\`商品UPC\`,
            c.\`规格\`
         FROM ${this.table} a
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
         ) c ON a.\`SKU\` = c.\`商品SKU\`
         ${whereCondition}
         ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`;

        const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
        const total = Number(countRows?.total || 0);

        const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
        const data = (rows || []).map(r => {
            // 时间字段已经在SQL中使用DATE_FORMAT格式化，直接使用即可
            const 数据更新时间 = r['数据更新时间'] || null;
            const 结束时间 = r['结束时间'] || null;

            return {
                'SKU': String(r['SKU'] || ''),
                '活动价': r['活动价'] !== null && r['活动价'] !== undefined ? r['活动价'] : null,
                '最低活动价': r['最低活动价'] !== null && r['最低活动价'] !== undefined ? r['最低活动价'] : null,
                '活动类型': r['活动类型'] ? String(r['活动类型']) : null,
                '门店名称': r['门店名称'] ? String(r['门店名称']) : null,
                '活动备注': r['活动备注'] ? String(r['活动备注']) : null,
                '剩余活动天数': r['剩余活动天数'] !== null && r['剩余活动天数'] !== undefined ? r['剩余活动天数'] : null,
                '活动确认人': r['活动确认人'] ? String(r['活动确认人']) : null,
                '结束时间': 结束时间,
                '数据更新时间': 数据更新时间,
                '采购单价 (基础单位)': r['采购单价 (基础单位)'] !== null && r['采购单价 (基础单位)'] !== undefined ? r['采购单价 (基础单位)'] : null,
                '采购单价 (采购单位)': r['采购单价 (采购单位)'] !== null && r['采购单价 (采购单位)'] !== undefined ? r['采购单价 (采购单位)'] : null,
                '商品名称': r['商品名称'] ? String(r['商品名称']) : null,
                '商品UPC': r['商品UPC'] ? String(r['商品UPC']) : null,
                '规格': r['规格'] ? String(r['规格']) : null,
            };
        });

        return { data, total };
    }

    async create(item: OpsActivityDispatchItem): Promise<void> {
        this.validate(item);

        // 计算剩余活动天数：如果结束时间不为空，则计算结束时间-今天的天数
        let 剩余活动天数 = item['剩余活动天数'];
        // 处理结束时间：只保留年月日，去掉时分秒
        let 结束时间Date: Date | null = null;
        if (item['结束时间']) {
            const endDateStr = String(item['结束时间']);
            // 如果包含时分秒，只取年月日部分
            const dateOnly = endDateStr.split(' ')[0]; // 取空格前的部分（年月日）
            const endDate = new Date(dateOnly);
            if (!isNaN(endDate.getTime())) {
                endDate.setHours(0, 0, 0, 0);
                结束时间Date = endDate;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffTime = endDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                剩余活动天数 = diffDays >= 0 ? diffDays : null;
            }
        }

        try {
            await this.prisma.$executeRawUnsafe(
                `INSERT INTO ${this.table} (
                    \`SKU\`, \`活动价\`, \`最低活动价\`, \`活动类型\`, 
                    \`门店名称\`, \`活动备注\`, \`剩余活动天数\`, \`活动确认人\`, \`结束时间\`, \`数据更新时间\`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                item['SKU'] || '',
                item['活动价'] !== null && item['活动价'] !== undefined ? item['活动价'] : null,
                item['最低活动价'] !== null && item['最低活动价'] !== undefined ? item['最低活动价'] : null,
                item['活动类型'] || null,
                item['门店名称'] || null,
                item['活动备注'] || null,
                剩余活动天数 !== null && 剩余活动天数 !== undefined ? 剩余活动天数 : null,
                item['活动确认人'] || null,
                结束时间Date,
            );

            // 记录操作日志
            await this.operationLogService.logOperation({
                userId: userId,
                displayName: userName,
                operationType: 'CREATE',
                targetDatabase: 'sm_cuxiaohuodong',
                targetTable: '手动强制活动分发',
                recordIdentifier: { SKU: item['SKU'] },
                changes: {},
                operationDetails: { new_data: item },
            });
        } catch (error: any) {
            Logger.error('[OpsActivityDispatchService] Create error:', error);
            // 捕获数据库主键冲突错误（多种格式）
            if (error?.code === 'P2010' ||
                error?.code === 'ER_DUP_ENTRY' ||
                error?.errno === 1062 ||
                (error?.meta?.code === '1062' && error?.meta?.message?.includes('Duplicate entry')) ||
                (error?.message && error.message.includes('Duplicate entry'))) {
                throw new BadRequestException('该商品已存在');
            }
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error?.message || '创建失败');
        }
    }

    async update(original: OpsActivityDispatchItem, data: OpsActivityDispatchItem, userId?: number, userName?: string): Promise<void> {
        this.validate(data);

        // 计算剩余活动天数：如果结束时间不为空，则计算结束时间-今天的天数；如果结束时间为空，则不修改剩余活动天数
        let 剩余活动天数 = data['剩余活动天数'];
        if (data['结束时间']) {
            const endDate = new Date(data['结束时间']);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            const diffTime = endDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            剩余活动天数 = diffDays >= 0 ? diffDays : null;
        }
        // 如果结束时间为空，保持原有的剩余活动天数不变（不更新该字段）

        // SKU是主键，更新时不应该修改SKU字段
        const affected = await this.prisma.$executeRawUnsafe(
            `UPDATE ${this.table}
       SET \`活动价\`=?, \`最低活动价\`=?, \`活动类型\`=?, 
           \`门店名称\`=?, \`活动备注\`=?, \`剩余活动天数\`=?, \`活动确认人\`=?, \`结束时间\`=?, \`数据更新时间\`=NOW()
       WHERE \`SKU\`=?`,
            data['活动价'] !== null && data['活动价'] !== undefined ? data['活动价'] : null,
            data['最低活动价'] !== null && data['最低活动价'] !== undefined ? data['最低活动价'] : null,
            data['活动类型'] || null,
            data['门店名称'] || null,
            data['活动备注'] || null,
            剩余活动天数 !== null && 剩余活动天数 !== undefined ? 剩余活动天数 : null,
            data['活动确认人'] || null,
            data['结束时间'] ? new Date(data['结束时间']) : null,
            original['SKU'] || '',
        );
        // @ts-ignore Prisma returns number for executeRawUnsafe
        if (!affected) {
            throw new BadRequestException('未找到原记录，更新失败');
        }
    }

    async remove(item: OpsActivityDispatchItem, userId?: number, userName?: string): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`SKU\`=?`,
            item['SKU'] || '',
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
            targetTable: '手动强制活动分发',
            recordIdentifier: { SKU: item['SKU'] },
            changes: {},
            operationDetails: { deleted_data: item },
        });
    }

    async batchRemove(items: OpsActivityDispatchItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; deletedCount: number }> {
        if (!items || items.length === 0) {
            throw new BadRequestException('请选择要删除的记录');
        }

        let deletedCount = 0;
        const errors: string[] = [];

        for (const item of items) {
            try {
                const affected = await this.prisma.$executeRawUnsafe(
                    `DELETE FROM ${this.table} WHERE \`SKU\`=?`,
                    item['SKU'] || '',
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
                        targetTable: '手动强制活动分发',
                        recordIdentifier: { SKU: item['SKU'] },
                        changes: {},
                        operationDetails: { deleted_data: item },
                    });
                }
            } catch (error: any) {
                errors.push(`删除失败: ${item['SKU']} - ${error?.message || '未知错误'}`);
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

    async batchCreate(items: OpsActivityDispatchItem[], userId?: number, userName?: string): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> {
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
                errors.push(`${item['SKU']}: ${errorMsg}`);
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

    async getStoreNames(): Promise<string[]> {
        try {
            const sql = `SELECT DISTINCT \`门店名称\` 
                        FROM \`sm_shangping\`.\`全部门店商品\` 
                        WHERE \`门店名称\` IS NOT NULL AND TRIM(\`门店名称\`) <> '' 
                        GROUP BY \`门店名称\`
                        ORDER BY \`门店名称\``;
            const rows: any[] = await this.prisma.$queryRawUnsafe(sql);
            const storeNames = (rows || []).map(r => String(r['门店名称'] || '').trim()).filter(Boolean);
            // 添加"全部门店"选项
            return ['全部门店', ...storeNames];
        } catch (error) {
            console.error('[OpsActivityDispatchService] 获取门店名称列表失败:', error);
            throw error;
        }
    }

    async checkExists(item: OpsActivityDispatchItem): Promise<boolean> {
        // 检查SKU是否已存在
        const checkSql = `SELECT * FROM ${this.table} WHERE \`SKU\` = ?`;
        const existing: any[] = await this.prisma.$queryRawUnsafe(
            checkSql,
            item['SKU'] || ''
        );
        return existing && existing.length > 0;
    }

    async checkBatchExists(items: OpsActivityDispatchItem[]): Promise<{ exists: boolean; duplicateItems: OpsActivityDispatchItem[] }> {
        const duplicateItems: OpsActivityDispatchItem[] = [];
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

    private validate(item: OpsActivityDispatchItem) {
        if (!item['SKU'] || !item['SKU'].trim()) {
            throw new BadRequestException('SKU为必填');
        }

        // 验证结束时间不能超过今天之后31天
        if (item['结束时间']) {
            const endDate = new Date(item['结束时间']);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + 31);
            maxDate.setHours(23, 59, 59, 999);

            if (endDate > maxDate) {
                throw new BadRequestException('结束时间不能超过今天之后31天');
            }
        }
    }
}

