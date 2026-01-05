import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { SupplierService } from './supplier.service';

export interface SupplierBasicInfo {
  supplierCode: string;
  supplierName: string;
  deliveryDays: number;
  officeAddress: string;
  contactPerson: string;
  contactPhone: string;
}

export interface SupplierManagement {
  supplierCode: string;
  minOrderAmount?: number;
  minOrderQuantity?: number;
  orderRemarks?: string;
  sellerWangwang?: string;
  wangwangMessage?: string;
}

export interface SupplierFullInfo extends SupplierBasicInfo {
  minOrderAmount?: number;
  minOrderQuantity?: number;
  orderRemarks?: string;
  sellerWangwang?: string;
  wangwangMessage?: string;
}

@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) { }

  // 获取所有供应商信息（基础信息+管理信息）
  @Get()
  async getAllSuppliers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ): Promise<{ data: SupplierFullInfo[]; total: number }> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.supplierService.getAllSuppliers(pageNum, limitNum, search);
  }

  // 获取单个供应商信息
  @Get(':supplierCode')
  async getSupplier(@Param('supplierCode') supplierCode: string): Promise<SupplierFullInfo | null> {
    return this.supplierService.getSupplierByCode(supplierCode);
  }

  // 创建或更新供应商管理信息
  @Post('management')
  async upsertSupplierManagement(@Body() body: SupplierManagement & { userId?: number; userName?: string }): Promise<SupplierManagement> {
    try {
      const { userId, userName, ...data } = body;
      return await this.supplierService.upsertSupplierManagement(data, userId, userName);
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // 删除供应商管理信息
  @Delete('management/:supplierCode')
  async deleteSupplierManagement(@Param('supplierCode') supplierCode: string): Promise<boolean> {
    return this.supplierService.deleteSupplierManagement(supplierCode);
  }

  // 获取统计信息
  @Get('stats/summary')
  async getStatistics(): Promise<{
    totalSuppliers: number;
    managedSuppliers: number;
    averageDeliveryDays: number;
  }> {
    return this.supplierService.getStatistics();
  }

  // 获取供应商管理变更日志
  @Get('management/logs/:supplierCode')
  async getSupplierManagementLogs(@Param('supplierCode') supplierCode: string) {
    return this.supplierService.getSupplierManagementLogs(supplierCode);
  }
}
