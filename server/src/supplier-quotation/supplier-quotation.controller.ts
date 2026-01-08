import { Body, Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { SupplierQuotationService } from './supplier-quotation.service';

@Controller('supplier-quotation')
export class SupplierQuotationController {
    constructor(private readonly service: SupplierQuotationService) { }

    // 获取所有供应商编码列表
    @Get('supplier-codes')
    async getAllSupplierCodes() {
        try {
            return await this.service.getAllSupplierCodes();
        } catch (error) {
            throw new HttpException(
                error.message || '查询供应商编码列表失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 获取供应商报价列表
    @Get()
    async getSupplierQuotations(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('supplierCodes') supplierCodes?: string | string[],
    ) {
        try {
            const pageNum = page ? parseInt(page, 10) : 1;
            const limitNum = limit ? parseInt(limit, 10) : 20;
            // 处理supplierCodes参数（可能是字符串或字符串数组）
            let supplierCodesArray: string[] | undefined;
            if (supplierCodes) {
                if (Array.isArray(supplierCodes)) {
                    supplierCodesArray = supplierCodes;
                } else if (typeof supplierCodes === 'string') {
                    // 如果是逗号分隔的字符串，转换为数组
                    supplierCodesArray = supplierCodes.split(',').filter(s => s.trim());
                }
            }
            return await this.service.getSupplierQuotations(pageNum, limitNum, search, supplierCodesArray);
        } catch (error) {
            throw new HttpException(
                error.message || '查询供应商报价失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 获取仓库优先级列表（门店/仓名称）
    @Get('warehouse-priorities')
    async getWarehousePriorities() {
        try {
            return await this.service.getWarehousePriorities();
        } catch (error) {
            throw new HttpException(
                error.message || '查询仓库优先级失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 获取城市列表
    @Get('cities')
    async getCities() {
        try {
            return await this.service.getCities();
        } catch (error) {
            throw new HttpException(
                error.message || '查询城市列表失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 获取库存汇总数据
    @Get('inventory-summary')
    async getInventorySummary(
        @Query('type') type: '全部' | '仓店' | '城市' = '全部',
        @Query('upc') upc?: string,
        @Query('storeNames') storeNames?: string | string[],
    ) {
        try {
            // 处理storeNames参数（可能是字符串或字符串数组）
            let storeNamesArray: string[] | undefined;
            if (storeNames) {
                if (Array.isArray(storeNames)) {
                    storeNamesArray = storeNames;
                } else if (typeof storeNames === 'string') {
                    // 如果是逗号分隔的字符串，转换为数组
                    storeNamesArray = storeNames.split(',').filter(s => s.trim());
                }
            }
            return await this.service.getInventorySummary(type, upc, storeNamesArray);
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

