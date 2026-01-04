import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';
import { OperationLogService } from '../operation-log/operation-log.service';

export interface MaxPurchaseQuantityItem {
    '仓店名称': string;
    'SKU': string;
    '单次最高采购量(基本单位)': number;
    '修改人': string;
    '商品名称'?: string | null;
    '商品UPC'?: string | null;
    '规格'?: string | null;
    '采购单价 (基础单位)'?: string | number | null;
    '采购单价 (采购单位)'?: string | number | null;
}

@Injectable()
export class MaxPurchaseQuantityService {
    constructor(
        private prisma: PrismaService,
        private operationLogService: OperationLogService,
    ) { }

    private readonly table = '`sm_chaigou`.`单次最高采购量`';
    private readonly warehousePriorityTable = '`sm_chaigou`.`仓库优先级`';
    private readonly replenishmentReferenceTable = '`sm_chaigou`.`仓店补货参考`';

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
     * 验证单次最高采购量是否符合30天总销量的要求
     * 从 sm_chaigou.仓店补货参考 表中查询同仓店名称、同SKU的30天总销量
     * 单次最高采购量不能低于 (30天总销量 / 15)
     */
    private async validateMaxQuantityAgainstSales(
        storeName: string,
        sku: string,
        maxQuantity: number
    ): Promise<{ valid: boolean; message?: string; requiredMinimum?: number }> {
        try {
            Logger.log('[MaxPurchaseQuantityService] ========== 开始验证单次最高采购量 ==========');
            Logger.log('[MaxPurchaseQuantityService] 输入参数:', {
                storeName,
                sku,
                maxQuantity
            });

            // 查询仓店补货参考表
            const sql = `SELECT \`30天总销量\` 
                        FROM ${this.replenishmentReferenceTable} 
                        WHERE \`门店/仓名称\` = ? AND \`商品SKU\` = ? 
                        LIMIT 1`;

            Logger.log('[MaxPurchaseQuantityService] 执行查询SQL:', sql);
            Logger.log('[MaxPurchaseQuantityService] 查询参数:', [storeName.trim(), sku.trim()]);

            const rows: any[] = await this.prisma.$queryRawUnsafe(sql, storeName.trim(), sku.trim());

            Logger.log('[MaxPurchaseQuantityService] 查询结果行数:', rows?.length || 0);
            Logger.log('[MaxPurchaseQuantityService] 查询结果:', this.safeStringify(rows));

            if (!rows || rows.length === 0) {
                // 如果没有找到对应的补货参考记录，则不进行验证，允许设置
                Logger.warn('[MaxPurchaseQuantityService] ⚠️ 未找到仓店补货参考记录，跳过验证');
                Logger.warn('[MaxPurchaseQuantityService] 仓店名称:', storeName.trim());
                Logger.warn('[MaxPurchaseQuantityService] SKU:', sku.trim());
                return { valid: true };
            }

            const totalSales30Days = Number(rows[0]['30天总销量'] || 0);
            Logger.log('[MaxPurchaseQuantityService] 查询到30天总销量:', totalSales30Days);

            // 计算最小采购量要求：30天总销量 / 15
            const requiredMinimum = totalSales30Days / 15;
            Logger.log('[MaxPurchaseQuantityService] 计算得到的最小采购量要求:', requiredMinimum);
            Logger.log('[MaxPurchaseQuantityService] 用户输入的最高采购量:', maxQuantity);

            if (maxQuantity < requiredMinimum) {
                // 向上取整作为推荐值
                const recommendedMinimum = Math.ceil(requiredMinimum);
                const message = `设置的单次最高采购量(${maxQuantity})低于要求的最小值。根据该仓店SKU的30天总销量(${totalSales30Days})计算，最小值应为：${totalSales30Days} ÷ 15 = ${requiredMinimum.toFixed(2)}（向上取整为 ${recommendedMinimum}）`;
                Logger.warn('[MaxPurchaseQuantityService] ❌ 验证失败:', message);
                Logger.warn('[MaxPurchaseQuantityService] 推荐最小值:', recommendedMinimum);
                return {
                    valid: false,
                    message,
                    requiredMinimum: recommendedMinimum  // 返回向上取整后的值
                };
            }

            Logger.log('[MaxPurchaseQuantityService] ✅ 验证通过');
            Logger.log('[MaxPurchaseQuantityService] ========== 验证结束 ==========');
            return { valid: true };
        } catch (error) {
            Logger.error('[MaxPurchaseQuantityService] ❌ 验证单次最高采购量时发生错误:', error);
            Logger.error('[MaxPurchaseQuantityService] 错误堆栈:', (error as Error)?.stack);
            // 如果查询出错，记录日志但不阻止操作
            return { valid: true };
        }
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
            clauses.push(`t.\`仓店名称\` LIKE ?`);
            params.push(buildLike(filters.storeName));
        }
        if (filters?.sku?.trim()) {
            clauses.push(`t.\`SKU\` LIKE ?`);
            params.push(buildLike(filters.sku));
        }
        if (filters?.maxQuantity?.trim()) {
            // 尝试转换为数字进行精确匹配，如果转换失败则使用LIKE模糊匹配
            const quantityValue = parseFloat(filters.maxQuantity.trim());
            if (!isNaN(quantityValue)) {
                clauses.push(`t.\`单次最高采购量(基本单位)\` = ?`);
                params.push(quantityValue);
            } else {
                clauses.push(`CAST(t.\`单次最高采购量(基本单位)\` AS CHAR) LIKE ?`);
                params.push(buildLike(filters.maxQuantity));
            }
        }
        if (filters?.modifier?.trim()) {
            clauses.push(`t.\`修改人\` LIKE ?`);
            params.push(buildLike(filters.modifier));
        }

        const searchCondition = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        countSql = `SELECT COUNT(*) as total 
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
            ) p ON t.\`SKU\` = p.\`商品SKU\`
            ${searchCondition}`;
        sql = `SELECT 
            t.\`仓店名称\`,
            t.\`SKU\`,
            t.\`单次最高采购量(基本单位)\`,
            t.\`修改人\`,
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
        ) p ON t.\`SKU\` = p.\`商品SKU\`
        ${searchCondition}
        ORDER BY t.\`仓店名称\`, t.\`SKU\`
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
                Logger.log('[MaxPurchaseQuantityService] 过滤后的总行数:', total);
                Logger.log('[MaxPurchaseQuantityService] 当前页行数:', rows.length);
            }

            const data = (rows || []).map(r => ({
                '仓店名称': String(r['仓店名称'] || ''),
                'SKU': String(r['SKU'] || ''),
                '单次最高采购量(基本单位)': Number(r['单次最高采购量(基本单位)'] || 0),
                '修改人': String(r['修改人'] || ''),
                '采购单价 (基础单位)': r['采购单价 (基础单位)'] !== null && r['采购单价 (基础单位)'] !== undefined ? r['采购单价 (基础单位)'] : null,
                '采购单价 (采购单位)': r['采购单价 (采购单位)'] !== null && r['采购单价 (采购单位)'] !== undefined ? r['采购单价 (采购单位)'] : null,
                '商品名称': r['商品名称'] ? String(r['商品名称']) : null,
                '商品UPC': r['商品UPC'] ? String(r['商品UPC']) : null,
                '规格': r['规格'] ? String(r['规格']) : null,
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

        // 验证单次最高采购量是否符合30天总销量的要求
        const validationResult = await this.validateMaxQuantityAgainstSales(
            data.storeName,
            data.sku,
            data.maxQuantity
        );

        if (!validationResult.valid) {
            // 在错误消息中包含推荐的最小值，方便前端解析
            const errorMessage = `${validationResult.message}[REQUIRED_MINIMUM:${validationResult.requiredMinimum}]`;
            throw new BadRequestException(errorMessage);
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
                const createdItem = {
                    '仓店名称': String(r['仓店名称'] || ''),
                    'SKU': String(r['SKU'] || ''),
                    '单次最高采购量(基本单位)': Number(r['单次最高采购量(基本单位)'] || 0),
                    '修改人': String(r['修改人'] || ''),
                    '采购单价 (基础单位)': null,
                    '采购单价 (采购单位)': null,
                    '商品名称': null,
                    '商品UPC': null,
                    '规格': null,
                };

                // 记录操作日志
                await this.operationLogService.logOperation({
                    userId: userId,
                    displayName: modifier,
                    operationType: 'CREATE',
                    targetDatabase: 'sm_chaigou',
                    targetTable: '单次最高采购量',
                    recordIdentifier: {
                        仓店名称: data.storeName.trim(),
                        SKU: data.sku.trim(),
                    },
                    changes: {},
                    operationDetails: { new_data: createdItem },
                });

                return createdItem;
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

        // 如果更新了单次最高采购量，验证是否符合30天总销量的要求
        if (data.maxQuantity !== undefined) {
            const finalStoreName = data.storeName || original.storeName;
            const finalSku = data.sku || original.sku;

            const validationResult = await this.validateMaxQuantityAgainstSales(
                finalStoreName,
                finalSku,
                data.maxQuantity
            );

            if (!validationResult.valid) {
                // 在错误消息中包含推荐的最小值，方便前端解析
                const errorMessage = `${validationResult.message}[REQUIRED_MINIMUM:${validationResult.requiredMinimum}]`;
                throw new BadRequestException(errorMessage);
            }
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
                const updatedItem = {
                    '仓店名称': String(r['仓店名称'] || ''),
                    'SKU': String(r['SKU'] || ''),
                    '单次最高采购量(基本单位)': Number(r['单次最高采购量(基本单位)'] || 0),
                    '修改人': String(r['修改人'] || ''),
                    '采购单价 (基础单位)': null,
                    '采购单价 (采购单位)': null,
                    '商品名称': null,
                    '商品UPC': null,
                    '规格': null,
                };

                // 记录操作日志
                const oldRecord = existing[0];
                const changes: Record<string, { old?: any; new?: any }> = {};
                if (data.storeName !== undefined && oldRecord['仓店名称'] !== newStoreName) {
                    changes['仓店名称'] = { old: oldRecord['仓店名称'], new: newStoreName };
                }
                if (data.sku !== undefined && oldRecord['SKU'] !== newSku) {
                    changes['SKU'] = { old: oldRecord['SKU'], new: newSku };
                }
                if (data.maxQuantity !== undefined && oldRecord['单次最高采购量(基本单位)'] !== data.maxQuantity) {
                    changes['单次最高采购量(基本单位)'] = { old: oldRecord['单次最高采购量(基本单位)'], new: data.maxQuantity };
                }
                if (oldRecord['修改人'] !== modifier) {
                    changes['修改人'] = { old: oldRecord['修改人'], new: modifier };
                }

                await this.operationLogService.logOperation({
                    userId: userId,
                    displayName: modifier,
                    operationType: 'UPDATE',
                    targetDatabase: 'sm_chaigou',
                    targetTable: '单次最高采购量',
                    recordIdentifier: {
                        仓店名称: original.storeName.trim(),
                        SKU: original.sku.trim(),
                    },
                    changes: changes,
                    operationDetails: { original: oldRecord, updated: updatedItem },
                });

                return updatedItem;
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
    }, userId?: number): Promise<void> {
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
            // 先获取要删除的记录信息
            const selectSql = `SELECT * FROM ${this.table} WHERE \`仓店名称\` = ? AND \`SKU\` = ?`;
            const existing: any[] = await this.prisma.$queryRawUnsafe(
                selectSql,
                data.storeName.trim(),
                data.sku.trim()
            );

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

            // 记录操作日志
            if (existing && existing.length > 0) {
                const deletedRecord = existing[0];
                let displayName = '系统';
                if (userId) {
                    const userName = await this.getUserDisplayName(userId);
                    if (userName) {
                        displayName = userName;
                    }
                }

                await this.operationLogService.logOperation({
                    userId: userId,
                    displayName: displayName,
                    operationType: 'DELETE',
                    targetDatabase: 'sm_chaigou',
                    targetTable: '单次最高采购量',
                    recordIdentifier: {
                        仓店名称: data.storeName.trim(),
                        SKU: data.sku.trim(),
                    },
                    changes: {},
                    operationDetails: { deleted_data: deletedRecord },
                });
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

