import { Module } from '@nestjs/common';
import { FinanceReconciliationDifferenceController } from './finance-reconciliation-difference.controller';
import { FinanceReconciliationDifferenceService } from './finance-reconciliation-difference.service';

@Module({
  controllers: [FinanceReconciliationDifferenceController],
  providers: [FinanceReconciliationDifferenceService],
  exports: [FinanceReconciliationDifferenceService],
})
export class FinanceReconciliationDifferenceModule {}

