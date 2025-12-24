
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OpsActivityDispatchItem {
    'SKU': string;
    '活动价': string | number | null;
    '最低活动价': string | number | null;
    '活动类型': string | null;
    '门店名称': string | null;
    '活动备注': string | null;
    '剩余活动天数': string | number | null;
    '活动确认人': string | null;
    '数据更新时间': string | Date | null;
    // 从商品主档销售规格表关联的字段
    '商品名称'?: string | null;
    '商品条码'?: string | null;
    '规格名称'?: string | null;
}

@Injectable()
export class OpsActivityDispatchService {
    constructor(private prisma: PrismaService) { }

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
                p.\`商品名称\` LIKE ? OR
                p.\`商品条码\` LIKE ? OR
                p.\`规格名称\` LIKE ?
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

        // 构建 SQL - 左连接商品主档销售规格表
        const countSql = `SELECT COUNT(*) as total 
            FROM ${this.table} a
            LEFT JOIN \`sm_shangping\`.\`商品主档销售规格\` p ON a.\`SKU\` = p.\`SKU编码\`
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
            a.\`数据更新时间\`,
            p.\`商品名称\`,
            p.\`商品条码\`,
            p.\`规格名称\`
         FROM ${this.table} a
         LEFT JOIN \`sm_shangping\`.\`商品主档销售规格\` p ON a.\`SKU\` = p.\`SKU编码\`
         ${whereCondition}
         ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`;

        const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
        const total = Number(countRows?.total || 0);

        const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
        const data = (rows || []).map(r => ({
            'SKU': String(r['SKU'] || ''),
            '活动价': r['活动价'] !== null && r['活动价'] !== undefined ? r['活动价'] : null,
            '最低活动价': r['最低活动价'] !== null && r['最低活动价'] !== undefined ? r['最低活动价'] : null,
            '活动类型': r['活动类型'] ? String(r['活动类型']) : null,
            '门店名称': r['门店名称'] ? String(r['门店名称']) : null,
            '活动备注': r['活动备注'] ? String(r['活动备注']) : null,
            '剩余活动天数': r['剩余活动天数'] !== null && r['剩余活动天数'] !== undefined ? r['剩余活动天数'] : null,
            '活动确认人': r['活动确认人'] ? String(r['活动确认人']) : null,
            '数据更新时间': r['数据更新时间'] ? (r['数据更新时间'] instanceof Date ? r['数据更新时间'].toISOString() : String(r['数据更新时间'])) : null,
            '商品名称': r['商品名称'] ? String(r['商品名称']) : null,
            '商品条码': r['商品条码'] ? String(r['商品条码']) : null,
            '规格名称': r['规格名称'] ? String(r['规格名称']) : null,
        }));

        return { data, total };
    }

    async create(item: OpsActivityDispatchItem): Promise<void> {
        this.validate(item);
        await this.prisma.$executeRawUnsafe(
            `INSERT INTO ${this.table} (
                \`SKU\`, \`活动价\`, \`最低活动价\`, \`活动类型\`, 
                \`门店名称\`, \`活动备注\`, \`剩余活动天数\`, \`活动确认人\`, \`数据更新时间\`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            item['SKU'] || '',
            item['活动价'] !== null && item['活动价'] !== undefined ? item['活动价'] : null,
            item['最低活动价'] !== null && item['最低活动价'] !== undefined ? item['最低活动价'] : null,
            item['活动类型'] || null,
            item['门店名称'] || null,
            item['活动备注'] || null,
            item['剩余活动天数'] !== null && item['剩余活动天数'] !== undefined ? item['剩余活动天数'] : null,
            item['活动确认人'] || null,
        );
    }

    async update(original: OpsActivityDispatchItem, data: OpsActivityDispatchItem): Promise<void> {
        this.validate(data);
        // SKU是主键，更新时不应该修改SKU字段
        const affected = await this.prisma.$executeRawUnsafe(
            `UPDATE ${this.table}
       SET \`活动价\`=?, \`最低活动价\`=?, \`活动类型\`=?, 
           \`门店名称\`=?, \`活动备注\`=?, \`剩余活动天数\`=?, \`活动确认人\`=?, \`数据更新时间\`=NOW()
       WHERE \`SKU\`=?`,
            data['活动价'] !== null && data['活动价'] !== undefined ? data['活动价'] : null,
            data['最低活动价'] !== null && data['最低活动价'] !== undefined ? data['最低活动价'] : null,
            data['活动类型'] || null,
            data['门店名称'] || null,
            data['活动备注'] || null,
            data['剩余活动天数'] !== null && data['剩余活动天数'] !== undefined ? data['剩余活动天数'] : null,
            data['活动确认人'] || null,
            original['SKU'] || '',
        );
        // @ts-ignore Prisma returns number for executeRawUnsafe
        if (!affected) {
            throw new BadRequestException('未找到原记录，更新失败');
        }
    }

    async remove(item: OpsActivityDispatchItem): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`SKU\`=?`,
            item['SKU'] || '',
        );
        // @ts-ignore
        if (!affected) {
            throw new BadRequestException('未找到记录，删除失败');
        }
    }

    async batchRemove(items: OpsActivityDispatchItem[]): Promise<{ success: boolean; message: string; deletedCount: number }> {
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

    async batchCreate(items: OpsActivityDispatchItem[]): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> {
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

    private validate(item: OpsActivityDispatchItem) {
        if (!item['SKU'] || !item['SKU'].trim()) {
            throw new BadRequestException('SKU为必填');
        }
    }
}

