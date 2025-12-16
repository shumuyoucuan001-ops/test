import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Logger } from '../utils/logger.util';
import { PurchasePassDifferenceService } from './purchase-pass-difference.service';

@Controller('purchase-pass-difference')
export class PurchasePassDifferenceController {
    constructor(private service: PurchasePassDifferenceService) { }

    @Post('send-email')
    async sendEmail(
        @Body() body: { items: string[]; email?: string },
        @Headers('x-user-id') userId?: string,
    ): Promise<{ success: boolean; message: string }> {
        const userIdNum = userId ? Number(userId) : undefined;
        Logger.log('[PurchasePassDifferenceController] 收到发送邮件请求:', {
            itemsCount: body.items?.length || 0,
            email: body.email || '使用环境变量配置的邮箱',
            userId: userIdNum,
            timestamp: new Date().toISOString(),
        });

        try {
            await this.service.sendPassDifferenceEmail(body.items || [], body.email, userIdNum);
            Logger.log('[PurchasePassDifferenceController] 邮件发送成功');
            return { success: true, message: '邮件发送成功' };
        } catch (error: any) {
            Logger.error('[PurchasePassDifferenceController] 发送邮件失败:', {
                error: error?.message || error,
                code: error?.code,
                responseCode: error?.responseCode,
                stack: error?.stack,
                timestamp: new Date().toISOString(),
            });
            return {
                success: false,
                message: error instanceof Error ? error.message : '发送邮件失败',
            };
        }
    }
}

