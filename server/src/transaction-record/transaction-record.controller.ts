import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { ChannelType } from './transaction-record.service';
import { TransactionRecord, TransactionRecordService } from './transaction-record.service';

@Controller('transaction-record')
export class TransactionRecordController {
    constructor(private readonly transactionRecordService: TransactionRecordService) { }

    @Get()
    async getAll(
        @Query('channel') channel: ChannelType,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('search') search?: string,
    ) {
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;

        if (!channel || !['1688先采后付', '京东金融', '微信', '支付宝'].includes(channel)) {
            throw new Error('无效的渠道类型');
        }

        return await this.transactionRecordService.getAll(
            channel as ChannelType,
            pageNum,
            limitNum,
            search,
        );
    }

    @Post('batch')
    async batchCreate(
        @Body('channel') channel: ChannelType,
        @Body('records') records: Partial<TransactionRecord>[],
    ) {
        if (!channel || !['1688先采后付', '京东金融', '微信', '支付宝'].includes(channel)) {
            throw new Error('无效的渠道类型');
        }

        if (!records || !Array.isArray(records) || records.length === 0) {
            throw new Error('记录列表不能为空');
        }

        return await this.transactionRecordService.batchCreate(channel as ChannelType, records);
    }

    @Get('all-for-export')
    async getAllForExport(
        @Query('channel') channel: ChannelType,
        @Query('search') search?: string,
    ) {
        if (!channel || !['1688先采后付', '京东金融', '微信', '支付宝'].includes(channel)) {
            throw new Error('无效的渠道类型');
        }

        return await this.transactionRecordService.getAllForExport(channel as ChannelType, search);
    }
}

