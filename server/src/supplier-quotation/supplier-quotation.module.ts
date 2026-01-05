import { Module } from '@nestjs/common';
import { SupplierQuotationController } from './supplier-quotation.controller';
import { SupplierQuotationService } from './supplier-quotation.service';

@Module({
  controllers: [SupplierQuotationController],
  providers: [SupplierQuotationService],
  exports: [SupplierQuotationService],
})
export class SupplierQuotationModule {}

