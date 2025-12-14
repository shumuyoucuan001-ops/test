import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MaxPurchaseQuantityController } from './max-purchase-quantity.controller';
import { MaxPurchaseQuantityService } from './max-purchase-quantity.service';

@Module({
    imports: [PrismaModule],
    controllers: [MaxPurchaseQuantityController],
    providers: [MaxPurchaseQuantityService],
})
export class MaxPurchaseQuantityModule { }

