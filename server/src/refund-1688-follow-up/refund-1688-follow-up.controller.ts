import { Body, Controller, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { Refund1688FollowUp, Refund1688FollowUpService } from './refund-1688-follow-up.service';

@Controller('refund-1688-follow-up')
export class Refund1688FollowUpController {
  constructor(private readonly service: Refund1688FollowUpService) { }

  // 获取所有退款跟进记录（支持分页）
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('收货人姓名') 收货人姓名?: string,
    @Query('订单编号') 订单编号?: string,
    @Query('订单状态') 订单状态?: string,
    @Query('买家会员名') 买家会员名?: string,
    @Query('采购单号') 采购单号?: string,
    @Query('物流单号') 物流单号?: string,
    @Query('进度追踪') 进度追踪?: string,
    @Query('keyword') keyword?: string,
  ): Promise<{ data: Refund1688FollowUp[]; total: number }> {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 200));

    const filters: any = {};
    if (收货人姓名) filters.收货人姓名 = 收货人姓名;
    if (订单编号) filters.订单编号 = 订单编号;
    if (订单状态) filters.订单状态 = 订单状态;
    if (买家会员名) filters.买家会员名 = 买家会员名;
    if (采购单号) filters.采购单号 = 采购单号;
    if (物流单号) filters.物流单号 = 物流单号;
    if (进度追踪) filters.进度追踪 = 进度追踪;
    if (keyword) filters.keyword = keyword;

    return await this.service.findAll(
      pageNum,
      limitNum,
      Object.keys(filters).length > 0 ? filters : undefined
    );
  }

  // 更新退款跟进记录
  @Put(':orderNo')
  async update(
    @Param('orderNo') orderNo: string,
    @Body() data: Partial<Refund1688FollowUp>,
    @Headers('x-user-id') userId?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.service.update(orderNo, data, userId ? parseInt(userId, 10) : undefined);
    return { success: true, message: '更新成功' };
  }

  // 获取订单状态
  @Post(':orderNo/order-status')
  async getOrderStatus(@Param('orderNo') orderNo: string): Promise<{ status: string }> {
    return await this.service.getOrderStatus(orderNo);
  }

  // 获取退款状态
  @Post(':orderNo/refund-status')
  async getRefundStatus(@Param('orderNo') orderNo: string): Promise<{ refundStatus: string }> {
    return await this.service.getRefundStatus(orderNo);
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

