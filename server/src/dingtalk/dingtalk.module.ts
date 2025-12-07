import { Module } from '@nestjs/common';
import { DingTalkController } from './dingtalk.controller';
import { DingTalkService } from './dingtalk.service';

/**
 * 钉钉模块
 * 类似Java的@Configuration配置类
 */
@Module({
    providers: [DingTalkService], // 类似@Bean注解
    controllers: [DingTalkController], // 类似@RestController
    exports: [DingTalkService], // 导出服务供其他模块使用
})
export class DingTalkModule { }

