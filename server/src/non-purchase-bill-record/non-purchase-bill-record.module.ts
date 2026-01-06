import { Module } from '@nestjs/common';
import { OssModule } from '../oss/oss.module';
import { NonPurchaseBillRecordController } from './non-purchase-bill-record.controller';
import { NonPurchaseBillRecordService } from './non-purchase-bill-record.service';

@Module({
    imports: [OssModule],
    controllers: [NonPurchaseBillRecordController],
    providers: [NonPurchaseBillRecordService],
    exports: [NonPurchaseBillRecordService],
})
export class NonPurchaseBillRecordModule { }

