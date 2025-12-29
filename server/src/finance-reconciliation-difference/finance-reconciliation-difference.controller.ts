import { Controller, Get, Query } from '@nestjs/common';
import { FinanceReconciliationDifferenceService } from './finance-reconciliation-difference.service';
import type { FinanceReconciliationDifference } from './finance-reconciliation-difference.service';

@Controller('finance-reconciliation-difference')
export class FinanceReconciliationDifferenceController {
  constructor(private readonly service: FinanceReconciliationDifferenceService) {}

  // 获取所有记录（分页）
  @Get()
  async getAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('交易单号') 交易单号?: string,
    @Query('牵牛花采购单号') 牵牛花采购单号?: string,
    @Query('对账单号') 对账单号?: string,
    @Query('记录状态') 记录状态?: string,
  ): Promise<{ data: FinanceReconciliationDifference[]; total: number }> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return this.service.getAll(pageNum, limitNum, search, 交易单号, 牵牛花采购单号, 对账单号, 记录状态);
  }
}

