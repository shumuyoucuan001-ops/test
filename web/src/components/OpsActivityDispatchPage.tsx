"use client";

import { OpsActivityDispatchItem, opsActivityDispatchApi, productMasterApi } from "@/lib/api";
import { formatDateTime } from "@/lib/dateUtils";
import { showErrorBoth } from "@/lib/errorUtils";
import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Popover, Select, Space, Table, Tag, message } from "antd";
import { ColumnType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import ColumnSettings from "./ColumnSettings";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof OpsActivityDispatchItem, string> = {
    "SKU": "SKU",
    "活动价": "活动价",
    "最低活动价": "最低活动价",
    "活动类型": "活动类型",
    "门店名称": "门店名称",
    "活动备注": "活动备注",
    "剩余活动天数": "剩余活动天数",
    "活动确认人": "活动确认人",
    "结束时间": "结束时间",
    "数据更新时间": "数据更新时间",
    "商品名称": "商品名称",
    "商品UPC": "商品UPC",
    "规格": "规格",
    "采购单价 (基础单位)": "采购单价 (基础单位)",
    "采购单价 (采购单位)": "采购单价 (采购单位)",
};

export default function OpsActivityDispatchPage() {
    const [data, setData] = useState<OpsActivityDispatchItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OpsActivityDispatchItem | null>(null);
    const [form] = Form.useForm<OpsActivityDispatchItem>();
    const [isMobile, setIsMobile] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [batchItems, setBatchItems] = useState<OpsActivityDispatchItem[]>([]);
    const [invalidItems, setInvalidItems] = useState<Array<{ item: OpsActivityDispatchItem; reasons: string[] }>>([]);
    const [searchText, setSearchText] = useState('');
    const [searchFilters, setSearchFilters] = useState<{
        SKU?: string;
        活动价?: string;
        最低活动价?: string;
        活动类型?: string;
        门店名称?: string;
        活动备注?: string;
        剩余活动天数?: string;
        活动确认人?: string;
    }>({});
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
    const [storeNames, setStoreNames] = useState<string[]>([]);
    const [loadingStoreNames, setLoadingStoreNames] = useState(false);

    // 从 localStorage 加载列显示偏好和顺序
    useEffect(() => {
        const savedHiddenColumns = localStorage.getItem('ops_activity_dispatch_hidden_columns');
        if (savedHiddenColumns) {
            try {
                const parsed = JSON.parse(savedHiddenColumns);
                setHiddenColumns(new Set(parsed));
            } catch (error) {
                console.error('加载列显示偏好失败:', error);
            }
        }

        const savedColumnOrder = localStorage.getItem('ops_activity_dispatch_column_order');
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
            localStorage.setItem('ops_activity_dispatch_hidden_columns', JSON.stringify(Array.from(hidden)));
        } catch (error) {
            console.error('保存列显示偏好失败:', error);
        }
    };

    // 保存列顺序到 localStorage
    const saveColumnOrder = (order: string[]) => {
        try {
            localStorage.setItem('ops_activity_dispatch_column_order', JSON.stringify(order));
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

            const res = await opsActivityDispatchApi.list({
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

    // 加载门店名称列表
    useEffect(() => {
        const loadStoreNames = async () => {
            setLoadingStoreNames(true);
            try {
                const names = await opsActivityDispatchApi.getStoreNames();
                setStoreNames(names);
            } catch (error) {
                console.error('加载门店名称列表失败:', error);
                message.error('加载门店名称列表失败');
            } finally {
                setLoadingStoreNames(false);
            }
        };
        loadStoreNames();
    }, []);

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

    const openEdit = (record: OpsActivityDispatchItem) => {
        setEditing(record);
        const formValues: any = {
            ...record,
            活动价: record.活动价 !== null && record.活动价 !== undefined ? Number(record.活动价) : undefined,
            最低活动价: record.最低活动价 !== null && record.最低活动价 !== undefined ? Number(record.最低活动价) : undefined,
            剩余活动天数: record.剩余活动天数 !== null && record.剩余活动天数 !== undefined ? Number(record.剩余活动天数) : undefined,
        };
        if (record.结束时间) {
            formValues.结束时间 = dayjs(record.结束时间);
        }
        form.setFieldsValue(formValues);
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const submitData: OpsActivityDispatchItem = {
                'SKU': values['SKU'] || '',
                '活动价': values['活动价'] !== undefined && values['活动价'] !== null ? Number(values['活动价']) : null,
                '最低活动价': values['最低活动价'] !== undefined && values['最低活动价'] !== null ? Number(values['最低活动价']) : null,
                '活动类型': values['活动类型']?.trim() || null,
                '门店名称': values['门店名称']?.trim() || null,
                '活动备注': values['活动备注']?.trim() || null,
                '剩余活动天数': values['剩余活动天数'] !== undefined && values['剩余活动天数'] !== null ? Number(values['剩余活动天数']) : null,
                '活动确认人': values['活动确认人']?.trim() || null,
                '结束时间': values['结束时间'] ? (values['结束时间'] as unknown as Dayjs).format('YYYY-MM-DD HH:mm:ss') : null,
                '数据更新时间': null, // 由数据库自动更新
            };
            if (editing) {
                await opsActivityDispatchApi.update(editing, submitData);
                message.success("更新成功");
            } else {
                await opsActivityDispatchApi.create(submitData);
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

    const handleDelete = async (record: OpsActivityDispatchItem) => {
        try {
            await opsActivityDispatchApi.remove(record);
            message.success("删除成功");
            load();
        } catch (e) {
            message.error("删除失败");
            console.error(e);
        }
    };

    const getRowKey = (record: OpsActivityDispatchItem): string => {
        return record['SKU'] || '';
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请至少选择一条记录');
            return;
        }

        try {
            const selectedItems = data.filter(item => selectedRowKeys.includes(getRowKey(item)));
            const result = await opsActivityDispatchApi.batchDelete(selectedItems);
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

    const handleSelect = (record: OpsActivityDispatchItem, checked: boolean) => {
        const rowKey = getRowKey(record);
        if (checked) {
            setSelectedRowKeys([...selectedRowKeys, rowKey]);
        } else {
            setSelectedRowKeys(selectedRowKeys.filter(key => key !== rowKey));
        }
    };

    const openBatchCreate = () => {
        setBatchModalOpen(true);
        setBatchItems([]);
    };

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        // 确保门店名称列表已加载
        if (storeNames.length === 0) {
            message.warning('门店名称列表正在加载中，请稍后再试');
            return;
        }
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const lines = pastedText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            message.warning('粘贴的内容为空');
            return;
        }

        const newItems: OpsActivityDispatchItem[] = [];
        const newInvalidItems: Array<{ item: OpsActivityDispatchItem; reasons: string[] }> = [];

        for (const line of lines) {
            let parts: string[];
            if (line.includes('\t')) {
                parts = line.split('\t').map(p => p.trim());
            } else if (line.includes(',')) {
                parts = line.split(',').map(p => p.trim());
            } else {
                parts = line.split(/\s{2,}/).map(p => p.trim());
            }

            if (parts.length >= 1 && parts[0]) {
                const reasons: string[] = [];

                // 验证活动类型是否为"折扣商品"或"爆品活动"
                if (parts[3] && parts[3].trim() !== '' && parts[3] !== '折扣商品' && parts[3] !== '爆品活动') {
                    reasons.push(`活动类型无效（应为"折扣商品"或"爆品活动"）`);
                }

                // 验证门店名称是否在选择范围内
                if (parts[4] && parts[4].trim() !== '' && !storeNames.includes(parts[4].trim())) {
                    reasons.push(`门店名称"${parts[4]}"不在选择范围内`);
                }

                // 验证结束时间不能超过今天之后31天
                if (parts[8]) {
                    const endDate = dayjs(parts[8]);
                    const today = dayjs().startOf('day');
                    const maxDate = today.add(31, 'day');
                    if (endDate.isAfter(maxDate)) {
                        reasons.push(`结束时间超过今天之后31天`);
                    }
                }

                // 计算剩余活动天数：如果结束时间不为空，则计算结束时间-今天的天数
                let 剩余活动天数 = parts[6] ? Number(parts[6]) : null;
                if (parts[8]) {
                    const endDate = dayjs(parts[8]);
                    const today = dayjs().startOf('day');
                    const diffDays = endDate.startOf('day').diff(today, 'day');
                    剩余活动天数 = diffDays >= 0 ? diffDays : null;
                }

                const item: OpsActivityDispatchItem = {
                    'SKU': parts[0] || '',
                    '活动价': parts[1] ? Number(parts[1]) : null,
                    '最低活动价': parts[2] ? Number(parts[2]) : null,
                    '活动类型': parts[3] && (parts[3] === '折扣商品' || parts[3] === '爆品活动') ? parts[3] : null,
                    '门店名称': parts[4] || null,
                    '活动备注': parts[5] || null,
                    '剩余活动天数': 剩余活动天数,
                    '活动确认人': parts[7] || null,
                    '结束时间': parts[8] || null,
                    '数据更新时间': null, // 由数据库自动更新
                };

                if (reasons.length > 0) {
                    newInvalidItems.push({ item, reasons });
                } else {
                    newItems.push(item);
                }
            }
        }

        if (newItems.length > 0 || newInvalidItems.length > 0) {
            setBatchItems(prev => [...prev, ...newItems]);
            setInvalidItems(prev => [...prev, ...newInvalidItems]);
            if (newItems.length > 0 && newInvalidItems.length > 0) {
                message.warning(`已粘贴 ${newItems.length} 条有效数据，${newInvalidItems.length} 条数据验证失败，请查看下方验证失败列表`);
            } else if (newItems.length > 0) {
                message.success(`已粘贴 ${newItems.length} 条数据`);
            } else {
                message.error(`粘贴的 ${newInvalidItems.length} 条数据全部验证失败，请查看下方验证失败列表`);
            }
        } else {
            message.warning('未能解析出有效数据，请检查格式');
        }

        const target = e.target as HTMLTextAreaElement;
        if (target) {
            target.value = '';
        }
    }, [storeNames, message]);

    const handleBatchSave = async () => {
        if (batchItems.length === 0 && invalidItems.length === 0) {
            message.warning('请先粘贴数据');
            return;
        }

        // 验证活动类型、门店名称和结束时间
        const today = dayjs().startOf('day');
        const maxDate = today.add(31, 'day');
        const newInvalidItems: Array<{ item: OpsActivityDispatchItem; reasons: string[] }> = [];

        const validItems = batchItems.filter(item => {
            if (!item['SKU']) {
                newInvalidItems.push({ item, reasons: ['SKU为必填'] });
                return false;
            }

            const reasons: string[] = [];

            // 验证活动类型
            if (item['活动类型'] && item['活动类型'] !== '折扣商品' && item['活动类型'] !== '爆品活动') {
                reasons.push(`活动类型无效（应为"折扣商品"或"爆品活动"）`);
            }

            // 验证门店名称是否在选择范围内
            if (item['门店名称'] && item['门店名称'].trim() !== '' && !storeNames.includes(item['门店名称'].trim())) {
                reasons.push(`门店名称"${item['门店名称']}"不在选择范围内`);
            }

            // 验证结束时间
            if (item['结束时间']) {
                const endDate = dayjs(item['结束时间']);
                if (endDate.isAfter(maxDate)) {
                    reasons.push(`结束时间超过今天之后31天`);
                }
            }

            if (reasons.length > 0) {
                newInvalidItems.push({ item, reasons });
                return false;
            }
            return true;
        });

        // 更新验证失败的数据列表
        if (newInvalidItems.length > 0) {
            setInvalidItems(prev => [...prev, ...newInvalidItems]);
            message.error(`有 ${newInvalidItems.length} 条数据验证失败，请查看下方验证失败列表`);
            return;
        }

        if (validItems.length === 0) {
            message.warning('请至少填写一条有效数据（SKU为必填）');
            return;
        }

        try {
            const result = await opsActivityDispatchApi.batchCreate(validItems);
            message.success(result.message);
            if (result.errors && result.errors.length > 0) {
                message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
            }
            setBatchModalOpen(false);
            setBatchItems([]);
            setInvalidItems([]);
            load();
        } catch (e: any) {
            // 使用增强的错误提示（方式1：message + Modal弹框）
            showErrorBoth(e, '批量创建失败');
            console.error('批量创建失败:', e);
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
            render: (_: any, record: OpsActivityDispatchItem) => (
                <Checkbox
                    checked={selectedRowKeys.includes(getRowKey(record))}
                    onChange={(e) => handleSelect(record, e.target.checked)}
                />
            ),
        };

        const baseCols: ColumnType<OpsActivityDispatchItem>[] = [
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
                title: '最低活动价',
                dataIndex: '最低活动价',
                key: '最低活动价',
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
                title: '门店名称',
                dataIndex: '门店名称',
                key: '门店名称',
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
                title: '剩余活动天数',
                dataIndex: '剩余活动天数',
                key: '剩余活动天数',
                width: 120,
                render: (value: any) => value !== null && value !== undefined ? Number(value) : '-',
            },
            {
                title: '活动确认人',
                dataIndex: '活动确认人',
                key: '活动确认人',
                width: 120,
                ellipsis: true,
            },
            {
                title: '结束时间',
                dataIndex: '结束时间',
                key: '结束时间',
                width: 180,
                render: (text: string) => formatDateTime(text),
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
            render: (_: any, record: OpsActivityDispatchItem) => (
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
            const savedOrder = localStorage.getItem('ops_activity_dispatch_column_order');
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
            .filter(Boolean) as ColumnType<OpsActivityDispatchItem>[],
        columns.find(col => col.key === 'action'),
    ].filter(Boolean) as ColumnType<OpsActivityDispatchItem>[];

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
                title="运营组管理 - 手动强制活动分发"
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
                                placeholder="门店名称"
                                style={{ width: '100%' }}
                                value={searchFilters.门店名称}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 门店名称: e.target.value })}
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
                                placeholder="门店名称"
                                style={{ width: 150 }}
                                value={searchFilters.门店名称}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 门店名称: e.target.value })}
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
                <ResponsiveTable<OpsActivityDispatchItem>
                    columns={visibleColumns as any}
                    dataSource={data}
                    rowKey={getRowKey}
                    loading={loading}
                    scroll={{ x: 2500 }}
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
                    <Form.Item name="活动价" label="活动价">
                        <InputNumber style={{ width: '100%' }} precision={2} />
                    </Form.Item>
                    <Form.Item name="最低活动价" label="最低活动价">
                        <InputNumber style={{ width: '100%' }} precision={2} />
                    </Form.Item>
                    <Form.Item name="活动类型" label="活动类型">
                        <Select
                            placeholder="请选择活动类型"
                            allowClear
                            options={[
                                { label: '折扣商品', value: '折扣商品' },
                                { label: '爆品活动', value: '爆品活动' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="门店名称" label="门店名称">
                        <Select
                            placeholder="请选择门店名称"
                            loading={loadingStoreNames}
                            showSearch
                            allowClear
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={storeNames.map(name => ({ label: name, value: name }))}
                        />
                    </Form.Item>
                    <Form.Item name="活动备注" label="活动备注">
                        <Input.TextArea rows={3} maxLength={500} />
                    </Form.Item>
                    <Form.Item
                        name="结束时间"
                        label="结束时间"
                        rules={[
                            {
                                validator: (_rule, value: Dayjs) => {
                                    if (value) {
                                        const today = dayjs().startOf('day');
                                        const maxDate = today.add(31, 'day');
                                        if (value.isAfter(maxDate)) {
                                            return Promise.reject('结束时间不能超过今天之后31天');
                                        }
                                    }
                                    return Promise.resolve();
                                },
                            },
                        ]}
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            showTime
                            format="YYYY-MM-DD HH:mm:ss"
                            onChange={(date: Dayjs | null) => {
                                if (date) {
                                    // 自动计算剩余活动天数：结束时间 - 今天
                                    const today = dayjs().startOf('day');
                                    const endDate = date.startOf('day');
                                    const diffDays = endDate.diff(today, 'day');
                                    if (diffDays >= 0) {
                                        form.setFieldsValue({
                                            '剩余活动天数': diffDays,
                                        });
                                    } else {
                                        form.setFieldsValue({
                                            '剩余活动天数': null,
                                        });
                                    }
                                } else {
                                    // 如果结束时间为空，不修改剩余活动天数
                                }
                            }}
                        />
                    </Form.Item>
                    <Form.Item name="剩余活动天数" label="剩余活动天数">
                        <InputNumber style={{ width: '100%' }} min={0} disabled />
                    </Form.Item>
                    <Form.Item name="活动确认人" label="活动确认人">
                        <Input maxLength={100} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增弹窗 */}
            <Modal
                open={batchModalOpen}
                title="批量新增记录"
                onCancel={() => {
                    setBatchModalOpen(false);
                    setBatchItems([]);
                    setInvalidItems([]);
                }}
                onOk={handleBatchSave}
                okText="确定创建"
                cancelText="取消"
                width={900}
                destroyOnClose
            >
                <div style={{
                    marginBottom: 16,
                    padding: '16px',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                }}>
                    <div style={{
                        marginBottom: 8,
                        color: '#666',
                        fontSize: 14,
                    }}>
                        提示：您可以从 Excel 中复制数据（包含SKU、活动价、最低活动价、活动类型、门店名称、活动备注、剩余活动天数、活动确认人、结束时间列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）
                    </div>
                    <Input.TextArea
                        placeholder="在此处粘贴 Excel 数据（Ctrl+V），每行一条记录，字段用制表符或逗号分隔&#10;格式：SKU	活动价	最低活动价	活动类型	门店名称	活动备注	剩余活动天数	活动确认人	结束时间&#10;示例：SKU001	100.00	90.00	促销	门店A	备注	30	张三	2024-12-31 23:59:59"
                        rows={4}
                        onPaste={handlePaste}
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 14,
                        }}
                    />
                </div>

                {/* 有效数据预览表格 */}
                {batchItems.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#52c41a' }}>
                            ✓ 有效数据 ({batchItems.length} 条)
                        </div>
                        <Table
                            columns={[
                                {
                                    title: 'SKU',
                                    dataIndex: 'SKU',
                                    key: 'SKU',
                                    render: (text: string) => (
                                        <span style={{ color: !text ? 'red' : 'inherit' }}>
                                            {text || '(必填)'}
                                        </span>
                                    ),
                                },
                                { title: '活动价', dataIndex: '活动价', key: '活动价', render: (v: any) => v !== null ? Number(v).toFixed(2) : '-' },
                                { title: '最低活动价', dataIndex: '最低活动价', key: '最低活动价', render: (v: any) => v !== null ? Number(v).toFixed(2) : '-' },
                                { title: '活动类型', dataIndex: '活动类型', key: '活动类型' },
                                { title: '门店名称', dataIndex: '门店名称', key: '门店名称' },
                                { title: '活动备注', dataIndex: '活动备注', key: '活动备注' },
                                { title: '剩余活动天数', dataIndex: '剩余活动天数', key: '剩余活动天数', render: (v: any) => v !== null ? Number(v) : '-' },
                                { title: '活动确认人', dataIndex: '活动确认人', key: '活动确认人' },
                                { title: '结束时间', dataIndex: '结束时间', key: '结束时间', render: (v: any) => formatDateTime(v) },
                                {
                                    title: '操作',
                                    key: 'action',
                                    width: 100,
                                    render: (_: any, record: OpsActivityDispatchItem, index: number) => (
                                        <Button
                                            type="link"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={() => {
                                                setBatchItems(prev => prev.filter((_, i) => i !== index));
                                            }}
                                        >
                                            删除
                                        </Button>
                                    ),
                                },
                            ]}
                            dataSource={batchItems.map((item, index) => ({ ...item, key: index }))}
                            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条记录` }}
                            size="small"
                        />
                    </div>
                )}

                {/* 验证失败数据表格 */}
                {invalidItems.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#ff4d4f' }}>
                            ✗ 验证失败数据 ({invalidItems.length} 条)
                        </div>
                        <Table
                            columns={[
                                {
                                    title: 'SKU',
                                    key: 'SKU',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) => (
                                        <span style={{ color: !record.item.SKU ? 'red' : 'inherit' }}>
                                            {record.item.SKU || '(必填)'}
                                        </span>
                                    ),
                                },
                                {
                                    title: '活动价',
                                    key: '活动价',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) =>
                                        record.item.活动价 !== null ? Number(record.item.活动价).toFixed(2) : '-'
                                },
                                {
                                    title: '最低活动价',
                                    key: '最低活动价',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) =>
                                        record.item.最低活动价 !== null ? Number(record.item.最低活动价).toFixed(2) : '-'
                                },
                                {
                                    title: '活动类型',
                                    key: '活动类型',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) =>
                                        record.item.活动类型 || '-'
                                },
                                {
                                    title: '门店名称',
                                    key: '门店名称',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) =>
                                        record.item.门店名称 || '-'
                                },
                                {
                                    title: '活动备注',
                                    key: '活动备注',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) =>
                                        record.item.活动备注 || '-'
                                },
                                {
                                    title: '剩余活动天数',
                                    key: '剩余活动天数',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) =>
                                        record.item.剩余活动天数 !== null ? Number(record.item.剩余活动天数) : '-'
                                },
                                {
                                    title: '活动确认人',
                                    key: '活动确认人',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) =>
                                        record.item.活动确认人 || '-'
                                },
                                {
                                    title: '结束时间',
                                    key: '结束时间',
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) =>
                                        record.item.结束时间 || '-'
                                },
                                {
                                    title: '失败原因',
                                    key: 'reasons',
                                    width: 300,
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }) => (
                                        <div>
                                            {record.reasons.map((reason, idx) => (
                                                <Tag key={idx} color="error" style={{ marginBottom: 4, display: 'block' }}>
                                                    {reason}
                                                </Tag>
                                            ))}
                                        </div>
                                    ),
                                },
                                {
                                    title: '操作',
                                    key: 'action',
                                    width: 100,
                                    render: (_: any, record: { item: OpsActivityDispatchItem; reasons: string[] }, index: number) => (
                                        <Button
                                            type="link"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={() => {
                                                setInvalidItems(prev => prev.filter((_, i) => i !== index));
                                            }}
                                        >
                                            删除
                                        </Button>
                                    ),
                                },
                            ]}
                            dataSource={invalidItems.map((item, index) => ({ ...item, key: index }))}
                            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条记录` }}
                            size="small"
                            style={{
                                backgroundColor: '#fff1f0',
                            }}
                        />
                    </div>
                )}

                {/* 无数据提示 */}
                {batchItems.length === 0 && invalidItems.length === 0 && (
                    <div style={{
                        padding: 40,
                        textAlign: 'center',
                        color: '#999',
                        fontSize: 14
                    }}>
                        暂无数据，请粘贴数据到上方输入框
                    </div>
                )}
            </Modal>
        </div>
    );
}

