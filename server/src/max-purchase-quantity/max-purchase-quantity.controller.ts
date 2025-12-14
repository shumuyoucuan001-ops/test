import { Body, Controller, Delete, Get, Headers, Post, Put, Query } from '@nestjs/common';
import { Logger } from '../utils/logger.util';
import type { MaxPurchaseQuantityItem } from './max-purchase-quantity.service';
import { MaxPurchaseQuantityService } from './max-purchase-quantity.service';

@Controller('max-purchase-quantity')
export class MaxPurchaseQuantityController {
    constructor(private service: MaxPurchaseQuantityService) { }

    @Get('store-names')
    async getStoreNames(): Promise<string[]> {
        Logger.log('[MaxPurchaseQuantityController] 获取门店名称列表');
        return this.service.getStoreNames();
    }

    @Get('user-display-name')
    async getUserDisplayName(@Headers('x-user-id') userId?: string): Promise<{ displayName: string | null }> {
        const userIdNum = userId ? Number(userId) : undefined;
        if (!userIdNum) {
            return { displayName: null };
        }
        Logger.log('[MaxPurchaseQuantityController] 获取用户display_name:', userIdNum);
        const displayName = await this.service.getUserDisplayName(userIdNum);
        return { displayName };
    }

    @Get()
    async list(
        @Query('storeName') storeName?: string,
        @Query('sku') sku?: string,
        @Query('maxQuantity') maxQuantity?: string,
        @Query('modifier') modifier?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<{ data: MaxPurchaseQuantityItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 50));
        const filters: any = {};
        if (storeName) filters.storeName = storeName;
        if (sku) filters.sku = sku;
        if (maxQuantity) filters.maxQuantity = maxQuantity;
        if (modifier) filters.modifier = modifier;

        Logger.log('[MaxPurchaseQuantityController] list query:', {
            storeName, sku, maxQuantity, modifier, page: pageNum, limit: limitNum,
        });

        return this.service.list(Object.keys(filters).length > 0 ? filters : undefined, pageNum, limitNum);
    }

    @Post()
    async create(
        @Body() body: {
            storeName: string;
            sku: string;
            maxQuantity: number;
        },
        @Headers('x-user-id') userId?: string,
    ): Promise<MaxPurchaseQuantityItem> {
        const userIdNum = userId ? Number(userId) : undefined;
        Logger.log('[MaxPurchaseQuantityController] 创建记录:', {
            ...body,
            userId: userIdNum,
        });

        return this.service.create(body, userIdNum);
    }

    @Put()
    async update(
        @Body() body: {
            original: {
                storeName: string;
                sku: string;
            };
            data: {
                storeName?: string;
                sku?: string;
                maxQuantity?: number;
            };
        },
        @Headers('x-user-id') userId?: string,
    ): Promise<MaxPurchaseQuantityItem> {
        const userIdNum = userId ? Number(userId) : undefined;
        Logger.log('[MaxPurchaseQuantityController] 更新记录:', {
            ...body,
            userId: userIdNum,
        });
        return this.service.update(body.original, body.data, userIdNum);
    }

    @Delete()
    async delete(
        @Body() body: {
            storeName: string;
            sku: string;
        },
    ): Promise<{ success: boolean }> {
        await this.service.delete(body);
        return { success: true };
    }
}

