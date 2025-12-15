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

    private readonly table = '`sm_chaigou`.`仓店sku最高库存`';
    private readonly warehousePriorityTable = '`sm_chaigou`.`仓库优先级`';

    /**
     * 获取用户的角色名称列表
     */
    private async getUserRoles(userId: number): Promise<string[]> {
        try {
            const rows: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT r.name 
                FROM sm_xitongkaifa.sys_roles r
                JOIN sm_xitongkaifa.sys_user_roles ur ON ur.role_id = r.id
                WHERE ur.user_id = ?`,
                userId
            );
            return (rows || []).map(r => String(r.name || '').trim()).filter(Boolean);
        } catch (error) {
            Logger.error('[MaxStoreSkuInventoryService] 获取用户角色失败:', error);
            return [];
        }
    }

    /**
     * 获取用户的 department_id（可能是数字或字符串）
     */
    private async getUserDepartmentId(userId: number): Promise<string | null> {
        try {
            const rows: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT department_id 
                FROM sm_xitongkaifa.sys_users 
                WHERE id = ? 
                LIMIT 1`,
                userId
            );
            if (rows && rows.length > 0 && rows[0].department_id !== null && rows[0].department_id !== undefined) {
                return String(rows[0].department_id);
            }
            return null;
        } catch (error) {
            Logger.error('[MaxStoreSkuInventoryService] 获取用户department_id失败:', error);
            return null;
        }
    }

    /**
     * 从"仓店名称"字段提取第二个"-"之后、'仓'之前的数据
     * 例如："XX-XX-门店名称仓" -> "门店名称"
     */
    private extractStoreNameFromStoreName(storeName: string): string | null {
        if (!storeName || !storeName.trim()) {
            return null;
        }
        const str = storeName.trim();
        // 找到第二个"-"的位置
        const firstDash = str.indexOf('-');
        if (firstDash === -1) {
            return null;
        }
        const secondDash = str.indexOf('-', firstDash + 1);
        if (secondDash === -1) {
            // 如果没有第二个"-"，则使用第一个"-"（兼容只有单个"-"的情况）
            let extracted = str.substring(firstDash + 1);
            const warehouseIndex = extracted.indexOf('仓');
            if (warehouseIndex !== -1) {
                extracted = extracted.substring(0, warehouseIndex);
            }
            return extracted.trim() || null;
        }
        // 从第二个"-"之后开始提取
        let extracted = str.substring(secondDash + 1);
        // 找到'仓'的位置
        const warehouseIndex = extracted.indexOf('仓');
        if (warehouseIndex !== -1) {
            extracted = extracted.substring(0, warehouseIndex);
        }
        return extracted.trim() || null;
    }

    /**
     * 检查是否需要根据角色过滤数据
     */
    private async shouldFilterByRole(userId?: number): Promise<{ shouldFilter: boolean; departmentId: string | null }> {
        if (!userId) {
            return { shouldFilter: false, departmentId: null };
        }
        const roles = await this.getUserRoles(userId);
        const hasRestrictedRole = roles.some(role => role === '仓店-店长' || role === '仓店-拣货员');
        if (!hasRestrictedRole) {
            return { shouldFilter: false, departmentId: null };
        }
        const departmentId = await this.getUserDepartmentId(userId);
        return { shouldFilter: true, departmentId };
    }

    /**
     * 安全地序列化包含 BigInt 的对象
     */
    private safeStringify(obj: any): string {
        return JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
            , 2);
    }

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
        limit: number = 20,
        userId?: number
    ): Promise<{ data: MaxStoreSkuInventoryItem[]; total: number }> {
        Logger.log('[MaxStoreSkuInventoryService] ========== 查询列表开始 ==========');
        Logger.log('[MaxStoreSkuInventoryService] filters:', this.safeStringify(filters));
        Logger.log('[MaxStoreSkuInventoryService] page:', page);
        Logger.log('[MaxStoreSkuInventoryService] limit:', limit);

        let sql: string;
        let countSql: string;
        let params: any[] = [];

        const offset = (page - 1) * limit;
        const baseFrom = `FROM ${this.table}`;
        Logger.log('[MaxStoreSkuInventoryService] 表名:', this.table);
        Logger.log('[MaxStoreSkuInventoryService] offset:', offset);

        // 构建搜索条件
        const clauses: string[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // 按字段匹配（AND）
        if (filters?.storeName?.trim()) {
            clauses.push(`\`仓店名称\` LIKE ?`);
            params.push(buildLike(filters.storeName));
            Logger.log('[MaxStoreSkuInventoryService] 添加 storeName 条件:', buildLike(filters.storeName));
        }
        if (filters?.sku?.trim()) {
            clauses.push(`\`SKU编码\` LIKE ?`);
            params.push(buildLike(filters.sku));
            Logger.log('[MaxStoreSkuInventoryService] 添加 sku 条件:', buildLike(filters.sku));
        }
        if (filters?.maxInventory?.trim()) {
            // 尝试转换为数字进行精确匹配，如果转换失败则使用LIKE模糊匹配
            const maxInventoryStr = filters.maxInventory.trim();
            const inventoryValue = parseFloat(maxInventoryStr);
            if (!isNaN(inventoryValue)) {
                clauses.push(`\`最高库存量（基础单位）\` = ?`);
                params.push(inventoryValue);
                Logger.log('[MaxStoreSkuInventoryService] 添加 maxInventory 精确匹配条件:', inventoryValue);
            } else {
                clauses.push(`CAST(\`最高库存量（基础单位）\` AS CHAR) LIKE ?`);
                params.push(buildLike(maxInventoryStr));
                Logger.log('[MaxStoreSkuInventoryService] 添加 maxInventory 模糊匹配条件:', buildLike(maxInventoryStr));
            }
        }
        if (filters?.remark?.trim()) {
            clauses.push(`\`备注（说明设置原因）\` LIKE ?`);
            params.push(buildLike(filters.remark));
            Logger.log('[MaxStoreSkuInventoryService] 添加 remark 条件:', buildLike(filters.remark));
        }
        if (filters?.modifier?.trim()) {
            clauses.push(`\`修改人\` LIKE ?`);
            params.push(buildLike(filters.modifier));
            Logger.log('[MaxStoreSkuInventoryService] 添加 modifier 条件:', buildLike(filters.modifier));
        }

        const searchCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
        Logger.log('[MaxStoreSkuInventoryService] 搜索条件数量:', clauses.length);
        Logger.log('[MaxStoreSkuInventoryService] searchCondition:', searchCondition);

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
            Logger.log('[MaxStoreSkuInventoryService] ========== 执行 COUNT 查询 ==========');
            Logger.log('[MaxStoreSkuInventoryService] Count SQL:', countSql);
            Logger.log('[MaxStoreSkuInventoryService] Count params:', this.safeStringify(params));
            Logger.log('[MaxStoreSkuInventoryService] Count params 长度:', params.length);

            const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
            Logger.log('[MaxStoreSkuInventoryService] Count 查询结果:', this.safeStringify(countRows));
            Logger.log('[MaxStoreSkuInventoryService] countRows 类型:', typeof countRows);
            Logger.log('[MaxStoreSkuInventoryService] countRows?.total:', countRows?.total);

            let total = Number(countRows?.total || 0);
            Logger.log('[MaxStoreSkuInventoryService] Total count:', total);

            Logger.log('[MaxStoreSkuInventoryService] ========== 执行 DATA 查询 ==========');
            Logger.log('[MaxStoreSkuInventoryService] Data SQL:', sql);
            Logger.log('[MaxStoreSkuInventoryService] Data params:', this.safeStringify(params));
            Logger.log('[MaxStoreSkuInventoryService] Data params 长度:', params.length);

            let rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
            Logger.log('[MaxStoreSkuInventoryService] Data 查询结果行数:', rows?.length || 0);
            Logger.log('[MaxStoreSkuInventoryService] Data 查询结果前3条:', this.safeStringify(rows?.slice(0, 3)));

            // 根据角色过滤数据
            const { shouldFilter, departmentId } = await this.shouldFilterByRole(userId);
            if (shouldFilter && departmentId !== null) {
                Logger.log('[MaxStoreSkuInventoryService] 需要根据角色过滤数据，departmentId:', departmentId);
                // 先查询所有数据（不分页）进行过滤
                const allRowsSql = sql.replace(/LIMIT \d+ OFFSET \d+$/, '');
                const allRows: any[] = await this.prisma.$queryRawUnsafe(allRowsSql, ...params);
                const filteredRows: any[] = [];
                for (const r of allRows) {
                    const storeName = String(r['仓店名称'] || '');
                    const extractedStoreName = this.extractStoreNameFromStoreName(storeName);
                    if (extractedStoreName) {
                        // 检查 department_id 是否包含提取的字符串
                        // 特殊处理：避免"金沙湾"误匹配"沙湾"
                        // 如果 department_id 包含"金沙湾"且 extractedStoreName 是"沙湾"，则不匹配
                        // 如果 extractedStoreName 是"金沙湾"且 department_id 包含"沙湾"但不包含"金沙湾"，则不匹配
                        const isJinshawanMismatch =
                            (departmentId.includes('金沙湾') && extractedStoreName === '沙湾') ||
                            (extractedStoreName === '金沙湾' && departmentId.includes('沙湾') && !departmentId.includes('金沙湾'));

                        if (!isJinshawanMismatch &&
                            (departmentId.includes(extractedStoreName) || extractedStoreName.includes(departmentId))) {
                            filteredRows.push(r);
                        }
                    }
                }
                total = filteredRows.length;
                // 对过滤后的数据进行分页
                const startIndex = (page - 1) * limit;
                rows = filteredRows.slice(startIndex, startIndex + limit);
                Logger.log('[MaxStoreSkuInventoryService] 过滤后的总行数:', total);
                Logger.log('[MaxStoreSkuInventoryService] 当前页行数:', rows.length);
            }

            const data = (rows || []).map(r => ({
                '仓店名称': String(r['仓店名称'] || ''),
                'SKU编码': String(r['SKU编码'] || ''),
                '最高库存量（基础单位）': Number(r['最高库存量（基础单位）'] || 0),
                '备注（说明设置原因）': String(r['备注（说明设置原因）'] || ''),
                '修改人': String(r['修改人'] || ''),
            }));

            Logger.log('[MaxStoreSkuInventoryService] 处理后的数据行数:', data.length);
            Logger.log('[MaxStoreSkuInventoryService] ========== 查询列表结束 ==========');
            return { data, total };
        } catch (error: any) {
            Logger.error('[MaxStoreSkuInventoryService] ========== 查询出错 ==========');
            Logger.error('[MaxStoreSkuInventoryService] 错误对象:', error);
            Logger.error('[MaxStoreSkuInventoryService] 错误消息:', error?.message);
            Logger.error('[MaxStoreSkuInventoryService] 错误代码:', error?.code);
            Logger.error('[MaxStoreSkuInventoryService] 错误堆栈:', error?.stack);
            Logger.error('[MaxStoreSkuInventoryService] Count SQL:', countSql);
            Logger.error('[MaxStoreSkuInventoryService] Data SQL:', sql);
            Logger.error('[MaxStoreSkuInventoryService] SQL params:', this.safeStringify(params));
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

        // 自动获取修改人
        let modifier = '系统';
        if (userId) {
            const displayName = await this.getUserDisplayName(userId);
            if (displayName) {
                modifier = displayName;
            }
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
                modifier,
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

        // 自动获取修改人
        let modifier = '系统';
        if (userId) {
            const displayName = await this.getUserDisplayName(userId);
            if (displayName) {
                modifier = displayName;
            }
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
            updateParams.push(modifier);

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

