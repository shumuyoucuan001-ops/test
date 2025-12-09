import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { StoreRejectionItem } from './store-rejection.service';
import { StoreRejectionService } from './store-rejection.service';

@Controller('store-rejection')
export class StoreRejectionController {
    constructor(private service: StoreRejectionService) { }

    @Get()
    async list(
        @Query('q') q?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<{ data: StoreRejectionItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 50));
        return this.service.list(q, pageNum, limitNum);
    }

    @Post('send-rejection-email')
    async sendRejectionEmail(
        @Body() body: { item: StoreRejectionItem; email?: string },
    ): Promise<{ success: boolean; message: string }> {
        console.log('[StoreRejectionController] 收到发送邮件请求:', {
            item: body.item,
            email: body.email || '使用环境变量配置的邮箱',
            timestamp: new Date().toISOString(),
        });

        try {
            await this.service.sendRejectionEmail(body.item, body.email);
            console.log('[StoreRejectionController] 邮件发送成功');
            return { success: true, message: '邮件发送成功' };
        } catch (error: any) {
            console.error('[StoreRejectionController] 发送邮件失败:', {
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

