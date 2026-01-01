import { Controller, Get, Param, Query } from '@nestjs/common';
import type { FinanceReconciliationDifference } from './finance-reconciliation-difference.service';
import { FinanceReconciliationDifferenceService } from './finance-reconciliation-difference.service';

@Controller('finance-reconciliation-difference')
export class FinanceReconciliationDifferenceController {
    constructor(private readonly service: FinanceReconciliationDifferenceService) { }

    // 获取所有记录（分页）
    @Get()
    async getAll(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('search') search?: string,
        @Query('交易单号') 交易单号?: string,
        @Query('牵牛花采购单号') 牵牛花采购单号?: string,
        @Query('对账单号') 对账单号?: string,
        @Query('记录状态') 记录状态?: string | string[],
    ): Promise<{ data: FinanceReconciliationDifference[]; total: number }> {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        // 处理记录状态：可能是字符串或字符串数组
        const 记录状态数组 = 记录状态 ? (Array.isArray(记录状态) ? 记录状态 : [记录状态]) : undefined;
        return this.service.getAll(pageNum, limitNum, search, 交易单号, 牵牛花采购单号, 对账单号, 记录状态数组);
    }

    // 获取对账单号维度数据（去重）
    @Get('by-reconciliation-number')
    async getByReconciliationNumber(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('search') search?: string,
        @Query('对账单号') 对账单号?: string,
        @Query('记录状态') 记录状态?: string | string[],
    ): Promise<{ data: FinanceReconciliationDifference[]; total: number }> {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const 记录状态数组 = 记录状态 ? (Array.isArray(记录状态) ? 记录状态 : [记录状态]) : undefined;
        return this.service.getByReconciliationNumber(pageNum, limitNum, search, 对账单号, 记录状态数组);
    }

    // 根据对账单号获取子维度数据
    @Get('details/:对账单号')
    async getDetailsByReconciliationNumber(
        @Param('对账单号') 对账单号: string,
        @Query('交易单号') 交易单号?: string,
        @Query('牵牛花采购单号') 牵牛花采购单号?: string,
        @Query('采购单状态') 采购单状态?: string,
        @Query('门店仓') 门店仓?: string,
    ): Promise<{ data: FinanceReconciliationDifference[]; total: number }> {
        return this.service.getDetailsByReconciliationNumber(
            对账单号,
            交易单号,
            牵牛花采购单号,
            采购单状态,
            门店仓
        );
    }
}

