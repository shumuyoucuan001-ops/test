"use client";

import { StoreRejectionItem, storeRejectionApi } from "@/lib/api";
import { MailOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Card, Input, Space } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ResponsiveTable from "./ResponsiveTable";

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
    const [filters, setFilters] = useState<{
        store?: string;
        productName?: string;
        skuId?: string;
        upc?: string;
        purchaseOrderNo?: string;
        receiptNo?: string;
    }>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    // 记录每个按钮的最后点击时间，key: rowKey_actionType (如: "xxx_rejection" 或 "xxx_rejectionAll")
    const buttonClickTimesRef = useRef<Record<string, number>>({});
    // 记录每个按钮的禁用状态
    const [buttonDisabled, setButtonDisabled] = useState<Record<string, boolean>>({});

    const load = async (
        searchFilters?: {
            store?: string;
            productName?: string;
            skuId?: string;
            upc?: string;
            purchaseOrderNo?: string;
            receiptNo?: string;
        },
        page: number = currentPage,
        limit: number = pageSize
    ) => {
        setLoading(true);
        try {
            // 过滤掉空值
            const activeFilters = searchFilters ? Object.fromEntries(
                Object.entries(searchFilters).filter(([_, v]) => v && v.trim())
            ) : undefined;
            console.log('Loading data with params:', { filters: activeFilters, page, limit });
            const res = await storeRejectionApi.list(activeFilters, page, limit);
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
        load(filters, currentPage, pageSize);
    }, [currentPage, pageSize]);

    const handleSearch = () => {
        setCurrentPage(1);
        load(filters, 1, pageSize);
    };

    const handleReset = () => {
        setFilters({});
        setCurrentPage(1);
        load(undefined, 1, pageSize);
    };

    const updateFilter = (key: keyof typeof filters, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleSendRejectionEmail = useCallback(async (item: StoreRejectionItem) => {
        const rowKey = `${item["采购单号"]}_${item["sku_id"]}_${item["门店/仓"]}`;
        const buttonKey = `${rowKey}_rejection`;
        const now = Date.now();
        const lastClickTime = buttonClickTimesRef.current[buttonKey];

        // 检查是否在一分钟内重复点击
        if (lastClickTime && now - lastClickTime < 60000) {
            message.warning('请勿在一分钟内重复点击');
            return;
        }

        // 设置按钮为禁用状态
        setButtonDisabled(prev => ({ ...prev, [buttonKey]: true }));
        // 记录点击时间
        buttonClickTimesRef.current[buttonKey] = now;

        // 一分钟后恢复按钮
        setTimeout(() => {
            setButtonDisabled(prev => ({ ...prev, [buttonKey]: false }));
        }, 60000);

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

    const handleSendRejectionAllEmail = useCallback(async (item: StoreRejectionItem) => {
        const rowKey = `${item["采购单号"]}_${item["sku_id"]}_${item["门店/仓"]}`;
        const buttonKey = `${rowKey}_rejectionAll`;
        const now = Date.now();
        const lastClickTime = buttonClickTimesRef.current[buttonKey];

        // 检查是否在一分钟内重复点击
        if (lastClickTime && now - lastClickTime < 60000) {
            message.warning('请勿在一分钟内重复点击');
            return;
        }

        // 设置按钮为禁用状态
        setButtonDisabled(prev => ({ ...prev, [buttonKey]: true }));
        // 记录点击时间
        buttonClickTimesRef.current[buttonKey] = now;

        // 一分钟后恢复按钮
        setTimeout(() => {
            setButtonDisabled(prev => ({ ...prev, [buttonKey]: false }));
        }, 60000);

        try {
            const result = await storeRejectionApi.sendRejectionAllEmail(item);
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
            console.error('Send rejection all email error:', error);
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
            width: 300,
            render: (_: any, record: StoreRejectionItem) => {
                const rowKey = `${record["采购单号"]}_${record["sku_id"]}_${record["门店/仓"]}`;
                const rejectionButtonKey = `${rowKey}_rejection`;
                const rejectionAllButtonKey = `${rowKey}_rejectionAll`;
                return (
                    <Space>
                        <Button
                            type="primary"
                            size="small"
                            icon={<MailOutlined />}
                            onClick={() => handleSendRejectionEmail(record)}
                            disabled={buttonDisabled[rejectionButtonKey] || false}
                        >
                            驳回差异单
                        </Button>
                        <Button
                            type="default"
                            size="small"
                            icon={<MailOutlined />}
                            onClick={() => handleSendRejectionAllEmail(record)}
                            disabled={buttonDisabled[rejectionAllButtonKey] || false}
                        >
                            驳回全部
                        </Button>
                        <span style={{ color: '#999', fontSize: '9px' }}>驳回该收货单所有上报商品</span>
                    </Space>
                );
            },
        };

        return [...dataColumns, actionColumn];
    }, [handleSendRejectionEmail, handleSendRejectionAllEmail, buttonDisabled]);

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="门店管理 - 驳回差异单"
                extra={
                    <Space>
                        <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                        <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                    </Space>
                }
            >
                <div style={{ marginBottom: 16, padding: '16px', background: '#f5f5f5', borderRadius: '4px' }}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Space wrap>
                            <Input
                                allowClear
                                placeholder="门店/仓"
                                value={filters.store || ''}
                                onChange={e => updateFilter('store', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="商品名称"
                                value={filters.productName || ''}
                                onChange={e => updateFilter('productName', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="SKU编码"
                                value={filters.skuId || ''}
                                onChange={e => updateFilter('skuId', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="UPC"
                                value={filters.upc || ''}
                                onChange={e => updateFilter('upc', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="采购单号"
                                value={filters.purchaseOrderNo || ''}
                                onChange={e => updateFilter('purchaseOrderNo', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="关联收货单号"
                                value={filters.receiptNo || ''}
                                onChange={e => updateFilter('receiptNo', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                        </Space>
                    </Space>
                </div>
                <ResponsiveTable<StoreRejectionItem>
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

