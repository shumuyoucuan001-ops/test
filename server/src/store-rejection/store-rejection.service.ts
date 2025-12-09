
import { Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

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

    async list(q?: string, page: number = 1, limit: number = 20): Promise<{ data: StoreRejectionItem[]; total: number }> {
        const keyword = (q || '').trim();
        let sql: string;
        let countSql: string;
        let countParams: any[] = [];
        let params: any[] = [];

        const baseFrom = `FROM \`sm_chaigou\`.\`采购单商品明细\` mx
            LEFT JOIN \`sm_chaigou\`.\`采购单信息\` xx ON mx.\`采购单号\` = xx.\`采购单号\``;
        // 根据原始需求：只查询状态不在排除列表中的记录（有采购单信息的记录）
        const baseWhere = `WHERE xx.\`状态\` IS NOT NULL AND xx.\`状态\` NOT IN ('已完成','已关闭','收货完成')`;

        const offset = (page - 1) * limit;

        if (keyword) {
            const like = `%${keyword}%`;
            const searchCondition = `AND (
                    mx.\`门店/仓\` LIKE ? OR
                    mx.\`商品名称\` LIKE ? OR
                    mx.\`sku_id\` LIKE ? OR
                    mx.\`upc\` LIKE ? OR
                    mx.\`采购单号\` LIKE ? OR
                    xx.\`关联收货单号\` LIKE ?
                )`;
            countParams = [like, like, like, like, like, like];

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
            params = countParams;
        } else {
            countSql = `SELECT COUNT(*) as total ${baseFrom} ${baseWhere}`;
            sql = `SELECT 
                mx.\`门店/仓\`,
                mx.\`商品名称\`,
                mx.\`sku_id\`,
                mx.\`upc\`,
                mx.\`采购单号\`,
                xx.\`关联收货单号\`
            ${baseFrom}
            ${baseWhere}
            LIMIT ${limit} OFFSET ${offset}`;
            params = [];
        }

        try {
            console.log('[StoreRejectionService] Executing count SQL:', countSql);
            console.log('[StoreRejectionService] Count params:', countParams);
            const [countRows]: any[] = await this.prisma.$queryRawUnsafe(countSql, ...countParams);
            const total = Number(countRows?.total || 0);
            console.log('[StoreRejectionService] Total count:', total);

            console.log('[StoreRejectionService] Executing data SQL:', sql);
            console.log('[StoreRejectionService] Data params:', params);
            const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
            console.log('[StoreRejectionService] Rows returned:', rows?.length || 0);

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
            console.error('[StoreRejectionService] Query error:', error);
            throw error;
        }
    }

    /**
     * 发送驳回差异单邮件
     * @param item 要发送的数据项
     * @param email 收件人邮箱（如果未提供，从环境变量读取）
     */
    async sendRejectionEmail(item: StoreRejectionItem, email?: string): Promise<void> {
        const recipientEmail = email || process.env.STORE_REJECTION_EMAIL || '';

        if (!recipientEmail) {
            throw new Error('未配置收件人邮箱，请设置环境变量 STORE_REJECTION_EMAIL 或在请求中提供邮箱地址');
        }

        const subject = `驳回差异单 - ${item['采购单号']} - ${item['商品名称']}`;

        await this.emailService.sendJsonEmail(recipientEmail, subject, item);
    }
}

