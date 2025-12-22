import { Body, Controller, Delete, Get, Patch, Post, Query } from '@nestjs/common';
import type { OpsShelfExclusionItem } from './ops-shelf-exclusion.service';
import { OpsShelfExclusionService } from './ops-shelf-exclusion.service';

@Controller('ops-shelf-exclusion')
export class OpsShelfExclusionController {
    constructor(private service: OpsShelfExclusionService) { }

    @Get()
    async list(
        @Query('门店编码') 门店编码?: string,
        @Query('SPU') SPU?: string,
        @Query('渠道编码') 渠道编码?: string,
        @Query('keyword') keyword?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<{ data: OpsShelfExclusionItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 50));
        
        const filters: any = {};
        if (门店编码) filters.门店编码 = 门店编码;
        if (SPU) filters.SPU = SPU;
        if (渠道编码) filters.渠道编码 = 渠道编码;
        if (keyword) filters.keyword = keyword;

        return this.service.list(Object.keys(filters).length > 0 ? filters : undefined, pageNum, limitNum);
    }

    @Post()
    async create(@Body() body: OpsShelfExclusionItem) {
        await this.service.create(body);
        return { success: true };
    }

    @Patch()
    async update(@Body() body: { original: OpsShelfExclusionItem; data: OpsShelfExclusionItem }) {
        await this.service.update(body.original, body.data);
        return { success: true };
    }

    @Delete()
    async remove(@Body() body: OpsShelfExclusionItem) {
        await this.service.remove(body);
        return { success: true };
    }

    @Post('batch-delete')
    async batchRemove(@Body() body: { items: OpsShelfExclusionItem[] }) {
        const result = await this.service.batchRemove(body.items);
        return result;
    }

    @Post('batch-create')
    async batchCreate(@Body() body: { items: OpsShelfExclusionItem[] }) {
        const result = await this.service.batchCreate(body.items);
        return result;
    }
}

