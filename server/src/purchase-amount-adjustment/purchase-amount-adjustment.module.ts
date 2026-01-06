import { Module } from '@nestjs/common';
import { OssModule } from '../oss/oss.module';
import { PurchaseAmountAdjustmentController } from './purchase-amount-adjustment.controller';
import { PurchaseAmountAdjustmentService } from './purchase-amount-adjustment.service';

@Module({
  imports: [OssModule],
  controllers: [PurchaseAmountAdjustmentController],
  providers: [PurchaseAmountAdjustmentService],
  exports: [PurchaseAmountAdjustmentService],
})
export class PurchaseAmountAdjustmentModule {}

