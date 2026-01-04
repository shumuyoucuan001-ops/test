"use client";

import { SellerWangwangItem, sellerWangwangApi } from "@/lib/api";
import { showErrorBoth } from "@/lib/errorUtils";
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Popover, Space, message } from "antd";
import { ColumnType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import BatchAddModal, { FieldConfig } from "./BatchAddModal";
import ColumnSettings from "./ColumnSettings";
import ExcelExportModal, { ExcelExportField } from "./ExcelExportModal";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof SellerWangwangItem, string> = {
    "供应商编码": "供应商编码",
    "卖家旺旺": "卖家旺旺",
};

export default function SellerWangwangPage() {
    const [data, setData] = useState<SellerWangwangItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<SellerWangwangItem | null>(null);
    const [form] = Form.useForm<SellerWangwangItem>();
    const [isMobile, setIsMobile] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchFilters, setSearchFilters] = useState<{
        供应商编码?: string;
        卖家旺旺?: string;
    }>({});
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // 从 localStorage 加载列显示偏好和顺序
    useEffect(() => {
        const savedHiddenColumns = localStorage.getItem('seller_wangwang_hidden_columns');
        if (savedHiddenColumns) {
            try {
                const parsed = JSON.parse(savedHiddenColumns);
                setHiddenColumns(new Set(parsed));
            } catch (error) {
                console.error('加载列显示偏好失败:', error);
            }
        }

        const savedColumnOrder = localStorage.getItem('seller_wangwang_column_order');
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
            localStorage.setItem('seller_wangwang_hidden_columns', JSON.stringify(Array.from(hidden)));
        } catch (error) {
            console.error('保存列显示偏好失败:', error);
        }
    };

    // 保存列顺序到 localStorage
    const saveColumnOrder = (order: string[]) => {
        try {
            localStorage.setItem('seller_wangwang_column_order', JSON.stringify(order));
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

            const res = await sellerWangwangApi.list({
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

    const openEdit = (record: SellerWangwangItem) => {
        setEditing(record);
        form.setFieldsValue(record);
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const submitData: SellerWangwangItem = {
                '供应商编码': values['供应商编码']?.trim() || '',
                '卖家旺旺': values['卖家旺旺']?.trim() || '',
            };
            if (editing) {
                await sellerWangwangApi.update(editing, submitData);
                message.success("更新成功");
            } else {
                await sellerWangwangApi.create(submitData);
                message.success("新增成功");
            }
            setModalOpen(false);
            load();
        } catch (e: any) {
            if (e?.errorFields) return;

            console.error('[SellerWangwangPage] 保存失败，错误详情:', {
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
                console.error('[SellerWangwangPage] 显示错误提示失败:', showError);
                alert('保存失败: ' + (e?.response?.data?.message || e?.message || '未知错误'));
            }
        }
    };

    const handleDelete = async (record: SellerWangwangItem) => {
        try {
            await sellerWangwangApi.remove(record);
            message.success("删除成功");
            load();
        } catch (e) {
            message.error("删除失败");
            console.error(e);
        }
    };

    const getRowKey = (record: SellerWangwangItem): string => {
        return `${record['供应商编码']}_${record['卖家旺旺']}`;
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请至少选择一条记录');
            return;
        }

        try {
            const selectedItems = data.filter(item => selectedRowKeys.includes(getRowKey(item)));
            const result = await sellerWangwangApi.batchDelete(selectedItems);
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

    const handleSelect = (record: SellerWangwangItem, checked: boolean) => {
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
    const batchAddFields: FieldConfig<SellerWangwangItem>[] = [
        {
            key: '供应商编码',
            label: '供应商编码',
            excelHeaderName: '供应商编码',
            required: true,
            index: 0,
        },
        {
            key: '卖家旺旺',
            label: '卖家旺旺',
            excelHeaderName: '卖家旺旺',
            required: true,
            index: 1,
        },
    ];

    // 创建数据项
    const createBatchItem = useCallback((parts: string[]): Partial<SellerWangwangItem> => {
        return {
            '供应商编码': parts[0] || '',
            '卖家旺旺': parts[1] || '',
        };
    }, []);

    // 验证数据项
    const validateBatchItem = useCallback((item: Partial<SellerWangwangItem>): string[] => {
        const reasons: string[] = [];

        if (!item['供应商编码'] || !item['供应商编码'].trim()) {
            reasons.push('供应商编码为必填');
        }

        if (!item['卖家旺旺'] || !item['卖家旺旺'].trim()) {
            reasons.push('卖家旺旺为必填');
        }

        return reasons;
    }, []);

    // 获取全部数据（用于导出）
    const fetchAllData = useCallback(async (): Promise<SellerWangwangItem[]> => {
        try {
            const cleanFilters = Object.fromEntries(
                Object.entries(searchFilters).filter(([_, v]) => v !== undefined && v !== null && v !== '')
            );
            const res = await sellerWangwangApi.list({
                ...cleanFilters,
                keyword: searchText || undefined,
                page: 1,
                limit: 100000, // 使用一个很大的limit来获取全部数据
            });
            if (Array.isArray(res)) {
                return res || [];
            } else if (res && typeof res === 'object') {
                return res?.data || [];
            }
            return [];
        } catch (error) {
            console.error('获取全部数据失败:', error);
            message.error('获取全部数据失败');
            return [];
        }
    }, [searchFilters, searchText]);

    // 导出字段配置
    const exportFields: ExcelExportField[] = useMemo(() => [
        { key: '供应商编码', label: '供应商编码' },
        { key: '卖家旺旺', label: '卖家旺旺' },
    ], []);

    // 批量保存
    const handleBatchSave = useCallback(async (validItems: SellerWangwangItem[]) => {
        try {
            const result = await sellerWangwangApi.batchCreate(validItems);
            message.success('卖家旺旺-批量新增数据已完成');
            if (result.errors && result.errors.length > 0) {
                message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
            }
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
            render: (_: any, record: SellerWangwangItem) => (
                <Checkbox
                    checked={selectedRowKeys.includes(getRowKey(record))}
                    onChange={(e) => handleSelect(record, e.target.checked)}
                />
            ),
        };

        const baseCols: ColumnType<SellerWangwangItem>[] = [
            {
                title: '供应商编码',
                dataIndex: '供应商编码',
                key: '供应商编码',
                width: 200,
                fixed: 'left',
            },
            {
                title: '卖家旺旺',
                dataIndex: '卖家旺旺',
                key: '卖家旺旺',
                width: 200,
            },
        ];

        const actionCol = {
            title: "操作",
            key: "action" as const,
            width: 140,
            fixed: 'right' as const,
            render: (_: any, record: SellerWangwangItem) => (
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
            const savedOrder = localStorage.getItem('seller_wangwang_column_order');
            if (!savedOrder) {
                const order = getDefaultColumnOrder();
                saveColumnOrder(order);
                setColumnOrder(order);
            } else {
                try {
                    const parsed = JSON.parse(savedOrder);
                    // 合并保存的顺序和默认顺序，确保新列也会显示
                    const mergedOrder = [...parsed];
                    const defaultKeys = defaultOrder;
                    // 添加默认顺序中存在但保存顺序中不存在的列
                    defaultKeys.forEach(key => {
                        if (!mergedOrder.includes(key)) {
                            mergedOrder.push(key);
                        }
                    });
                    // 移除已不存在的列
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
            .filter(Boolean) as ColumnType<SellerWangwangItem>[],
        columns.find(col => col.key === 'action'),
    ].filter(Boolean) as ColumnType<SellerWangwangItem>[];

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
                title="采购管理 - 卖家旺旺"
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
                                placeholder="卖家旺旺"
                                style={{ width: '100%' }}
                                value={searchFilters.卖家旺旺}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 卖家旺旺: e.target.value })}
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
                            <Button icon={<DownloadOutlined />} onClick={() => setExportModalOpen(true)} block>导出数据</Button>
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
                                placeholder="卖家旺旺"
                                style={{ width: 150 }}
                                value={searchFilters.卖家旺旺}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 卖家旺旺: e.target.value })}
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
                            <Button icon={<DownloadOutlined />} onClick={() => setExportModalOpen(true)}>导出数据</Button>
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
                <ResponsiveTable<SellerWangwangItem>
                    tableId="seller-wangwang"
                    columns={visibleColumns as any}
                    dataSource={data}
                    rowKey={getRowKey}
                    loading={loading}
                    scroll={{ x: 800, y: 600 }}
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
                        <Input maxLength={255} />
                    </Form.Item>
                    <Form.Item name="卖家旺旺" label="卖家旺旺" rules={[{ required: true, message: "请输入卖家旺旺" }]}>
                        <Input maxLength={255} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增弹窗 */}
            <BatchAddModal<SellerWangwangItem>
                open={batchModalOpen}
                title="批量新增记录"
                hint="您可以从 Excel 中复制数据（包含供应商编码、卖家旺旺列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件"
                fields={batchAddFields}
                formatHint="格式：供应商编码	卖家旺旺"
                example="SUP001	旺旺账号1"
                onCancel={() => setBatchModalOpen(false)}
                onSave={handleBatchSave}
                createItem={createBatchItem}
                validateItem={validateBatchItem}
            />

            {/* Excel导出弹窗 */}
            <ExcelExportModal<SellerWangwangItem>
                open={exportModalOpen}
                title="导出数据为Excel"
                fields={exportFields}
                selectedData={data.filter(item => selectedRowKeys.includes(getRowKey(item)))}
                fetchAllData={fetchAllData}
                onCancel={() => setExportModalOpen(false)}
                fileName="卖家旺旺数据"
            />
        </div>
    );
}

