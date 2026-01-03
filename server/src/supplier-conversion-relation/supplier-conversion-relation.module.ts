
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupplierConversionRelationController } from './supplier-conversion-relation.controller';
import { SupplierConversionRelationService } from './supplier-conversion-relation.service';

@Module({
    imports: [PrismaModule],
    controllers: [SupplierConversionRelationController],
    providers: [SupplierConversionRelationService],
})
export class SupplierConversionRelationModule { }

