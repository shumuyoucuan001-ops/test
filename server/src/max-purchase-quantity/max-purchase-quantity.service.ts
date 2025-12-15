import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

export interface MaxPurchaseQuantityItem {
    '仓店名称': string;
    'SKU': string;
    '单次最高采购量(基本单位)': number;
    '修改人': string;
}

@Injectable()
export class MaxPurchaseQuantityService {
    constructor(private prisma: PrismaService) { }

    private readonly table = '`sm_chaigou`.`单次最高采购量`';
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
            Logger.error('[MaxPurchaseQuantityService] 获取用户角色失败:', error);
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
            Logger.error('[MaxPurchaseQuantityService] 获取用户department_id失败:', error);
            return null;
        }
    }

    /**
     * 从"仓店名称"字段提取"-"之后、'仓'之前的数据
     * 例如："XX-门店名称仓" -> "门店名称"
     */
    private extractStoreNameFromStoreName(storeName: string): string | null {
        if (!storeName || !storeName.trim()) {
            return null;
        }
        const str = storeName.trim();
        // 找到"-"的位置
        const dashIndex = str.indexOf('-');
        if (dashIndex === -1) {
            return null;
        }
        // 从"-"之后开始提取
        let extracted = str.substring(dashIndex + 1);
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
            Logger.error('[MaxPurchaseQuantityService] 获取门店名称列表失败:', error);
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
            Logger.error('[MaxPurchaseQuantityService] 获取用户display_name失败:', error);
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
            maxQuantity?: string;
            modifier?: string;
        },
        page: number = 1,
        limit: number = 20,
        userId?: number
    ): Promise<{ data: MaxPurchaseQuantityItem[]; total: number }> {
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
            clauses.push(`\`SKU\` LIKE ?`);
            params.push(buildLike(filters.sku));
        }
        if (filters?.maxQuantity?.trim()) {
            // 尝试转换为数字进行精确匹配，如果转换失败则使用LIKE模糊匹配
            const quantityValue = parseFloat(filters.maxQuantity.trim());
            if (!isNaN(quantityValue)) {
                clauses.push(`\`单次最高采购量(基本单位)\` = ?`);
                params.push(quantityValue);
            } else {
                clauses.push(`CAST(\`单次最高采购量(基本单位)\` AS CHAR) LIKE ?`);
                params.push(buildLike(filters.maxQuantity));
            }
        }
        if (filters?.modifier?.trim()) {
            clauses.push(`\`修改人\` LIKE ?`);
            params.push(buildLike(filters.modifier));
        }

        const searchCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        countSql = `SELECT COUNT(*) as total ${baseFrom} ${searchCondition}`;
        sql = `SELECT 
            \`仓店名称\`,
            \`SKU\`,
            \`单次最高采购量(基本单位)\`,
            \`修改人\`
        ${baseFrom}
        ${searchCondition}
        ORDER BY \`仓店名称\`, \`SKU\`
        LIMIT ${limit} OFFSET ${offset}`;

        try {
            Logger.log('[MaxPurchaseQuantityService] Executing count SQL:', countSql);
            Logger.log('[MaxPurchaseQuantityService] Count params:', params);
            const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
            let total = Number(countRows?.total || 0);
            Logger.log('[MaxPurchaseQuantityService] Total count:', total);

            Logger.log('[MaxPurchaseQuantityService] Executing data SQL:', sql);
            Logger.log('[MaxPurchaseQuantityService] Data params:', params);
            let rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
            Logger.log('[MaxPurchaseQuantityService] Rows returned:', rows?.length || 0);

            // 根据角色过滤数据
            const { shouldFilter, departmentId } = await this.shouldFilterByRole(userId);
            if (shouldFilter && departmentId !== null) {
                Logger.log('[MaxPurchaseQuantityService] 需要根据角色过滤数据，departmentId:', departmentId);
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
                        // 如果 department_id 是"金沙湾"且 extractedStoreName 是"沙湾"，则不匹配
                        // 如果 extractedStoreName 是"金沙湾"且 department_id 是"沙湾"，则不匹配
                        const isJinshawanMismatch =
                            (departmentId.includes('金沙湾') && extractedStoreName === '沙湾') ||
                            (extractedStoreName === '金沙湾' && departmentId.includes('沙湾'));

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
                Logger.log('[MaxPurchaseQuantityService] 过滤后的总行数:', total);
                Logger.log('[MaxPurchaseQuantityService] 当前页行数:', rows.length);
            }

            const data = (rows || []).map(r => ({
                '仓店名称': String(r['仓店名称'] || ''),
                'SKU': String(r['SKU'] || ''),
                '单次最高采购量(基本单位)': Number(r['单次最高采购量(基本单位)'] || 0),
                '修改人': String(r['修改人'] || ''),
            }));

            return { data, total };
        } catch (error) {
            Logger.error('[MaxPurchaseQuantityService] Query error:', error);
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
            maxQuantity: number;
        },
        userId?: number
    ): Promise<MaxPurchaseQuantityItem> {
        // 验证必填字段
        if (!data.storeName || !data.storeName.trim()) {
            throw new BadRequestException('仓店名称不能为空');
        }
        if (!data.sku || !data.sku.trim()) {
            throw new BadRequestException('SKU不能为空');
        }
        if (data.maxQuantity === undefined || data.maxQuantity === null) {
            throw new BadRequestException('单次最高采购量(基本单位)不能为空');
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
            // 检查是否已存在（根据仓店名称和SKU）
            const checkSql = `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU\` = ?`;
            const existing: any[] = await this.prisma.$queryRawUnsafe(
                checkSql,
                data.storeName.trim(),
                data.sku.trim()
            );

            if (existing && existing.length > 0) {
                throw new BadRequestException('该仓店名称和SKU的组合已存在');
            }

            // 插入新记录
            const insertSql = `INSERT INTO ${this.table} 
                (\`仓店名称\`, \`SKU\`, \`单次最高采购量(基本单位)\`, \`修改人\`)
                VALUES (?, ?, ?, ?)`;

            await this.prisma.$executeRawUnsafe(
                insertSql,
                data.storeName.trim(),
                data.sku.trim(),
                data.maxQuantity,
                modifier
            );

            // 返回创建的记录
            const result: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU\` = ?`,
                data.storeName.trim(),
                data.sku.trim()
            );

            if (result && result.length > 0) {
                const r = result[0];
                return {
                    '仓店名称': String(r['仓店名称'] || ''),
                    'SKU': String(r['SKU'] || ''),
                    '单次最高采购量(基本单位)': Number(r['单次最高采购量(基本单位)'] || 0),
                    '修改人': String(r['修改人'] || ''),
                };
            }

            throw new Error('创建失败，无法获取创建的记录');
        } catch (error: any) {
            Logger.error('[MaxPurchaseQuantityService] Create error:', error);
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
            maxQuantity?: number;
        },
        userId?: number
    ): Promise<MaxPurchaseQuantityItem> {
        // 验证必填字段
        if (data.storeName !== undefined && (!data.storeName || !data.storeName.trim())) {
            throw new BadRequestException('仓店名称不能为空');
        }
        if (data.sku !== undefined && (!data.sku || !data.sku.trim())) {
            throw new BadRequestException('SKU不能为空');
        }
        if (data.maxQuantity !== undefined && (data.maxQuantity === null || data.maxQuantity === undefined)) {
            throw new BadRequestException('单次最高采购量(基本单位)不能为空');
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
            const checkSql = `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU\` = ?`;
            const existing: any[] = await this.prisma.$queryRawUnsafe(
                checkSql,
                original.storeName.trim(),
                original.sku.trim()
            );

            if (!existing || existing.length === 0) {
                throw new BadRequestException('要更新的记录不存在');
            }

            // 如果更新了仓店名称或SKU，检查新组合是否已存在
            const newStoreName = (data.storeName || original.storeName).trim();
            const newSku = (data.sku || original.sku).trim();

            if (newStoreName !== original.storeName.trim() || newSku !== original.sku.trim()) {
                const checkNewSql = `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU\` = ?`;
                const newExisting: any[] = await this.prisma.$queryRawUnsafe(
                    checkNewSql,
                    newStoreName,
                    newSku
                );

                if (newExisting && newExisting.length > 0) {
                    throw new BadRequestException('该仓店名称和SKU的组合已存在');
                }
            }

            // 构建更新SQL
            const updateFields: string[] = [];
            const updateParams: any[] = [];

            if (data.storeName !== undefined) {
                updateFields.push('`仓店名称` = ?');
                updateParams.push(data.storeName.trim());
            }
            if (data.sku !== undefined) {
                updateFields.push('`SKU` = ?');
                updateParams.push(data.sku.trim());
            }
            if (data.maxQuantity !== undefined) {
                updateFields.push('`单次最高采购量(基本单位)` = ?');
                updateParams.push(data.maxQuantity);
            }
            updateFields.push('`修改人` = ?');
            updateParams.push(modifier);

            updateParams.push(original.storeName.trim(), original.sku.trim());

            const updateSql = `UPDATE ${this.table} 
                SET ${updateFields.join(', ')}
                WHERE \`仓店名称\` = ? AND \`SKU\` = ?`;

            await this.prisma.$executeRawUnsafe(updateSql, ...updateParams);

            // 返回更新后的记录
            const result: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU\` = ?`,
                newStoreName,
                newSku
            );

            if (result && result.length > 0) {
                const r = result[0];
                return {
                    '仓店名称': String(r['仓店名称'] || ''),
                    'SKU': String(r['SKU'] || ''),
                    '单次最高采购量(基本单位)': Number(r['单次最高采购量(基本单位)'] || 0),
                    '修改人': String(r['修改人'] || ''),
                };
            }

            throw new Error('更新失败，无法获取更新的记录');
        } catch (error: any) {
            Logger.error('[MaxPurchaseQuantityService] Update error:', error);
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
        Logger.log('[MaxPurchaseQuantityService] ========== 开始删除记录 ==========');
        Logger.log('[MaxPurchaseQuantityService] 接收到的数据:', this.safeStringify(data));
        Logger.log('[MaxPurchaseQuantityService] storeName:', data?.storeName);
        Logger.log('[MaxPurchaseQuantityService] sku:', data?.sku);
        Logger.log('[MaxPurchaseQuantityService] storeName.trim():', data?.storeName?.trim());
        Logger.log('[MaxPurchaseQuantityService] sku.trim():', data?.sku?.trim());

        const deleteSql = `DELETE FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU\` = ?`;
        Logger.log('[MaxPurchaseQuantityService] 执行SQL:', deleteSql);
        Logger.log('[MaxPurchaseQuantityService] SQL参数1 (仓店名称):', data.storeName.trim());
        Logger.log('[MaxPurchaseQuantityService] SQL参数2 (SKU):', data.sku.trim());

        try {
            const affected = await this.prisma.$executeRawUnsafe(
                deleteSql,
                data.storeName.trim(),
                data.sku.trim()
            );
            Logger.log('[MaxPurchaseQuantityService] 执行结果 affected:', affected);
            Logger.log('[MaxPurchaseQuantityService] affected 类型:', typeof affected);
            Logger.log('[MaxPurchaseQuantityService] affected 是否为真值:', !!affected);

            // @ts-ignore Prisma returns number for executeRawUnsafe
            if (!affected) {
                Logger.warn('[MaxPurchaseQuantityService] 未找到记录，删除失败');
                throw new BadRequestException('未找到记录，删除失败');
            }
            Logger.log('[MaxPurchaseQuantityService] 删除成功，影响行数:', affected);
            Logger.log('[MaxPurchaseQuantityService] ========== 删除记录结束 ==========');
        } catch (error: any) {
            Logger.error('[MaxPurchaseQuantityService] 删除过程出错:', error);
            Logger.error('[MaxPurchaseQuantityService] 错误消息:', error?.message);
            Logger.error('[MaxPurchaseQuantityService] 错误堆栈:', error?.stack);
            throw error;
        }
    }
}

