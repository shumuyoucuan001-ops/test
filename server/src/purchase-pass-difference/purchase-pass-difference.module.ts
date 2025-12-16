import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PurchasePassDifferenceController } from './purchase-pass-difference.controller';
import { PurchasePassDifferenceService } from './purchase-pass-difference.service';

@Module({
    imports: [PrismaModule, EmailModule],
    controllers: [PurchasePassDifferenceController],
    providers: [PurchasePassDifferenceService],
})
export class PurchasePassDifferenceModule { }

