import { Module } from '@nestjs/common';
import { LabelPrintController } from './label-print.controller';
import { LabelPrintService } from './label-print.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LabelPrintController],
  providers: [LabelPrintService],
})
export class LabelPrintModule {}


