import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { SupplierManagementService } from './supplier-management.service';

@Controller('supplier-management')
export class SupplierManagementController {
  constructor(private readonly service: SupplierManagementService) { }

  @Post('create-or-update')
  async createOrUpdate(
    @Body() data: {
      supplierCode: string;
      minOrderAmount?: number;
      minOrderQuantity?: number;
      orderRemarks?: string;
      userId?: number;
      userName?: string;
    },
    @Headers('x-user-id') userId?: string
  ) {
    const userIdNum = userId ? parseInt(userId, 10) : data.userId;
    return this.service.createOrUpdateSupplierManagement({
      ...data,
      userId: userIdNum,
    });
  }

  @Get('logs')
  async getLogs(@Query('supplierCode') supplierCode: string) {
    return this.service.getSupplierManagementLogs(supplierCode);
  }

  @Post('create-supplier')
  async createSupplier(@Body() data: {
    supplierCode: string;
    supplierName?: string;
    deliveryDays?: number;
    officeAddress?: string;
    contactPerson?: string;
    contactPhone?: string;
  }) {
    return this.service.createSupplierBasicInfo(data);
  }
}


