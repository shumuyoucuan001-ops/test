import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { SellerWangwangController } from './seller-wangwang.controller';
import { SellerWangwangService } from './seller-wangwang.service';

@Module({
    imports: [PrismaModule, OperationLogModule],
    controllers: [SellerWangwangController],
    providers: [SellerWangwangService],
})
export class SellerWangwangModule { }

