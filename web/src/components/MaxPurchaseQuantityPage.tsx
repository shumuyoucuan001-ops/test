"use client";

import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';
import { MaxPurchaseQuantityItem, maxPurchaseQuantityApi, productMasterApi } from "@/lib/api";
import { DeleteOutlined, EditOutlined, ExclamationCircleOutlined, FilterOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from "@ant-design/icons";
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Popover, Select, Space, Tag } from "antd";
import { ColumnType } from "antd/es/table";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BatchAddModal, { FieldConfig } from "./BatchAddModal";
import ColumnSettings from "./ColumnSettings";
import ExcelExportModal, { ExcelExportField } from "./ExcelExportModal";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof MaxPurchaseQuantityItem, string> = {
    "仓店名称": "仓店名称",
    "SKU": "SKU",
    "单次最高采购量(基本单位)": "单次最高采购量(基本单位)",
    "备注": "备注",
    "修改人": "修改人",
    "商品名称": "商品名称",
    "商品UPC": "商品UPC",
    "SPU编码": "SPU编码",
    "规格": "规格",
    "采购单价 (基础单位)": "采购单价 (基础单位)",
    "采购单价 (采购单位)": "采购单价 (采购单位)",
};

// 页面唯一标识符
const PAGE_KEY = 'max-purchase-quantity';

// 搜索框筛选组件
const SearchFilterDropdown = ({
    columnKey,
    columnTitle,
    searchText,
    onSearchChange,
    onConfirm,
    onClear,
    setSelectedKeys,
    confirm,
    clearFilters,
}: {
    columnKey: string;
    columnTitle: string;
    searchText: string;
    onSearchChange: (text: string) => void;
    onConfirm: (text: string) => void;
    onClear: () => void;
    setSelectedKeys: (keys: string[]) => void;
    confirm: () => void;
    clearFilters?: () => void;
}) => {
    const [localSearchText, setLocalSearchText] = useState(searchText);

    // 当外部 searchText 变化时，同步到本地状态
    useEffect(() => {
        setLocalSearchText(searchText);
    }, [searchText]);

    const handleConfirm = () => {
        onSearchChange(localSearchText);
        onConfirm(localSearchText);
        if (localSearchText) {
            setSelectedKeys([localSearchText]);
        } else {
            setSelectedKeys([]);
        }
        confirm();
    };

    const handleClear = () => {
        setLocalSearchText('');
        onSearchChange('');
        onClear();
        setSelectedKeys([]);
        if (clearFilters) {
            clearFilters();
        }
        confirm();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    return (
        <div style={{ padding: 12, minWidth: 300 }}>
            <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#333' }}>
                    搜索 {columnTitle}
                </div>
                <Input
                    placeholder={`请输入${columnTitle}关键词进行搜索`}
                    allowClear
                    value={localSearchText}
                    onChange={(e) => setLocalSearchText(e.target.value)}
                    onPressEnter={handleKeyPress}
                    size="small"
                    prefix={<SearchOutlined />}
                    autoFocus
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    将在数据库中搜索该列的所有匹配数据
                </div>
            </div>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                    size="small"
                    onClick={handleClear}
                >
                    清空
                </Button>
                <Button
                    type="primary"
                    size="small"
                    onClick={handleConfirm}
                >
                    搜索
                </Button>
            </Space>
        </div>
    );
};

// 为列添加搜索筛选功能（只对非自动匹配的列）
const addSearchFiltersToColumns = (
    columns: any[],
    columnSearchKeywords: Record<string, string>,
    onSearchChange: (columnKey: string, keyword: string) => void,
    onSearchClear: (columnKey: string) => void
): any[] => {
    // 自动匹配的列（不需要添加筛选）
    const autoMatchColumns = ['商品名称', '采购单价 (基础单位)', '采购单价 (采购单位)', '商品UPC', '规格'];

    return columns.map(col => {
        const columnKey = col.key as string;
        const columnTitle = col.title as string;

        // 如果是操作列或自动匹配的列，不添加筛选
        if (!columnKey || columnKey === 'action' || autoMatchColumns.includes(columnKey)) {
            return col;
        }

        const searchKeyword = columnSearchKeywords[columnKey] || '';

        return {
            ...col,
            filteredValue: searchKeyword ? [searchKeyword] : null,
            filterIcon: (filtered: boolean) => (
                <FilterOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
            ),
            filterDropdown: ({ setSelectedKeys, confirm, clearFilters }: any) => (
                <SearchFilterDropdown
                    columnKey={columnKey}
                    columnTitle={typeof columnTitle === 'string' ? columnTitle : columnKey}
                    searchText={searchKeyword}
                    onSearchChange={(text) => onSearchChange(columnKey, text)}
                    onConfirm={(text) => {
                        onSearchChange(columnKey, text);
                    }}
                    onClear={() => {
                        onSearchClear(columnKey);
                    }}
                    setSelectedKeys={setSelectedKeys}
                    confirm={confirm}
                    clearFilters={clearFilters}
                />
            ),
        };
    });
};

export default function MaxPurchaseQuantityPage() {
    const { message, modal } = App.useApp();
    const [form] = Form.useForm();

    // 定义默认状态
    const defaultState = {
        currentPage: 1,
        pageSize: 20,
        filters: {} as {
            storeName?: string;
            sku?: string;
            maxQuantity?: string;
            modifier?: string;
        },
    };

    // 恢复保存的状态
    const restoredState = usePageStateRestore(PAGE_KEY, defaultState);

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
    const [editingRecord, setEditingRecord] = useState<MaxPurchaseQuantityItem | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
    const [batchModalVisible, setBatchModalVisible] = useState(false);
    const [exportModalVisible, setExportModalVisible] = useState(false);

    // 列搜索关键词（每列的搜索关键词）
    const [columnSearchKeywords, setColumnSearchKeywords] = useState<Record<string, string>>({});

    // 从 localStorage 加载列显示偏好和顺序
    useEffect(() => {
        const savedHiddenColumns = localStorage.getItem('max_purchase_quantity_hidden_columns');
        if (savedHiddenColumns) {
            try {
                const parsed = JSON.parse(savedHiddenColumns);
                setHiddenColumns(new Set(parsed));
            } catch (error) {
                console.error('加载列显示偏好失败:', error);
            }
        }

        const savedColumnOrder = localStorage.getItem('max_purchase_quantity_column_order');
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
            localStorage.setItem('max_purchase_quantity_hidden_columns', JSON.stringify(Array.from(hidden)));
        } catch (error) {
            console.error('保存列显示偏好失败:', error);
        }
    };

    // 保存列顺序到 localStorage
    const saveColumnOrder = (order: string[]) => {
        try {
            localStorage.setItem('max_purchase_quantity_column_order', JSON.stringify(order));
        } catch (error) {
            console.error('保存列顺序失败:', error);
        }
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
                title: '单次最高采购量(基本单位)',
                dataIndex: '单次最高采购量(基本单位)',
                key: '单次最高采购量(基本单位)',
                width: 200,
            },
            {
                title: '备注',
                dataIndex: '备注',
                key: '备注',
                width: 220,
                ellipsis: true,
            },
            {
                title: '修改人',
                dataIndex: '修改人',
                key: '修改人',
                width: 120,
            },
        ] as ColumnType<MaxPurchaseQuantityItem>[];
    }, []);

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

    // 将列搜索关键词转换为搜索参数
    const buildColumnSearchParams = useCallback((): string[] => {
        const searchParams: string[] = [];
        Object.entries(columnSearchKeywords).forEach(([columnKey, keyword]) => {
            if (keyword && keyword.trim()) {
                // 将搜索关键词转换为搜索格式：列名:关键词
                searchParams.push(`${columnKey}:${keyword.trim()}`);
            }
        });
        return searchParams;
    }, [columnSearchKeywords]);

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

            // 检查是否有列搜索
            const columnSearchParams = buildColumnSearchParams();
            const hasColumnSearch = columnSearchParams.length > 0;

            // 如果有列搜索，需要获取更多数据以便在前端进行过滤
            // 否则使用正常的分页
            const fetchLimit = hasColumnSearch ? 10000 : limit;
            const fetchPage = hasColumnSearch ? 1 : page;

            const res = await maxPurchaseQuantityApi.list(activeFilters, fetchPage, fetchLimit);
            let filteredData = res?.data || [];

            // 在前端进行列搜索过滤
            if (hasColumnSearch) {
                Object.entries(columnSearchKeywords).forEach(([columnKey, keyword]) => {
                    if (keyword && keyword.trim()) {
                        filteredData = filteredData.filter((item: MaxPurchaseQuantityItem) => {
                            const value = item[columnKey as keyof MaxPurchaseQuantityItem];
                            if (value === null || value === undefined) return false;
                            return String(value).toLowerCase().includes(keyword.toLowerCase());
                        });
                    }
                });

                // 前端分页
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                filteredData = filteredData.slice(startIndex, endIndex);
            }

            setData(filteredData);
            // 如果有列搜索，total使用过滤后的数据总长度，否则使用后端返回的total
            if (hasColumnSearch) {
                // 需要重新获取所有数据来计算总数（这里简化处理，使用一个较大的limit）
                const totalRes = await maxPurchaseQuantityApi.list(activeFilters, 1, 10000);
                let totalFilteredData = totalRes?.data || [];
                Object.entries(columnSearchKeywords).forEach(([columnKey, keyword]) => {
                    if (keyword && keyword.trim()) {
                        totalFilteredData = totalFilteredData.filter((item: MaxPurchaseQuantityItem) => {
                            const value = item[columnKey as keyof MaxPurchaseQuantityItem];
                            if (value === null || value === undefined) return false;
                            return String(value).toLowerCase().includes(keyword.toLowerCase());
                        });
                    }
                });
                setTotal(totalFilteredData.length);
            } else {
                setTotal(res?.total || 0);
            }
        } catch (e: any) {
            message.error("加载失败: " + (e?.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, message, buildColumnSearchParams, columnSearchKeywords]);

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

    // 当列搜索关键词改变时，重新加载数据
    useEffect(() => {
        if (hasInitialLoadRef.current) {
            setCurrentPage(1);
            load(filters, 1, pageSize);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columnSearchKeywords]);

    const handleReset = () => {
        setFilters({});
        setCurrentPage(1);
        // 清除所有列搜索关键词
        setColumnSearchKeywords({});
        load(undefined, 1, pageSize);
    };

    // 检查是否有列搜索条件
    const hasActiveColumnFilters = Object.values(columnSearchKeywords).some(keyword => keyword && keyword.trim());

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
            remark: record['备注'],
            '商品名称': record['商品名称'],
            '商品UPC': record['商品UPC'],
            '规格': record['规格'],
            '采购单价 (基础单位)': record['采购单价 (基础单位)'],
            '采购单价 (采购单位)': record['采购单价 (采购单位)'],
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

    // 解析错误消息中的推荐最小值
    const parseRequiredMinimum = (errorMessage: string): number | null => {
        const match = errorMessage.match(/\[REQUIRED_MINIMUM:(\d+)\]/);
        if (match && match[1]) {
            return parseInt(match[1], 10);
        }
        return null;
    };

    // 执行创建或更新操作（不显示成功消息，由调用者决定）
    const executeCreateOrUpdate = async (values: any, showSuccessMessage: boolean = false) => {
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
                    remark: values.remark,
                }
            );
            if (showSuccessMessage) {
                message.success('更新成功');
            }
        } else {
            // 新增
            await maxPurchaseQuantityApi.create({
                storeName: values.storeName,
                sku: values.sku,
                maxQuantity: values.maxQuantity,
                remark: values.remark,
            });
            if (showSuccessMessage) {
                message.success('创建成功');
            }
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            setModalLoading(true);

            console.log('[MaxPurchaseQuantity] 提交数据:', values);
            await executeCreateOrUpdate(values, false);

            // 成功后的处理
            setModalVisible(false);
            form.resetFields();
            message.success((editingRecord ? '更新' : '创建') + '成功');
            load(filters, currentPage, pageSize);
        } catch (error: any) {
            console.log('[MaxPurchaseQuantity] 捕获错误:', error);
            console.log('[MaxPurchaseQuantity] 错误响应:', error?.response);
            console.log('[MaxPurchaseQuantity] 错误数据:', error?.response?.data);

            if (error?.errorFields) {
                // 表单验证错误
                console.log('[MaxPurchaseQuantity] 表单验证错误');
                return;
            }

            // 检查是否是单次最高采购量验证错误
            const errorMessage = error?.response?.data?.message || error?.message || '未知错误';
            console.log('[MaxPurchaseQuantity] 错误消息:', errorMessage);

            const requiredMinimum = parseRequiredMinimum(errorMessage);
            console.log('[MaxPurchaseQuantity] 解析的最小值:', requiredMinimum);

            if (requiredMinimum !== null) {
                // 显示确认对话框
                // 清理错误消息，移除 [REQUIRED_MINIMUM:xxx] 标记
                const cleanMessage = errorMessage.replace(/\[REQUIRED_MINIMUM:\d+\]/, '').trim();

                console.log('[MaxPurchaseQuantity] 显示确认对话框，推荐最小值:', requiredMinimum);
                modal.confirm({
                    title: '单次最高采购量不能低于月销/15',
                    icon: <ExclamationCircleOutlined />,
                    content: (
                        <div>
                            <p>{cleanMessage}</p>
                            <p style={{ marginTop: 16, fontWeight: 'bold' }}>
                                当前商品最低可设置为 {requiredMinimum}，是否调整到该值？
                            </p>
                        </div>
                    ),
                    okText: '确定',
                    cancelText: '取消',
                    onOk: async () => {
                        console.log('[MaxPurchaseQuantity] 用户确认使用推荐值:', requiredMinimum);
                        // 自动设置表单值为推荐的最小值
                        form.setFieldsValue({ maxQuantity: requiredMinimum });

                        try {
                            const updatedValues = await form.validateFields();
                            console.log('[MaxPurchaseQuantity] 重新提交数据:', updatedValues);
                            await executeCreateOrUpdate(updatedValues, false);

                            setModalVisible(false);
                            form.resetFields();
                            message.success((editingRecord ? '更新' : '创建') + '成功');
                            load(filters, currentPage, pageSize);
                        } catch (retryError: any) {
                            console.error('[MaxPurchaseQuantity] 重试失败:', retryError);
                            message.error((editingRecord ? '更新' : '创建') + '失败: ' + (retryError?.response?.data?.message || retryError?.message || '未知错误'));
                        }
                    },
                    onCancel: () => {
                        console.log('[MaxPurchaseQuantity] 用户取消操作');
                    },
                });
            } else {
                // 其他错误，直接显示错误消息
                console.log('[MaxPurchaseQuantity] 显示错误消息:', errorMessage);
                message.error((editingRecord ? '更新' : '创建') + '失败: ' + errorMessage);
            }
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
            .filter((col): col is ColumnType<MaxPurchaseQuantityItem> => col !== undefined && !hiddenColumns.has(col.key as string));

        // 添加操作列
        const actionColumn = {
            title: '操作',
            key: 'action',
            width: 150,
            fixed: 'right' as const,
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

        const colsWithAction = [...orderedCols, actionColumn];

        // 为列添加搜索筛选功能（只对非自动匹配的列）
        return addSearchFiltersToColumns(
            colsWithAction,
            columnSearchKeywords,
            (columnKey: string, keyword: string) => {
                setColumnSearchKeywords(prev => ({
                    ...prev,
                    [columnKey]: keyword,
                }));
            },
            (columnKey: string) => {
                setColumnSearchKeywords(prev => {
                    const newKeywords = { ...prev };
                    delete newKeywords[columnKey];
                    return newKeywords;
                });
            }
        );
    }, [hiddenColumns, columnOrder, baseColumns, columnSearchKeywords]);

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="门店管理 - 单次最高采购量"
                extra={
                    <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            新增
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setBatchModalVisible(true)}>
                            批量新增
                        </Button>
                        <Button onClick={() => setExportModalVisible(true)}>导出数据</Button>
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
                <ResponsiveTable<MaxPurchaseQuantityItem>
                    tableId="max-purchase-quantity"
                    columns={columns as any}
                    dataSource={data}
                    rowKey={(r) => `${r["仓店名称"]}_${r["SKU"]}`}
                    loading={loading}
                    scroll={{ x: 2500, y: 600 }}
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: total,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50'],
                        showTotal: (total, range) => {
                            const filterHint = hasActiveColumnFilters ? '（已筛选）' : '';
                            return `第 ${range[0]}-${range[1]} 条，共 ${total} 条${filterHint}`;
                        },
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
                        <Input
                            placeholder="请输入SKU"
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
                    <Form.Item
                        label="备注"
                        name="remark"
                    >
                        <Input.TextArea placeholder="请输入备注" rows={3} />
                    </Form.Item>
                    <Form.Item
                        label="备注"
                        name="remark"
                    >
                        <Input.TextArea placeholder="请输入备注" rows={3} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增模态框 */}
            <BatchAddModal<MaxPurchaseQuantityItem>
                open={batchModalVisible}
                title="批量新增记录"
                hint="您可以从 Excel 中复制数据（包含仓店名称、SKU、单次最高采购量(基本单位)、备注列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件。"
                fields={useMemo<FieldConfig<MaxPurchaseQuantityItem>[]>(() => ([
                    { key: '仓店名称', label: '仓店名称', excelHeaderName: '仓店名称', required: true, index: 0 },
                    { key: 'SKU', label: 'SKU', excelHeaderName: 'SKU', required: true, index: 1 },
                    { key: '单次最高采购量(基本单位)', label: '单次最高采购量(基本单位)', excelHeaderName: '单次最高采购量(基本单位)', required: true, index: 2 },
                    { key: '备注', label: '备注', excelHeaderName: '备注', required: false, index: 3 },
                ]), [])}
                formatHint="格式：仓店名称	SKU	单次最高采购量(基本单位)	备注"
                example="仓店A	SKU000000000000001	100	说明"
                onCancel={() => setBatchModalVisible(false)}
                onSave={useCallback(async (validItems: MaxPurchaseQuantityItem[]) => {
                    try {
                        let success = 0;
                        let failed = 0;
                        const errors: string[] = [];
                        for (const item of validItems) {
                            try {
                                await maxPurchaseQuantityApi.create({
                                    storeName: item['仓店名称'],
                                    sku: item['SKU'],
                                    maxQuantity: Number(item['单次最高采购量(基本单位)'] || 0),
                                    remark: item['备注'] || undefined,
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
                }, [filters, currentPage, pageSize, load])}
                createItem={useCallback((parts: string[]) => {
                    return {
                        '仓店名称': parts[0] || '',
                        'SKU': parts[1] || '',
                        '单次最高采购量(基本单位)': parts[2] ? Number(parts[2]) : 0,
                        '备注': parts[3] || null,
                    } as Partial<MaxPurchaseQuantityItem>;
                }, [])}
            />

            {/* 导出数据模态框 */}
            <ExcelExportModal<MaxPurchaseQuantityItem>
                open={exportModalVisible}
                title="导出单次最高采购量数据"
                fields={useMemo<ExcelExportField[]>(() => ([
                    { key: '仓店名称', label: '仓店名称' },
                    { key: 'SKU', label: 'SKU' },
                    { key: '商品名称', label: '商品名称' },
                    { key: '商品UPC', label: '商品UPC' },
                    { key: '规格', label: '规格' },
                    { key: '采购单价 (基础单位)', label: '采购单价 (基础单位)' },
                    { key: '采购单价 (采购单位)', label: '采购单价 (采购单位)' },
                    { key: '单次最高采购量(基本单位)', label: '单次最高采购量(基本单位)' },
                    { key: '备注', label: '备注' },
                    { key: '修改人', label: '修改人' },
                ]), [])}
                selectedData={[]}
                fetchAllData={useCallback(async () => {
                    const all: MaxPurchaseQuantityItem[] = [];
                    let page = 1;
                    const limit = 100000;
                    let total = 0;
                    // 使用当前筛选条件导出
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const res = await maxPurchaseQuantityApi.list(filters, page, limit);
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
                fileName="单次最高采购量"
            />
        </div>
    );
}

