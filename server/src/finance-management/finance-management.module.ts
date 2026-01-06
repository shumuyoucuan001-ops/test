import { Module } from '@nestjs/common';
import { OssModule } from '../oss/oss.module';
import { FinanceManagementController } from './finance-management.controller';
import { FinanceManagementService } from './finance-management.service';

@Module({
  imports: [OssModule],
  controllers: [FinanceManagementController],
  providers: [FinanceManagementService],
  exports: [FinanceManagementService],
})
export class FinanceManagementModule {}

