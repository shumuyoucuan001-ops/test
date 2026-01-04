import { Body, Controller, Delete, Get, Param, Post, Put, Query, Headers } from '@nestjs/common';
import { FinanceManagementService } from './finance-management.service';
import type { FinanceBill } from './finance-management.service';

@Controller('finance-management')
export class FinanceManagementController {
  constructor(private readonly service: FinanceManagementService) {}

  // 获取所有账单（分页）
  @Get()
  async getAllBills(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('transactionNumber') transactionNumber?: string,
    @Query('qianniuhuaPurchaseNumber') qianniuhuaPurchaseNumber?: string,
    @Query('importExceptionRemark') importExceptionRemark?: string,
    @Query('modifier') modifier?: string,
  ): Promise<{ data: FinanceBill[]; total: number }> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.service.getAllBills(pageNum, limitNum, search, transactionNumber, qianniuhuaPurchaseNumber, importExceptionRemark, modifier);
  }

  // 获取单个账单
  @Get('by-transaction')
  async getBill(
    @Query('transactionNumber') transactionNumber: string,
    @Query('qianniuhuaPurchaseNumber') qianniuhuaPurchaseNumber?: string,
  ): Promise<FinanceBill | null> {
    return this.service.getBill(transactionNumber, qianniuhuaPurchaseNumber);
  }

  // 创建账单
  @Post()
  async createBill(
    @Body() data: FinanceBill,
    @Headers('x-user-id') userId?: string,
  ): Promise<FinanceBill> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.createBill(data, userIdNum);
  }

  // 批量创建账单
  @Post('batch')
  async createBills(
    @Body() body: { bills: FinanceBill[] },
    @Headers('x-user-id') userId?: string,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.createBills(body.bills, userIdNum);
  }

  // 更新账单
  @Put()
  async updateBill(
    @Body() body: { transactionNumber: string; qianniuhuaPurchaseNumber?: string; data: Partial<FinanceBill> },
    @Headers('x-user-id') userId?: string,
  ): Promise<FinanceBill> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.updateBill(body.transactionNumber, body.qianniuhuaPurchaseNumber, body.data, userIdNum);
  }

  // 删除账单
  @Delete()
  async deleteBill(
    @Body() body: { transactionNumber: string; qianniuhuaPurchaseNumber?: string },
    @Headers('x-user-id') userId?: string,
  ): Promise<boolean> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.deleteBill(body.transactionNumber, body.qianniuhuaPurchaseNumber, userIdNum);
  }

  // 批量删除账单
  @Delete('batch')
  async deleteBills(
    @Body() body: { bills: Array<{ transactionNumber: string; qianniuhuaPurchaseNumber?: string }> },
    @Headers('x-user-id') userId?: string,
  ): Promise<{ success: number; failed: number }> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.deleteBills(body.bills, userIdNum);
  }
}

