"use client";

import { aclApi, dingTalkApi } from "@/lib/api";
import { Button, Card, Divider, Form, Input, message } from "antd";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [dingTalkLoading, setDingTalkLoading] = useState(false);
  const [form] = Form.useForm();
  // React 19 + antd v5: 使用 useMessage，避免静态 message 触发兼容告警
  const [msgApi, contextHolder] = message.useMessage();

  const handleDingTalkCallback = async (code: string) => {
    try {
      setDingTalkLoading(true);
      msgApi.loading('正在验证钉钉身份...');

      // 验证钉钉用户信息
      const result = await dingTalkApi.callback(code);

      if (result.success) {
        msgApi.success('钉钉验证成功，请继续输入用户名和密码');
        // 将钉钉code存储到表单中，登录时一起提交
        form.setFieldsValue({ dingTalkCode: code });
      } else {
        msgApi.error('钉钉验证失败');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '钉钉验证失败';
      msgApi.error(msg);
    } finally {
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

      const u = await aclApi.login(v.username, v.password, dingTalkCode);
      localStorage.setItem('userId', String(u.id));
      localStorage.setItem('displayName', u.display_name || '');
      localStorage.setItem('sessionToken', u.token || '');
      msgApi.success('登录成功');
      location.href = '/home';
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '登录失败';
      msgApi.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      {contextHolder}
      <Card title="登录到术木优选" style={{ width: 400 }}>
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


