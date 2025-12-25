import { Module } from '@nestjs/common';
import { FinanceManagementController } from './finance-management.controller';
import { FinanceManagementService } from './finance-management.service';

@Module({
  controllers: [FinanceManagementController],
  providers: [FinanceManagementService],
  exports: [FinanceManagementService],
})
export class FinanceManagementModule {}

