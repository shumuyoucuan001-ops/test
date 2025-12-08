import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * 钉钉服务类 - 用于钉钉OAuth验证
 * 类似Java中的 @Service 注解的Service类
 */
@Injectable()
export class DingTalkService {
    // 钉钉配置（从环境变量读取，类似Spring的@Value注解）
    private readonly appKey: string;
    private readonly appSecret: string;
    private readonly corpId: string; // 企业ID
    private readonly redirectUri: string; // 回调地址

    constructor() {
        // 从环境变量读取配置，不再使用硬编码默认值
        this.appKey = process.env.DINGTALK_APP_KEY || '';
        this.appSecret = process.env.DINGTALK_APP_SECRET || '';
        this.corpId = process.env.DINGTALK_CORP_ID || '';
        this.redirectUri = process.env.DINGTALK_REDIRECT_URI || '';

        // 验证必要的配置项是否存在
        if (!this.appKey || !this.appSecret || !this.corpId) {
            console.warn('[DingTalkService] 钉钉配置不完整，钉钉登录功能可能不可用');
            console.warn('[DingTalkService] 请检查 server/.env 文件中的配置：DINGTALK_APP_KEY, DINGTALK_APP_SECRET, DINGTALK_CORP_ID');
        }

        // 如果没有配置回调地址，使用默认值（但建议在环境变量中配置）
        if (!this.redirectUri) {
            console.warn('[DingTalkService] 未配置 DINGTALK_REDIRECT_URI，请确保在 server/.env 中配置回调地址');
        }
    }

    /**
     * 生成钉钉授权URL（企业内应用OAuth2.0）
     * 类似Java方法：public String generateAuthUrl()
     * 
     * 注意：钉钉企业内应用的OAuth2.0授权URL格式
     */
    generateAuthUrl(state?: string): string {
        if (!this.appKey || !this.corpId) {
            throw new BadRequestException('钉钉配置不完整');
        }

        if (!this.redirectUri) {
            throw new BadRequestException('未配置回调地址，请在 server/.env 中设置 DINGTALK_REDIRECT_URI');
        }

        // 验证并清理 redirectUri（去除末尾的斜杠，确保格式一致）
        let cleanRedirectUri = this.redirectUri.trim();
        if (cleanRedirectUri.endsWith('/')) {
            cleanRedirectUri = cleanRedirectUri.slice(0, -1);
        }

        // 验证 redirectUri 格式
        try {
            const url = new URL(cleanRedirectUri);
            if (!url.protocol || !url.hostname) {
                throw new BadRequestException(`回调地址格式不正确: ${cleanRedirectUri}`);
            }
        } catch (error) {
            throw new BadRequestException(`回调地址格式不正确: ${cleanRedirectUri}`);
        }

        // 钉钉企业内应用OAuth2.0授权URL
        // 注意：redirect_uri 必须是完整URL，且必须与钉钉开放平台配置的回调地址完全一致
        // 使用 URLSearchParams 确保参数正确编码
        const params = new URLSearchParams();
        params.append('appid', this.appKey.trim()); // 确保去除空格
        params.append('response_type', 'code');
        params.append('scope', 'snsapi_base'); // 企业内应用使用snsapi_base获取用户基本信息
        params.append('redirect_uri', cleanRedirectUri); // URLSearchParams会自动进行URL编码
        params.append('state', (state || 'default').trim());

        const authUrl = `https://oapi.dingtalk.com/connect/oauth2/sns_authorize?${params.toString()}`;

        // 详细日志输出（便于排查问题）
        const hostname = new URL(cleanRedirectUri).hostname;
        console.log('[DingTalkService] ========== 钉钉授权URL生成 ==========');
        console.log('[DingTalkService] 生成的授权URL:', authUrl);
        console.log('[DingTalkService] 配置信息:');
        console.log('[DingTalkService]   - AppKey:', this.appKey ? `${this.appKey.substring(0, 10)}...` : '未配置');
        console.log('[DingTalkService]   - CorpId:', this.corpId ? `${this.corpId.substring(0, 10)}...` : '未配置');
        console.log('[DingTalkService]   - RedirectUri:', cleanRedirectUri);
        console.log('[DingTalkService]   - Hostname:', hostname);
        console.log('[DingTalkService] 请确保钉钉开放平台已配置：');
        console.log('[DingTalkService]   1. OAuth2.0回调地址:', cleanRedirectUri);
        console.log('[DingTalkService]   2. 安全域名:', hostname, '(仅域名，不要包含 http:// 或路径)');
        console.log('[DingTalkService]   3. 应用已发布上线');
        console.log('[DingTalkService]   4. 权限已申请并授权');
        console.log('[DingTalkService] ====================================');

        return authUrl;
    }

    /**
     * 通过code获取access_token
     * 类似Java方法：public String getAccessToken(String code)
     */
    async getAccessToken(code: string): Promise<string> {
        if (!this.appKey || !this.appSecret) {
            throw new BadRequestException('钉钉配置不完整');
        }

        try {
            // 钉钉OAuth2.0获取access_token
            const response = await axios.post('https://oapi.dingtalk.com/gettoken', {
                appkey: this.appKey,
                appsecret: this.appSecret,
            });

            if (response.data.errcode !== 0) {
                throw new BadRequestException(`获取access_token失败: ${response.data.errmsg}`);
            }

            return response.data.access_token;
        } catch (error: any) {
            throw new BadRequestException(`钉钉认证失败: ${error.message}`);
        }
    }

    /**
     * 通过code获取用户信息（企业内成员验证）
     * 类似Java方法：public DingTalkUserInfo getUserInfo(String code)
     * 
     * 钉钉企业内应用OAuth2.0流程：
     * 1. 获取access_token（使用appkey和appsecret）
     * 2. 通过code获取用户userid（使用access_token和code）
     * 3. 通过userid获取用户详细信息
     */
    async getUserInfoByCode(code: string): Promise<DingTalkUserInfo> {
        if (!this.appKey || !this.appSecret) {
            throw new BadRequestException('钉钉配置不完整');
        }

        try {
            console.log('[DingTalkService] 开始获取用户信息，code:', code.substring(0, 10) + '...');

            // 第一步：获取access_token（企业应用的access_token）
            const tokenResponse = await axios.get('https://oapi.dingtalk.com/gettoken', {
                params: {
                    appkey: this.appKey,
                    appsecret: this.appSecret,
                },
            });

            console.log('[DingTalkService] 获取access_token响应:', {
                errcode: tokenResponse.data.errcode,
                errmsg: tokenResponse.data.errmsg,
                hasToken: !!tokenResponse.data.access_token,
            });

            if (tokenResponse.data.errcode !== 0) {
                console.error('[DingTalkService] 获取access_token失败:', tokenResponse.data);
                throw new BadRequestException(`获取access_token失败: ${tokenResponse.data.errmsg || '未知错误'}`);
            }

            const accessToken = tokenResponse.data.access_token;
            console.log('[DingTalkService] access_token获取成功');

            // 第二步：通过code获取用户userid
            console.log('[DingTalkService] 通过code获取用户信息...');
            const userResponse = await axios.post(
                'https://oapi.dingtalk.com/topapi/v2/user/getuserinfo',
                {
                    code: code,
                },
                {
                    params: {
                        access_token: accessToken,
                    },
                }
            );

            console.log('[DingTalkService] 获取用户信息响应:', {
                errcode: userResponse.data.errcode,
                errmsg: userResponse.data.errmsg,
                hasResult: !!userResponse.data.result,
                userId: userResponse.data.result?.userid,
            });

            if (userResponse.data.errcode !== 0) {
                console.error('[DingTalkService] 获取用户信息失败:', userResponse.data);
                throw new BadRequestException(`获取用户信息失败: ${userResponse.data.errmsg || '未知错误'} (错误码: ${userResponse.data.errcode})`);
            }

            const userInfo = userResponse.data.result;

            // 第三步：验证是否为企业内成员（通过userid是否存在判断）
            if (!userInfo.userid) {
                console.error('[DingTalkService] 用户信息中没有userid:', userInfo);
                throw new BadRequestException('该用户不是企业内成员（未获取到userid）');
            }

            console.log('[DingTalkService] 获取到userid:', userInfo.userid);

            // 第四步：获取用户详细信息
            console.log('[DingTalkService] 获取用户详细信息...');
            const detailResponse = await axios.post(
                'https://oapi.dingtalk.com/topapi/v2/user/get',
                {
                    userid: userInfo.userid,
                },
                {
                    params: {
                        access_token: accessToken,
                    },
                }
            );

            console.log('[DingTalkService] 获取用户详情响应:', {
                errcode: detailResponse.data.errcode,
                errmsg: detailResponse.data.errmsg,
                hasResult: !!detailResponse.data.result,
                userName: detailResponse.data.result?.name,
                active: detailResponse.data.result?.active,
            });

            if (detailResponse.data.errcode !== 0) {
                console.error('[DingTalkService] 获取用户详情失败:', detailResponse.data);
                throw new BadRequestException(`获取用户详情失败: ${detailResponse.data.errmsg || '未知错误'} (错误码: ${detailResponse.data.errcode})`);
            }

            const userDetail = detailResponse.data.result;

            // 验证用户是否激活（企业内成员必须是激活状态）
            if (!userDetail.active) {
                throw new BadRequestException('该用户账号未激活，不是有效的企业内成员');
            }

            return {
                userId: userInfo.userid,
                name: userDetail.name || '',
                mobile: userDetail.mobile || '',
                email: userDetail.email || '',
                avatar: userDetail.avatar || '',
                active: userDetail.active || false,
                isAdmin: userDetail.is_admin || false,
                isBoss: userDetail.is_boss || false,
            };
        } catch (error: any) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(`钉钉认证失败: ${error.message}`);
        }
    }

    /**
     * 验证用户是否为企业内成员
     * 类似Java方法：public boolean isEnterpriseMember(String userId)
     */
    async verifyEnterpriseMember(userId: string): Promise<boolean> {
        if (!this.appKey || !this.appSecret) {
            return false;
        }

        try {
            const tokenResponse = await axios.get('https://oapi.dingtalk.com/gettoken', {
                params: {
                    appkey: this.appKey,
                    appsecret: this.appSecret,
                },
            });

            if (tokenResponse.data.errcode !== 0) {
                return false;
            }

            const accessToken = tokenResponse.data.access_token;

            const userResponse = await axios.post(
                'https://oapi.dingtalk.com/topapi/v2/user/get',
                {
                    userid: userId,
                },
                {
                    params: {
                        access_token: accessToken,
                    },
                }
            );

            // 如果能获取到用户信息且用户是激活状态，说明是企业内成员
            return userResponse.data.errcode === 0 && userResponse.data.result?.active === true;
        } catch {
            return false;
        }
    }

    /**
     * 检查钉钉配置并返回诊断信息
     * 用于排查配置问题
     */
    checkConfig(): {
        isValid: boolean;
        config: {
            appKey: { configured: boolean; value: string };
            appSecret: { configured: boolean; value: string };
            corpId: { configured: boolean; value: string };
            redirectUri: { configured: boolean; value: string; hostname?: string };
        };
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];

        // 检查配置项
        const appKeyConfigured = !!this.appKey;
        const appSecretConfigured = !!this.appSecret;
        const corpIdConfigured = !!this.corpId;
        const redirectUriConfigured = !!this.redirectUri;

        if (!appKeyConfigured) {
            issues.push('DINGTALK_APP_KEY 未配置');
            recommendations.push('请在 server/.env 文件中设置 DINGTALK_APP_KEY');
        }

        if (!appSecretConfigured) {
            issues.push('DINGTALK_APP_SECRET 未配置');
            recommendations.push('请在 server/.env 文件中设置 DINGTALK_APP_SECRET');
        }

        if (!corpIdConfigured) {
            issues.push('DINGTALK_CORP_ID 未配置');
            recommendations.push('请在 server/.env 文件中设置 DINGTALK_CORP_ID');
        }

        if (!redirectUriConfigured) {
            issues.push('DINGTALK_REDIRECT_URI 未配置');
            recommendations.push('请在 server/.env 文件中设置 DINGTALK_REDIRECT_URI，格式：http://your-domain.com/login');
        } else {
            // 验证回调地址格式
            try {
                const url = new URL(this.redirectUri);
                const hostname = url.hostname;

                // 检查是否是有效的URL格式
                if (!url.protocol || !hostname) {
                    issues.push('DINGTALK_REDIRECT_URI 格式不正确');
                    recommendations.push('回调地址必须是完整的URL，格式：http://your-domain.com/login 或 https://your-domain.com/login');
                } else {
                    // 提供安全域名配置建议
                    recommendations.push(`请在钉钉开放平台添加安全域名：${hostname}`);
                    recommendations.push(`请确保钉钉开放平台配置的回调地址与 DINGTALK_REDIRECT_URI 完全一致：${this.redirectUri}`);
                }
            } catch (error) {
                issues.push('DINGTALK_REDIRECT_URI 格式不正确，无法解析为有效URL');
                recommendations.push('回调地址必须是完整的URL，格式：http://your-domain.com/login 或 https://your-domain.com/login');
            }
        }

        // 检查所有必要配置是否都已配置
        const isValid = appKeyConfigured && appSecretConfigured && corpIdConfigured && redirectUriConfigured;

        let hostname: string | undefined;
        try {
            if (this.redirectUri) {
                hostname = new URL(this.redirectUri).hostname;
            }
        } catch {
            // 忽略解析错误
        }

        return {
            isValid,
            config: {
                appKey: {
                    configured: appKeyConfigured,
                    value: appKeyConfigured ? `${this.appKey.substring(0, 10)}...` : '未配置',
                },
                appSecret: {
                    configured: appSecretConfigured,
                    value: appSecretConfigured ? '已配置（已隐藏）' : '未配置',
                },
                corpId: {
                    configured: corpIdConfigured,
                    value: corpIdConfigured ? `${this.corpId.substring(0, 10)}...` : '未配置',
                },
                redirectUri: {
                    configured: redirectUriConfigured,
                    value: redirectUriConfigured ? this.redirectUri : '未配置',
                    hostname,
                },
            },
            issues,
            recommendations,
        };
    }
}

/**
 * 钉钉用户信息接口
 * 类似Java的DTO类
 */
export interface DingTalkUserInfo {
    userId: string; // 钉钉用户ID
    name: string; // 用户姓名
    mobile: string; // 手机号
    email: string; // 邮箱
    avatar: string; // 头像
    active: boolean; // 是否激活
    isAdmin: boolean; // 是否管理员
    isBoss: boolean; // 是否老板
}

