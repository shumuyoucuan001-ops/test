import { Body, Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { SupplierQuotationService } from './supplier-quotation.service';

@Controller('supplier-quotation')
export class SupplierQuotationController {
    constructor(private readonly service: SupplierQuotationService) { }

    // 获取供应商报价列表
    @Get()
    async getSupplierQuotations(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
    ) {
        try {
            const pageNum = page ? parseInt(page, 10) : 1;
            const limitNum = limit ? parseInt(limit, 10) : 20;
            return await this.service.getSupplierQuotations(pageNum, limitNum, search);
        } catch (error) {
            throw new HttpException(
                error.message || '查询供应商报价失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 获取库存汇总数据
    @Get('inventory-summary')
    async getInventorySummary(
        @Query('type') type: '全部' | '仓店' | '城市' = '全部',
        @Query('upc') upc?: string,
    ) {
        try {
            return await this.service.getInventorySummary(type, upc);
        } catch (error) {
            throw new HttpException(
                error.message || '查询库存汇总失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 获取SKU绑定信息
    @Get('sku-bindings')
    async getSkuBindings(
        @Query('supplierCode') supplierCode: string,
        @Query('supplierProductCode') supplierProductCode: string,
    ) {
        try {
            return await this.service.getSkuBindings(supplierCode, supplierProductCode);
        } catch (error) {
            throw new HttpException(
                error.message || '查询SKU绑定失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 更新SKU绑定信息
    @Post('sku-bindings')
    async updateSkuBinding(
        @Body() body: {
            supplierCode: string;
            supplierProductCode: string;
            sku: string;
        },
    ) {
        try {
            return await this.service.updateSkuBinding(
                body.supplierCode,
                body.supplierProductCode,
                body.sku,
            );
        } catch (error) {
            throw new HttpException(
                error.message || '更新SKU绑定失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

