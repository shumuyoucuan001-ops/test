import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { LabelDataService } from './label-data.service';
import { Logger } from '../utils/logger.util';

@Controller('label-data')
export class LabelDataController {
  constructor(private readonly service: LabelDataService) {}

  @Get()
  list(@Query('sku') sku?: string, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.service.list({ sku, q, limit: limit ? Number(limit) : undefined });
  }

  @Post('upsert')
  upsert(@Body() body: { sku: string; values: Record<string, any> }) {
    return this.service.upsertBySku(body);
  }

  @Get('columns')
  columns() {
    return this.service.getColumns();
  }

  @Get('by-sku')
  bySku(@Query('sku') sku?: string) {
    return this.service.list({ sku, limit: 500 });
  }

  @Delete('by-sku')
  remove(@Query('sku') sku: string, @Query('supplier') supplier: string) {
    return this.service.deleteBySkuAndSupplier({ sku, supplier });
  }

  // 获取某个SKU的所有供应商列表
  @Get('suppliers-by-sku')
  async getSuppliersBySku(@Query('sku') sku: string) {
    Logger.log('[LabelDataController] getSuppliersBySku called with:', { sku });
    
    if (!sku) {
      Logger.log('[LabelDataController] Missing SKU parameter');
      return { error: 'Missing sku parameter' };
    }
    
    try {
      const suppliers = await this.service.getSuppliersBySku(sku);
      Logger.log('[LabelDataController] Found suppliers:', suppliers);
      return suppliers;
    } catch (error) {
      Logger.error('[LabelDataController] Error:', error);
      return { error: error.message };
    }
  }

  // 通过 SKU 与 供应商名称精确获取一条标签记录
  @Get('by-sku-supplier')
  async bySkuAndSupplier(@Query('sku') sku: string, @Query('supplierName') supplierName: string) {
    Logger.log('[LabelDataController] bySkuAndSupplier called with:', { sku, supplierName });
    
    if (!sku || !supplierName) {
      Logger.log('[LabelDataController] Missing parameters');
      return { error: 'Missing sku or supplierName parameters' };
    }
    
    try {
      const result = await this.service.getBySkuAndSupplierName(sku, supplierName);
      Logger.log('[LabelDataController] Result:', result);
      return result || { error: 'No data found' };
    } catch (error) {
      Logger.error('[LabelDataController] Error:', error);
      return { error: error.message };
    }
  }

  // 测试数据库连接
  @Get('test-db')
  async testDb() {
    try {
      const result = await this.service.testDatabaseConnection();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 获取所有标签数据（分页）
  @Get('all')
  async getAllLabelData(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sku') sku?: string,
    @Query('supplierName') supplierName?: string,
  ) {
    return this.service.getAllLabelData({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      sku,
      supplierName,
    });
  }

  // 获取统计信息
  @Get('statistics')
  async getStatistics() {
    return this.service.getStatistics();
  }

  // 获取供应商列表
  @Get('suppliers')
  async getSuppliers() {
    return this.service.getSuppliers();
  }

  // 创建或更新标签数据（移除productSpec字段）
  @Post('create-or-update')
  async createOrUpdate(@Body() data: {
    sku: string;
    supplierName: string;
    productName?: string;
    headerInfo?: string;
    executionStandard?: string;
    manufacturerName?: string;
    addressInfo?: string;
    material?: string;
    otherInfo?: string;
  }) {
    // 字数验证（移除productSpec验证）
    const validationErrors: string[] = [];
    
    if (data.headerInfo && data.headerInfo.length > 15) {
      validationErrors.push('抬头信息不能超过15个字');
    }
    if (data.executionStandard && data.executionStandard.length > 30) {
      validationErrors.push('执行标准不能超过30个字');
    }
    if (data.productName && data.productName.length > 13) {
      validationErrors.push('产品名称不能超过13个字');
    }
    if (data.manufacturerName && data.manufacturerName.length > 26) {
      validationErrors.push('厂家名称不能超过26个字');
    }
    if (data.addressInfo && data.addressInfo.length > 26) {
      validationErrors.push('地址信息不能超过26个字');
    }
    if (data.material && data.material.length > 13) {
      validationErrors.push('材质不能超过13个字');
    }
    if (data.otherInfo && data.otherInfo.length > 12) {
      validationErrors.push('其他信息不能超过12个字');
    }
    
    if (validationErrors.length > 0) {
      return {
        success: false,
        message: validationErrors.join(', '),
        errors: validationErrors
      };
    }
    
    return this.service.createOrUpdateLabelData(data);
  }

  // 删除标签数据
  @Delete('delete/:sku/:supplierName')
  async deleteLabelData(
    @Param('sku') sku: string, 
    @Param('supplierName') supplierName: string
  ) {
    return this.service.deleteLabelData(sku, supplierName);
  }

  // 获取标签数据修改日志
  @Get('logs')
  async getLogs(
    @Query('sku') sku: string,
    @Query('supplierName') supplierName: string,
  ) {
    Logger.log('[LabelDataController] getLogs called with:', { sku, supplierName });
    const result = await this.service.getLabelDataLogs(sku, supplierName);
    Logger.log('[LabelDataController] getLogs returned:', result.length, 'records');
    return result;
  }
  
  // 测试端点：查看某个SKU的所有日志记录（不过滤supplier）
  @Get('logs/debug/:sku')
  async getLogsDebug(@Param('sku') sku: string) {
    return this.service.getLogsDebug(sku);
  }
}

// 新增控制器：标签审核数据
@Controller('label-data-audit')
export class LabelDataAuditController {
  constructor(private readonly service: LabelDataService) {}

  // 根据SKU和供应商名称获取审核数据
  @Get('by-sku-supplier')
  async getBySkuAndSupplier(
    @Query('sku') sku: string,
    @Query('supplierName') supplierName: string,
  ) {
    return this.service.getAuditDataBySkuAndSupplier(sku, supplierName);
  }
}


