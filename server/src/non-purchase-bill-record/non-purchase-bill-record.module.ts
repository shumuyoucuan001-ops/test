import { Module } from '@nestjs/common';
import { NonPurchaseBillRecordController } from './non-purchase-bill-record.controller';
import { NonPurchaseBillRecordService } from './non-purchase-bill-record.service';

@Module({
    controllers: [NonPurchaseBillRecordController],
    providers: [NonPurchaseBillRecordService],
    exports: [NonPurchaseBillRecordService],
})
export class NonPurchaseBillRecordModule { }

