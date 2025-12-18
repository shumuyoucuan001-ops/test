import { Module } from '@nestjs/common';
import { Refund1688FollowUpController } from './refund-1688-follow-up.controller';
import { Refund1688FollowUpService } from './refund-1688-follow-up.service';

@Module({
  controllers: [Refund1688FollowUpController],
  providers: [Refund1688FollowUpService],
  exports: [Refund1688FollowUpService],
})
export class Refund1688FollowUpModule {}

