"use client";

import { SupplierConversionRelationItem, supplierConversionRelationApi } from "@/lib/api";
import { formatDateTime } from "@/lib/dateUtils";
import { showErrorBoth } from "@/lib/errorUtils";
import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Popover, Space, message } from "antd";
import { ColumnType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import BatchAddModal, { FieldConfig } from "./BatchAddModal";
import ColumnSettings from "./ColumnSettings";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof SupplierConversionRelationItem, string> = {
    "供应商编码": "供应商编码",
    "*SKU编码": "SKU编码",
    "二次换算关系": "二次换算关系",
    "数据更新时间": "数据更新时间",
};

export default function SupplierConversionRelationPage() {
    const [data, setData] = useState<SupplierConversionRelationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<SupplierConversionRelationItem | null>(null);
    const [form] = Form.useForm<SupplierConversionRelationItem>();
    const [isMobile, setIsMobile] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchFilters, setSearchFilters] = useState<{
        供应商编码?: string;
        '*SKU编码'?: string;
        二次换算关系?: string;
    }>({});
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

    // 从 localStorage 加载列显示偏好和顺序
    useEffect(() => {
        const savedHiddenColumns = localStorage.getItem('supplier_conversion_relation_hidden_columns');
        if (savedHiddenColumns) {
            try {
                const parsed = JSON.parse(savedHiddenColumns);
                setHiddenColumns(new Set(parsed));
            } catch (error) {
                console.error('加载列显示偏好失败:', error);
            }
        }

        const savedColumnOrder = localStorage.getItem('supplier_conversion_relation_column_order');
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
            localStorage.setItem('supplier_conversion_relation_hidden_columns', JSON.stringify(Array.from(hidden)));
        } catch (error) {
            console.error('保存列显示偏好失败:', error);
        }
    };

    // 保存列顺序到 localStorage
    const saveColumnOrder = (order: string[]) => {
        try {
            localStorage.setItem('supplier_conversion_relation_column_order', JSON.stringify(order));
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

    // 移动列位置
    const moveColumn = (columnKey: string, direction: 'up' | 'down') => {
        const getDefaultOrder = (): string[] => {
            return columns
                .filter(col => {
                    const key = col.key as string;
                    return key !== 'selection' && key !== 'action';
                })
                .map(col => col.key as string);
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

    // 检测移动端
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const load = async (overrideParams?: {
        page?: number;
        keyword?: string;
        filters?: typeof searchFilters;
    }) => {
        setLoading(true);
        try {
            const finalPage = overrideParams?.page !== undefined ? overrideParams.page : currentPage;
            const finalKeyword = overrideParams?.keyword !== undefined
                ? (overrideParams.keyword === '' ? undefined : overrideParams.keyword)
                : (searchText || undefined);
            const finalFilters = overrideParams?.filters !== undefined
                ? overrideParams.filters
                : searchFilters;

            const cleanFilters = Object.fromEntries(
                Object.entries(finalFilters).filter(([_, v]) => v !== undefined && v !== null && v !== '')
            );

            const res = await supplierConversionRelationApi.list({
                ...cleanFilters,
                keyword: finalKeyword,
                page: finalPage,
                limit: pageSize,
            });

            if (Array.isArray(res)) {
                setData(res || []);
                setTotal(res?.length || 0);
            } else if (res && typeof res === 'object') {
                setData(res?.data || []);
                setTotal(res?.total || 0);
            } else {
                setData([]);
                setTotal(0);
            }
            setSelectedRowKeys([]);
        } catch (e) {
            message.error("加载失败");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageSize]);

    const handleSearch = () => {
        setCurrentPage(1);
        load({
            page: 1,
            keyword: searchText || undefined,
            filters: searchFilters,
        });
    };

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        setModalOpen(true);
    };

    const openEdit = (record: SupplierConversionRelationItem) => {
        setEditing(record);
        const formValues: any = {
            ...record,
        };
        form.setFieldsValue(formValues);
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const submitData: SupplierConversionRelationItem = {
                '供应商编码': values['供应商编码']?.trim() || '',
                '*SKU编码': values['*SKU编码']?.trim() || '',
                '二次换算关系': values['二次换算关系']?.trim() || '',
                '数据更新时间': null, // 由数据库自动更新
            };
            if (editing) {
                await supplierConversionRelationApi.update(editing, submitData);
                message.success("更新成功");
            } else {
                await supplierConversionRelationApi.create(submitData);
                message.success("新增成功");
            }
            setModalOpen(false);
            load();
        } catch (e: any) {
            if (e?.errorFields) return;

            console.error('[SupplierConversionRelationPage] 保存失败，错误详情:', {
                error: e,
                hasResponse: !!e?.response,
                responseStatus: e?.response?.status,
                responseData: e?.response?.data,
                errorMessage: e?.message,
                errorStack: e?.stack,
            });

            try {
                showErrorBoth(e, '保存失败');
            } catch (showError) {
                console.error('[SupplierConversionRelationPage] 显示错误提示失败:', showError);
                alert('保存失败: ' + (e?.response?.data?.message || e?.message || '未知错误'));
            }
        }
    };

    const handleDelete = async (record: SupplierConversionRelationItem) => {
        try {
            await supplierConversionRelationApi.remove(record);
            message.success("删除成功");
            load();
        } catch (e) {
            message.error("删除失败");
            console.error(e);
        }
    };

    const getRowKey = (record: SupplierConversionRelationItem): string => {
        return `${record['供应商编码']}_${record['*SKU编码']}`;
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请至少选择一条记录');
            return;
        }

        try {
            const selectedItems = data.filter(item => selectedRowKeys.includes(getRowKey(item)));
            const result = await supplierConversionRelationApi.batchDelete(selectedItems);
            message.success(result.message || `成功删除 ${result.deletedCount} 条记录`);
            setSelectedRowKeys([]);
            load();
        } catch (error: any) {
            message.error(error?.response?.data?.message || error?.message || '批量删除失败');
            console.error(error);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRowKeys(data.map(item => getRowKey(item)));
        } else {
            setSelectedRowKeys([]);
        }
    };

    const handleSelect = (record: SupplierConversionRelationItem, checked: boolean) => {
        const rowKey = getRowKey(record);
        if (checked) {
            setSelectedRowKeys([...selectedRowKeys, rowKey]);
        } else {
            setSelectedRowKeys(selectedRowKeys.filter(key => key !== rowKey));
        }
    };

    const openBatchCreate = () => {
        setBatchModalOpen(true);
    };

    // 批量新增字段配置
    const batchAddFields: FieldConfig<SupplierConversionRelationItem>[] = [
        {
            key: '供应商编码',
            label: '供应商编码',
            excelHeaderName: '供应商编码', // Excel表头名称，必须完全一致
            required: true,
            index: 0,
        },
        {
            key: '*SKU编码',
            label: 'SKU编码',
            excelHeaderName: 'SKU编码', // Excel表头名称，必须完全一致
            required: true,
            index: 1,
        },
        {
            key: '二次换算关系',
            label: '二次换算关系',
            excelHeaderName: '二次换算关系', // Excel表头名称，必须完全一致
            required: true,
            index: 2,
        },
    ];

    // 创建数据项
    const createBatchItem = useCallback((parts: string[]): Partial<SupplierConversionRelationItem> => {
        return {
            '供应商编码': parts[0] || '',
            '*SKU编码': parts[1] || '',
            '二次换算关系': parts[2] || '',
            '数据更新时间': null,
        };
    }, []);

    // 批量保存
    const handleBatchSave = useCallback(async (validItems: SupplierConversionRelationItem[]) => {
        try {
            const result = await supplierConversionRelationApi.batchCreate(validItems);
            message.success(result.message);
            if (result.errors && result.errors.length > 0) {
                message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
            }
            setBatchModalOpen(false);
            load();
        } catch (e: any) {
            showErrorBoth(e, '批量创建失败');
            console.error('批量创建失败:', e);
        }
    }, []);

    const columns = useMemo(() => {
        const selectionCol = {
            title: (
                <Checkbox
                    checked={selectedRowKeys.length > 0 && selectedRowKeys.length === data.length}
                    indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < data.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                />
            ),
            key: 'selection',
            width: 60,
            fixed: 'left' as const,
            render: (_: any, record: SupplierConversionRelationItem) => (
                <Checkbox
                    checked={selectedRowKeys.includes(getRowKey(record))}
                    onChange={(e) => handleSelect(record, e.target.checked)}
                />
            ),
        };

        const baseCols: ColumnType<SupplierConversionRelationItem>[] = [
            {
                title: '供应商编码',
                dataIndex: '供应商编码',
                key: '供应商编码',
                width: 150,
                fixed: 'left',
            },
            {
                title: 'SKU编码',
                dataIndex: '*SKU编码',
                key: '*SKU编码',
                width: 220,
                fixed: 'left',
            },
            {
                title: '二次换算关系',
                dataIndex: '二次换算关系',
                key: '二次换算关系',
                width: 200,
                ellipsis: true,
            },
            {
                title: '数据更新时间',
                dataIndex: '数据更新时间',
                key: '数据更新时间',
                width: 180,
                render: (text: string) => formatDateTime(text),
            },
        ];

        const actionCol = {
            title: "操作",
            key: "action" as const,
            width: 140,
            fixed: 'right' as const,
            render: (_: any, record: SupplierConversionRelationItem) => (
                <Space>
                    <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
                    <Popconfirm
                        title="确认删除？"
                        onConfirm={() => handleDelete(record)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                </Space>
            ),
        };

        return [selectionCol, ...baseCols, actionCol];
    }, [data, selectedRowKeys]);

    // 获取可配置的列（排除 selection 和 action）
    const configurableColumns = columns.filter(col => {
        const key = col.key as string;
        return key !== 'selection' && key !== 'action';
    });

    // 获取默认列顺序
    const getDefaultColumnOrder = (): string[] => {
        return configurableColumns.map(col => col.key as string);
    };

    // 获取列顺序
    const defaultOrder = getDefaultColumnOrder();
    const currentColumnOrder = columnOrder.length > 0 ? columnOrder : defaultOrder;

    // 初始化列顺序
    useEffect(() => {
        if (columnOrder.length === 0 && defaultOrder.length > 0) {
            const savedOrder = localStorage.getItem('supplier_conversion_relation_column_order');
            if (!savedOrder) {
                const order = getDefaultColumnOrder();
                saveColumnOrder(order);
                setColumnOrder(order);
            } else {
                try {
                    const parsed = JSON.parse(savedOrder);
                    const mergedOrder = [...parsed];
                    const defaultKeys = defaultOrder;
                    defaultKeys.forEach(key => {
                        if (!mergedOrder.includes(key)) {
                            mergedOrder.push(key);
                        }
                    });
                    const validOrder = mergedOrder.filter(key => defaultKeys.includes(key));
                    if (JSON.stringify(validOrder) !== JSON.stringify(parsed)) {
                        saveColumnOrder(validOrder);
                        setColumnOrder(validOrder);
                    } else {
                        setColumnOrder(parsed);
                    }
                } catch (error) {
                    console.error('加载列顺序失败:', error);
                    const order = getDefaultColumnOrder();
                    saveColumnOrder(order);
                    setColumnOrder(order);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 根据顺序和隐藏状态排序列
    const sortedColumns = [
        columns.find(col => col.key === 'selection'),
        ...currentColumnOrder
            .map(key => configurableColumns.find(col => col.key === key))
            .filter(Boolean) as ColumnType<SupplierConversionRelationItem>[],
        columns.find(col => col.key === 'action'),
    ].filter(Boolean) as ColumnType<SupplierConversionRelationItem>[];

    // 过滤列
    const visibleColumns = sortedColumns.filter(col => {
        const key = col.key as string;
        if (key === 'selection' || key === 'action') {
            return true;
        }
        return !hiddenColumns.has(key);
    });

    // 列设置内容使用独立组件
    const columnSettingsContent = (
        <ColumnSettings
            columns={columns}
            hiddenColumns={hiddenColumns}
            columnOrder={currentColumnOrder}
            onToggleVisibility={toggleColumnVisibility}
            onMoveColumn={moveColumn}
            onColumnOrderChange={(newOrder) => {
                setColumnOrder(newOrder);
                saveColumnOrder(newOrder);
            }}
        />
    );

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="采购管理 - 供应商推送换算关系变更"
                extra={
                    isMobile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <Input
                                placeholder="供应商编码"
                                style={{ width: '100%' }}
                                value={searchFilters.供应商编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 供应商编码: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="SKU编码"
                                style={{ width: '100%' }}
                                value={searchFilters['*SKU编码']}
                                onChange={(e) => setSearchFilters({ ...searchFilters, '*SKU编码': e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="二次换算关系"
                                style={{ width: '100%' }}
                                value={searchFilters.二次换算关系}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 二次换算关系: e.target.value })}
                                allowClear
                            />
                            <Input.Search
                                placeholder="总搜索（全字段）"
                                style={{ width: '100%' }}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onSearch={handleSearch}
                                allowClear
                            />
                            <Space style={{ width: '100%' }}>
                                <Button type="primary" onClick={handleSearch} style={{ flex: 1 }}>搜索</Button>
                                <Button onClick={() => {
                                    setSearchText('');
                                    setSearchFilters({});
                                    setCurrentPage(1);
                                    setSelectedRowKeys([]);
                                    load({
                                        page: 1,
                                        keyword: '',
                                        filters: {}
                                    });
                                }} style={{ flex: 1 }}>重置</Button>
                            </Space>
                            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block>新增</Button>
                            <Button type="primary" icon={<PlusOutlined />} onClick={openBatchCreate} block>批量新增</Button>
                            <Popover
                                content={columnSettingsContent}
                                title={null}
                                trigger="click"
                                open={columnSettingsOpen}
                                onOpenChange={setColumnSettingsOpen}
                                placement="bottomRight"
                            >
                                <Button icon={<SettingOutlined />} block>列设置</Button>
                            </Popover>
                            {selectedRowKeys.length > 0 && (
                                <Popconfirm
                                    title="确认批量删除？"
                                    description={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`}
                                    onConfirm={handleBatchDelete}
                                    okText="确定"
                                    cancelText="取消"
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button danger block>
                                        批量删除 ({selectedRowKeys.length})
                                    </Button>
                                </Popconfirm>
                            )}
                        </div>
                    ) : (
                        <Space wrap>
                            <Input
                                placeholder="供应商编码"
                                style={{ width: 150 }}
                                value={searchFilters.供应商编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 供应商编码: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="SKU编码"
                                style={{ width: 150 }}
                                value={searchFilters['*SKU编码']}
                                onChange={(e) => setSearchFilters({ ...searchFilters, '*SKU编码': e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="二次换算关系"
                                style={{ width: 150 }}
                                value={searchFilters.二次换算关系}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 二次换算关系: e.target.value })}
                                allowClear
                            />
                            <Input.Search
                                placeholder="总搜索（全字段）"
                                style={{ width: 200 }}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onSearch={handleSearch}
                                allowClear
                            />
                            <Button type="primary" onClick={handleSearch}>搜索</Button>
                            <Button onClick={() => {
                                setSearchText('');
                                setSearchFilters({});
                                setCurrentPage(1);
                                setSelectedRowKeys([]);
                                load({
                                    page: 1,
                                    keyword: '',
                                    filters: {}
                                });
                            }}>重置</Button>
                            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增</Button>
                            <Button type="primary" icon={<PlusOutlined />} onClick={openBatchCreate}>批量新增</Button>
                            <Popover
                                content={columnSettingsContent}
                                title={null}
                                trigger="click"
                                open={columnSettingsOpen}
                                onOpenChange={setColumnSettingsOpen}
                                placement="bottomRight"
                            >
                                <Button icon={<SettingOutlined />}>列设置</Button>
                            </Popover>
                            {selectedRowKeys.length > 0 && (
                                <Popconfirm
                                    title="确认批量删除？"
                                    description={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`}
                                    onConfirm={handleBatchDelete}
                                    okText="确定"
                                    cancelText="取消"
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button danger>
                                        批量删除 ({selectedRowKeys.length})
                                    </Button>
                                </Popconfirm>
                            )}
                        </Space>
                    )
                }
            >
                <ResponsiveTable<SupplierConversionRelationItem>
                    tableId="supplier-conversion-relation"
                    columns={visibleColumns as any}
                    dataSource={data}
                    rowKey={getRowKey}
                    loading={loading}
                    scroll={{ x: 1200, y: 600 }}
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
                open={modalOpen}
                title={editing ? "编辑记录" : "新增记录"}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText="确定"
                cancelText="取消"
                destroyOnClose
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="供应商编码" label="供应商编码" rules={[{ required: true, message: "请输入供应商编码" }]}>
                        <Input
                            maxLength={20}
                            disabled={!!editing}
                        />
                    </Form.Item>
                    <Form.Item name="*SKU编码" label="SKU编码" rules={[{ required: true, message: "请输入SKU编码" }]}>
                        <Input
                            maxLength={50}
                            disabled={!!editing}
                        />
                    </Form.Item>
                    <Form.Item name="二次换算关系" label="二次换算关系" rules={[{ required: true, message: "请输入二次换算关系" }]}>
                        <Input
                            maxLength={50}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增弹窗 */}
            <BatchAddModal<SupplierConversionRelationItem>
                open={batchModalOpen}
                title="批量新增记录"
                hint="您可以从 Excel 中复制数据（包含供应商编码、SKU编码、二次换算关系列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件"
                fields={batchAddFields}
                formatHint="格式：供应商编码	SKU编码	二次换算关系"
                example="SUP001	SKU001	1:10"
                onCancel={() => setBatchModalOpen(false)}
                onSave={handleBatchSave}
                createItem={createBatchItem}
            />
        </div>
    );
}

