import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
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
        @Query('supplierName') supplierName?: string,
        @Query('supplierCode') supplierCode?: string,
        @Query('productName') productName?: string,
        @Query('upcCode') upcCode?: string,
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
            return await this.service.getSupplierQuotations(
                pageNum,
                limitNum,
                search,
                supplierCodesArray,
                supplierName,
                supplierCode,
                productName,
                upcCode,
            );
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

    // 根据UPC条码批量获取SKU编码
    @Post('sku-codes-by-upc')
    async getSkuCodesByUpcCodes(
        @Body() body: {
            upcCodes: string[];
        },
    ) {
        try {
            return await this.service.getSkuCodesByUpcCodes(body.upcCodes || []);
        } catch (error) {
            throw new HttpException(
                error.message || '根据UPC获取SKU编码失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 批量查询供应商名称
    @Post('supplier-names')
    async getSupplierNames(
        @Body() body: {
            type: '全部' | '仓店' | '城市';
            items: any[];
            fields: string[];
            city?: string; // 城市维度时传递的城市名称
        },
    ) {
        try {
            return await this.service.getSupplierNamesForInventory(
                body.type,
                body.items || [],
                body.fields || [],
                body.city,
            );
        } catch (error) {
            throw new HttpException(
                error.message || '查询供应商名称失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 查询报价比例
    @Get('price-ratios')
    async getPriceRatios(
        @Query('supplierCode') supplierCode: string,
        @Query('upcCode') upcCode: string,
    ) {
        try {
            return await this.service.getPriceRatios(supplierCode, upcCode);
        } catch (error) {
            throw new HttpException(
                error.message || '查询报价比例失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 保存报价比例
    @Post('price-ratios')
    async updatePriceRatios(
        @Body() body: {
            supplierCode: string;
            upcCode: string;
            supplierRatio: number;
            qianniuhuaRatio: number;
        },
    ) {
        try {
            return await this.service.updatePriceRatios(
                body.supplierCode,
                body.upcCode,
                body.supplierRatio,
                body.qianniuhuaRatio,
            );
        } catch (error) {
            throw new HttpException(
                error.message || '保存报价比例失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 清空报价比例
    @Post('price-ratios/clear')
    async clearPriceRatios(
        @Body() body: {
            supplierCode: string;
            upcCode: string;
        },
    ) {
        try {
            return await this.service.clearPriceRatios(
                body.supplierCode,
                body.upcCode,
            );
        } catch (error) {
            throw new HttpException(
                error.message || '清空报价比例失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 批量查询SKU绑定标记
    @Post('sku-binding-flags')
    async getSkuBindingFlags(
        @Body() body: {
            items: any[];
            quotationData: any[];
            upcToSkuMap?: Record<string, string[]>;
        },
    ) {
        try {
            return await this.service.getSkuBindingFlags(
                body.items || [],
                body.quotationData || [],
                body.upcToSkuMap,
            );
        } catch (error) {
            throw new HttpException(
                error.message || '查询SKU绑定标记失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 根据供应商编码获取采购下单渠道
    @Get('order-channel/:supplierCode')
    async getSupplierOrderChannel(@Param('supplierCode') supplierCode: string) {
        try {
            return await this.service.getSupplierOrderChannel(supplierCode);
        } catch (error) {
            throw new HttpException(
                error.message || '查询采购下单渠道失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // 根据SKU编码获取商品供货关系
    @Get('product-supply-relations/:sku')
    async getProductSupplyRelations(@Param('sku') sku: string) {
        try {
            return await this.service.getProductSupplyRelations(sku);
        } catch (error) {
            throw new HttpException(
                error.message || '查询商品供货关系失败',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

