import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SupplierManagementService } from './supplier-management.service';

@Controller('supplier-management')
export class SupplierManagementController {
  constructor(private readonly service: SupplierManagementService) {}

  @Post('create-or-update')
  async createOrUpdate(@Body() data: {
    supplierCode: string;
    minOrderAmount?: number;
    minOrderQuantity?: number;
    orderRemarks?: string;
    userId?: number;
    userName?: string;
  }) {
    return this.service.createOrUpdateSupplierManagement(data);
  }

  @Get('logs')
  async getLogs(@Query('supplierCode') supplierCode: string) {
    return this.service.getSupplierManagementLogs(supplierCode);
  }
}


