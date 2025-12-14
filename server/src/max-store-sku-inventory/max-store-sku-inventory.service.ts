import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

export interface MaxStoreSkuInventoryItem {
    '仓店名称': string;
    'SKU编码': string;
    '最高库存量（基础单位）': number;
    '备注（说明设置原因）': string;
    '修改人': string;
}

@Injectable()
export class MaxStoreSkuInventoryService {
    constructor(private prisma: PrismaService) { }

    private readonly table = '`sm_chaigou`.`仓店sku最高库存表`';
    private readonly warehousePriorityTable = '`sm_chaigou`.`仓库优先级`';

    /**
     * 获取仓库优先级表中的门店/仓名称列表
     */
    async getStoreNames(): Promise<string[]> {
        try {
            const sql = `SELECT DISTINCT TRIM(\`门店/仓名称\`) AS name 
                        FROM ${this.warehousePriorityTable} 
                        WHERE \`门店/仓名称\` IS NOT NULL AND TRIM(\`门店/仓名称\`) <> '' 
                        ORDER BY name`;
            const rows: any[] = await this.prisma.$queryRawUnsafe(sql);
            return (rows || []).map(r => String(r.name || '').trim()).filter(Boolean);
        } catch (error) {
            Logger.error('[MaxStoreSkuInventoryService] 获取门店名称列表失败:', error);
            throw error;
        }
    }

    /**
     * 根据门店/仓名称获取门店/仓编码
     */
    async getStoreCodeByStoreName(storeName: string): Promise<string | null> {
        try {
            const sql = `SELECT DISTINCT TRIM(\`门店/仓编码\`) AS code 
                        FROM ${this.warehousePriorityTable} 
                        WHERE TRIM(\`门店/仓名称\`) = ? 
                        LIMIT 1`;
            const rows: any[] = await this.prisma.$queryRawUnsafe(sql, storeName.trim());
            if (rows && rows.length > 0 && rows[0].code) {
                return String(rows[0].code).trim();
            }
            return null;
        } catch (error) {
            Logger.error('[MaxStoreSkuInventoryService] 获取门店编码失败:', error);
            throw error;
        }
    }

    /**
     * 根据用户ID获取display_name
     */
    async getUserDisplayName(userId: number): Promise<string | null> {
        try {
            const sql = `SELECT display_name 
                        FROM \`sm_xitongkaifa\`.\`sys_users\` 
                        WHERE id = ? 
                        LIMIT 1`;
            const rows: any[] = await this.prisma.$queryRawUnsafe(sql, userId);
            if (rows && rows.length > 0 && rows[0].display_name) {
                return String(rows[0].display_name).trim();
            }
            return null;
        } catch (error) {
            Logger.error('[MaxStoreSkuInventoryService] 获取用户display_name失败:', error);
            return null;
        }
    }

    /**
     * 查询列表
     */
    async list(
        filters?: {
            storeName?: string;
            sku?: string;
            maxInventory?: string;
            remark?: string;
            modifier?: string;
        },
        page: number = 1,
        limit: number = 20
    ): Promise<{ data: MaxStoreSkuInventoryItem[]; total: number }> {
        let sql: string;
        let countSql: string;
        let params: any[] = [];

        const offset = (page - 1) * limit;
        const baseFrom = `FROM ${this.table}`;

        // 构建搜索条件
        const clauses: string[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // 按字段匹配（AND）
        if (filters?.storeName?.trim()) {
            clauses.push(`\`仓店名称\` LIKE ?`);
            params.push(buildLike(filters.storeName));
        }
        if (filters?.sku?.trim()) {
            clauses.push(`\`SKU编码\` LIKE ?`);
            params.push(buildLike(filters.sku));
        }
        if (filters?.maxInventory?.trim()) {
            // 尝试转换为数字进行精确匹配，如果转换失败则使用LIKE模糊匹配
            const maxInventoryStr = filters.maxInventory.trim();
            const inventoryValue = parseFloat(maxInventoryStr);
            if (!isNaN(inventoryValue)) {
                clauses.push(`\`最高库存量（基础单位）\` = ?`);
                params.push(inventoryValue);
            } else {
                clauses.push(`CAST(\`最高库存量（基础单位）\` AS CHAR) LIKE ?`);
                params.push(buildLike(maxInventoryStr));
            }
        }
        if (filters?.remark?.trim()) {
            clauses.push(`\`备注（说明设置原因）\` LIKE ?`);
            params.push(buildLike(filters.remark));
        }
        if (filters?.modifier?.trim()) {
            clauses.push(`\`修改人\` LIKE ?`);
            params.push(buildLike(filters.modifier));
        }

        const searchCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        countSql = `SELECT COUNT(*) as total ${baseFrom} ${searchCondition}`;
        sql = `SELECT 
            \`仓店名称\`,
            \`SKU编码\`,
            \`最高库存量（基础单位）\`,
            \`备注（说明设置原因）\`,
            \`修改人\`
        ${baseFrom}
        ${searchCondition}
        ORDER BY \`仓店名称\`, \`SKU编码\`
        LIMIT ${limit} OFFSET ${offset}`;

        try {
            Logger.log('[MaxStoreSkuInventoryService] Executing count SQL:', countSql);
            Logger.log('[MaxStoreSkuInventoryService] Count params:', params);
            const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
            const total = Number(countRows?.total || 0);
            Logger.log('[MaxStoreSkuInventoryService] Total count:', total);

            Logger.log('[MaxStoreSkuInventoryService] Executing data SQL:', sql);
            Logger.log('[MaxStoreSkuInventoryService] Data params:', params);
            const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
            Logger.log('[MaxStoreSkuInventoryService] Rows returned:', rows?.length || 0);

            const data = (rows || []).map(r => ({
                '仓店名称': String(r['仓店名称'] || ''),
                'SKU编码': String(r['SKU编码'] || ''),
                '最高库存量（基础单位）': Number(r['最高库存量（基础单位）'] || 0),
                '备注（说明设置原因）': String(r['备注（说明设置原因）'] || ''),
                '修改人': String(r['修改人'] || ''),
            }));

            return { data, total };
        } catch (error) {
            Logger.error('[MaxStoreSkuInventoryService] Query error:', error);
            throw error;
        }
    }

    /**
     * 创建记录
     */
    async create(
        data: {
            storeName: string;
            sku: string;
            maxInventory: number;
            remark: string;
            modifier: string;
        },
        userId?: number
    ): Promise<MaxStoreSkuInventoryItem> {
        // 验证必填字段
        if (!data.storeName || !data.storeName.trim()) {
            throw new BadRequestException('仓店名称不能为空');
        }
        if (!data.sku || !data.sku.trim()) {
            throw new BadRequestException('SKU编码不能为空');
        }
        if (data.maxInventory === undefined || data.maxInventory === null) {
            throw new BadRequestException('最高库存量（基础单位）不能为空');
        }
        if (!data.remark || !data.remark.trim()) {
            throw new BadRequestException('备注（说明设置原因）不能为空');
        }
        if (!data.modifier || !data.modifier.trim()) {
            throw new BadRequestException('修改人不能为空');
        }

        try {
            // 获取仓店编码
            const storeCode = await this.getStoreCodeByStoreName(data.storeName.trim());
            if (!storeCode) {
                throw new BadRequestException('无法找到对应的仓店编码，请检查仓店名称是否正确');
            }

            // 拼接SKU编码仓店编码
            const skuStoreCode = `${data.sku.trim()}${storeCode}`;

            // 检查是否已存在（根据仓店名称和SKU编码）
            const checkSql = `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU编码\` = ?`;
            const existing: any[] = await this.prisma.$queryRawUnsafe(
                checkSql,
                data.storeName.trim(),
                data.sku.trim()
            );

            if (existing && existing.length > 0) {
                throw new BadRequestException('该仓店名称和SKU编码的组合已存在');
            }

            // 插入新记录
            const insertSql = `INSERT INTO ${this.table} 
                (\`仓店名称\`, \`SKU编码\`, \`最高库存量（基础单位）\`, \`备注（说明设置原因）\`, \`修改人\`, \`仓店编码\`, \`SKU编码仓店编码\`)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;

            await this.prisma.$executeRawUnsafe(
                insertSql,
                data.storeName.trim(),
                data.sku.trim(),
                data.maxInventory,
                data.remark.trim(),
                data.modifier.trim(),
                storeCode,
                skuStoreCode
            );

            // 返回创建的记录
            const result: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU编码\` = ?`,
                data.storeName.trim(),
                data.sku.trim()
            );

            if (result && result.length > 0) {
                const r = result[0];
                return {
                    '仓店名称': String(r['仓店名称'] || ''),
                    'SKU编码': String(r['SKU编码'] || ''),
                    '最高库存量（基础单位）': Number(r['最高库存量（基础单位）'] || 0),
                    '备注（说明设置原因）': String(r['备注（说明设置原因）'] || ''),
                    '修改人': String(r['修改人'] || ''),
                };
            }

            throw new Error('创建失败，无法获取创建的记录');
        } catch (error: any) {
            Logger.error('[MaxStoreSkuInventoryService] Create error:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error?.message || '创建失败');
        }
    }

    /**
     * 更新记录
     */
    async update(
        original: {
            storeName: string;
            sku: string;
        },
        data: {
            storeName?: string;
            sku?: string;
            maxInventory?: number;
            remark?: string;
            modifier: string;
        },
        userId?: number
    ): Promise<MaxStoreSkuInventoryItem> {
        // 验证必填字段
        if (data.storeName !== undefined && (!data.storeName || !data.storeName.trim())) {
            throw new BadRequestException('仓店名称不能为空');
        }
        if (data.sku !== undefined && (!data.sku || !data.sku.trim())) {
            throw new BadRequestException('SKU编码不能为空');
        }
        if (data.maxInventory !== undefined && (data.maxInventory === null || data.maxInventory === undefined)) {
            throw new BadRequestException('最高库存量（基础单位）不能为空');
        }
        if (data.remark !== undefined && (!data.remark || !data.remark.trim())) {
            throw new BadRequestException('备注（说明设置原因）不能为空');
        }
        if (!data.modifier || !data.modifier.trim()) {
            throw new BadRequestException('修改人不能为空');
        }

        try {
            // 检查原记录是否存在
            const checkSql = `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU编码\` = ?`;
            const existing: any[] = await this.prisma.$queryRawUnsafe(
                checkSql,
                original.storeName.trim(),
                original.sku.trim()
            );

            if (!existing || existing.length === 0) {
                throw new BadRequestException('要更新的记录不存在');
            }

            // 如果更新了仓店名称或SKU编码，检查新组合是否已存在
            const newStoreName = (data.storeName || original.storeName).trim();
            const newSku = (data.sku || original.sku).trim();

            if (newStoreName !== original.storeName.trim() || newSku !== original.sku.trim()) {
                const checkNewSql = `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU编码\` = ?`;
                const newExisting: any[] = await this.prisma.$queryRawUnsafe(
                    checkNewSql,
                    newStoreName,
                    newSku
                );

                if (newExisting && newExisting.length > 0) {
                    throw new BadRequestException('该仓店名称和SKU编码的组合已存在');
                }
            }

            // 获取新的仓店编码（如果仓店名称改变了）
            let storeCode: string | null = null;
            let skuStoreCode: string | null = null;

            if (data.storeName !== undefined || data.sku !== undefined) {
                storeCode = await this.getStoreCodeByStoreName(newStoreName);
                if (!storeCode) {
                    throw new BadRequestException('无法找到对应的仓店编码，请检查仓店名称是否正确');
                }
                skuStoreCode = `${newSku}${storeCode}`;
            }

            // 构建更新SQL
            const updateFields: string[] = [];
            const updateParams: any[] = [];

            if (data.storeName !== undefined) {
                updateFields.push('`仓店名称` = ?');
                updateParams.push(data.storeName.trim());
            }
            if (data.sku !== undefined) {
                updateFields.push('`SKU编码` = ?');
                updateParams.push(data.sku.trim());
            }
            if (data.maxInventory !== undefined) {
                updateFields.push('`最高库存量（基础单位）` = ?');
                updateParams.push(data.maxInventory);
            }
            if (data.remark !== undefined) {
                updateFields.push('`备注（说明设置原因）` = ?');
                updateParams.push(data.remark.trim());
            }
            updateFields.push('`修改人` = ?');
            updateParams.push(data.modifier.trim());

            // 如果仓店名称或SKU编码改变了，更新仓店编码和SKU编码仓店编码
            if (storeCode && skuStoreCode) {
                updateFields.push('`仓店编码` = ?');
                updateParams.push(storeCode);
                updateFields.push('`SKU编码仓店编码` = ?');
                updateParams.push(skuStoreCode);
            }

            updateParams.push(original.storeName.trim(), original.sku.trim());

            const updateSql = `UPDATE ${this.table} 
                SET ${updateFields.join(', ')}
                WHERE \`仓店名称\` = ? AND \`SKU编码\` = ?`;

            await this.prisma.$executeRawUnsafe(updateSql, ...updateParams);

            // 返回更新后的记录
            const result: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU编码\` = ?`,
                newStoreName,
                newSku
            );

            if (result && result.length > 0) {
                const r = result[0];
                return {
                    '仓店名称': String(r['仓店名称'] || ''),
                    'SKU编码': String(r['SKU编码'] || ''),
                    '最高库存量（基础单位）': Number(r['最高库存量（基础单位）'] || 0),
                    '备注（说明设置原因）': String(r['备注（说明设置原因）'] || ''),
                    '修改人': String(r['修改人'] || ''),
                };
            }

            throw new Error('更新失败，无法获取更新的记录');
        } catch (error: any) {
            Logger.error('[MaxStoreSkuInventoryService] Update error:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error?.message || '更新失败');
        }
    }

    /**
     * 删除记录
     */
    async delete(data: {
        storeName: string;
        sku: string;
    }): Promise<void> {
        const affected = await this.prisma.$executeRawUnsafe(
            `DELETE FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU编码\` = ?`,
            data.storeName.trim(),
            data.sku.trim()
        );
        // @ts-ignore Prisma returns number for executeRawUnsafe
        if (!affected) {
            throw new BadRequestException('未找到记录，删除失败');
        }
    }
}

