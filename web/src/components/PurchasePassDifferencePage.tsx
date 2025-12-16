"use client";

import { purchasePassDifferenceApi } from "@/lib/api";
import { MailOutlined } from "@ant-design/icons";
import { App, Button, Card, Input, Space, Table, message as antdMessage } from "antd";
import { useCallback, useState } from "react";

interface TableDataItem {
    key: number;
    value: string;
}

export default function PurchasePassDifferencePage() {
    const { message } = App.useApp();
    const [data, setData] = useState<TableDataItem[]>([]);
    const [loading, setLoading] = useState(false);

    // 处理粘贴事件
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');

        // 将粘贴的内容按行分割，过滤空行
        const lines = pastedText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            antdMessage.warning('粘贴的内容为空');
            return;
        }

        // 转换为表格数据
        const newData = lines.map((line, index) => ({
            key: Date.now() + index,
            value: line,
        }));

        setData(prev => [...prev, ...newData]);
        antdMessage.success(`已粘贴 ${lines.length} 条数据`);

        // 清空输入框
        const target = e.target as HTMLTextAreaElement;
        if (target) {
            target.value = '';
        }
    }, []);

    // 发送邮件
    const handleSendEmail = useCallback(async () => {
        if (data.length === 0) {
            message.warning('请先粘贴数据到表格中');
            return;
        }

        try {
            setLoading(true);
            const items = data.map(item => item.value);
            const result = await purchasePassDifferenceApi.sendEmail(items);
            if (result.success) {
                message.success('邮件发送成功');
            } else {
                const errorMsg = result.message || '邮件发送失败';
                if (errorMsg.includes('\n')) {
                    message.error({
                        content: errorMsg.split('\n').map((line, idx) => (
                            <div key={idx}>{line}</div>
                        )),
                        duration: 8,
                    });
                } else {
                    message.error(errorMsg);
                }
            }
        } catch (error: any) {
            const errorMsg = error?.response?.data?.message || error?.message || '未知错误';
            if (errorMsg.includes('\n')) {
                message.error({
                    content: errorMsg.split('\n').map((line: string, idx: number) => (
                        <div key={idx}>{line}</div>
                    )),
                    duration: 8,
                });
            } else {
                message.error('邮件发送失败: ' + errorMsg);
            }
            console.error('Send email error:', error);
        } finally {
            setLoading(false);
        }
    }, [data, message]);

    // 清空数据
    const handleClear = useCallback(() => {
        setData([]);
        message.success('已清空数据');
    }, [message]);

    // 删除单行
    const handleDelete = useCallback((key: number) => {
        setData(prev => prev.filter(item => item.key !== key));
    }, []);

    const columns = [
        {
            title: '数据',
            dataIndex: 'value',
            key: 'value',
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: any, record: TableDataItem) => (
                <Button
                    type="link"
                    danger
                    size="small"
                    onClick={() => handleDelete(record.key)}
                >
                    删除
                </Button>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="采购管理 - 采购通过差异单"
                extra={
                    <Space>
                        <Button onClick={handleClear}>清空</Button>
                        <Button
                            type="primary"
                            icon={<MailOutlined />}
                            onClick={handleSendEmail}
                            loading={loading}
                            disabled={data.length === 0}
                        >
                            通过差异单
                        </Button>
                    </Space>
                }
            >
                <div
                    style={{
                        marginBottom: 16,
                        padding: '16px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <div style={{ marginBottom: 8, color: '#666' }}>
                        提示：您可以从 Excel 中复制一列数据，然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）
                    </div>
                    <Input.TextArea
                        placeholder="在此处粘贴 Excel 数据（Ctrl+V），支持多行数据，每行一个"
                        rows={4}
                        onPaste={handlePaste}
                        style={{
                            fontFamily: 'monospace',
                        }}
                    />
                </div>
                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="key"
                    pagination={{
                        pageSize: 50,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50', '100'],
                        showTotal: (total) => `共 ${total} 条记录`,
                    }}
                />
            </Card>
        </div>
    );
}

