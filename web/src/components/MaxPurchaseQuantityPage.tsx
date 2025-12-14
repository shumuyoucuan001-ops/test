"use client";

import { MaxPurchaseQuantityItem, maxPurchaseQuantityApi } from "@/lib/api";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

const fieldLabels: Record<keyof MaxPurchaseQuantityItem, string> = {
    "仓店名称": "仓店名称",
    "SKU": "SKU",
    "单次最高采购量(基本单位)": "单次最高采购量(基本单位)",
    "修改人": "修改人",
};

export default function MaxPurchaseQuantityPage() {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [data, setData] = useState<MaxPurchaseQuantityItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [storeNames, setStoreNames] = useState<string[]>([]);
    const [loadingStoreNames, setLoadingStoreNames] = useState(false);
    const [filters, setFilters] = useState<{
        storeName?: string;
        sku?: string;
        maxQuantity?: string;
        modifier?: string;
    }>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<MaxPurchaseQuantityItem | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    // 加载门店名称列表
    const loadStoreNames = useCallback(async () => {
        setLoadingStoreNames(true);
        try {
            const names = await maxPurchaseQuantityApi.getStoreNames();
            setStoreNames(names);
        } catch (e: any) {
            message.error("加载门店名称失败: " + (e?.message || '未知错误'));
        } finally {
            setLoadingStoreNames(false);
        }
    }, [message]);

    useEffect(() => {
        loadStoreNames();
    }, [loadStoreNames]);

    const load = useCallback(async (
        searchFilters?: {
            storeName?: string;
            sku?: string;
            maxQuantity?: string;
            modifier?: string;
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
            const res = await maxPurchaseQuantityApi.list(activeFilters, page, limit);
            setData(res?.data || []);
            setTotal(res?.total || 0);
        } catch (e: any) {
            message.error("加载失败: " + (e?.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, message]);

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

    const handleAdd = () => {
        setEditingRecord(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record: MaxPurchaseQuantityItem) => {
        setEditingRecord(record);
        form.setFieldsValue({
            storeName: record['仓店名称'],
            sku: record['SKU'],
            maxQuantity: record['单次最高采购量(基本单位)'],
        });
        setModalVisible(true);
    };

    const handleDelete = async (record: MaxPurchaseQuantityItem) => {
        try {
            await maxPurchaseQuantityApi.delete({
                storeName: record['仓店名称'],
                sku: record['SKU'],
            });
            message.success("删除成功");
            load(filters, currentPage, pageSize);
        } catch (e: any) {
            message.error("删除失败: " + (e?.message || '未知错误'));
            console.error(e);
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            setModalLoading(true);

            if (editingRecord) {
                // 更新
                await maxPurchaseQuantityApi.update(
                    {
                        storeName: editingRecord['仓店名称'],
                        sku: editingRecord['SKU'],
                    },
                    {
                        storeName: values.storeName,
                        sku: values.sku,
                        maxQuantity: values.maxQuantity,
                    }
                );
                message.success('更新成功');
            } else {
                // 新增
                await maxPurchaseQuantityApi.create({
                    storeName: values.storeName,
                    sku: values.sku,
                    maxQuantity: values.maxQuantity,
                });
                message.success('创建成功');
            }

            setModalVisible(false);
            form.resetFields();
            load(filters, currentPage, pageSize);
        } catch (error: any) {
            if (error?.errorFields) {
                // 表单验证错误
                return;
            }
            message.error((editingRecord ? '更新' : '创建') + '失败: ' + (error?.message || '未知错误'));
        } finally {
            setModalLoading(false);
        }
    };

    const handleModalCancel = () => {
        setModalVisible(false);
        form.resetFields();
        setEditingRecord(null);
    };

    const columns = useMemo(() => {
        const dataColumns = (Object.keys(fieldLabels) as (keyof MaxPurchaseQuantityItem)[]).map((key) => ({
            title: fieldLabels[key],
            dataIndex: key,
            key,
        }));

        // 添加操作列
        const actionColumn = {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: any, record: MaxPurchaseQuantityItem) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    <Popconfirm
                        title="确认删除？"
                        onConfirm={() => handleDelete(record)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                        >
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        };

        return [...dataColumns, actionColumn];
    }, []);

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="门店管理 - 单次最高采购量"
                extra={
                    <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            新增
                        </Button>
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
                                placeholder="仓店名称"
                                value={filters.storeName || ''}
                                onChange={e => updateFilter('storeName', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="SKU"
                                value={filters.sku || ''}
                                onChange={e => updateFilter('sku', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="单次最高采购量(基本单位)"
                                value={filters.maxQuantity || ''}
                                onChange={e => updateFilter('maxQuantity', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 200 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="修改人"
                                value={filters.modifier || ''}
                                onChange={e => updateFilter('modifier', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                        </Space>
                    </Space>
                </div>
                <Table
                    columns={columns as any}
                    dataSource={data}
                    rowKey={(r) => `${r["仓店名称"]}_${r["SKU"]}`}
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

            <Modal
                title={editingRecord ? '编辑记录' : '新增记录'}
                open={modalVisible}
                onOk={handleModalOk}
                onCancel={handleModalCancel}
                okText="确定"
                cancelText="取消"
                confirmLoading={modalLoading}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        maxQuantity: 0,
                    }}
                >
                    <Form.Item
                        label="仓店名称"
                        name="storeName"
                        rules={[
                            { required: true, message: '仓店名称不能为空' },
                        ]}
                    >
                        <Select
                            placeholder="请选择仓店名称"
                            loading={loadingStoreNames}
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={storeNames.map(name => ({ label: name, value: name }))}
                        />
                    </Form.Item>
                    <Form.Item
                        label="SKU"
                        name="sku"
                        rules={[
                            { required: true, message: 'SKU不能为空' },
                        ]}
                    >
                        <Input placeholder="请输入SKU" />
                    </Form.Item>
                    <Form.Item
                        label="单次最高采购量(基本单位)"
                        name="maxQuantity"
                        rules={[
                            { required: true, message: '单次最高采购量(基本单位)不能为空' },
                            { type: 'number', min: 0, message: '单次最高采购量(基本单位)必须大于等于0' },
                        ]}
                    >
                        <InputNumber
                            placeholder="请输入单次最高采购量(基本单位)"
                            style={{ width: '100%' }}
                            min={0}
                            precision={0}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

