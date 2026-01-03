import { Module } from '@nestjs/common';
import { FinanceReconciliationDifferenceController, PurchaseOrderInfoController, TransactionRecordController } from './finance-reconciliation-difference.controller';
import { FinanceReconciliationDifferenceService } from './finance-reconciliation-difference.service';

@Module({
  controllers: [FinanceReconciliationDifferenceController, TransactionRecordController, PurchaseOrderInfoController],
  providers: [FinanceReconciliationDifferenceService],
  exports: [FinanceReconciliationDifferenceService],
})
export class FinanceReconciliationDifferenceModule {}

