import { Body, Controller, Get, Param, Put, Post } from '@nestjs/common';
import { Refund1688FollowUpService, Refund1688FollowUp } from './refund-1688-follow-up.service';

@Controller('refund-1688-follow-up')
export class Refund1688FollowUpController {
  constructor(private readonly service: Refund1688FollowUpService) {}

  // 获取所有退款跟进记录
  @Get()
  async findAll(): Promise<Refund1688FollowUp[]> {
    return await this.service.findAll();
  }

  // 更新退款跟进记录
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Partial<Refund1688FollowUp>,
  ): Promise<{ success: boolean; message: string }> {
    await this.service.update(Number(id), data);
    return { success: true, message: '更新成功' };
  }

  // 获取订单状态
  @Post(':id/order-status')
  async getOrderStatus(@Param('id') id: string): Promise<{ status: string }> {
    return await this.service.getOrderStatus(Number(id));
  }

  // 获取退款状态
  @Post(':id/refund-status')
  async getRefundStatus(@Param('id') id: string): Promise<{ refundStatus: string }> {
    return await this.service.getRefundStatus(Number(id));
  }

  // 自动匹配采购单号
  @Post('auto-match-purchase-orders')
  async autoMatchPurchaseOrderNos(): Promise<{ success: boolean; count: number; message: string }> {
    const count = await this.service.autoMatchPurchaseOrderNos();
    return {
      success: true,
      count,
      message: `成功匹配 ${count} 条记录`,
    };
  }
}

