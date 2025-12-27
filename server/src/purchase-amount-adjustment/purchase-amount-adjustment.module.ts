import { Module } from '@nestjs/common';
import { PurchaseAmountAdjustmentController } from './purchase-amount-adjustment.controller';
import { PurchaseAmountAdjustmentService } from './purchase-amount-adjustment.service';

@Module({
  controllers: [PurchaseAmountAdjustmentController],
  providers: [PurchaseAmountAdjustmentService],
  exports: [PurchaseAmountAdjustmentService],
})
export class PurchaseAmountAdjustmentModule {}

