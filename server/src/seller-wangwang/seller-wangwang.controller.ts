import { Body, Controller, Delete, Get, Headers, Patch, Post, Query } from '@nestjs/common';
import type { SellerWangwangItem } from './seller-wangwang.service';
import { SellerWangwangService } from './seller-wangwang.service';

@Controller('seller-wangwang')
export class SellerWangwangController {
    constructor(private service: SellerWangwangService) { }

    @Get()
    async list(
        @Query('供应商编码') 供应商编码?: string,
        @Query('卖家旺旺') 卖家旺旺?: string,
        @Query('keyword') keyword?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<{ data: SellerWangwangItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 100000));

        const filters: any = {};
        if (供应商编码) filters.供应商编码 = 供应商编码;
        if (卖家旺旺) filters.卖家旺旺 = 卖家旺旺;
        if (keyword) filters.keyword = keyword;

        return this.service.list(Object.keys(filters).length > 0 ? filters : undefined, pageNum, limitNum);
    }

    @Post()
    async create(
        @Body() body: SellerWangwangItem,
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        await this.service.create(body, userIdNum, undefined);
        return { success: true };
    }

    @Patch()
    async update(
        @Body() body: { original: SellerWangwangItem; data: SellerWangwangItem },
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        await this.service.update(body.original, body.data, userIdNum, undefined);
        return { success: true };
    }

    @Delete()
    async remove(
        @Body() body: SellerWangwangItem,
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        await this.service.remove(body, userIdNum, undefined);
        return { success: true };
    }

    @Post('batch-delete')
    async batchRemove(
        @Body() body: { items: SellerWangwangItem[] },
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        const result = await this.service.batchRemove(body.items, userIdNum, undefined);
        return result;
    }

    @Post('batch-create')
    async batchCreate(
        @Body() body: { items: SellerWangwangItem[] },
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        const result = await this.service.batchCreate(body.items, userIdNum, undefined);
        return result;
    }

    @Post('check-exists')
    async checkExists(@Body() body: SellerWangwangItem) {
        const exists = await this.service.checkExists(body);
        return { exists };
    }

    @Post('check-batch-exists')
    async checkBatchExists(@Body() body: { items: SellerWangwangItem[] }) {
        const result = await this.service.checkBatchExists(body.items);
        return result;
    }
}

