"use client";

import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';
import { MaxStoreSkuInventoryItem, maxStoreSkuInventoryApi, productMasterApi } from "@/lib/api";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from "@ant-design/icons";
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Popover, Select, Space, Tag } from "antd";
import { ColumnType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BatchAddModal, { FieldConfig } from "./BatchAddModal";
import ColumnSettings from "./ColumnSettings";
import ExcelExportModal, { ExcelExportField } from "./ExcelExportModal";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof MaxStoreSkuInventoryItem, string> = {
    "仓店名称": "仓店名称",
    "SKU编码": "SKU编码",
    "最高库存量（基础单位）": "最高库存量（基础单位）",
    "备注（说明设置原因）": "备注（说明设置原因）",
    "修改人": "修改人",
    "商品名称": "商品名称",
    "商品UPC": "商品UPC",
    "规格": "规格",
    "采购单价 (基础单位)": "采购单价 (基础单位)",
    "采购单价 (采购单位)": "采购单价 (采购单位)",
};

// 页面唯一标识符
const PAGE_KEY = 'max-store-sku-inventory';

export default function MaxStoreSkuInventoryPage() {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    
    // 定义默认状态
    const defaultState = {
        currentPage: 1,
        pageSize: 20,
        filters: {} as {
            storeName?: string;
            sku?: string;
            maxInventory?: string;
            remark?: string;
            modifier?: string;
        },
    };
    
    // 恢复保存的状态
    const restoredState = usePageStateRestore(PAGE_KEY, defaultState);
    
    const [data, setData] = useState<MaxStoreSkuInventoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [storeNames, setStoreNames] = useState<string[]>([]);
    const [loadingStoreNames, setLoadingStoreNames] = useState(false);
    const [filters, setFilters] = useState<{
        storeName?: string;
        sku?: string;
        maxInventory?: string;
        remark?: string;
        modifier?: string;
    }>(restoredState?.filters ?? defaultState.filters);
    const [currentPage, setCurrentPage] = useState(restoredState?.currentPage ?? defaultState.currentPage);
    const [pageSize, setPageSize] = useState(restoredState?.pageSize ?? defaultState.pageSize);
    
    // 保存状态（自动保存，防抖 300ms）
    usePageStateSave(PAGE_KEY, {
        currentPage,
        pageSize,
        filters,
    });
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<MaxStoreSkuInventoryItem | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
    const [batchModalVisible, setBatchModalVisible] = useState(false);
    const [exportModalVisible, setExportModalVisible] = useState(false);

    // 从 localStorage 加载列显示偏好和顺序
    useEffect(() => {
        const savedHiddenColumns = localStorage.getItem('max_store_sku_inventory_hidden_columns');
        if (savedHiddenColumns) {
            try {
                const parsed = JSON.parse(savedHiddenColumns);
                setHiddenColumns(new Set(parsed));
            } catch (error) {
                console.error('加载列显示偏好失败:', error);
            }
        }

        const savedColumnOrder = localStorage.getItem('max_store_sku_inventory_column_order');
        if (savedColumnOrder) {
            try {
                const parsed = JSON.parse(savedColumnOrder);
                setColumnOrder(parsed);
            } catch (error) {
                console.error('加载列顺序失败:', error);
            }
        }
    }, []);

    // 保存列显示偏好到 localStorage
    const saveHiddenColumns = (hidden: Set<string>) => {
        try {
            localStorage.setItem('max_store_sku_inventory_hidden_columns', JSON.stringify(Array.from(hidden)));
        } catch (error) {
            console.error('保存列显示偏好失败:', error);
        }
    };

    // 保存列顺序到 localStorage
    const saveColumnOrder = (order: string[]) => {
        try {
            localStorage.setItem('max_store_sku_inventory_column_order', JSON.stringify(order));
        } catch (error) {
            console.error('保存列顺序失败:', error);
        }
    };

    // 切换列的显示/隐藏
    const toggleColumnVisibility = (columnKey: string) => {
        const newHidden = new Set(hiddenColumns);
        if (newHidden.has(columnKey)) {
            newHidden.delete(columnKey);
        } else {
            newHidden.add(columnKey);
        }
        setHiddenColumns(newHidden);
        saveHiddenColumns(newHidden);
    };

    // 基础列定义（包含所有列，不进行过滤）
    const baseColumns = useMemo(() => {
        return [
            {
                title: '仓店名称',
                dataIndex: '仓店名称',
                key: '仓店名称',
                width: 200,
            },
            {
                title: 'SKU编码',
                dataIndex: 'SKU编码',
                key: 'SKU编码',
                width: 220,
                fixed: 'left',
            },
            {
                title: (
                    <span>
                        商品名称{' '}
                        <Tag color="blue" style={{ marginLeft: 4 }}>自动匹配</Tag>
                    </span>
                ),
                dataIndex: '商品名称',
                key: '商品名称',
                width: 200,
                ellipsis: true,
            },
            {
                title: (
                    <span>
                        采购单价 (基础单位){' '}
                        <Tag color="blue" style={{ marginLeft: 4 }}>自动匹配</Tag>
                    </span>
                ),
                dataIndex: '采购单价 (基础单位)',
                key: '采购单价 (基础单位)',
                width: 150,
                render: (value: any) => value !== null && value !== undefined ? Number(value).toFixed(2) : '-',
            },
            {
                title: (
                    <span>
                        采购单价 (采购单位){' '}
                        <Tag color="blue" style={{ marginLeft: 4 }}>自动匹配</Tag>
                    </span>
                ),
                dataIndex: '采购单价 (采购单位)',
                key: '采购单价 (采购单位)',
                width: 150,
                render: (value: any) => value !== null && value !== undefined ? Number(value).toFixed(2) : '-',
            },
            {
                title: (
                    <span>
                        商品UPC{' '}
                        <Tag color="blue" style={{ marginLeft: 4 }}>自动匹配</Tag>
                    </span>
                ),
                dataIndex: '商品UPC',
                key: '商品UPC',
                width: 180,
                ellipsis: true,
            },
            {
                title: (
                    <span>
                        规格{' '}
                        <Tag color="blue" style={{ marginLeft: 4 }}>自动匹配</Tag>
                    </span>
                ),
                dataIndex: '规格',
                key: '规格',
                width: 150,
                ellipsis: true,
            },
            {
                title: '最高库存量（基础单位）',
                dataIndex: '最高库存量（基础单位）',
                key: '最高库存量（基础单位）',
                width: 180,
            },
            {
                title: '备注（说明设置原因）',
                dataIndex: '备注（说明设置原因）',
                key: '备注（说明设置原因）',
                width: 250,
                ellipsis: true,
            },
            {
                title: '修改人',
                dataIndex: '修改人',
                key: '修改人',
                width: 120,
            },
        ] as ColumnType<MaxStoreSkuInventoryItem>[];
    }, []);

    // 移动列位置
    const moveColumn = (columnKey: string, direction: 'up' | 'down') => {
        const getDefaultOrder = (): string[] => {
            return baseColumns.map(col => col.key as string);
        };

        const currentOrder = columnOrder.length > 0 ? [...columnOrder] : getDefaultOrder();
        const index = currentOrder.indexOf(columnKey);

        if (index === -1) return;

        if (direction === 'up' && index > 0) {
            [currentOrder[index], currentOrder[index - 1]] = [currentOrder[index - 1], currentOrder[index]];
        } else if (direction === 'down' && index < currentOrder.length - 1) {
            [currentOrder[index], currentOrder[index + 1]] = [currentOrder[index + 1], currentOrder[index]];
        }

        setColumnOrder(currentOrder);
        saveColumnOrder(currentOrder);
    };

    // 直接设置列顺序（用于拖拽）
    const handleColumnOrderChange = (newOrder: string[]) => {
        setColumnOrder(newOrder);
        saveColumnOrder(newOrder);
    };

    // 加载门店名称列表
    const loadStoreNames = useCallback(async () => {
        setLoadingStoreNames(true);
        try {
            const names = await maxStoreSkuInventoryApi.getStoreNames();
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

    const load = async (
        searchFilters?: {
            storeName?: string;
            sku?: string;
            maxInventory?: string;
            remark?: string;
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
            const res = await maxStoreSkuInventoryApi.list(activeFilters, page, limit);
            setData(res?.data || []);
            setTotal(res?.total || 0);
        } catch (e: any) {
            message.error("加载失败: " + (e?.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    // 使用 ref 标记是否已经初始加载
    const hasInitialLoadRef = useRef(false);

    // 如果恢复了状态，需要重新加载数据（只在组件挂载时执行一次）
    useEffect(() => {
        if (!hasInitialLoadRef.current) {
            hasInitialLoadRef.current = true;
            load(filters, currentPage, pageSize);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 只在组件挂载时执行一次

    // 当 currentPage 或 pageSize 变化时加载数据（排除初始加载）
    useEffect(() => {
        if (hasInitialLoadRef.current) {
            load(filters, currentPage, pageSize);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const handleEdit = (record: MaxStoreSkuInventoryItem) => {
        setEditingRecord(record);
        form.setFieldsValue({
            storeName: record['仓店名称'],
            sku: record['SKU编码'],
            maxInventory: record['最高库存量（基础单位）'],
            remark: record['备注（说明设置原因）'],
            '商品名称': record['商品名称'],
            '商品UPC': record['商品UPC'],
            '规格': record['规格'],
            '采购单价 (基础单位)': record['采购单价 (基础单位)'],
            '采购单价 (采购单位)': record['采购单价 (采购单位)'],
        });
        setModalVisible(true);
    };

    const handleDelete = async (record: MaxStoreSkuInventoryItem) => {
        try {
            await maxStoreSkuInventoryApi.delete({
                storeName: record['仓店名称'],
                sku: record['SKU编码'],
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
                await maxStoreSkuInventoryApi.update(
                    {
                        storeName: editingRecord['仓店名称'],
                        sku: editingRecord['SKU编码'],
                    },
                    {
                        storeName: values.storeName,
                        sku: values.sku,
                        maxInventory: values.maxInventory,
                        remark: values.remark,
                    }
                );
                message.success('更新成功');
            } else {
                // 新增
                await maxStoreSkuInventoryApi.create({
                    storeName: values.storeName,
                    sku: values.sku,
                    maxInventory: values.maxInventory,
                    remark: values.remark,
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
            // 提取后端返回的错误消息
            let errorMessage = '未知错误';
            if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error?.message) {
                errorMessage = error.message;
            }
            message.error((editingRecord ? '更新' : '创建') + '失败: ' + errorMessage);
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
        // 根据列顺序和隐藏状态过滤列
        const getDefaultOrder = (): string[] => {
            return baseColumns.map(col => col.key as string);
        };
        const currentOrder = columnOrder.length > 0 ? columnOrder : getDefaultOrder();
        const orderedCols = currentOrder
            .map(key => baseColumns.find(col => col.key === key))
            .filter((col): col is ColumnType<MaxStoreSkuInventoryItem> => col !== undefined && !hiddenColumns.has(col.key as string));

        // 添加操作列
        const actionColumn = {
            title: '操作',
            key: 'action',
            width: 150,
            fixed: 'right' as const,
            render: (_: any, record: MaxStoreSkuInventoryItem) => (
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

        return [...orderedCols, actionColumn];
    }, [hiddenColumns, columnOrder, baseColumns]);

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="门店管理 - 仓店sku最高库存"
                extra={
                    <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            新增
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setBatchModalVisible(true)}>
                            批量新增
                        </Button>
                        <Button onClick={() => setExportModalVisible(true)}>导出数据</Button>
                        <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                        <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                        <Popover
                            content={
                                <ColumnSettings
                                    columns={baseColumns}
                                    hiddenColumns={hiddenColumns}
                                    columnOrder={columnOrder}
                                    onToggleVisibility={toggleColumnVisibility}
                                    onMoveColumn={moveColumn}
                                    onColumnOrderChange={handleColumnOrderChange}
                                />
                            }
                            title="列设置"
                            trigger="click"
                            open={columnSettingsOpen}
                            onOpenChange={setColumnSettingsOpen}
                            placement="bottomRight"
                        >
                            <Button icon={<SettingOutlined />}>列设置</Button>
                        </Popover>
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
                                placeholder="SKU编码"
                                value={filters.sku || ''}
                                onChange={e => updateFilter('sku', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 180 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="最高库存量（基础单位）"
                                value={filters.maxInventory || ''}
                                onChange={e => updateFilter('maxInventory', e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ width: 200 }}
                                prefix={<SearchOutlined />}
                            />
                            <Input
                                allowClear
                                placeholder="备注（说明设置原因）"
                                value={filters.remark || ''}
                                onChange={e => updateFilter('remark', e.target.value)}
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
                <ResponsiveTable<MaxStoreSkuInventoryItem>
                    tableId="max-store-sku-inventory"
                    columns={columns as any}
                    dataSource={data}
                    rowKey={(r) => `${r["仓店名称"]}_${r["SKU编码"]}`}
                    loading={loading}
                    scroll={{ x: 2500, y: 600 }}
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
                        maxInventory: 0,
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
                        label="SKU编码"
                        name="sku"
                        rules={[
                            { required: true, message: 'SKU编码不能为空' },
                        ]}
                    >
                        <Input
                            placeholder="请输入SKU编码"
                            disabled={!!editingRecord}
                            onChange={async (e) => {
                                if (!editingRecord) {
                                    const sku = e.target.value.trim();
                                    if (sku.length === 19) {
                                        try {
                                            const productInfo = await productMasterApi.getProductInfo(sku);
                                            if (productInfo) {
                                                form.setFieldsValue({
                                                    '商品名称': productInfo.productName,
                                                    '商品UPC': productInfo.productCode,
                                                    '规格': productInfo.specName,
                                                    '采购单价 (基础单位)': productInfo.purchasePriceBase,
                                                    '采购单价 (采购单位)': productInfo.purchasePriceUnit,
                                                });
                                            }
                                        } catch (error) {
                                            console.error('查询商品信息失败:', error);
                                        }
                                    }
                                }
                            }}
                        />
                    </Form.Item>
                    <Form.Item name="商品名称" label="商品名称">
                        <Input maxLength={200} disabled />
                    </Form.Item>
                    <Form.Item name="采购单价 (基础单位)" label="采购单价 (基础单位)">
                        <Input maxLength={200} disabled />
                    </Form.Item>
                    <Form.Item name="采购单价 (采购单位)" label="采购单价 (采购单位)">
                        <Input maxLength={200} disabled />
                    </Form.Item>
                    <Form.Item name="商品UPC" label="商品UPC">
                        <Input maxLength={200} disabled />
                    </Form.Item>
                    <Form.Item name="规格" label="规格">
                        <Input maxLength={200} disabled />
                    </Form.Item>
                    <Form.Item
                        label="最高库存量（基础单位）"
                        name="maxInventory"
                        rules={[
                            { required: true, message: '最高库存量（基础单位）不能为空' },
                            { type: 'number', min: 0, message: '最高库存量（基础单位）必须大于等于0' },
                        ]}
                    >
                        <InputNumber
                            placeholder="请输入最高库存量（基础单位）"
                            style={{ width: '100%' }}
                            min={0}
                            precision={0}
                        />
                    </Form.Item>
                    <Form.Item
                        label="备注（说明设置原因）"
                        name="remark"
                        rules={[
                            { required: true, message: '备注（说明设置原因）不能为空' },
                        ]}
                    >
                        <Input.TextArea
                            placeholder="请输入备注（说明设置原因）"
                            rows={4}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增模态框 */}
            <BatchAddModal<MaxStoreSkuInventoryItem>
                open={batchModalVisible}
                title="批量新增记录"
                hint="您可以从 Excel 中复制数据（包含仓店名称、SKU编码、最高库存量（基础单位）、备注（说明设置原因）列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件。"
                fields={useMemo<FieldConfig<MaxStoreSkuInventoryItem>[]>(() => ([
                    { key: '仓店名称', label: '仓店名称', excelHeaderName: '仓店名称', required: true, index: 0 },
                    { key: 'SKU编码', label: 'SKU编码', excelHeaderName: 'SKU编码', required: true, index: 1 },
                    { key: '最高库存量（基础单位）', label: '最高库存量（基础单位）', excelHeaderName: '最高库存量（基础单位）', required: true, index: 2 },
                    { key: '备注（说明设置原因）', label: '备注（说明设置原因）', excelHeaderName: '备注（说明设置原因）', required: true, index: 3 },
                ]), [])}
                formatHint="格式：仓店名称	SKU编码	最高库存量（基础单位）	备注（说明设置原因）"
                example="仓店A	SKU000000000000001	200	说明原因"
                onCancel={() => setBatchModalVisible(false)}
                onSave={useCallback(async (validItems: MaxStoreSkuInventoryItem[]) => {
                    try {
                        let success = 0;
                        let failed = 0;
                        const errors: string[] = [];
                        for (const item of validItems) {
                            try {
                                await maxStoreSkuInventoryApi.create({
                                    storeName: item['仓店名称'],
                                    sku: item['SKU编码'],
                                    maxInventory: Number(item['最高库存量（基础单位）'] || 0),
                                    remark: item['备注（说明设置原因）'] || '',
                                });
                                success++;
                            } catch (err: any) {
                                failed++;
                                errors.push(err?.response?.data?.message || err?.message || '未知错误');
                            }
                        }
                        if (success > 0) {
                            message.success(`批量新增成功 ${success} 条${failed > 0 ? `，失败 ${failed} 条` : ''}`);
                        }
                        if (failed > 0) {
                            message.warning(`有 ${failed} 条数据失败：${errors.slice(0, 3).join('；')}${errors.length > 3 ? '……' : ''}`);
                        }
                        load(filters, currentPage, pageSize);
                    } catch (e) {
                        message.error('批量新增失败');
                    }
                }, [filters, currentPage, pageSize])}
                createItem={useCallback((parts: string[]) => {
                    return {
                        '仓店名称': parts[0] || '',
                        'SKU编码': parts[1] || '',
                        '最高库存量（基础单位）': parts[2] ? Number(parts[2]) : 0,
                        '备注（说明设置原因）': parts[3] || '',
                    } as Partial<MaxStoreSkuInventoryItem>;
                }, [])}
            />

            {/* 导出数据模态框 */}
            <ExcelExportModal<MaxStoreSkuInventoryItem>
                open={exportModalVisible}
                title="导出仓店SKU最高库存数据"
                fields={useMemo<ExcelExportField[]>(() => ([
                    { key: '仓店名称', label: '仓店名称' },
                    { key: 'SKU编码', label: 'SKU编码' },
                    { key: '商品名称', label: '商品名称' },
                    { key: '商品UPC', label: '商品UPC' },
                    { key: '规格', label: '规格' },
                    { key: '采购单价 (基础单位)', label: '采购单价 (基础单位)' },
                    { key: '采购单价 (采购单位)', label: '采购单价 (采购单位)' },
                    { key: '最高库存量（基础单位）', label: '最高库存量（基础单位）' },
                    { key: '备注（说明设置原因）', label: '备注（说明设置原因）' },
                    { key: '修改人', label: '修改人' },
                ]), [])}
                selectedData={[]}
                fetchAllData={useCallback(async () => {
                    const all: MaxStoreSkuInventoryItem[] = [];
                    let page = 1;
                    const limit = 100000;
                    let total = 0;
                    // 使用当前筛选条件导出
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const res = await maxStoreSkuInventoryApi.list(filters, page, limit);
                        if (!res?.data) break;
                        all.push(...res.data);
                        total = res.total || 0;
                        // 如果已经获取了所有数据，或者返回的数据少于 limit，则停止
                        if (all.length >= total || res.data.length < limit) break;
                        page += 1;
                    }
                    return all;
                }, [filters])}
                onCancel={() => setExportModalVisible(false)}
                fileName="仓店SKU最高库存"
            />
        </div>
    );
}

