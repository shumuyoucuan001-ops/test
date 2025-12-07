import { Module } from '@nestjs/common';
import { DingTalkModule } from '../dingtalk/dingtalk.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AclController } from './acl.controller';
import { AclService } from './acl.service';

@Module({
  imports: [PrismaModule, DingTalkModule],
  controllers: [AclController],
  providers: [AclService],
})
export class AclModule { }


