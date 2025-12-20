
import { Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

export interface StoreRejectionItem {
    '门店/仓': string;
    '商品名称': string;
    'sku_id': string;
    'upc': string;
    '采购单号': string;
    '关联收货单号': string;
}

@Injectable()
export class StoreRejectionService {
    constructor(
        private prisma: PrismaService,
        private emailService: EmailService,
    ) { }

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
            Logger.error('[StoreRejectionService] 获取用户角色失败:', error);
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
            Logger.error('[StoreRejectionService] 获取用户department_id失败:', error);
            return null;
        }
    }

    /**
     * 从"门店/仓"字段提取第二个"-"之后、'仓'之前的数据
     * 例如："XX-XX-门店名称仓" -> "门店名称"
     */
    private extractStoreNameFromStoreWarehouse(storeWarehouse: string): string | null {
        if (!storeWarehouse || !storeWarehouse.trim()) {
            return null;
        }
        const str = storeWarehouse.trim();
        // 找到第二个"-"的位置
        const firstDash = str.indexOf('-');
        if (firstDash === -1) {
            return null;
        }
        const secondDash = str.indexOf('-', firstDash + 1);
        if (secondDash === -1) {
            return null;
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

    async list(
        filters?: {
            store?: string;
            productName?: string;
            skuId?: string;
            upc?: string;
            purchaseOrderNo?: string;
            receiptNo?: string;
            keyword?: string; // 兼容 keyword/q 的模糊搜索
        },
        page: number = 1,
        limit: number = 20,
        userId?: number
    ): Promise<{ data: StoreRejectionItem[]; total: number }> {
        let sql: string;
        let countSql: string;
        let params: any[] = [];

        const baseFrom = `FROM \`sm_chaigou\`.\`采购单商品明细\` mx
            LEFT JOIN \`sm_chaigou\`.\`采购单信息\` xx ON mx.\`采购单号\` = xx.\`采购单号\``;
        // 根据原始需求：只查询状态不在排除列表中的记录（有采购单信息的记录）
        const baseWhere = `WHERE xx.\`状态\` IS NOT NULL AND xx.\`状态\` NOT IN ('已完成','已关闭','收货完成')`;

        const offset = (page - 1) * limit;

        // 构建搜索条件：支持 keyword 模糊（OR），以及按字段精确（AND）
        const clauses: string[] = [];
        const unionClauses: string[] = [];
        const buildLike = (v?: string) => `%${(v || '').trim()}%`;

        // keyword/q 模糊匹配（OR across all columns）
        if (filters?.keyword?.trim()) {
            const like = buildLike(filters.keyword);
            clauses.push(`(
                mx.\`门店/仓\` LIKE ? OR
                mx.\`商品名称\` LIKE ? OR
                mx.\`sku_id\` LIKE ? OR
                mx.\`upc\` LIKE ? OR
                mx.\`采购单号\` LIKE ? OR
                xx.\`关联收货单号\` LIKE ?
            )`);
            unionClauses.push(`(
                \`收货方\` LIKE ? OR
                \`商品名称\` LIKE ? OR
                \`SKU\` LIKE ? OR
                \`UPC\` LIKE ? OR
                \`关联单号\` LIKE ? OR
                \`来源单号\` LIKE ?
            )`);
            params.push(like, like, like, like, like, like, like, like, like, like, like, like);
        }

        // 按字段匹配（AND）
        if (filters?.store?.trim()) {
            clauses.push(`mx.\`门店/仓\` LIKE ?`);
            unionClauses.push(`\`收货方\` LIKE ?`);
            const like = buildLike(filters.store);
            params.push(like, like);
        }
        if (filters?.productName?.trim()) {
            clauses.push(`mx.\`商品名称\` LIKE ?`);
            unionClauses.push(`\`商品名称\` LIKE ?`);
            const like = buildLike(filters.productName);
            params.push(like, like);
        }
        if (filters?.skuId?.trim()) {
            clauses.push(`mx.\`sku_id\` LIKE ?`);
            unionClauses.push(`\`SKU\` LIKE ?`);
            const like = buildLike(filters.skuId);
            params.push(like, like);
        }
        if (filters?.upc?.trim()) {
            clauses.push(`mx.\`upc\` LIKE ?`);
            unionClauses.push(`\`UPC\` LIKE ?`);
            const like = buildLike(filters.upc);
            params.push(like, like);
        }
        if (filters?.purchaseOrderNo?.trim()) {
            clauses.push(`mx.\`采购单号\` LIKE ?`);
            unionClauses.push(`\`关联单号\` LIKE ?`);
            const like = buildLike(filters.purchaseOrderNo);
            params.push(like, like);
        }
        if (filters?.receiptNo?.trim()) {
            clauses.push(`xx.\`关联收货单号\` LIKE ?`);
            unionClauses.push(`\`来源单号\` LIKE ?`);
            const like = buildLike(filters.receiptNo);
            params.push(like, like);
        }

        const searchCondition = clauses.length > 0 ? `AND (${clauses.join(' AND ')})` : '';
        const unionSearchCondition = unionClauses.length > 0 ? `AND (${unionClauses.join(' AND ')})` : '';

        // 主查询
        const mainQuery = `SELECT 
            mx.\`门店/仓\`,
            mx.\`商品名称\`,
            mx.\`sku_id\`,
            mx.\`upc\`,
            mx.\`采购单号\`,
            xx.\`关联收货单号\`
        ${baseFrom}
        ${baseWhere}
        ${searchCondition}`;

        // UNION 查询：从待处理差异单表查询关联单号包含'DB'的记录
        const unionQuery = `SELECT 
            \`收货方\` AS \`门店/仓\`,
            \`商品名称\`,
            \`SKU\` AS \`sku_id\`,
            \`UPC\` AS \`upc\`,
            \`关联单号\` AS \`采购单号\`,
            \`来源单号\` AS \`关联收货单号\`
        FROM \`sm_chaigou\`.\`待处理差异单\`
        WHERE \`关联单号\` LIKE '%DB%'
        ${unionSearchCondition}`;

        // 组合查询
        const combinedQuery = `(${mainQuery}) UNION (${unionQuery})`;

        // 计数查询：使用 UNION 查询计算总数，确保参数顺序一致
        countSql = `SELECT COUNT(*) as total FROM (${combinedQuery}) AS combined_result`;

        // 数据查询：先 UNION，再分页
        sql = `SELECT * FROM (${combinedQuery}) AS combined_result LIMIT ${limit} OFFSET ${offset}`;

        try {
            Logger.log('[StoreRejectionService] Executing count SQL:', countSql);
            Logger.log('[StoreRejectionService] Count params:', params);
            const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
            let total = Number(countRows?.total || 0);
            Logger.log('[StoreRejectionService] Total count:', total);

            Logger.log('[StoreRejectionService] Executing data SQL:', sql);
            Logger.log('[StoreRejectionService] Data params:', params);
            let rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
            Logger.log('[StoreRejectionService] Rows returned:', rows?.length || 0);

            // 根据角色过滤数据
            const { shouldFilter, departmentId } = await this.shouldFilterByRole(userId);
            if (shouldFilter && departmentId !== null) {
                Logger.log('[StoreRejectionService] 需要根据角色过滤数据，departmentId:', departmentId);
                // 先查询所有数据（不分页）进行过滤
                const allRowsSql = sql.replace(/LIMIT \d+ OFFSET \d+$/, '');
                const allRows: any[] = await this.prisma.$queryRawUnsafe(allRowsSql, ...params);
                Logger.log('[StoreRejectionService] 查询到的所有数据行数:', allRows.length);

                const finalFilteredRows: any[] = [];
                for (const r of allRows) {
                    const storeWarehouse = String(r['门店/仓'] || '');
                    const extractedStoreName = this.extractStoreNameFromStoreWarehouse(storeWarehouse);
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
                            finalFilteredRows.push(r);
                        }
                    }
                }
                total = finalFilteredRows.length;
                Logger.log('[StoreRejectionService] 过滤后的总行数:', total);

                // 对过滤后的数据进行分页
                const startIndex = (page - 1) * limit;
                rows = finalFilteredRows.slice(startIndex, startIndex + limit);
                Logger.log('[StoreRejectionService] 当前页行数:', rows.length);
            }

            const data = (rows || []).map(r => ({
                '门店/仓': String(r['门店/仓'] || ''),
                '商品名称': String(r['商品名称'] || ''),
                'sku_id': String(r['sku_id'] || ''),
                'upc': String(r['upc'] || ''),
                '采购单号': String(r['采购单号'] || ''),
                '关联收货单号': String(r['关联收货单号'] || ''),
            }));

            return { data, total };
        } catch (error) {
            Logger.error('[StoreRejectionService] Query error:', error);
            throw error;
        }
    }

    /**
     * 发送驳回差异单邮件
     * @param item 要发送的数据项
     * @param email 收件人邮箱（如果未提供，从环境变量读取）
     * @param userId 操作者用户ID（从请求头获取）
     */
    async sendRejectionEmail(item: StoreRejectionItem, email?: string, userId?: number): Promise<void> {
        const recipientEmail = email || process.env.STORE_REJECTION_EMAIL || '';

        if (!recipientEmail) {
            throw new Error('未配置收件人邮箱，请设置环境变量 STORE_REJECTION_EMAIL 或在请求中提供邮箱地址');
        }

        const subject = '驳回差异单';

        // 只发送门店/仓、sku_id、关联收货单号三个字段
        const emailData: any = {
            '门店/仓': item['门店/仓'],
            'sku_id': item['sku_id'],
            '关联收货单号': item['关联收货单号'],
        };

        // 如果提供了userId，查询sys_users表中的user_id字段并添加到邮件中
        if (userId) {
            try {
                const userRows: any[] = await this.prisma.$queryRawUnsafe(
                    `SELECT user_id FROM sm_xitongkaifa.sys_users WHERE id = ? LIMIT 1`,
                    userId
                );
                if (userRows.length > 0 && userRows[0].user_id) {
                    emailData['操作者user_id'] = userRows[0].user_id;
                }
            } catch (error) {
                Logger.warn('[StoreRejectionService] 查询用户user_id失败:', error);
                // 查询失败不影响邮件发送，只记录警告
            }
        }

        await this.emailService.sendJsonEmail(recipientEmail, subject, emailData);
    }

    /**
     * 发送驳回全部差异单邮件
     * @param item 要发送的数据项
     * @param email 收件人邮箱（如果未提供，从环境变量读取）
     * @param userId 操作者用户ID（从请求头获取）
     */
    async sendRejectionAllEmail(item: StoreRejectionItem, email?: string, userId?: number): Promise<void> {
        const recipientEmail = email || process.env.STORE_REJECTION_EMAIL || '';

        if (!recipientEmail) {
            throw new Error('未配置收件人邮箱，请设置环境变量 STORE_REJECTION_EMAIL 或在请求中提供邮箱地址');
        }

        const subject = '驳回差异单';

        // 只发送门店/仓、sku_id（空值）、关联收货单号三个字段
        const emailData: any = {
            '门店/仓': item['门店/仓'],
            'sku_id': '', // sku_id设为空值
            '关联收货单号': item['关联收货单号'],
        };

        // 如果提供了userId，查询sys_users表中的user_id字段并添加到邮件中
        if (userId) {
            try {
                const userRows: any[] = await this.prisma.$queryRawUnsafe(
                    `SELECT user_id FROM sm_xitongkaifa.sys_users WHERE id = ? LIMIT 1`,
                    userId
                );
                if (userRows.length > 0 && userRows[0].user_id) {
                    emailData['操作者user_id'] = userRows[0].user_id;
                }
            } catch (error) {
                Logger.warn('[StoreRejectionService] 查询用户user_id失败:', error);
                // 查询失败不影响邮件发送，只记录警告
            }
        }

        await this.emailService.sendJsonEmail(recipientEmail, subject, emailData);
    }
}

