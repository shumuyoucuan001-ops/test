
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OpsExclusionItem {
    '视图名称': string;
    '门店编码': string;
    'SKU编码': string;
    'SPU编码': string;
}

@Injectable()
export class OpsExclusionService {
    constructor(private prisma: PrismaService) { }

    private table = '`sm_cuxiaohuodong`.`活动视图排除规则`';

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
        const orderBy = `ORDER BY \`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\``;

        // 构建搜索条件
        const clauses: string[] = [];
        const params: any[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // 关键词搜索（OR across all columns）
        if (filters?.keyword?.trim()) {
            const like = buildLike(filters.keyword);
            const whereCondition = `(\`视图名称\` LIKE ? OR \`门店编码\` LIKE ? OR \`SKU编码\` LIKE ? OR \`SPU编码\` LIKE ?)`;
            clauses.push(whereCondition);
            params.push(like, like, like, like);
        }

        // 按字段精确搜索（AND）
        if (filters?.视图名称?.trim()) {
            clauses.push(`\`视图名称\` LIKE ?`);
            params.push(buildLike(filters.视图名称));
        }
        if (filters?.门店编码?.trim()) {
            clauses.push(`\`门店编码\` LIKE ?`);
            params.push(buildLike(filters.门店编码));
        }
        if (filters?.SKU编码?.trim()) {
            clauses.push(`\`SKU编码\` LIKE ?`);
            params.push(buildLike(filters.SKU编码));
        }
        if (filters?.SPU编码?.trim()) {
            clauses.push(`\`SPU编码\` LIKE ?`);
            params.push(buildLike(filters.SPU编码));
        }

        // 构建 WHERE 条件
        const whereCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        // 构建 SQL
        const countSql = `SELECT COUNT(*) as total FROM ${this.table} ${whereCondition}`;
        const sql = `SELECT \`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\`
         FROM ${this.table}
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
        }));

        return { data, total };
    }

    async create(item: OpsExclusionItem): Promise<void> {
        this.validate(item);
        await this.prisma.$executeRawUnsafe(
            `INSERT INTO ${this.table} (\`视图名称\`, \`门店编码\`, \`SKU编码\`, \`SPU编码\`) VALUES (?, ?, ?, ?)`,
            item['视图名称'] || '',
            item['门店编码'] || '',
            item['SKU编码'] || '',
            item['SPU编码'] || '',
        );
    }

    async update(original: OpsExclusionItem, data: OpsExclusionItem): Promise<void> {
        this.validate(data);
        const affected = await this.prisma.$executeRawUnsafe(
            `UPDATE ${this.table}
       SET \`视图名称\`=?, \`门店编码\`=?, \`SKU编码\`=?, \`SPU编码\`=?
       WHERE \`视图名称\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`SKU编码\`, '') = COALESCE(?, '') AND COALESCE(\`SPU编码\`, '') = COALESCE(?, '')`,
            data['视图名称'] || '', data['门店编码'] || '', data['SKU编码'] || '', data['SPU编码'] || '',
            original['视图名称'] || '', original['门店编码'] || '', original['SKU编码'] || '', original['SPU编码'] || '',
        );
        // @ts-ignore Prisma returns number for executeRawUnsafe
        if (!affected) {
            throw new BadRequestException('未找到原记录，更新失败');
        }
    }

    async remove(item: OpsExclusionItem): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`视图名称\`=? AND COALESCE(\`门店编码\`, '') = COALESCE(?, '') AND COALESCE(\`SKU编码\`, '') = COALESCE(?, '') AND COALESCE(\`SPU编码\`, '') = COALESCE(?, '')`,
            item['视图名称'] || '', item['门店编码'] || '', item['SKU编码'] || '', item['SPU编码'] || '',
        );
        // @ts-ignore
        if (!affected) {
            throw new BadRequestException('未找到记录，删除失败');
        }
    }

    async batchRemove(items: OpsExclusionItem[]): Promise<{ success: boolean; message: string; deletedCount: number }> {
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

    async batchCreate(items: OpsExclusionItem[]): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> {
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

    private validate(item: OpsExclusionItem) {
        if (!item['视图名称']) {
            throw new BadRequestException('视图名称为必填');
        }
    }
}
