import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MaxStoreSkuInventoryController } from './max-store-sku-inventory.controller';
import { MaxStoreSkuInventoryService } from './max-store-sku-inventory.service';

@Module({
    imports: [PrismaModule],
    controllers: [MaxStoreSkuInventoryController],
    providers: [MaxStoreSkuInventoryService],
})
export class MaxStoreSkuInventoryModule { }

