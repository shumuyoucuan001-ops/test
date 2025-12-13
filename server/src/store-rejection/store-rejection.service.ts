
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
        limit: number = 20
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
            params.push(like, like, like, like, like, like);
        }

        // 按字段匹配（AND）
        if (filters?.store?.trim()) {
            clauses.push(`mx.\`门店/仓\` LIKE ?`);
            params.push(buildLike(filters.store));
        }
        if (filters?.productName?.trim()) {
            clauses.push(`mx.\`商品名称\` LIKE ?`);
            params.push(buildLike(filters.productName));
        }
        if (filters?.skuId?.trim()) {
            clauses.push(`mx.\`sku_id\` LIKE ?`);
            params.push(buildLike(filters.skuId));
        }
        if (filters?.upc?.trim()) {
            clauses.push(`mx.\`upc\` LIKE ?`);
            params.push(buildLike(filters.upc));
        }
        if (filters?.purchaseOrderNo?.trim()) {
            clauses.push(`mx.\`采购单号\` LIKE ?`);
            params.push(buildLike(filters.purchaseOrderNo));
        }
        if (filters?.receiptNo?.trim()) {
            clauses.push(`xx.\`关联收货单号\` LIKE ?`);
            params.push(buildLike(filters.receiptNo));
        }

        const searchCondition = clauses.length > 0 ? `AND (${clauses.join(' AND ')})` : '';

        countSql = `SELECT COUNT(*) as total ${baseFrom} ${baseWhere} ${searchCondition}`;
        sql = `SELECT 
            mx.\`门店/仓\`,
            mx.\`商品名称\`,
            mx.\`sku_id\`,
            mx.\`upc\`,
            mx.\`采购单号\`,
            xx.\`关联收货单号\`
        ${baseFrom}
        ${baseWhere}
        ${searchCondition}
        LIMIT ${limit} OFFSET ${offset}`;

        try {
            Logger.log('[StoreRejectionService] Executing count SQL:', countSql);
            Logger.log('[StoreRejectionService] Count params:', params);
            const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
            const total = Number(countRows?.total || 0);
            Logger.log('[StoreRejectionService] Total count:', total);

            Logger.log('[StoreRejectionService] Executing data SQL:', sql);
            Logger.log('[StoreRejectionService] Data params:', params);
            const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
            Logger.log('[StoreRejectionService] Rows returned:', rows?.length || 0);

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

