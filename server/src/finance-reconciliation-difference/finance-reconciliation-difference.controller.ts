import { Controller, Get, Param, Post, Query } from '@nestjs/common';
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
        @Query('对账单收货状态') 对账单收货状态?: string | string[],
        @Query('更新时间开始') 更新时间开始?: string,
        @Query('更新时间结束') 更新时间结束?: string,
        @Query('采购单号') 采购单号?: string,
        @Query('交易单号') 交易单号?: string,
    ): Promise<{ data: FinanceReconciliationDifference[]; total: number }> {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const 记录状态数组 = 记录状态 ? (Array.isArray(记录状态) ? 记录状态 : [记录状态]) : undefined;
        const 对账单收货状态数组 = 对账单收货状态 ? (Array.isArray(对账单收货状态) ? 对账单收货状态 : [对账单收货状态]) : undefined;
        return this.service.getByReconciliationNumber(
            pageNum,
            limitNum,
            search,
            对账单号,
            记录状态数组,
            对账单收货状态数组,
            更新时间开始,
            更新时间结束,
            采购单号,
            交易单号,
        );
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

    // 生成对账单（调用存储过程）
    @Post('generate-bill')
    async generateBill(): Promise<{ success: boolean; message: string }> {
        try {
            const result = await this.service.generateReconciliationBill();
            return result;
        } catch (error: any) {
            // 确保错误被正确抛出
            throw error;
        }
    }
}

// 所有渠道交易记录接口
export interface TransactionRecord {
    支付渠道?: string;
    支付账号?: string;
    收支金额?: number;
    交易账单号?: string;
    账单交易时间?: string;
}

// 采购单信息接口
export interface PurchaseOrderInfo {
    采购单号?: string;
    '门店/仓'?: string;
    所属采购计划?: string;
    采购金额?: number;
    实收金额?: number;
    关联收货单号?: string;
    状态?: string;
    付款状态?: string;
    创建时间?: string;
    创建人名称?: string;
}

@Controller('transaction-record')
export class TransactionRecordController {
    constructor(private readonly service: FinanceReconciliationDifferenceService) { }

    // 根据交易账单号查询所有渠道交易记录
    @Get('by-bill-number')
    async getByTransactionBillNumber(
        @Query('交易账单号') 交易账单号: string,
    ): Promise<{ data: TransactionRecord[] }> {
        return this.service.getTransactionRecordByBillNumber(交易账单号);
    }
}

@Controller('purchase-order-info')
export class PurchaseOrderInfoController {
    constructor(private readonly service: FinanceReconciliationDifferenceService) { }

    // 根据采购单号查询采购单信息
    @Get('by-order-number')
    async getByPurchaseOrderNumber(
        @Query('采购单号') 采购单号: string,
    ): Promise<{ data: PurchaseOrderInfo[] }> {
        return this.service.getPurchaseOrderInfoByOrderNumber(采购单号);
    }
}

