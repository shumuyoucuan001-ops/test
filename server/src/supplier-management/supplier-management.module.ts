import { Module } from '@nestjs/common';
import { SupplierManagementController } from './supplier-management.controller';
import { SupplierManagementService } from './supplier-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierManagementController],
  providers: [SupplierManagementService],
})
export class SupplierManagementModule {}
