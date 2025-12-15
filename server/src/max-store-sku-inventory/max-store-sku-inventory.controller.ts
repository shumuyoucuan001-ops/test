import { Body, Controller, Delete, Get, Headers, Post, Put, Query } from '@nestjs/common';
import { Logger } from '../utils/logger.util';
import type { MaxStoreSkuInventoryItem } from './max-store-sku-inventory.service';
import { MaxStoreSkuInventoryService } from './max-store-sku-inventory.service';

@Controller('max-store-sku-inventory')
export class MaxStoreSkuInventoryController {
    constructor(private service: MaxStoreSkuInventoryService) { }

    @Get('store-names')
    async getStoreNames(): Promise<string[]> {
        Logger.log('[MaxStoreSkuInventoryController] 获取门店名称列表');
        return this.service.getStoreNames();
    }

    @Get('user-display-name')
    async getUserDisplayName(@Headers('x-user-id') userId?: string): Promise<{ displayName: string | null }> {
        const userIdNum = userId ? Number(userId) : undefined;
        if (!userIdNum) {
            return { displayName: null };
        }
        Logger.log('[MaxStoreSkuInventoryController] 获取用户display_name:', userIdNum);
        const displayName = await this.service.getUserDisplayName(userIdNum);
        return { displayName };
    }

    @Get()
    async list(
        @Query('storeName') storeName?: string,
        @Query('sku') sku?: string,
        @Query('maxInventory') maxInventory?: string,
        @Query('remark') remark?: string,
        @Query('modifier') modifier?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Headers('x-user-id') userId?: string,
    ): Promise<{ data: MaxStoreSkuInventoryItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 50));
        const userIdNum = userId ? Number(userId) : undefined;
        const filters: any = {};
        if (storeName) filters.storeName = storeName;
        if (sku) filters.sku = sku;
        if (maxInventory) filters.maxInventory = maxInventory;
        if (remark) filters.remark = remark;
        if (modifier) filters.modifier = modifier;

        Logger.log('[MaxStoreSkuInventoryController] list query:', {
            storeName, sku, maxInventory, remark, modifier, page: pageNum, limit: limitNum, userId: userIdNum,
        });

        return this.service.list(Object.keys(filters).length > 0 ? filters : undefined, pageNum, limitNum, userIdNum);
    }

    @Post()
    async create(
        @Body() body: {
            storeName: string;
            sku: string;
            maxInventory: number;
            remark: string;
        },
        @Headers('x-user-id') userId?: string,
    ): Promise<MaxStoreSkuInventoryItem> {
        const userIdNum = userId ? Number(userId) : undefined;
        Logger.log('[MaxStoreSkuInventoryController] 创建记录:', {
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
                maxInventory?: number;
                remark?: string;
            };
        },
        @Headers('x-user-id') userId?: string,
    ): Promise<MaxStoreSkuInventoryItem> {
        const userIdNum = userId ? Number(userId) : undefined;
        Logger.log('[MaxStoreSkuInventoryController] 更新记录:', {
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

