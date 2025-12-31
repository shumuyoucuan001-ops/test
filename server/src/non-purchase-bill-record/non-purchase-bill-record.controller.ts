import { Body, Controller, Delete, Get, Headers, Post, Put, Query } from '@nestjs/common';
import type { NonPurchaseBillRecord } from './non-purchase-bill-record.service';
import { NonPurchaseBillRecordService } from './non-purchase-bill-record.service';

@Controller('non-purchase-bill-record')
export class NonPurchaseBillRecordController {
    constructor(private readonly service: NonPurchaseBillRecordService) { }

    // 获取所有记录（分页）
    @Get()
    async getAllRecords(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('search') search?: string,
        @Query('账单流水') 账单流水?: string,
        @Query('账单类型') 账单类型?: string,
        @Query('所属仓店') 所属仓店?: string,
        @Query('财务审核状态') 财务审核状态?: string,
        @Query('记录修改人') 记录修改人?: string,
    ): Promise<{ data: NonPurchaseBillRecord[]; total: number }> {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        return this.service.getAllRecords(pageNum, limitNum, search, 账单流水, 账单类型, 所属仓店, 财务审核状态, 记录修改人);
    }

    // 获取单个记录
    @Get('by-bill')
    async getRecord(
        @Query('账单流水') 账单流水: string,
    ): Promise<NonPurchaseBillRecord | null> {
        return this.service.getRecord(账单流水);
    }

    // 创建记录
    @Post()
    async createRecord(
        @Body() data: NonPurchaseBillRecord,
        @Headers('x-user-id') userId?: string,
    ): Promise<NonPurchaseBillRecord> {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        return this.service.createRecord(data, userIdNum);
    }

    // 批量创建记录
    @Post('batch')
    async createRecords(
        @Body() body: { records: NonPurchaseBillRecord[] },
        @Headers('x-user-id') userId?: string,
    ): Promise<{ success: number; failed: number; errors: string[] }> {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        return this.service.createRecords(body.records, userIdNum);
    }

    // 更新记录
    @Put()
    async updateRecord(
        @Body() body: { 账单流水: string; data: Partial<NonPurchaseBillRecord> },
        @Headers('x-user-id') userId?: string,
    ): Promise<NonPurchaseBillRecord> {
        const userIdNum = userId ? parseInt(userId, 10) : undefined;
        return this.service.updateRecord(body.账单流水, body.data, userIdNum);
    }

    // 删除记录
    @Delete()
    async deleteRecord(
        @Body() body: { 账单流水: string },
    ): Promise<boolean> {
        return this.service.deleteRecord(body.账单流水);
    }

    // 批量删除记录
    @Delete('batch')
    async deleteRecords(
        @Body() body: { 账单流水列表: string[] },
    ): Promise<{ success: number; failed: number }> {
        return this.service.deleteRecords(body.账单流水列表);
    }
}

