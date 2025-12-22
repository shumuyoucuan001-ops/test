import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsShelfExclusionController } from './ops-shelf-exclusion.controller';
import { OpsShelfExclusionService } from './ops-shelf-exclusion.service';

@Module({
    imports: [PrismaModule],
    controllers: [OpsShelfExclusionController],
    providers: [OpsShelfExclusionService],
})
export class OpsShelfExclusionModule { }

