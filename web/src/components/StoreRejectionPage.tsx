"use client";

import { StoreRejectionItem, storeRejectionApi } from "@/lib/api";
import { MailOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Card, Input, Space, Table } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

const fieldLabels: Record<keyof StoreRejectionItem, string> = {
    "门店/仓": "门店/仓",
    "商品名称": "商品名称",
    "sku_id": "SKU编码",
    "upc": "UPC",
    "采购单号": "采购单号",
    "关联收货单号": "关联收货单号",
};

export default function StoreRejectionPage() {
    const { message } = App.useApp();
    const [data, setData] = useState<StoreRejectionItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const load = async (keyword?: string, page: number = currentPage, limit: number = pageSize) => {
        setLoading(true);
        try {
            const searchKeyword = keyword?.trim() || undefined;
            console.log('Loading data with params:', { searchKeyword, page, limit });
            const res = await storeRejectionApi.list(searchKeyword, page, limit);
            console.log('API response:', res);
            console.log('API response type:', typeof res, 'isArray:', Array.isArray(res));
            // 处理返回格式：可能是 { data, total } 或直接是数组
            if (Array.isArray(res)) {
                // 如果返回的是数组，说明后端没有正确应用分页或格式不对
                console.warn('API returned array instead of { data, total } object');
                setData(res || []);
                setTotal(res?.length || 0);
            } else if (res && typeof res === 'object') {
                setData(res?.data || []);
                setTotal(res?.total || 0);
            } else {
                setData([]);
                setTotal(0);
            }
        } catch (e: any) {
            message.error("加载失败: " + (e?.message || '未知错误'));
            console.error('Load error details:', e);
            if (e?.response) {
                console.error('Response data:', e.response.data);
                console.error('Response status:', e.response.status);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(q, currentPage, pageSize);
    }, [currentPage, pageSize]);

    const handleSearch = () => {
        setCurrentPage(1);
        load(q.trim(), 1, pageSize);
    };

    const handleSendRejectionEmail = useCallback(async (item: StoreRejectionItem) => {
        try {
            const result = await storeRejectionApi.sendRejectionEmail(item);
            if (result.success) {
                message.success('邮件发送成功');
            } else {
                // 显示详细的错误信息，支持多行
                const errorMsg = result.message || '邮件发送失败';
                if (errorMsg.includes('\n')) {
                    // 如果是多行错误，使用更详细的显示方式
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
        }
    }, [message]);

    const columns = useMemo(() => {
        const dataColumns = (Object.keys(fieldLabels) as (keyof StoreRejectionItem)[]).map((key) => ({
            title: fieldLabels[key],
            dataIndex: key,
            key,
        }));

        // 添加操作列
        const actionColumn = {
            title: '操作',
            key: 'action',
            width: 120,
            render: (_: any, record: StoreRejectionItem) => (
                <Button
                    type="primary"
                    size="small"
                    icon={<MailOutlined />}
                    onClick={() => handleSendRejectionEmail(record)}
                >
                    驳回差异单
                </Button>
            ),
        };

        return [...dataColumns, actionColumn];
    }, [handleSendRejectionEmail]);

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="门店管理(测试) - 驳回差异单"
                extra={
                    <Space>
                        <Input
                            allowClear
                            placeholder="搜索相关信息"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            onPressEnter={handleSearch}
                            style={{ width: 240 }}
                            prefix={<SearchOutlined />}
                        />
                        <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                        <Button icon={<ReloadOutlined />} onClick={() => { setQ(''); setCurrentPage(1); load(undefined, 1, pageSize); }}>刷新</Button>
                    </Space>
                }
            >
                <Table
                    columns={columns as any}
                    dataSource={data}
                    rowKey={(r) => `${r["采购单号"]}_${r["sku_id"]}_${r["门店/仓"]}`}
                    loading={loading}
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: total,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50'],
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, size) => {
                            setCurrentPage(page);
                            if (size && size !== pageSize) {
                                setPageSize(size);
                            }
                        },
                        onShowSizeChange: (_current, size) => {
                            setPageSize(size);
                            setCurrentPage(1);
                        },
                    }}
                />
            </Card>
        </div>
    );
}

