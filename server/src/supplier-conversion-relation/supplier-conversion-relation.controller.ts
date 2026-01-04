
import { Body, Controller, Delete, Get, Patch, Post, Query } from '@nestjs/common';
import type { SupplierConversionRelationItem } from './supplier-conversion-relation.service';
import { SupplierConversionRelationService } from './supplier-conversion-relation.service';

@Controller('supplier-conversion-relation')
export class SupplierConversionRelationController {
    constructor(private service: SupplierConversionRelationService) { }

    @Get()
    async list(
        @Query('供应商编码') 供应商编码?: string,
        @Query('*SKU编码') SKU编码?: string,
        @Query('换算关系') 换算关系?: string,
        @Query('二次换算关系') 二次换算关系?: string,
        @Query('keyword') keyword?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<{ data: SupplierConversionRelationItem[]; total: number }> {
        const pageNum = Math.max(1, parseInt(page || '1', 10));
        const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 50));

        const filters: any = {};
        if (供应商编码) filters['供应商编码'] = 供应商编码;
        if (SKU编码) filters['*SKU编码'] = SKU编码;
        if (换算关系) filters['换算关系'] = 换算关系;
        if (二次换算关系) filters['二次换算关系'] = 二次换算关系;
        if (keyword) filters.keyword = keyword;

        return this.service.list(Object.keys(filters).length > 0 ? filters : undefined, pageNum, limitNum);
    }

    @Post()
    async create(@Body() body: SupplierConversionRelationItem) {
        await this.service.create(body);
        return { success: true };
    }

    @Patch()
    async update(@Body() body: { original: SupplierConversionRelationItem; data: SupplierConversionRelationItem }) {
        await this.service.update(body.original, body.data);
        return { success: true };
    }

    @Delete()
    async remove(@Body() body: SupplierConversionRelationItem) {
        await this.service.remove(body);
        return { success: true };
    }

    @Post('batch-delete')
    async batchRemove(@Body() body: { items: SupplierConversionRelationItem[] }) {
        const result = await this.service.batchRemove(body.items);
        return result;
    }

    @Post('batch-create')
    async batchCreate(@Body() body: { items: SupplierConversionRelationItem[] }) {
        const result = await this.service.batchCreate(body.items);
        return result;
    }

    @Post('check-exists')
    async checkExists(@Body() body: SupplierConversionRelationItem) {
        const exists = await this.service.checkExists(body);
        return { exists };
    }

    @Post('check-batch-exists')
    async checkBatchExists(@Body() body: { items: SupplierConversionRelationItem[] }) {
        const result = await this.service.checkBatchExists(body.items);
        return result;
    }
}

