import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StoreRejectionController } from './store-rejection.controller';
import { StoreRejectionService } from './store-rejection.service';

@Module({
    imports: [PrismaModule, EmailModule],
    controllers: [StoreRejectionController],
    providers: [StoreRejectionService],
})
export class StoreRejectionModule { }

