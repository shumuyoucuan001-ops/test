"use client";

import { OpsExclusionItem, opsExclusionApi, productMasterApi } from "@/lib/api";
import { showErrorBoth } from "@/lib/errorUtils";
import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Popover, Space, Tag, message } from "antd";
import { ColumnType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import BatchAddModal, { FieldConfig } from "./BatchAddModal";
import ColumnSettings from "./ColumnSettings";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof OpsExclusionItem, string> = {
    "视图名称": "视图名称",
    "门店编码": "门店编码",
    "SKU编码": "SKU编码",
    "SPU编码": "SPU编码",
    "备注": "备注",
    "商品名称": "商品名称",
    "商品UPC": "商品UPC",
    "规格": "规格",
    "采购单价 (基础单位)": "采购单价 (基础单位)",
    "采购单价 (采购单位)": "采购单价 (采购单位)",
};

export default function OpsExclusionPage() {
    const [data, setData] = useState<OpsExclusionItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OpsExclusionItem | null>(null);
    const [form] = Form.useForm<OpsExclusionItem>();
    const [isMobile, setIsMobile] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]); // 选中的行
    const [batchModalOpen, setBatchModalOpen] = useState(false); // 批量新增弹窗
    const [searchText, setSearchText] = useState(''); // 总搜索（全字段）
    const [searchFilters, setSearchFilters] = useState<{
        视图名称?: string;
        门店编码?: string;
        SKU编码?: string;
        SPU编码?: string;
    }>({});
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

    // 从 localStorage 加载列显示偏好和顺序
    useEffect(() => {
        const savedHiddenColumns = localStorage.getItem('ops_exclusion_hidden_columns');
        if (savedHiddenColumns) {
            try {
                const parsed = JSON.parse(savedHiddenColumns);
                setHiddenColumns(new Set(parsed));
            } catch (error) {
                console.error('加载列显示偏好失败:', error);
            }
        }

        const savedColumnOrder = localStorage.getItem('ops_exclusion_column_order');
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
            localStorage.setItem('ops_exclusion_hidden_columns', JSON.stringify(Array.from(hidden)));
        } catch (error) {
            console.error('保存列显示偏好失败:', error);
        }
    };

    // 保存列顺序到 localStorage
    const saveColumnOrder = (order: string[]) => {
        try {
            localStorage.setItem('ops_exclusion_column_order', JSON.stringify(order));
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

    // 直接设置列顺序（用于拖拽）
    const handleColumnOrderChange = (newOrder: string[]) => {
        setColumnOrder(newOrder);
        saveColumnOrder(newOrder);
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
            // 如果传入了overrideParams，优先使用传入的参数；否则使用状态值
            const finalPage = overrideParams?.page !== undefined ? overrideParams.page : currentPage;
            const finalKeyword = overrideParams?.keyword !== undefined
                ? (overrideParams.keyword === '' ? undefined : overrideParams.keyword)
                : (searchText || undefined);
            const finalFilters = overrideParams?.filters !== undefined
                ? overrideParams.filters
                : searchFilters;

            // 过滤掉undefined值，避免API调用问题
            const cleanFilters = Object.fromEntries(
                Object.entries(finalFilters).filter(([_, v]) => v !== undefined && v !== null && v !== '')
            );

            const res = await opsExclusionApi.list({
                ...cleanFilters,
                keyword: finalKeyword,
                page: finalPage,
                limit: pageSize,
            });

            // 处理返回格式
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
            setSelectedRowKeys([]); // 加载新数据时清空选中
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

    const openEdit = (record: OpsExclusionItem) => {
        setEditing(record);
        form.setFieldsValue(record);
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            // 确保只传视图名称（必填），其他字段为空字符串时转为 undefined/null
            const submitData: OpsExclusionItem = {
                '视图名称': values['视图名称'] || '',
                '门店编码': values['门店编码']?.trim() || '',
                'SKU编码': values['SKU编码']?.trim() || '',
                'SPU编码': values['SPU编码']?.trim() || '',
                '备注': values['备注']?.trim() || null,
            };
            if (editing) {
                await opsExclusionApi.update(editing, submitData);
                message.success("更新成功");
            } else {
                console.log('开始创建数据:', submitData);
                await opsExclusionApi.create(submitData);
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

    const handleDelete = async (record: OpsExclusionItem) => {
        try {
            await opsExclusionApi.remove(record);
            message.success("删除成功");
            load();
        } catch (e) {
            message.error("删除失败");
            console.error(e);
        }
    };

    // 获取行的唯一标识
    const getRowKey = (record: OpsExclusionItem): string => {
        return `${record["视图名称"]}_${record["门店编码"]}_${record["SKU编码"]}_${record["SPU编码"]}`;
    };

    // 批量删除记录
    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请至少选择一条记录');
            return;
        }

        try {
            // 根据选中的 key 找到对应的记录
            const selectedItems = data.filter(item => selectedRowKeys.includes(getRowKey(item)));

            const result = await opsExclusionApi.batchDelete(selectedItems);
            message.success(result.message || `成功删除 ${result.deletedCount} 条记录`);
            setSelectedRowKeys([]); // 清空选中
            load();
        } catch (error: any) {
            message.error(error?.response?.data?.message || error?.message || '批量删除失败');
            console.error(error);
        }
    };

    // 全选/取消全选
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRowKeys(data.map(item => getRowKey(item)));
        } else {
            setSelectedRowKeys([]);
        }
    };

    // 单行选择
    const handleSelect = (record: OpsExclusionItem, checked: boolean) => {
        const rowKey = getRowKey(record);
        if (checked) {
            setSelectedRowKeys([...selectedRowKeys, rowKey]);
        } else {
            setSelectedRowKeys(selectedRowKeys.filter(key => key !== rowKey));
        }
    };

    // 打开批量新增弹窗
    const openBatchCreate = () => {
        setBatchModalOpen(true);
    };

    // 批量新增字段配置
    const batchAddFields: FieldConfig<OpsExclusionItem>[] = [
        {
            key: '视图名称',
            label: '视图名称',
            excelHeaderName: '视图名称',
            required: true,
            index: 0,
        },
        {
            key: '门店编码',
            label: '门店编码',
            excelHeaderName: '门店编码',
            required: false,
            index: 1,
        },
        {
            key: 'SKU编码',
            label: 'SKU编码',
            excelHeaderName: 'SKU编码',
            required: false,
            index: 2,
        },
        {
            key: 'SPU编码',
            label: 'SPU编码',
            excelHeaderName: 'SPU编码',
            required: false,
            index: 3,
        },
        {
            key: '备注',
            label: '备注',
            excelHeaderName: '备注',
            required: false,
            index: 4,
        },
    ];

    // 创建数据项
    const createBatchItem = useCallback((parts: string[]): Partial<OpsExclusionItem> => {
        return {
            '视图名称': parts[0] || '',
            '门店编码': parts[1] || '',
            'SKU编码': parts[2] || '',
            'SPU编码': parts[3] || '',
            '备注': parts[4] || null,
        };
    }, []);

    // 批量保存
    const handleBatchSave = useCallback(async (validItems: OpsExclusionItem[]) => {
        try {
            const result = await opsExclusionApi.batchCreate(validItems);
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

    // 使用转义机制解析行数据（处理备注列中的分隔符）- 已废弃，保留用于兼容
    const parseLineWithEscapedDelimiter = (line: string, delimiter: string, expectedColumns: number): string[] => {
        // 占位符：使用一个不太可能出现在数据中的字符串
        const PLACEHOLDER_TAB = '___TAB_PLACEHOLDER___';
        const PLACEHOLDER_COMMA = '___COMMA_PLACEHOLDER___';
        const placeholder = delimiter === '\t' ? PLACEHOLDER_TAB : PLACEHOLDER_COMMA;

        // 找到前N-1个分隔符的位置
        const indices: number[] = [];
        for (let i = 0; i < line.length && indices.length < expectedColumns - 1; i++) {
            if (line[i] === delimiter) {
                indices.push(i);
            }
        }

        if (indices.length >= expectedColumns - 1) {
            // 将第N个分隔符之后的所有分隔符替换为占位符
            const beforeRemark = line.substring(0, indices[indices.length - 1] + 1);
            const remarkPart = line.substring(indices[indices.length - 1] + 1);
            // 将备注部分的分隔符替换为占位符
            const escapedRemark = remarkPart.replace(new RegExp(delimiter === '\t' ? '\\t' : ',', 'g'), placeholder);
            const processedLine = beforeRemark + escapedRemark;

            // 现在可以安全地分割了
            const parts = processedLine.split(delimiter);

            // 恢复备注列中的占位符
            if (parts.length >= expectedColumns) {
                parts[expectedColumns - 1] = parts[expectedColumns - 1].replace(new RegExp(placeholder, 'g'), delimiter);
                // 如果备注被分割成多部分，合并它们
                if (parts.length > expectedColumns) {
                    parts[expectedColumns - 1] = [parts[expectedColumns - 1], ...parts.slice(expectedColumns)].join(delimiter);
                    parts.splice(expectedColumns);
                }
            }

            // 确保返回的数组长度正确
            while (parts.length < expectedColumns) {
                parts.push('');
            }

            return parts.map((p, idx) => {
                // 最后一列（备注）不trim，保留原始格式
                if (idx === expectedColumns - 1) {
                    return p;
                }
                return p.trim();
            });
        } else {
            // 如果分隔符少于预期，直接使用split
            const splitParts = line.split(delimiter);
            const result: string[] = [];
            for (let i = 0; i < expectedColumns; i++) {
                if (i < expectedColumns - 1) {
                    result.push(splitParts[i]?.trim() || '');
                } else {
                    // 最后一列（备注）合并剩余部分
                    result.push(splitParts.slice(i).join(delimiter) || '');
                }
            }
            return result;
        }
    };


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
            render: (_: any, record: OpsExclusionItem) => (
                <Checkbox
                    checked={selectedRowKeys.includes(getRowKey(record))}
                    onChange={(e) => handleSelect(record, e.target.checked)}
                />
            ),
        };

        const baseCols: ColumnType<OpsExclusionItem>[] = [
            {
                title: '视图名称',
                dataIndex: '视图名称',
                key: '视图名称',
                width: 150,
            },
            {
                title: '门店编码',
                dataIndex: '门店编码',
                key: '门店编码',
                width: 150,
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
                title: 'SPU编码',
                dataIndex: 'SPU编码',
                key: 'SPU编码',
                width: 220,
            },
            {
                title: '备注',
                dataIndex: '备注',
                key: '备注',
                width: 200,
                ellipsis: true,
            },
        ];

        // 根据列顺序和隐藏状态过滤列
        const getDefaultOrder = (): string[] => {
            return baseCols.map(col => col.key as string);
        };
        const currentOrder = columnOrder.length > 0 ? columnOrder : getDefaultOrder();
        const orderedCols = currentOrder
            .map(key => baseCols.find(col => col.key === key))
            .filter((col): col is ColumnType<OpsExclusionItem> => col !== undefined && !hiddenColumns.has(col.key as string));

        const actionCol = {
            title: "操作",
            key: "action" as const,
            width: 140,
            fixed: 'right' as const,
            render: (_: any, record: OpsExclusionItem) => (
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
        return [selectionCol, ...orderedCols, actionCol];
    }, [data, selectedRowKeys, hiddenColumns, columnOrder]);

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="运营组管理 - 排除活动商品"
                extra={
                    isMobile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <Input
                                placeholder="视图名称"
                                style={{ width: '100%' }}
                                value={searchFilters.视图名称}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 视图名称: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="门店编码"
                                style={{ width: '100%' }}
                                value={searchFilters.门店编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 门店编码: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="SKU编码"
                                style={{ width: '100%' }}
                                value={searchFilters.SKU编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, SKU编码: e.target.value })}
                                onPressEnter={handleSearch}
                                allowClear
                            />
                            <Input
                                placeholder="SPU编码"
                                style={{ width: '100%' }}
                                value={searchFilters.SPU编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, SPU编码: e.target.value })}
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
                                content={
                                    <ColumnSettings
                                        columns={columns}
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
                                placeholder="视图名称"
                                style={{ width: 150 }}
                                value={searchFilters.视图名称}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 视图名称: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="门店编码"
                                style={{ width: 150 }}
                                value={searchFilters.门店编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 门店编码: e.target.value })}
                                allowClear
                            />
                            <Input
                                placeholder="SKU编码"
                                style={{ width: 150 }}
                                value={searchFilters.SKU编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, SKU编码: e.target.value })}
                                onPressEnter={handleSearch}
                                allowClear
                            />
                            <Input
                                placeholder="SPU编码"
                                style={{ width: 150 }}
                                value={searchFilters.SPU编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, SPU编码: e.target.value })}
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
                                content={
                                    <ColumnSettings
                                        columns={columns}
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
                <ResponsiveTable<OpsExclusionItem>
                    tableId="ops-exclusion"
                    columns={columns as any}
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
                title={editing ? "编辑规则" : "新增规则"}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText="确定"
                cancelText="取消"
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="视图名称" label="视图名称" rules={[{ required: true, message: "请输入视图名称" }]}>
                        <Input maxLength={100} />
                    </Form.Item>
                    <Form.Item name="门店编码" label="门店编码">
                        <Input maxLength={50} />
                    </Form.Item>
                    <Form.Item name="SKU编码" label="SKU编码">
                        <Input
                            maxLength={64}
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
                    <Form.Item name="SPU编码" label="SPU编码">
                        <Input maxLength={64} />
                    </Form.Item>
                    <Form.Item name="备注" label="备注">
                        <Input.TextArea rows={3} maxLength={500} placeholder="请输入备注信息" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增弹窗 */}
            <BatchAddModal<OpsExclusionItem>
                open={batchModalOpen}
                title="批量新增规则"
                hint="您可以从 Excel 中复制数据（包含视图名称、门店编码、SKU编码、SPU编码、备注列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件"
                fields={batchAddFields}
                formatHint="格式：视图名称	门店编码	SKU编码	SPU编码	备注"
                example="视图1	门店1	SKU1	SPU1	备注1"
                onCancel={() => setBatchModalOpen(false)}
                onSave={handleBatchSave}
                createItem={createBatchItem}
            />
        </div>
    );
}
