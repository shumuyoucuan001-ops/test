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
     * 生成钉钉授权URL（企业登录地址）
     * 类似Java方法：public String generateAuthUrl()
     * 
     * 注意：使用钉钉企业登录地址 oauth2/challenge.htm
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

        // 钉钉企业登录地址
        // 注意：redirect_uri 必须是完整URL，且必须进行URL编码
        // 使用 URLSearchParams 确保参数正确编码
        const params = new URLSearchParams();
        params.append('redirect_uri', cleanRedirectUri); // URLSearchParams会自动进行URL编码
        params.append('response_type', 'code');
        params.append('client_id', this.appKey.trim()); // 使用client_id替代appid
        params.append('scope', 'openid corpid'); // 企业登录使用 openid corpid
        params.append('prompt', 'consent'); // 添加prompt参数

        const authUrl = `https://login.dingtalk.com/oauth2/challenge.htm?${params.toString()}`;

        // 调试：打印完整的授权URL和参数
        console.log('[DingTalkService] 授权URL参数详情:', {
            client_id: this.appKey.trim(),
            response_type: 'code',
            scope: 'openid corpid',
            redirect_uri: cleanRedirectUri,
            redirect_uri_encoded: encodeURIComponent(cleanRedirectUri),
            prompt: 'consent',
            corpId: this.corpId.trim(),
        });

        // 详细日志输出（便于排查问题）
        const hostname = new URL(cleanRedirectUri).hostname;
        console.log('[DingTalkService] ========== 钉钉授权URL生成 ==========');
        console.log('[DingTalkService] 生成的授权URL:', authUrl);
        console.log('[DingTalkService] 配置信息:');
        console.log('[DingTalkService]   - AppKey (client_id):', this.appKey ? `${this.appKey.substring(0, 10)}...` : '未配置');
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
     * 支持两种流程：
     * 1. OAuth2.0统一登录流程（oauth2/challenge.htm）：
     *    - 通过code换取OAuth2.0 access_token
     *    - 通过access_token获取用户信息
     * 2. 企业内应用流程（兼容旧方式）：
     *    - 获取企业应用access_token
     *    - 通过code获取用户userid
     *    - 通过userid获取用户详细信息
     */
    async getUserInfoByCode(code: string): Promise<DingTalkUserInfo> {
        if (!this.appKey || !this.appSecret) {
            throw new BadRequestException('钉钉配置不完整');
        }

        try {
            console.log('[DingTalkService] 开始获取用户信息，code:', code.substring(0, 10) + '...');

            // 使用钉钉新版API（适用于oauth2/challenge.htm统一登录）
            // 新版API使用 api.dingtalk.com 而不是 oapi.dingtalk.com
            try {
                console.log('[DingTalkService] ========== 开始新版OAuth2.0统一登录流程 ==========');
                console.log('[DingTalkService] 接收到的code:', code.substring(0, 20) + '... (长度: ' + code.length + ')');
                console.log('[DingTalkService] 使用参数:', {
                    clientId: this.appKey.trim().substring(0, 10) + '...',
                    clientSecret: this.appSecret.trim() ? '已配置' : '未配置',
                    code_length: code.length,
                    code_preview: code.substring(0, 20) + '...',
                });

                // 第一步：通过code换取用户级access_token（新版API）
                console.log('[DingTalkService] 步骤1: 调用新版API获取access_token...');
                console.log('[DingTalkService] 请求URL: https://api.dingtalk.com/v1.0/oauth2/userAccessToken');

                let oauthTokenResponse;
                try {
                    oauthTokenResponse = await axios.post(
                        'https://api.dingtalk.com/v1.0/oauth2/userAccessToken',
                        {
                            clientId: this.appKey.trim(),
                            clientSecret: this.appSecret.trim(),
                            code: code,
                            grantType: 'authorization_code',
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                } catch (axiosError: any) {
                    console.error('[DingTalkService] 新版API请求失败:', {
                        message: axiosError.message,
                        status: axiosError.response?.status,
                        statusText: axiosError.response?.statusText,
                        data: axiosError.response?.data,
                        fullError: JSON.stringify(axiosError.response?.data || axiosError.message),
                    });
                    throw axiosError;
                }

                console.log('[DingTalkService] 新版OAuth2.0 userAccessToken响应状态:', oauthTokenResponse.status);
                console.log('[DingTalkService] 新版OAuth2.0 userAccessToken响应数据:', {
                    hasAccessToken: !!oauthTokenResponse.data?.accessToken,
                    hasExpireIn: !!oauthTokenResponse.data?.expireIn,
                    hasCorpId: !!oauthTokenResponse.data?.corpId,
                    hasOpenId: !!oauthTokenResponse.data?.openId,
                    fullResponse: JSON.stringify(oauthTokenResponse.data),
                });

                if (oauthTokenResponse.data?.accessToken) {
                    const userAccessToken = oauthTokenResponse.data.accessToken;
                    const openId = oauthTokenResponse.data.openId;
                    const corpId = oauthTokenResponse.data.corpId;

                    console.log('[DingTalkService] ✓ 新版OAuth2.0 access_token获取成功');
                    console.log('[DingTalkService] openId:', openId);
                    console.log('[DingTalkService] 返回的corpId:', corpId);
                    console.log('[DingTalkService] 配置的corpId:', this.corpId);
                    console.log('[DingTalkService] accessToken预览:', userAccessToken.substring(0, 20) + '...');

                    // 验证用户选择的企业是否与配置的企业ID一致
                    if (corpId && this.corpId) {
                        if (corpId.trim() !== this.corpId.trim()) {
                            console.error('[DingTalkService] ✗ 企业ID不匹配:', {
                                返回的企业ID: corpId,
                                配置的企业ID: this.corpId,
                            });
                            throw new BadRequestException(`您选择的企业组织不正确。请选择正确的企业组织进行登录。`);
                        }
                        console.log('[DingTalkService] ✓ 企业ID验证通过');
                    } else if (!corpId) {
                        console.warn('[DingTalkService] ⚠ 响应中没有corpId，无法验证企业组织');
                    }

                    // 如果没有openId，尝试使用accessToken获取当前用户信息
                    if (!openId) {
                        console.log('[DingTalkService] 响应中没有openId，尝试使用accessToken获取当前用户信息...');

                        // 使用accessToken获取当前用户信息（新版API）
                        try {
                            console.log('[DingTalkService] 步骤2: 调用新版API获取当前用户信息...');
                            console.log('[DingTalkService] 请求URL: https://api.dingtalk.com/v1.0/contact/users/me');

                            const userInfoResponse = await axios.get(
                                'https://api.dingtalk.com/v1.0/contact/users/me',
                                {
                                    headers: {
                                        'x-acs-dingtalk-access-token': userAccessToken,
                                    },
                                }
                            );

                            console.log('[DingTalkService] 新版OAuth2.0获取当前用户信息响应状态:', userInfoResponse.status);
                            console.log('[DingTalkService] 新版OAuth2.0获取当前用户信息响应数据:', {
                                hasBody: !!userInfoResponse.data,
                                fullResponse: JSON.stringify(userInfoResponse.data),
                            });

                            if (userInfoResponse.data) {
                                const userInfo = userInfoResponse.data;
                                const userId = userInfo.userId || userInfo.unionId || userInfo.openId;

                                console.log('[DingTalkService] 从响应中提取的userId:', userId);

                                // 如果有userId且是企业内用户，尝试获取详细信息
                                if (userId && corpId) {
                                    // 验证企业ID是否匹配
                                    if (corpId.trim() !== this.corpId.trim()) {
                                        console.error('[DingTalkService] ✗ 企业ID不匹配:', {
                                            返回的企业ID: corpId,
                                            配置的企业ID: this.corpId,
                                        });
                                        throw new BadRequestException(`您选择的企业组织不正确。请选择正确的企业组织进行登录。`);
                                    }

                                    // 获取企业应用access_token来查询用户详情
                                    const corpTokenResponse = await axios.get('https://oapi.dingtalk.com/gettoken', {
                                        params: {
                                            appkey: this.appKey,
                                            appsecret: this.appSecret,
                                        },
                                    });

                                    if (corpTokenResponse.data.errcode === 0) {
                                        const corpAccessToken = corpTokenResponse.data.access_token;

                                        const detailResponse = await axios.post(
                                            'https://oapi.dingtalk.com/topapi/v2/user/get',
                                            {
                                                userid: userId,
                                            },
                                            {
                                                params: {
                                                    access_token: corpAccessToken,
                                                },
                                            }
                                        );

                                        if (detailResponse.data.errcode === 0 && detailResponse.data.result) {
                                            const userDetail = detailResponse.data.result;

                                            if (!userDetail.active) {
                                                throw new BadRequestException('该用户账号未激活，不是有效的企业内成员');
                                            }

                                            // 提取部门ID列表，确保转换为数字数组
                                            const rawDeptIdList = userDetail.dept_id_list || [];
                                            const deptIdList = Array.isArray(rawDeptIdList)
                                                ? rawDeptIdList.map(id => Number(id)).filter(id => !isNaN(id))
                                                : [];
                                            // 获取部门名称
                                            const deptNames = deptIdList.length > 0 ? await this.getDeptNames(deptIdList) : [];

                                            return {
                                                userId: userId,
                                                name: userDetail.name || userInfo.nick || userInfo.name || '',
                                                mobile: userDetail.mobile || userInfo.mobile || '',
                                                email: userDetail.email || userInfo.email || '',
                                                avatar: userDetail.avatar || userInfo.avatar || '',
                                                active: userDetail.active || false,
                                                isAdmin: userDetail.is_admin || false,
                                                isBoss: userDetail.is_boss || false,
                                                deptIdList: deptIdList,
                                                deptNames: deptNames,
                                            };
                                        }
                                    }
                                }

                                // 如果无法获取企业内详细信息，返回新版API返回的基本信息
                                return {
                                    userId: userId || 'unknown',
                                    name: userInfo.nick || userInfo.name || '',
                                    mobile: userInfo.mobile || '',
                                    email: userInfo.email || '',
                                    avatar: userInfo.avatar || '',
                                    active: true,
                                    isAdmin: false,
                                    isBoss: false,
                                    deptIdList: [],
                                    deptNames: [],
                                };
                            }
                        } catch (meError: any) {
                            console.error('[DingTalkService] 获取当前用户信息失败:', {
                                message: meError.message,
                                status: meError.response?.status,
                                data: meError.response?.data,
                            });
                            // 继续尝试其他方式
                        }

                        // 如果获取当前用户信息也失败，抛出错误，不再回退到旧版API
                        throw new BadRequestException('无法获取用户信息：响应中没有openId，且无法通过accessToken获取用户信息');
                    }

                    // 第二步：通过access_token和openId获取用户详细信息（新版API）
                    console.log('[DingTalkService] 步骤2: 调用新版API获取用户信息...');
                    console.log('[DingTalkService] 请求URL: https://api.dingtalk.com/v1.0/contact/users/' + openId);

                    let userInfoResponse;
                    try {
                        userInfoResponse = await axios.get(
                            `https://api.dingtalk.com/v1.0/contact/users/${openId}`,
                            {
                                headers: {
                                    'x-acs-dingtalk-access-token': userAccessToken,
                                },
                            }
                        );
                    } catch (axiosError: any) {
                        console.error('[DingTalkService] 获取用户信息请求失败:', {
                            message: axiosError.message,
                            status: axiosError.response?.status,
                            statusText: axiosError.response?.statusText,
                            data: axiosError.response?.data,
                            fullError: JSON.stringify(axiosError.response?.data || axiosError.message),
                        });
                        throw axiosError;
                    }

                    console.log('[DingTalkService] 新版OAuth2.0获取用户信息响应状态:', userInfoResponse.status);
                    console.log('[DingTalkService] 新版OAuth2.0获取用户信息响应数据:', {
                        hasBody: !!userInfoResponse.data,
                        fullResponse: JSON.stringify(userInfoResponse.data),
                    });

                    if (userInfoResponse.data) {
                        const userInfo = userInfoResponse.data;
                        const userId = userInfo.userId || openId;

                        // 如果有userId，尝试获取企业内用户的详细信息
                        if (userId && userId !== openId) {
                            // 获取企业应用access_token来查询用户详情
                            const corpTokenResponse = await axios.get('https://oapi.dingtalk.com/gettoken', {
                                params: {
                                    appkey: this.appKey,
                                    appsecret: this.appSecret,
                                },
                            });

                            if (corpTokenResponse.data.errcode === 0) {
                                const corpAccessToken = corpTokenResponse.data.access_token;

                                const detailResponse = await axios.post(
                                    'https://oapi.dingtalk.com/topapi/v2/user/get',
                                    {
                                        userid: userId,
                                    },
                                    {
                                        params: {
                                            access_token: corpAccessToken,
                                        },
                                    }
                                );

                                if (detailResponse.data.errcode === 0 && detailResponse.data.result) {
                                    const userDetail = detailResponse.data.result;

                                    if (!userDetail.active) {
                                        throw new BadRequestException('该用户账号未激活，不是有效的企业内成员');
                                    }

                                    // 提取部门ID列表，确保转换为数字数组
                                    const rawDeptIdList = userDetail.dept_id_list || [];
                                    const deptIdList = Array.isArray(rawDeptIdList)
                                        ? rawDeptIdList.map(id => Number(id)).filter(id => !isNaN(id))
                                        : [];
                                    // 获取部门名称
                                    const deptNames = deptIdList.length > 0 ? await this.getDeptNames(deptIdList) : [];

                                    return {
                                        userId: userId,
                                        name: userDetail.name || userInfo.nick || '',
                                        mobile: userDetail.mobile || userInfo.mobile || '',
                                        email: userDetail.email || userInfo.email || '',
                                        avatar: userDetail.avatar || userInfo.avatar || '',
                                        active: userDetail.active || false,
                                        isAdmin: userDetail.is_admin || false,
                                        isBoss: userDetail.is_boss || false,
                                        deptIdList: deptIdList,
                                        deptNames: deptNames,
                                    };
                                }
                            }
                        }

                        // 如果无法获取企业内详细信息，返回新版API返回的基本信息
                        return {
                            userId: userId || openId,
                            name: userInfo.nick || userInfo.name || '',
                            mobile: userInfo.mobile || '',
                            email: userInfo.email || '',
                            avatar: userInfo.avatar || '',
                            active: true,
                            isAdmin: false,
                            isBoss: false,
                            deptIdList: [],
                            deptNames: [],
                        };
                    }
                } else {
                    console.error('[DingTalkService] ✗ 新版OAuth2.0 userAccessToken失败 - 响应中没有accessToken');
                    console.error('[DingTalkService] 完整响应数据:', JSON.stringify(oauthTokenResponse.data, null, 2));
                    console.error('[DingTalkService] 响应状态码:', oauthTokenResponse.status);
                    console.error('[DingTalkService] 响应头:', JSON.stringify(oauthTokenResponse.headers));

                    const errorMsg = oauthTokenResponse.data?.message || oauthTokenResponse.data?.error || '未知错误';
                    throw new BadRequestException(`获取access_token失败: ${errorMsg} (响应: ${JSON.stringify(oauthTokenResponse.data)})`);
                }

                console.log('[DingTalkService] 新版OAuth2.0流程失败，尝试企业内应用流程...');
            } catch (oauthError: any) {
                console.error('[DingTalkService] ========== 新版OAuth2.0流程异常 ==========');
                console.error('[DingTalkService] 错误类型:', oauthError.constructor.name);
                console.error('[DingTalkService] 错误消息:', oauthError.message);
                console.error('[DingTalkService] 错误堆栈:', oauthError.stack);

                if (oauthError.response) {
                    console.error('[DingTalkService] HTTP响应状态:', oauthError.response.status, oauthError.response.statusText);
                    console.error('[DingTalkService] HTTP响应数据:', JSON.stringify(oauthError.response.data, null, 2));
                    console.error('[DingTalkService] HTTP响应头:', JSON.stringify(oauthError.response.headers));
                }

                if (oauthError.request) {
                    console.error('[DingTalkService] 请求配置:', {
                        url: oauthError.config?.url,
                        method: oauthError.config?.method,
                        headers: oauthError.config?.headers,
                    });
                }

                console.error('[DingTalkService] ===========================================');

                // 重要：新版API已经使用了code，不能再用同一个code调用旧版API
                // 直接抛出错误，不再尝试旧流程
                if (oauthError instanceof BadRequestException) {
                    // 如果是业务异常（如"未获取到用户openId"），直接抛出
                    throw oauthError;
                }

                // 如果是HTTP错误，提取错误信息
                if (oauthError.response?.status) {
                    const errorMsg = oauthError.response.data?.message ||
                        oauthError.response.data?.error ||
                        oauthError.message ||
                        '未知错误';
                    const statusCode = oauthError.response.status;
                    throw new BadRequestException(`新版OAuth2.0流程失败 (HTTP ${statusCode}): ${errorMsg}`);
                }

                // 如果是网络错误或其他错误，也直接抛出
                throw new BadRequestException(`新版OAuth2.0流程失败: ${oauthError.message}`);
            }

            // 企业内应用流程（兼容旧方式）
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
                fullResponse: JSON.stringify(userResponse.data),
            });

            if (userResponse.data.errcode !== 0) {
                console.error('[DingTalkService] 获取用户信息失败:', {
                    errcode: userResponse.data.errcode,
                    errmsg: userResponse.data.errmsg,
                    fullResponse: JSON.stringify(userResponse.data),
                });
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

            // 提取部门ID列表，确保转换为数字数组
            const rawDeptIdList = userDetail.dept_id_list || [];
            const deptIdList = Array.isArray(rawDeptIdList)
                ? rawDeptIdList.map(id => Number(id)).filter(id => !isNaN(id))
                : [];
            // 获取部门名称
            const deptNames = deptIdList.length > 0 ? await this.getDeptNames(deptIdList) : [];

            return {
                userId: userInfo.userid,
                name: userDetail.name || '',
                mobile: userDetail.mobile || '',
                email: userDetail.email || '',
                avatar: userDetail.avatar || '',
                active: userDetail.active || false,
                isAdmin: userDetail.is_admin || false,
                isBoss: userDetail.is_boss || false,
                deptIdList: deptIdList,
                deptNames: deptNames,
            };
        } catch (error: any) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(`钉钉认证失败: ${error.message}`);
        }
    }

    /**
     * 获取部门详情（根据部门ID列表获取部门名称）
     * 类似Java方法：public List<String> getDeptNames(List<Long> deptIds)
     */
    async getDeptNames(deptIds: number[]): Promise<string[]> {
        if (!deptIds || deptIds.length === 0) {
            return [];
        }

        if (!this.appKey || !this.appSecret) {
            return [];
        }

        try {
            // 获取企业应用access_token
            const tokenResponse = await axios.get('https://oapi.dingtalk.com/gettoken', {
                params: {
                    appkey: this.appKey,
                    appsecret: this.appSecret,
                },
            });

            if (tokenResponse.data.errcode !== 0) {
                console.warn('[DingTalkService] 获取access_token失败，无法获取部门信息');
                return [];
            }

            const accessToken = tokenResponse.data.access_token;
            const deptNames: string[] = [];

            // 批量获取部门信息
            for (const deptId of deptIds) {
                try {
                    const deptResponse = await axios.post(
                        'https://oapi.dingtalk.com/topapi/v2/department/get',
                        {
                            dept_id: deptId,
                        },
                        {
                            params: {
                                access_token: accessToken,
                            },
                        }
                    );

                    if (deptResponse.data.errcode === 0 && deptResponse.data.result) {
                        deptNames.push(deptResponse.data.result.name || `部门${deptId}`);
                    }
                } catch (error) {
                    console.warn(`[DingTalkService] 获取部门${deptId}信息失败:`, error);
                }
            }

            return deptNames;
        } catch (error) {
            console.warn('[DingTalkService] 获取部门信息失败:', error);
            return [];
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
    deptIdList?: number[]; // 用户所在部门的ID列表
    deptNames?: string[]; // 用户所在部门的名称列表（可选，需要额外调用API获取）
}

