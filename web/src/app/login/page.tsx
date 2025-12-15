"use client";

import { aclApi, dingTalkApi } from "@/lib/api";
import { Button, Card, Divider, Form, Input, message, Space } from "antd";
import { useEffect, useState } from "react";

// Logo 组件 - 用代码生成的logo（支持颜色自定义）
const LogoIcon = ({ size = 24, color = "#ffffff", orangeColor = "#ff6b35" }: { size?: number; color?: string; orangeColor?: string }) => {
  const viewBox = 32;
  const centerX = viewBox / 2;
  const centerY = viewBox / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      style={{ display: 'block' }}
    >
      {/* 中央垂直条 */}
      <rect
        x={centerX - 1.5}
        y={centerY - 8}
        width={3}
        height={16}
        fill={color}
      />

      {/* 左侧波浪线 - 上 */}
      <path
        d={`M ${centerX - 7} ${centerY - 3} Q ${centerX - 4.5} ${centerY - 5}, ${centerX - 1.5} ${centerY - 3}`}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* 左侧波浪线 - 下 */}
      <path
        d={`M ${centerX - 7} ${centerY + 3} Q ${centerX - 4.5} ${centerY + 1}, ${centerX - 1.5} ${centerY + 3}`}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* 右侧波浪线 - 上 */}
      <path
        d={`M ${centerX + 1.5} ${centerY - 3} Q ${centerX + 4.5} ${centerY - 1}, ${centerX + 7} ${centerY - 3}`}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* 右侧波浪线 - 下 */}
      <path
        d={`M ${centerX + 1.5} ${centerY + 3} Q ${centerX + 4.5} ${centerY + 5}, ${centerX + 7} ${centerY + 3}`}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* 右上角橙色弧形装饰 */}
      <path
        d={`M ${centerX + 2.6} ${centerY - 7} Q ${centerX + 4.8} ${centerY - 5}, ${centerX + 7} ${centerY - 7}`}
        stroke={orangeColor}
        strokeWidth="2.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [dingTalkLoading, setDingTalkLoading] = useState(false);
  const [form] = Form.useForm();
  // React 19 + antd v5: 使用 useMessage，避免静态 message 触发兼容告警
  const [msgApi, contextHolder] = message.useMessage();

  const handleDingTalkCallback = async (code: string) => {
    try {
      setDingTalkLoading(true);
      msgApi.loading('正在验证钉钉身份并登录...', 0); // 0表示不自动关闭

      // 调用自动登录接口
      const result = await dingTalkApi.autoLogin(code, 'dingtalk_web');

      if (result.success) {
        // 保存用户信息和token
        localStorage.setItem('userId', String(result.id));
        localStorage.setItem('displayName', result.display_name || '');
        localStorage.setItem('sessionToken', result.token || '');

        msgApi.success('钉钉登录成功，正在跳转...');

        // 延迟一下让用户看到成功消息，然后跳转
        setTimeout(() => {
          window.location.href = '/home';
        }, 500);
      } else {
        msgApi.error('钉钉登录失败');
        setDingTalkLoading(false);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '钉钉登录失败';
      msgApi.error(msg);
      setDingTalkLoading(false);
    }
  };

  // 检查URL参数中是否有钉钉回调的code
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // 检查是否有错误参数（钉钉回调时可能返回的错误）
    if (error || errorDescription) {
      let errorMsg = '钉钉登录失败';
      if (errorDescription) {
        errorMsg = decodeURIComponent(errorDescription);
      } else if (error) {
        errorMsg = `钉钉登录失败: ${error}`;
      }

      // 针对常见错误提供更友好的提示
      if (errorMsg.includes('无权限') || errorMsg.includes('url参数不合法')) {
        errorMsg = '钉钉登录失败：url参数不合法\n\n可能的原因：\n1. 钉钉开放平台未配置安全域名\n2. 回调地址配置不匹配\n3. 应用未发布或权限未授权\n\n请检查钉钉开放平台配置，确保：\n- 已添加安全域名\n- 回调地址与配置一致\n- 应用已发布并授权';
      }

      msgApi.error({
        content: errorMsg,
        duration: 8,
      });

      // 清除URL中的错误参数
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      newUrl.searchParams.delete('error_description');
      window.history.replaceState({}, '', newUrl.toString());
      return;
    }

    if (code) {
      // 处理钉钉回调
      handleDingTalkCallback(code);

      // 清除URL中的code和authCode参数（authCode是钉钉自动添加的冗余参数）
      // 避免刷新页面时重复处理
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('code');
      newUrl.searchParams.delete('authCode');
      newUrl.searchParams.delete('state');
      window.history.replaceState({}, '', newUrl.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDingTalkLogin = async () => {
    try {
      setDingTalkLoading(true);
      console.log('[LoginPage] 开始获取钉钉授权URL...');
      const result = await dingTalkApi.getAuthUrl('login');
      console.log('[LoginPage] 获取到的响应:', result);

      // 检查响应格式
      if (!result || !result.url) {
        console.error('[LoginPage] 响应格式错误，缺少 url 字段:', result);
        msgApi.error({
          content: '获取钉钉授权地址失败：响应格式错误。请检查后端服务配置。',
          duration: 5,
        });
        setDingTalkLoading(false);
        return;
      }

      console.log('[LoginPage] 准备跳转到钉钉授权页面:', result.url);
      // 跳转到钉钉授权页面
      window.location.href = result.url;
    } catch (e: any) {
      console.error('[LoginPage] 获取钉钉授权URL失败:', e);
      console.error('[LoginPage] 错误详情:', {
        message: e?.message,
        response: e?.response,
        responseData: e?.response?.data,
        status: e?.response?.status,
      });

      const errorMsg = e?.response?.data?.message || e?.message || '获取钉钉授权地址失败';

      // 提供更详细的错误提示
      let detailedMsg = errorMsg;
      if (errorMsg.includes('配置不完整') || errorMsg.includes('未配置')) {
        detailedMsg = `${errorMsg}\n\n请检查 server/.env 文件中的钉钉配置项。`;
      } else if (errorMsg.includes('回调地址')) {
        detailedMsg = `${errorMsg}\n\n请确保 DINGTALK_REDIRECT_URI 与钉钉开放平台配置的回调地址完全一致。`;
      }

      msgApi.error({
        content: detailedMsg,
        duration: 6,
      });
      setDingTalkLoading(false);
    }
  };

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      setLoading(true);

      // 获取钉钉code（如果有）
      const dingTalkCode = v.dingTalkCode;

      console.log('[LoginPage] 开始登录，用户名:', v.username);
      console.log('[LoginPage] 登录请求参数:', { username: v.username, hasPassword: !!v.password, hasDingTalkCode: !!dingTalkCode });

      const u = await aclApi.login(v.username, v.password, dingTalkCode);

      console.log('[LoginPage] 登录成功，用户信息:', u);
      localStorage.setItem('userId', String(u.id));
      localStorage.setItem('displayName', u.display_name || '');
      localStorage.setItem('sessionToken', u.token || '');
      msgApi.success('登录成功');
      location.href = '/home';
    } catch (e: any) {
      console.error('[LoginPage] 登录失败，完整错误信息:');
      console.error('[LoginPage] 错误对象:', e);
      console.error('[LoginPage] 错误消息:', e?.message);
      console.error('[LoginPage] 错误响应状态:', e?.response?.status);
      console.error('[LoginPage] 错误响应数据:', e?.response?.data);
      console.error('[LoginPage] 错误响应头:', e?.response?.headers);
      console.error('[LoginPage] 请求URL:', e?.config?.url);
      console.error('[LoginPage] 请求方法:', e?.config?.method);
      console.error('[LoginPage] 请求数据:', e?.config?.data);

      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || '登录失败';
      const status = e?.response?.status;

      // 根据错误状态码提供更友好的提示
      let errorMessage = msg;
      if (status === 500) {
        errorMessage = `登录失败（服务器错误 500）：${msg}\n\n请检查后端控制台是否有错误日志`;
      } else if (status === 503) {
        errorMessage = `登录失败（服务不可用）：${msg}\n\n请确认后端服务是否正在运行`;
      } else if (status === 504) {
        errorMessage = `登录失败（请求超时）：${msg}`;
      }

      msgApi.error({
        content: errorMessage,
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      {contextHolder}
      <Card
        title={
          <Space size={8} style={{ display: 'flex', alignItems: 'center' }}>
            <span>登录到术木优选</span>
            <LogoIcon size={30} color="#18478A" orangeColor="#ff6b35" />
          </Space>
        }
        style={{ width: 400 }}
      >
        <Form layout="vertical" form={form} onFinish={onSubmit}>
          {/* 隐藏字段：存储钉钉code */}
          <Form.Item name="dingTalkCode" hidden>
            <Input />
          </Form.Item>

          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input autoFocus placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
          </Form.Item>

          <Divider>或</Divider>

          <Form.Item>
            <Button
              type="default"
              onClick={handleDingTalkLogin}
              loading={dingTalkLoading}
              block
              style={{
                backgroundColor: '#1C82FF',
                color: 'white',
                borderColor: '#1C82FF'
              }}
            >
              钉钉企业登录
            </Button>
          </Form.Item>

          <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '8px' }}>
            使用钉钉企业账号登录，仅限企业内成员
          </div>
        </Form>
      </Card>
    </div>
  );
}


