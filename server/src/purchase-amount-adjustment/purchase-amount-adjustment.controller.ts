import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import type { PurchaseAmountAdjustment } from './purchase-amount-adjustment.service';
import { PurchaseAmountAdjustmentService } from './purchase-amount-adjustment.service';

@Controller('purchase-amount-adjustment')
export class PurchaseAmountAdjustmentController {
  constructor(private readonly service: PurchaseAmountAdjustmentService) { }

  // 获取所有调整记录（分页）
  @Get()
  async getAllAdjustments(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('purchaseOrderNumber') purchaseOrderNumber?: string,
    @Query('adjustmentAmount') adjustmentAmount?: string,
    @Query('creator') creator?: string,
    @Query('financeReviewer') financeReviewer?: string,
    @Query('dataUpdateTime') dataUpdateTime?: string,
  ): Promise<{ data: PurchaseAmountAdjustment[]; total: number }> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.service.getAllAdjustments(pageNum, limitNum, search, purchaseOrderNumber, adjustmentAmount, creator, financeReviewer, dataUpdateTime);
  }

  // 获取单个调整记录
  @Get(':purchaseOrderNumber')
  async getAdjustment(
    @Param('purchaseOrderNumber') purchaseOrderNumber: string,
  ): Promise<PurchaseAmountAdjustment | null> {
    return this.service.getAdjustment(purchaseOrderNumber);
  }

  // 创建调整记录
  @Post()
  async createAdjustment(
    @Body() data: PurchaseAmountAdjustment,
    @Headers('x-user-id') userId?: string,
  ): Promise<PurchaseAmountAdjustment> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.createAdjustment(data, userIdNum);
  }

  // 批量创建调整记录
  @Post('batch')
  async createAdjustments(
    @Body() body: { adjustments: PurchaseAmountAdjustment[] },
    @Headers('x-user-id') userId?: string,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.createAdjustments(body.adjustments, userIdNum);
  }

  // 更新调整记录
  @Put(':purchaseOrderNumber')
  async updateAdjustment(
    @Param('purchaseOrderNumber') purchaseOrderNumber: string,
    @Body() data: Partial<PurchaseAmountAdjustment>,
    @Headers('x-user-id') userId?: string,
  ): Promise<PurchaseAmountAdjustment> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.updateAdjustment(purchaseOrderNumber, data, userIdNum);
  }

  // 删除调整记录
  @Delete(':purchaseOrderNumber')
  async deleteAdjustment(
    @Param('purchaseOrderNumber') purchaseOrderNumber: string,
  ): Promise<boolean> {
    return this.service.deleteAdjustment(purchaseOrderNumber);
  }

  // 批量删除调整记录
  @Delete('batch')
  async deleteAdjustments(
    @Body() body: { purchaseOrderNumbers: string[] },
  ): Promise<{ success: number; failed: number }> {
    return this.service.deleteAdjustments(body.purchaseOrderNumbers);
  }
}

