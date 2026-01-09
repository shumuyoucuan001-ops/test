"use client";

import { OpsRegularActivityDispatchItem, opsRegularActivityDispatchApi, productMasterApi } from "@/lib/api";
import { formatDateTime } from "@/lib/dateUtils";
import { showErrorBoth } from "@/lib/errorUtils";
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Popover, Space, Tag, message } from "antd";
import { ColumnType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import BatchAddModal, { FieldConfig } from "./BatchAddModal";
import ColumnSettings from "./ColumnSettings";
import ExcelExportModal, { ExcelExportField } from "./ExcelExportModal";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof OpsRegularActivityDispatchItem, string> = {
    "SKU": "SKU",
    "活动价": "活动价",
    "活动类型": "活动类型",
    "活动备注": "活动备注",
    "活动确认人": "活动确认人",
    "数据更新时间": "数据更新时间",
    "商品名称": "商品名称",
    "商品UPC": "商品UPC",
    "SPU编码": "SPU编码",
    "规格": "规格",
    "采购单价 (基础单位)": "采购单价 (基础单位)",
    "采购单价 (采购单位)": "采购单价 (采购单位)",
};

export default function OpsRegularActivityDispatchPage() {
    const [data, setData] = useState<OpsRegularActivityDispatchItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OpsRegularActivityDispatchItem | null>(null);
    const [form] = Form.useForm<OpsRegularActivityDispatchItem>();
    const [isMobile, setIsMobile] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchFilters, setSearchFilters] = useState<{
        SKU?: string;
        活动价?: string;
        活动类型?: string;
        活动备注?: string;
        活动确认人?: string;
    }>({});
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // 从 localStorage 加载列显示偏好和顺序
    useEffect(() => {
        const savedHiddenColumns = localStorage.getItem('ops_regular_activity_dispatch_hidden_columns');
        if (savedHiddenColumns) {
            try {
                const parsed = JSON.parse(savedHiddenColumns);
                setHiddenColumns(new Set(parsed));
            } catch (error) {
                console.error('加载列显示偏好失败:', error);
            }
        }

        const savedColumnOrder = localStorage.getItem('ops_regular_activity_dispatch_column_order');
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
            localStorage.setItem('ops_regular_activity_dispatch_hidden_columns', JSON.stringify(Array.from(hidden)));
        } catch (error) {
            console.error('保存列显示偏好失败:', error);
        }
    };

    // 保存列顺序到 localStorage
    const saveColumnOrder = (order: string[]) => {
        try {
            localStorage.setItem('ops_regular_activity_dispatch_column_order', JSON.stringify(order));
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

            const res = await opsRegularActivityDispatchApi.list({
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

    const openEdit = (record: OpsRegularActivityDispatchItem) => {
        setEditing(record);
        form.setFieldsValue({
            ...record,
            活动价: record.活动价 !== null && record.活动价 !== undefined ? Number(record.活动价) : undefined,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const submitData: OpsRegularActivityDispatchItem = {
                'SKU': values['SKU'] || '',
                '活动价': values['活动价'] !== undefined && values['活动价'] !== null ? Number(values['活动价']) : null,
                '活动类型': values['活动类型']?.trim() || null,
                '活动备注': values['活动备注']?.trim() || null,
                '活动确认人': values['活动确认人']?.trim() || null,
                '数据更新时间': null, // 由数据库自动更新
            };
            if (editing) {
                await opsRegularActivityDispatchApi.update(editing, submitData);
                message.success("更新成功");
            } else {
                await opsRegularActivityDispatchApi.create(submitData);
                message.success("新增成功");
            }
            setModalOpen(false);
            load();
        } catch (e: any) {
            if (e?.errorFields) return;
            // 使用增强的错误提示（方式1：message + Modal弹框）
            showErrorBoth(e, '保存失败');
            console.error('保存失败:', e);
        }
    };

    const handleDelete = async (record: OpsRegularActivityDispatchItem) => {
        try {
            await opsRegularActivityDispatchApi.remove(record);
            message.success("删除成功");
            load();
        } catch (e) {
            message.error("删除失败");
            console.error(e);
        }
    };

    const getRowKey = (record: OpsRegularActivityDispatchItem): string => {
        return record['SKU'] || '';
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请至少选择一条记录');
            return;
        }

        try {
            const selectedItems = data.filter(item => selectedRowKeys.includes(getRowKey(item)));
            const result = await opsRegularActivityDispatchApi.batchDelete(selectedItems);
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

    const handleSelect = (record: OpsRegularActivityDispatchItem, checked: boolean) => {
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
    const batchAddFields: FieldConfig<OpsRegularActivityDispatchItem>[] = [
        {
            key: 'SKU',
            label: 'SKU',
            excelHeaderName: 'SKU',
            required: true,
            index: 0,
        },
        {
            key: '活动价',
            label: '活动价',
            excelHeaderName: '活动价',
            required: false,
            index: 1,
            transform: (value: string) => value ? Number(value) : null,
        },
        {
            key: '活动类型',
            label: '活动类型',
            excelHeaderName: '活动类型',
            required: false,
            index: 2,
        },
        {
            key: '活动备注',
            label: '活动备注',
            excelHeaderName: '活动备注',
            required: false,
            index: 3,
        },
        {
            key: '活动确认人',
            label: '活动确认人',
            excelHeaderName: '活动确认人',
            required: false,
            index: 4,
        },
    ];

    // 创建数据项
    const createBatchItem = useCallback((parts: string[]): Partial<OpsRegularActivityDispatchItem> => {
        return {
            'SKU': parts[0] || '',
            '活动价': parts[1] ? Number(parts[1]) : null,
            '活动类型': parts[2] || null,
            '活动备注': parts[3] || null,
            '活动确认人': parts[4] || null,
            '数据更新时间': null,
        };
    }, []);

    // 获取全部数据（用于导出）
    const fetchAllData = useCallback(async (): Promise<OpsRegularActivityDispatchItem[]> => {
        try {
            const cleanFilters = Object.fromEntries(
                Object.entries(searchFilters).filter(([_, v]) => v !== undefined && v !== null && v !== '')
            );
            const res = await opsRegularActivityDispatchApi.list({
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
        { key: 'SKU', label: 'SKU' },
        { key: '商品名称', label: '商品名称' },
        { key: '商品UPC', label: '商品UPC' },
        { key: 'SPU编码', label: 'SPU编码' },
        { key: '规格', label: '规格' },
        { key: '采购单价 (基础单位)', label: '采购单价 (基础单位)' },
        { key: '采购单价 (采购单位)', label: '采购单价 (采购单位)' },
        { key: '活动价', label: '活动价' },
        { key: '活动类型', label: '活动类型' },
        { key: '活动备注', label: '活动备注' },
        { key: '活动确认人', label: '活动确认人' },
        { key: '数据更新时间', label: '数据更新时间' },
    ], []);

    // 批量保存
    const handleBatchSave = useCallback(async (validItems: OpsRegularActivityDispatchItem[]) => {
        try {
            const result = await opsRegularActivityDispatchApi.batchCreate(validItems);
            if (result.errors && result.errors.length > 0) {
                message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
            }
            message.success('手动常规活动分发-批量新增数据已完成');
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
            render: (_: any, record: OpsRegularActivityDispatchItem) => (
                <Checkbox
                    checked={selectedRowKeys.includes(getRowKey(record))}
                    onChange={(e) => handleSelect(record, e.target.checked)}
                />
            ),
        };

        const baseCols: ColumnType<OpsRegularActivityDispatchItem>[] = [
            {
                title: 'SKU',
                dataIndex: 'SKU',
                key: 'SKU',
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
                        SPU编码{' '}
                        <Tag color="blue" style={{ marginLeft: 4 }}>自动匹配</Tag>
                    </span>
                ),
                dataIndex: 'SPU编码',
                key: 'SPU编码',
                width: 150,
                ellipsis: true,
                render: (text: string) => text || '-',
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
                title: '活动价',
                dataIndex: '活动价',
                key: '活动价',
                width: 120,
                render: (value: any) => value !== null && value !== undefined ? Number(value).toFixed(2) : '-',
            },
            {
                title: '活动类型',
                dataIndex: '活动类型',
                key: '活动类型',
                width: 150,
                ellipsis: true,
            },
            {
                title: '活动备注',
                dataIndex: '活动备注',
                key: '活动备注',
                width: 200,
                ellipsis: true,
            },
            {
                title: '活动确认人',
                dataIndex: '活动确认人',
                key: '活动确认人',
                width: 120,
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
            render: (_: any, record: OpsRegularActivityDispatchItem) => (
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
        if (defaultOrder.length > 0) {
            const savedOrder = localStorage.getItem('ops_regular_activity_dispatch_column_order');
            if (!savedOrder) {
                const order = getDefaultColumnOrder();
                saveColumnOrder(order);
                setColumnOrder(order);
            } else {
                try {
                    const parsed = JSON.parse(savedOrder);
                    // 合并保存的顺序和默认顺序，确保新列也会显示
                    let mergedOrder = [...parsed];
                    const defaultKeys = defaultOrder;

                    // 检查SPU编码的位置是否正确（应该在商品UPC之后，规格之前）
                    const spuIndex = mergedOrder.indexOf('SPU编码');
                    const upcIndex = mergedOrder.indexOf('商品UPC');
                    const specIndex = mergedOrder.indexOf('规格');

                    // 如果SPU编码不存在，或者位置不对（不在商品UPC和规格之间），使用默认顺序
                    let shouldUseDefaultOrder = false;
                    if (defaultKeys.includes('SPU编码')) {
                        if (!mergedOrder.includes('SPU编码')) {
                            // SPU编码不存在，使用默认顺序
                            shouldUseDefaultOrder = true;
                        } else if (spuIndex !== -1) {
                            // 检查位置是否正确：应该在商品UPC之后，规格之前
                            if (upcIndex !== -1 && specIndex !== -1) {
                                // 如果SPU编码不在商品UPC和规格之间，使用默认顺序
                                if (spuIndex <= upcIndex || spuIndex >= specIndex) {
                                    shouldUseDefaultOrder = true;
                                }
                            } else if (upcIndex !== -1 && spuIndex <= upcIndex) {
                                // 如果SPU编码在商品UPC之前，使用默认顺序
                                shouldUseDefaultOrder = true;
                            } else if (specIndex !== -1 && spuIndex >= specIndex) {
                                // 如果SPU编码在规格之后，使用默认顺序
                                shouldUseDefaultOrder = true;
                            }
                        }
                    }

                    if (shouldUseDefaultOrder) {
                        // 直接使用默认顺序，确保SPU编码在正确位置
                        const defaultOrder = getDefaultColumnOrder();
                        saveColumnOrder(defaultOrder);
                        setColumnOrder(defaultOrder);
                        return; // 提前返回，不再执行后续逻辑
                    }

                    // 添加其他默认顺序中存在但保存顺序中不存在的列（除了SPU编码，已经处理过了）
                    defaultKeys.forEach(key => {
                        if (key !== 'SPU编码' && !mergedOrder.includes(key)) {
                            mergedOrder.push(key);
                        }
                    });
                    // 移除已不存在的列
                    const validOrder = mergedOrder.filter(key => defaultKeys.includes(key));
                    // 始终更新列顺序，确保SPU编码位置正确
                    saveColumnOrder(validOrder);
                    setColumnOrder(validOrder);
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
            .filter(Boolean) as ColumnType<OpsRegularActivityDispatchItem>[],
        columns.find(col => col.key === 'action'),
    ].filter(Boolean) as ColumnType<OpsRegularActivityDispatchItem>[];

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
                title="运营组管理 - 手动常规活动分发"
                extra={
                    isMobile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <Input
                                placeholder="SKU"
                                style={{ width: '100%' }}
                                value={searchFilters.SKU}
                                onChange={(e) => setSearchFilters({ ...searchFilters, SKU: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="活动类型"
                                style={{ width: '100%' }}
                                value={searchFilters.活动类型}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 活动类型: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="活动确认人"
                                style={{ width: '100%' }}
                                value={searchFilters.活动确认人}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 活动确认人: e.target.value })}
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
                                placeholder="SKU"
                                style={{ width: 150 }}
                                value={searchFilters.SKU}
                                onChange={(e) => setSearchFilters({ ...searchFilters, SKU: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="活动类型"
                                style={{ width: 150 }}
                                value={searchFilters.活动类型}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 活动类型: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="活动确认人"
                                style={{ width: 150 }}
                                value={searchFilters.活动确认人}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 活动确认人: e.target.value })}
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
                <ResponsiveTable<OpsRegularActivityDispatchItem>
                    tableId="ops-regular-activity-dispatch"
                    columns={visibleColumns as any}
                    dataSource={data}
                    rowKey={getRowKey}
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
                    <Form.Item name="SKU" label="SKU" rules={[{ required: true, message: "请输入SKU" }]}>
                        <Input
                            maxLength={100}
                            disabled={!!editing}
                            onChange={async (e) => {
                                if (!editing) {
                                    const sku = e.target.value.trim();
                                    if (sku.length === 19) {
                                        try {
                                            const productInfo = await productMasterApi.getProductInfo(sku);
                                            if (productInfo) {
                                                form.setFieldsValue({
                                                    '商品名称': productInfo.productName,
                                                    '商品UPC': productInfo.productCode,
                                                    'SPU编码': productInfo.spuCode,
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
                    <Form.Item name="SPU编码" label="SPU编码">
                        <Input maxLength={200} disabled />
                    </Form.Item>
                    <Form.Item name="规格" label="规格">
                        <Input maxLength={200} disabled />
                    </Form.Item>
                    <Form.Item name="活动价" label="活动价">
                        <InputNumber style={{ width: '100%' }} precision={2} />
                    </Form.Item>
                    <Form.Item name="活动类型" label="活动类型">
                        <Input maxLength={100} />
                    </Form.Item>
                    <Form.Item name="活动备注" label="活动备注">
                        <Input.TextArea rows={3} maxLength={500} />
                    </Form.Item>
                    <Form.Item name="活动确认人" label="活动确认人">
                        <Input maxLength={100} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增弹窗 */}
            <BatchAddModal<OpsRegularActivityDispatchItem>
                open={batchModalOpen}
                title="批量新增记录"
                hint="您可以从 Excel 中复制数据（包含SKU、活动价、活动类型、活动备注、活动确认人列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件"
                fields={batchAddFields}
                formatHint="格式：SKU	活动价	活动类型	活动备注	活动确认人"
                example="SKU001	100.00	促销	备注	张三"
                onCancel={() => setBatchModalOpen(false)}
                onSave={handleBatchSave}
                createItem={createBatchItem}
            />

            {/* Excel导出弹窗 */}
            <ExcelExportModal<OpsRegularActivityDispatchItem>
                open={exportModalOpen}
                title="导出数据为Excel"
                fields={exportFields}
                selectedData={data.filter(item => selectedRowKeys.includes(getRowKey(item)))}
                fetchAllData={fetchAllData}
                onCancel={() => setExportModalOpen(false)}
                fileName="手动常规活动分发数据"
            />
        </div>
    );
}

