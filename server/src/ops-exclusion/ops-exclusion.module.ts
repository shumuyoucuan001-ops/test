import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsExclusionController } from './ops-exclusion.controller';
import { OpsExclusionService } from './ops-exclusion.service';

@Module({
    imports: [PrismaModule],
    controllers: [OpsExclusionController],
    providers: [OpsExclusionService],
})
export class OpsExclusionModule { }
