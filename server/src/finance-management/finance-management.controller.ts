import { Body, Controller, Delete, Get, Param, Post, Put, Query, Headers } from '@nestjs/common';
import { FinanceManagementService, FinanceBill } from './finance-management.service';

@Controller('finance-management')
export class FinanceManagementController {
  constructor(private readonly service: FinanceManagementService) {}

  // 获取所有账单（分页）
  @Get()
  async getAllBills(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ): Promise<{ data: FinanceBill[]; total: number }> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.service.getAllBills(pageNum, limitNum, search);
  }

  // 获取单个账单
  @Get(':id')
  async getBillById(@Param('id') id: string): Promise<FinanceBill | null> {
    return this.service.getBillById(parseInt(id, 10));
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
  @Put(':id')
  async updateBill(
    @Param('id') id: string,
    @Body() data: Partial<FinanceBill>,
    @Headers('x-user-id') userId?: string,
  ): Promise<FinanceBill> {
    const userIdNum = userId ? parseInt(userId, 10) : undefined;
    return this.service.updateBill(parseInt(id, 10), data, userIdNum);
  }

  // 删除账单
  @Delete(':id')
  async deleteBill(@Param('id') id: string): Promise<boolean> {
    return this.service.deleteBill(parseInt(id, 10));
  }

  // 批量删除账单
  @Delete('batch')
  async deleteBills(
    @Body() body: { ids: number[] },
  ): Promise<{ success: number; failed: number }> {
    return this.service.deleteBills(body.ids);
  }
}

