import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { Logger } from '../utils/logger.util';
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
    @Query('牵牛花物流单号') 牵牛花物流单号?: string,
    @Query('进度追踪') 进度追踪?: string,
    @Query('keyword') keyword?: string,
    @Headers('x-user-id') userId?: string,
  ): Promise<{ data: Refund1688FollowUp[]; total: number; canEdit?: boolean }> {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.max(1, Math.min(parseInt(limit || '20', 10), 200));

    const filters: any = {};
    if (收货人姓名) filters.收货人姓名 = 收货人姓名;
    if (订单编号) filters.订单编号 = 订单编号;
    if (订单状态) filters.订单状态 = 订单状态;
    if (买家会员名) filters.买家会员名 = 买家会员名;
    if (采购单号) filters.采购单号 = 采购单号;
    if (牵牛花物流单号) filters.牵牛花物流单号 = 牵牛花物流单号;
    if (进度追踪) filters.进度追踪 = 进度追踪;
    if (keyword) filters.keyword = keyword;

    const result = await this.service.findAll(
      pageNum,
      limitNum,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    // 检查用户是否有编辑权限（即使检查失败也不影响数据返回）
    let canEdit = true;
    if (userId) {
      try {
        const userIdNum = parseInt(userId, 10);
        if (!isNaN(userIdNum)) {
          canEdit = await this.service.checkEditPermission(userIdNum);
        }
      } catch (error) {
        // 如果检查失败，默认不允许编辑，但不影响数据返回
        Logger.error('[Refund1688FollowUpController] 权限检查失败，默认不允许编辑:', error);
        canEdit = false;
      }
    }

    return {
      ...result,
      canEdit,
    };
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

  // 获取跟进情况图片（按需查询，原发货截图）
  @Get(':orderNo/follow-up-image')
  async getFollowUpImage(@Param('orderNo') orderNo: string): Promise<{ 跟进情况图片: string | null }> {
    return await this.service.getFollowUpImage(orderNo);
  }

  // 同步数据：从采购单信息表同步采购单号和物流单号
  @Post('sync-data')
  async syncData(
    @Headers('x-user-id') userId?: string,
  ): Promise<{ success: boolean; updatedCount: number; message: string }> {
    // 检查编辑权限
    if (userId) {
      try {
        const hasPermission = await this.service.checkEditPermission(parseInt(userId, 10));
        if (!hasPermission) {
          throw new Error('您的账号没有编辑权限，无法执行同步操作');
        }
      } catch (error: any) {
        if (error.message && error.message.includes('没有编辑权限')) {
          throw error;
        }
        // 其他错误也拒绝，保证安全
        throw new Error('权限检查失败，无法执行同步操作');
      }
    }

    return await this.service.syncDataFromPurchaseOrder();
  }

  // 删除退款跟进记录
  @Delete(':orderNo')
  async delete(
    @Param('orderNo') orderNo: string,
    @Headers('x-user-id') userId?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.service.delete(orderNo, userId ? parseInt(userId, 10) : undefined);
    return { success: true, message: '删除成功' };
  }

  // 批量删除退款跟进记录
  @Post('batch-delete')
  async batchDelete(
    @Body() body: { orderNos: string[] },
    @Headers('x-user-id') userId?: string,
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    Logger.log(`[Refund1688FollowUpController] 收到批量删除请求: userId=${userId}, orderNos数量=${body?.orderNos?.length || 0}`);
    Logger.log(`[Refund1688FollowUpController] 订单编号列表:`, body?.orderNos);
    const result = await this.service.batchDelete(body.orderNos, userId ? parseInt(userId, 10) : undefined);
    Logger.log(`[Refund1688FollowUpController] 批量删除完成: 删除数量=${result.deletedCount}`);
    return result;
  }
}

