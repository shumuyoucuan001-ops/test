import { Body, Controller, Delete, Get, Headers, Patch, Post, Query } from '@nestjs/common';
import type { OpsExclusionItem } from './ops-exclusion.service';
import { OpsExclusionService } from './ops-exclusion.service';

@Controller('ops-exclusion')
export class OpsExclusionController {
    constructor(private service: OpsExclusionService) { }

    @Get()
    async list(
        @Query('视图名称') 视图名称?: string,
        @Query('门店编码') 门店编码?: string,
        @Query('SKU编码') SKU编码?: string,
        @Query('SPU编码') SPU编码?: string,
        @Query('keyword') keyword?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<{ data: OpsExclusionItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 50));

        const filters: any = {};
        if (视图名称) filters.视图名称 = 视图名称;
        if (门店编码) filters.门店编码 = 门店编码;
        if (SKU编码) filters.SKU编码 = SKU编码;
        if (SPU编码) filters.SPU编码 = SPU编码;
        if (keyword) filters.keyword = keyword;

        return this.service.list(Object.keys(filters).length > 0 ? filters : undefined, pageNum, limitNum);
    }

    @Post()
    async create(
        @Body() body: OpsExclusionItem,
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        await this.service.create(body, userIdNum);
        return { success: true };
    }

    @Patch()
    async update(
        @Body() body: { original: OpsExclusionItem; data: OpsExclusionItem },
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        await this.service.update(body.original, body.data, userIdNum);
        return { success: true };
    }

    @Delete()
    async remove(
        @Body() body: OpsExclusionItem,
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        await this.service.remove(body, userIdNum);
        return { success: true };
    }

    @Post('batch-delete')
    async batchRemove(
        @Body() body: { items: OpsExclusionItem[] },
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        const result = await this.service.batchRemove(body.items, userIdNum);
        return result;
    }

    @Post('batch-create')
    async batchCreate(
        @Body() body: { items: OpsExclusionItem[] },
        @Headers('x-user-id') userId?: string
    ) {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        const result = await this.service.batchCreate(body.items, userIdNum);
        return result;
    }

    @Post('check-exists')
    async checkExists(@Body() body: OpsExclusionItem) {
        const exists = await this.service.checkExists(body);
        return { exists };
    }

    @Post('check-batch-exists')
    async checkBatchExists(@Body() body: { items: OpsExclusionItem[] }) {
        const result = await this.service.checkBatchExists(body.items);
        return result;
    }
}
