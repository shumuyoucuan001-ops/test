import { Module, forwardRef } from '@nestjs/common';
import { DingTalkModule } from '../dingtalk/dingtalk.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AclController } from './acl.controller';
import { AclService } from './acl.service';

@Module({
  imports: [PrismaModule, forwardRef(() => DingTalkModule)], // 使用forwardRef解决循环依赖
  controllers: [AclController],
  providers: [AclService],
  exports: [AclService], // 导出AclService供其他模块使用
})
export class AclModule { }


