import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // 启动期不主动连接数据库，等第一次查询时 Prisma 会自动连接
    return;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}


