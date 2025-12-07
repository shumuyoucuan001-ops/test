import { Module } from '@nestjs/common';
import { LabelDataAuditController, LabelDataController } from './label-data.controller';
import { LabelDataService } from './label-data.service';

@Module({
  controllers: [LabelDataController, LabelDataAuditController],
  providers: [LabelDataService],
})
export class LabelDataModule {}


