import { Body, Controller, Delete, Get, Patch, Post, Query } from '@nestjs/common';
import type { OpsActivityDispatchItem } from './ops-activity-dispatch.service';
import { OpsActivityDispatchService } from './ops-activity-dispatch.service';

@Controller('ops-activity-dispatch')
export class OpsActivityDispatchController {
    constructor(private service: OpsActivityDispatchService) { }

    @Get()
    async list(
        @Query('SKU') SKU?: string,
        @Query('活动价') 活动价?: string,
        @Query('最低活动价') 最低活动价?: string,
        @Query('活动类型') 活动类型?: string,
        @Query('门店名称') 门店名称?: string,
        @Query('活动备注') 活动备注?: string,
        @Query('剩余活动天数') 剩余活动天数?: string,
        @Query('活动确认人') 活动确认人?: string,
        @Query('keyword') keyword?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<{ data: OpsActivityDispatchItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 50));

        const filters: any = {};
        if (SKU) filters.SKU = SKU;
        if (活动价) filters.活动价 = 活动价;
        if (最低活动价) filters.最低活动价 = 最低活动价;
        if (活动类型) filters.活动类型 = 活动类型;
        if (门店名称) filters.门店名称 = 门店名称;
        if (活动备注) filters.活动备注 = 活动备注;
        if (剩余活动天数) filters.剩余活动天数 = 剩余活动天数;
        if (活动确认人) filters.活动确认人 = 活动确认人;
        if (keyword) filters.keyword = keyword;

        return this.service.list(Object.keys(filters).length > 0 ? filters : undefined, pageNum, limitNum);
    }

    @Post()
    async create(@Body() body: OpsActivityDispatchItem) {
        await this.service.create(body);
        return { success: true };
    }

    @Patch()
    async update(@Body() body: { original: OpsActivityDispatchItem; data: OpsActivityDispatchItem }) {
        await this.service.update(body.original, body.data);
        return { success: true };
    }

    @Delete()
    async remove(@Body() body: OpsActivityDispatchItem) {
        await this.service.remove(body);
        return { success: true };
    }

    @Post('batch-delete')
    async batchRemove(@Body() body: { items: OpsActivityDispatchItem[] }) {
        const result = await this.service.batchRemove(body.items);
        return result;
    }

    @Post('batch-create')
    async batchCreate(@Body() body: { items: OpsActivityDispatchItem[] }) {
        const result = await this.service.batchCreate(body.items);
        return result;
    }
}

