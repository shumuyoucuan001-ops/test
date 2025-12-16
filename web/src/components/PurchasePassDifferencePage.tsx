"use client";

import { purchasePassDifferenceApi } from "@/lib/api";
import { MailOutlined } from "@ant-design/icons";
import { App, Button, Card, Input, Space, Table, message as antdMessage } from "antd";
import { useCallback, useEffect, useState } from "react";

interface TableDataItem {
    key: number;
    value: string;
}

export default function PurchasePassDifferencePage() {
    const { message } = App.useApp();
    const [data, setData] = useState<TableDataItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // 检测移动端
    useEffect(() => {
        const checkMobile = () => {
            const width = window.innerWidth;
            // 更严格的移动端检测：小于768px或检测到移动设备
            const isMobileDevice = width < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobile(isMobileDevice);
            // 调试日志（生产环境可移除）
            if (process.env.NODE_ENV === 'development') {
                console.log('[PurchasePassDifferencePage] 移动端检测:', {
                    width,
                    isMobile: isMobileDevice,
                    userAgent: navigator.userAgent,
                });
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        // 监听方向变化
        window.addEventListener('orientationchange', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('orientationchange', checkMobile);
        };
    }, []);

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
            ellipsis: isMobile,
        },
        {
            title: '操作',
            key: 'action',
            width: isMobile ? 60 : 100,
            render: (_: any, record: TableDataItem) => (
                <Button
                    type="link"
                    danger
                    size="small"
                    onClick={() => handleDelete(record.key)}
                >
                    {isMobile ? '删' : '删除'}
                </Button>
            ),
        },
    ];

    return (
        <div style={{
            padding: isMobile ? 8 : 24,
            width: '100%',
            maxWidth: '100%',
            overflowX: 'hidden',
            boxSizing: 'border-box',
        }}>
            <Card
                title={<span style={{ fontSize: isMobile ? 14 : 16 }}>采购管理 - 采购通过差异单</span>}
                extra={
                    <Space size={isMobile ? 'small' : 'middle'} wrap={isMobile}>
                        <Button
                            size={isMobile ? 'small' : 'middle'}
                            onClick={handleClear}
                        >
                            清空
                        </Button>
                        <Button
                            type="primary"
                            icon={<MailOutlined />}
                            onClick={handleSendEmail}
                            loading={loading}
                            disabled={data.length === 0}
                            size={isMobile ? 'small' : 'middle'}
                        >
                            {isMobile ? '通过' : '通过差异单'}
                        </Button>
                    </Space>
                }
                style={{
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                }}
            >
                <div
                    style={{
                        marginBottom: 16,
                        padding: isMobile ? '12px' : '16px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <div style={{
                        marginBottom: 8,
                        color: '#666',
                        fontSize: isMobile ? 12 : 14,
                    }}>
                        提示：您可以从 Excel 中复制一列数据，然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）
                    </div>
                    <Input.TextArea
                        placeholder="在此处粘贴 Excel 数据（Ctrl+V），支持多行数据，每行一个"
                        rows={isMobile ? 3 : 4}
                        onPaste={handlePaste}
                        style={{
                            fontFamily: 'monospace',
                            fontSize: isMobile ? 12 : 14,
                        }}
                    />
                </div>
                {/* 移动端使用卡片式布局，桌面端使用表格 */}
                {isMobile ? (
                    <div style={{
                        width: '100%',
                        maxWidth: '100%',
                        overflowX: 'hidden',
                        boxSizing: 'border-box',
                    }}>
                        {data.length === 0 ? (
                            <div style={{
                                padding: 40,
                                textAlign: 'center',
                                color: '#999',
                                fontSize: 14
                            }}>
                                暂无数据，请粘贴数据到上方输入框
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                width: '100%',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                            }}>
                                {data.map((item) => (
                                    <Card
                                        key={item.key}
                                        size="small"
                                        style={{
                                            marginBottom: 0,
                                            borderRadius: 4,
                                            width: '100%',
                                            maxWidth: '100%',
                                            boxSizing: 'border-box',
                                            overflow: 'hidden',
                                        }}
                                        bodyStyle={{
                                            padding: '12px',
                                            width: '100%',
                                            maxWidth: '100%',
                                            boxSizing: 'border-box',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 8,
                                            width: '100%',
                                            maxWidth: '100%',
                                            boxSizing: 'border-box',
                                        }}>
                                            {/* 数据内容 */}
                                            <div style={{
                                                fontSize: 14,
                                                color: '#333',
                                                wordBreak: 'break-all',
                                                wordWrap: 'break-word',
                                                whiteSpace: 'normal',
                                                lineHeight: '1.5',
                                                width: '100%',
                                                maxWidth: '100%',
                                                overflowWrap: 'break-word',
                                                boxSizing: 'border-box',
                                            }}>
                                                {item.value}
                                            </div>
                                            {/* 操作按钮 */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                                paddingTop: 8,
                                                borderTop: '1px solid #f0f0f0',
                                                width: '100%',
                                                boxSizing: 'border-box',
                                            }}>
                                                <Button
                                                    type="link"
                                                    danger
                                                    size="small"
                                                    onClick={() => handleDelete(item.key)}
                                                    style={{
                                                        padding: '0 8px',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    删除
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                        {/* 移动端分页信息 */}
                        {data.length > 0 && (
                            <div style={{
                                marginTop: 16,
                                padding: '12px',
                                background: '#f5f5f5',
                                borderRadius: 4,
                                textAlign: 'center',
                                fontSize: 13,
                                color: '#666',
                                width: '100%',
                                boxSizing: 'border-box',
                            }}>
                                共 {data.length} 条记录
                            </div>
                        )}
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        dataSource={data}
                        rowKey="key"
                        size="middle"
                        pagination={{
                            pageSize: 50,
                            showSizeChanger: true,
                            pageSizeOptions: ['20', '50', '100'],
                            showTotal: (total) => `共 ${total} 条记录`,
                        }}
                    />
                )}
            </Card>
        </div>
    );
}

