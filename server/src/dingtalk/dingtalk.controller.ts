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

            // 始终返回配置信息，便于调试（生产环境也需要）
            const response = {
                url,
                config: {
                    redirectUri: process.env.DINGTALK_REDIRECT_URI || '未配置',
                    appKey: process.env.DINGTALK_APP_KEY ? `${process.env.DINGTALK_APP_KEY.substring(0, 10)}...` : '未配置',
                    corpId: process.env.DINGTALK_CORP_ID ? `${process.env.DINGTALK_CORP_ID.substring(0, 10)}...` : '未配置',
                    hostname: process.env.DINGTALK_REDIRECT_URI ? new URL(process.env.DINGTALK_REDIRECT_URI).hostname : '未配置',
                },
                tips: [
                    '请确保钉钉开放平台配置：',
                    `1. OAuth2.0回调地址: ${process.env.DINGTALK_REDIRECT_URI || '未配置'}`,
                    `2. 安全域名: ${process.env.DINGTALK_REDIRECT_URI ? new URL(process.env.DINGTALK_REDIRECT_URI).hostname : '未配置'} (仅域名，不要包含 http:// 或路径)`,
                    '3. 应用已发布上线',
                    '4. 权限已申请并授权',
                ]
            };

            console.log('[DingTalkController] 返回授权URL响应:', {
                hasUrl: !!response.url,
                urlLength: response.url?.length,
                redirectUri: process.env.DINGTALK_REDIRECT_URI,
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
            console.log('[DingTalkController] ========== 收到钉钉回调请求 ==========');
            console.log('[DingTalkController] 请求body:', JSON.stringify(body, null, 2));
            console.log('[DingTalkController] code存在:', !!body.code);
            console.log('[DingTalkController] code长度:', body.code?.length);
            console.log('[DingTalkController] code预览:', body.code ? body.code.substring(0, 20) + '...' : '无');

            if (!body.code) {
                console.error('[DingTalkController] ✗ 缺少授权码');
                throw new BadRequestException('缺少授权码');
            }

            console.log('[DingTalkController] 开始调用 getUserInfoByCode...');
            const userInfo = await this.dingTalkService.getUserInfoByCode(body.code);
            console.log('[DingTalkController] ✓ 钉钉验证成功');
            console.log('[DingTalkController] 用户信息:', {
                userId: userInfo.userId,
                name: userInfo.name,
                mobile: userInfo.mobile,
                email: userInfo.email,
                active: userInfo.active,
            });

            return {
                success: true,
                userInfo,
                message: '钉钉验证成功，该用户是企业内成员',
            };
        } catch (error: any) {
            console.error('[DingTalkController] ========== 钉钉回调处理失败 ==========');
            console.error('[DingTalkController] 错误类型:', error.constructor.name);
            console.error('[DingTalkController] 错误消息:', error.message);
            console.error('[DingTalkController] 错误堆栈:', error.stack);

            if (error.response) {
                console.error('[DingTalkController] HTTP响应:', {
                    status: error.response.status,
                    data: error.response.data,
                });
            }

            console.error('[DingTalkController] ===========================================');
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

    /**
     * 检查钉钉配置
     * 用于诊断配置问题
     */
    @Get('check-config')
    checkConfig() {
        try {
            const result = this.dingTalkService.checkConfig();
            return {
                ...result,
                message: result.isValid
                    ? '钉钉配置检查通过'
                    : '钉钉配置存在问题，请查看 issues 和 recommendations',
            };
        } catch (error: any) {
            console.error('[DingTalkController] 配置检查失败:', error);
            throw new BadRequestException(`配置检查失败: ${error.message}`);
        }
    }
}

