import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DingTalkService } from './dingtalk.service';

/**
 * 钉钉控制器
 * 类似Java的@RestController
 */
@Controller('dingtalk')
export class DingTalkController {
    constructor(private readonly dingTalkService: DingTalkService) { }

    /**
     * 获取钉钉授权URL
     * 类似Java的 @GetMapping("/auth-url")
     */
    @Get('auth-url')
    getAuthUrl(@Query('state') state?: string) {
        try {
            console.log('[DingTalkController] 收到获取授权URL请求，state:', state);
            const url = this.dingTalkService.generateAuthUrl(state);
            const response = {
                url,
                // 开发环境返回配置信息，便于调试
                ...(process.env.NODE_ENV !== 'production' ? {
                    config: {
                        redirectUri: process.env.DINGTALK_REDIRECT_URI || '未配置',
                        appKey: process.env.DINGTALK_APP_KEY ? '已配置' : '未配置',
                        corpId: process.env.DINGTALK_CORP_ID ? '已配置' : '未配置',
                    }
                } : {})
            };
            console.log('[DingTalkController] 返回授权URL响应:', {
                hasUrl: !!response.url,
                urlLength: response.url?.length,
                urlPreview: response.url?.substring(0, 100) + '...',
            });
            return response;
        } catch (error: any) {
            console.error('[DingTalkController] 生成授权URL失败:', error);
            throw new BadRequestException(error.message);
        }
    }

    /**
     * 钉钉回调处理 - 通过code获取用户信息并验证
     * 类似Java的 @PostMapping("/callback")
     */
    @Post('callback')
    async handleCallback(@Body() body: { code: string }) {
        try {
            console.log('[DingTalkController] 收到回调请求，body:', {
                hasCode: !!body.code,
                codeLength: body.code?.length
            });

            if (!body.code) {
                console.error('[DingTalkController] 缺少授权码');
                throw new BadRequestException('缺少授权码');
            }

            const userInfo = await this.dingTalkService.getUserInfoByCode(body.code);
            console.log('[DingTalkController] 钉钉验证成功，用户:', userInfo.name);

            return {
                success: true,
                userInfo,
                message: '钉钉验证成功，该用户是企业内成员',
            };
        } catch (error: any) {
            console.error('[DingTalkController] 钉钉回调处理失败:', {
                message: error.message,
                stack: error.stack,
            });
            throw new BadRequestException(error.message || '钉钉验证失败');
        }
    }

    /**
     * 验证用户是否为企业内成员
     * 类似Java的 @PostMapping("/verify-member")
     */
    @Post('verify-member')
    async verifyMember(@Body() body: { userId: string }) {
        try {
            if (!body.userId) {
                throw new BadRequestException('缺少用户ID');
            }

            const isMember = await this.dingTalkService.verifyEnterpriseMember(body.userId);
            return {
                isMember,
                message: isMember ? '该用户是企业内成员' : '该用户不是企业内成员',
            };
        } catch (error: any) {
            throw new BadRequestException(error.message);
        }
    }
}

