import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsRegularActivityDispatchController } from './ops-regular-activity-dispatch.controller';
import { OpsRegularActivityDispatchService } from './ops-regular-activity-dispatch.service';

@Module({
    imports: [PrismaModule],
    controllers: [OpsRegularActivityDispatchController],
    providers: [OpsRegularActivityDispatchService],
})
export class OpsRegularActivityDispatchModule { }

