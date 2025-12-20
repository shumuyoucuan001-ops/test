import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Logger } from '../utils/logger.util';
import { Refund1688FollowUpService } from './refund-1688-follow-up.service';

@Injectable()
export class Refund1688FollowUpScheduler {
    constructor(private readonly refund1688FollowUpService: Refund1688FollowUpService) { }

    // 每天北京时间17:30执行同步数据
    // cron 表达式格式：秒 分 时 日 月 周
    // 0 30 17 * * * 表示每天17:30:00执行
    // timeZone: 'Asia/Shanghai' 指定使用北京时间
    @Cron('0 30 17 * * *', {
        name: 'syncRefund1688Data',
        timeZone: 'Asia/Shanghai',
    })
    async handleSyncData() {
        Logger.log('[Refund1688FollowUpScheduler] 开始执行定时同步任务（每天17:30）');
        try {
            const result = await this.refund1688FollowUpService.syncDataFromPurchaseOrder();
            Logger.log(
                `[Refund1688FollowUpScheduler] 定时同步任务完成: 成功更新 ${result.updatedCount} 条记录`,
            );
        } catch (error: any) {
            Logger.error(
                `[Refund1688FollowUpScheduler] 定时同步任务失败: ${error?.message || error}`,
            );
        }
    }
}

