import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { Logger } from '../utils/logger.util';
import type { StoreRejectionItem } from './store-rejection.service';
import { StoreRejectionService } from './store-rejection.service';

@Controller('store-rejection')
export class StoreRejectionController {
    constructor(private service: StoreRejectionService) { }

    @Get()
    async list(
        @Query('store') store?: string,
        @Query('productName') productName?: string,
        @Query('skuId') skuId?: string,
        @Query('upc') upc?: string,
        @Query('purchaseOrderNo') purchaseOrderNo?: string,
        @Query('receiptNo') receiptNo?: string,
        @Query('q') keyword?: string, // 兼容旧的 q 查询
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<{ data: StoreRejectionItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 50));
        const filters: any = {};
        if (store) filters.store = store;
        if (productName) filters.productName = productName;
        if (skuId) filters.skuId = skuId;
        if (upc) filters.upc = upc;
        if (purchaseOrderNo) filters.purchaseOrderNo = purchaseOrderNo;
        if (receiptNo) filters.receiptNo = receiptNo;
        if (keyword) filters.keyword = keyword;

        Logger.log('[StoreRejectionController] list query:', {
            store, productName, skuId, upc, purchaseOrderNo, receiptNo, keyword, page: pageNum, limit: limitNum,
        });

        return this.service.list(Object.keys(filters).length > 0 ? filters : undefined, pageNum, limitNum);
    }

    @Post('send-rejection-email')
    async sendRejectionEmail(
        @Body() body: { item: StoreRejectionItem; email?: string },
        @Headers('x-user-id') userId?: string,
    ): Promise<{ success: boolean; message: string }> {
        const userIdNum = userId ? Number(userId) : undefined;
        Logger.log('[StoreRejectionController] 收到发送邮件请求:', {
            item: body.item,
            email: body.email || '使用环境变量配置的邮箱',
            userId: userIdNum,
            timestamp: new Date().toISOString(),
        });

        try {
            await this.service.sendRejectionEmail(body.item, body.email, userIdNum);
            Logger.log('[StoreRejectionController] 邮件发送成功');
            return { success: true, message: '邮件发送成功' };
        } catch (error: any) {
            Logger.error('[StoreRejectionController] 发送邮件失败:', {
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

    @Post('send-rejection-all-email')
    async sendRejectionAllEmail(
        @Body() body: { item: StoreRejectionItem; email?: string },
        @Headers('x-user-id') userId?: string,
    ): Promise<{ success: boolean; message: string }> {
        const userIdNum = userId ? Number(userId) : undefined;
        Logger.log('[StoreRejectionController] 收到发送驳回全部邮件请求:', {
            item: body.item,
            email: body.email || '使用环境变量配置的邮箱',
            userId: userIdNum,
            timestamp: new Date().toISOString(),
        });

        try {
            await this.service.sendRejectionAllEmail(body.item, body.email, userIdNum);
            Logger.log('[StoreRejectionController] 驳回全部邮件发送成功');
            return { success: true, message: '邮件发送成功' };
        } catch (error: any) {
            Logger.error('[StoreRejectionController] 发送驳回全部邮件失败:', {
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

