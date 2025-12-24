import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsActivityDispatchController } from './ops-activity-dispatch.controller';
import { OpsActivityDispatchService } from './ops-activity-dispatch.service';

@Module({
    imports: [PrismaModule],
    controllers: [OpsActivityDispatchController],
    providers: [OpsActivityDispatchService],
})
export class OpsActivityDispatchModule { }

