import { Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../utils/logger.util';

@Injectable()
export class PurchasePassDifferenceService {
    constructor(
        private prisma: PrismaService,
        private emailService: EmailService,
    ) { }

    /**
     * 发送采购通过差异单邮件
     * @param items 要发送的数据列表（一列数据）
     * @param email 收件人邮箱（如果未提供，从环境变量读取）
     * @param userId 操作者用户ID（从请求头获取）
     */
    async sendPassDifferenceEmail(
        items: string[],
        email?: string,
        userId?: number,
    ): Promise<void> {
        const recipientEmail = email || process.env.STORE_REJECTION_EMAIL || '';

        if (!recipientEmail) {
            throw new Error(
                '未配置收件人邮箱，请设置环境变量 STORE_REJECTION_EMAIL 或在请求中提供邮箱地址',
            );
        }

        const subject = '采购通过差异单';

        // 将列表数据格式化为邮件内容
        // 格式化为列表形式：每行一个数据项，前面加序号
        const emailData: any = {
            数据列表: items.length > 0 ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : '(空)',
        };

        // 如果提供了userId，查询sys_users表中的user_id字段并添加到邮件中
        if (userId) {
            try {
                const userRows: any[] = await this.prisma.$queryRawUnsafe(
                    `SELECT user_id FROM sm_xitongkaifa.sys_users WHERE id = ? LIMIT 1`,
                    userId,
                );
                if (userRows.length > 0 && userRows[0].user_id) {
                    emailData['操作者user_id'] = userRows[0].user_id;
                }
            } catch (error) {
                Logger.warn('[PurchasePassDifferenceService] 查询用户user_id失败:', error);
                // 查询失败不影响邮件发送，只记录警告
            }
        }

        // 添加数据条数统计
        emailData['数据条数'] = items.length;

        await this.emailService.sendJsonEmail(recipientEmail, subject, emailData);
    }
}

