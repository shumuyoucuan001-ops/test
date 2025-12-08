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

  // 检查URL参数中是否有钉钉回调的code
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code) {
      // 处理钉钉回调
      handleDingTalkCallback(code);
    }
  }, []);

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

  const handleDingTalkLogin = async () => {
    try {
      setDingTalkLoading(true);
      const result = await dingTalkApi.getAuthUrl('login');
      // 跳转到钉钉授权页面
      window.location.href = result.url;
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '获取钉钉授权地址失败';
      msgApi.error(msg);
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


