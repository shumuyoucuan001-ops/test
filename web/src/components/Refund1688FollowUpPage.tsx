"use client";

import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';
import { refund1688Api, Refund1688FollowUp } from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';
import { LinkOutlined, SettingOutlined, SyncOutlined } from '@ant-design/icons';
import {
    Button,
    Card,
    Checkbox,
    Form,
    Image,
    Input,
    message,
    Modal,
    Popconfirm,
    Popover,
    Select,
    Space,
    Tag
} from 'antd';
import { ColumnType } from 'antd/es/table';
import Upload from 'antd/es/upload';
import type { RcFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useRef, useState } from 'react';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { TextArea } = Input;
const { Option } = Select;

// 页面唯一标识符
const PAGE_KEY = 'refund-1688-follow-up';

// 进度追踪状态选项
const PROGRESS_STATUS_OPTIONS = [
    '等待商家同意退换',
    '商家拒退-修改后申退',
    '换货/退货给商家',
    '等待商家确认收货',
    '退款/退换货成功',
    '申请售后流程(已收货)',
    '投诉商家(退换不成功)',
];

export default function Refund1688FollowUpPage() {
    // 定义默认状态
    const defaultState = {
        currentPage: 1,
        pageSize: 20,
        searchText: '',
        searchFilters: {} as {
            收货人姓名?: string;
            订单编号?: string;
            订单状态?: string;
            进度追踪?: string;
            采购单号?: string;
        },
    };

    // 恢复保存的状态
    const restoredState = usePageStateRestore(PAGE_KEY, defaultState);

    const [data, setData] = useState<Refund1688FollowUp[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Refund1688FollowUp | null>(null);
    const [form] = Form.useForm();
    const [currentPage, setCurrentPage] = useState(restoredState?.currentPage ?? defaultState.currentPage);
    const [pageSize, setPageSize] = useState(restoredState?.pageSize ?? defaultState.pageSize);
    const [searchText, setSearchText] = useState(restoredState?.searchText ?? defaultState.searchText);
    const [searchFilters, setSearchFilters] = useState<{
        收货人姓名?: string;
        订单编号?: string;
        订单状态?: string;
        进度追踪?: string;
        采购单号?: string;
    }>(restoredState?.searchFilters ?? defaultState.searchFilters);

    // 保存状态（自动保存，防抖 300ms）
    usePageStateSave(PAGE_KEY, {
        currentPage,
        pageSize,
        searchText,
        searchFilters,
    });
    const [followUpImagePreview, setFollowUpImagePreview] = useState<string | undefined>(undefined);
    const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
    const [imageCache, setImageCache] = useState<Record<string, string>>({});
    const [canEdit, setCanEdit] = useState<boolean>(true); // 默认允许编辑
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]); // 选中的行
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set()); // 隐藏的列
    const [columnOrder, setColumnOrder] = useState<string[]>([]); // 列顺序
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false); // 列设置弹窗状态

    // 从 localStorage 加载列显示偏好和顺序
    useEffect(() => {
        const savedHiddenColumns = localStorage.getItem('refund1688_hidden_columns');
        if (savedHiddenColumns) {
            try {
                const parsed = JSON.parse(savedHiddenColumns);
                setHiddenColumns(new Set(parsed));
            } catch (error) {
                console.error('加载列显示偏好失败:', error);
            }
        }

        const savedColumnOrder = localStorage.getItem('refund1688_column_order');
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
            localStorage.setItem('refund1688_hidden_columns', JSON.stringify(Array.from(hidden)));
        } catch (error) {
            console.error('保存列显示偏好失败:', error);
        }
    };

    // 保存列顺序到 localStorage
    const saveColumnOrder = (order: string[]) => {
        try {
            localStorage.setItem('refund1688_column_order', JSON.stringify(order));
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

    // 移动列位置（向上或向下）
    const moveColumn = (columnKey: string, direction: 'up' | 'down') => {
        // 获取默认列顺序
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

        if (index === -1) return; // 列不在顺序列表中

        if (direction === 'up' && index > 0) {
            // 向上移动
            [currentOrder[index], currentOrder[index - 1]] = [currentOrder[index - 1], currentOrder[index]];
        } else if (direction === 'down' && index < currentOrder.length - 1) {
            // 向下移动
            [currentOrder[index], currentOrder[index + 1]] = [currentOrder[index + 1], currentOrder[index]];
        }

        setColumnOrder(currentOrder);
        saveColumnOrder(currentOrder);
    };

    // 加载数据
    const loadData = async (overrideParams?: {
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

            const result = await refund1688Api.getAll({
                page: finalPage,
                limit: pageSize,
                keyword: finalKeyword,
                ...cleanFilters,
            });
            setData(result?.data || []);
            setTotal(result?.total || 0);
            setCanEdit(result?.canEdit !== false); // 如果返回false则不允许编辑，否则允许
            setSelectedRowKeys([]); // 加载新数据时清空选中
        } catch (error) {
            message.error('加载数据失败');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // 刷新订单状态
    const handleRefreshOrderStatus = async (record: Refund1688FollowUp) => {
        if (!record.http请求url) {
            message.warning('缺少HTTP请求URL');
            return;
        }

        try {
            message.loading({ content: '正在获取订单状态...', key: 'orderStatus' });
            const result = await refund1688Api.getOrderStatus(record.订单编号);
            message.success({ content: '订单状态已更新', key: 'orderStatus' });
            await loadData(); // 重新加载数据
        } catch (error: any) {
            message.error({
                content: error?.response?.data?.message || '获取订单状态失败',
                key: 'orderStatus'
            });
            console.error(error);
        }
    };

    // 刷新退款状态
    const handleRefreshRefundStatus = async (record: Refund1688FollowUp) => {
        if (!record.http请求url) {
            message.warning('缺少HTTP请求URL');
            return;
        }

        try {
            message.loading({ content: '正在获取退款状态...', key: 'refundStatus' });
            const result = await refund1688Api.getRefundStatus(record.订单编号);
            message.success({ content: '退款状态已更新', key: 'refundStatus' });
            await loadData(); // 重新加载数据
        } catch (error: any) {
            message.error({
                content: error?.response?.data?.message || '获取退款状态失败',
                key: 'refundStatus'
            });
            console.error(error);
        }
    };

    // 按需加载跟进情况图片
    const handleLoadImage = async (record: Refund1688FollowUp) => {
        const orderNo = record.订单编号;

        // 如果已经缓存，直接使用
        if (imageCache[orderNo]) {
            return;
        }

        // 如果正在加载，不重复请求
        if (loadingImages[orderNo]) {
            return;
        }

        setLoadingImages(prev => ({ ...prev, [orderNo]: true }));

        try {
            const result = await refund1688Api.getFollowUpImage(orderNo);
            if (result?.跟进情况图片 && typeof result.跟进情况图片 === 'string' && result.跟进情况图片.trim() !== '') {
                // 直接使用OSS URL，不需要base64转换
                setImageCache(prev => ({ ...prev, [orderNo]: result.跟进情况图片! }));
            } else {
                message.info('该订单暂无跟进情况图片');
            }
        } catch (error: any) {
            message.error(error?.response?.data?.message || '加载图片失败');
            console.error(error);
        } finally {
            setLoadingImages(prev => ({ ...prev, [orderNo]: false }));
        }
    };

    // 打开编辑弹窗
    const handleEdit = async (record: Refund1688FollowUp) => {
        setEditingRecord(record);
        form.setFieldsValue({
            ...record,
            // 如果进度追踪为null或空，设置默认值
            进度追踪: record.进度追踪 || '等待商家同意退换',
        });

        // 如果有缓存，使用缓存；否则如果有图片标识，按需加载
        const orderNo = record.订单编号;
        if (imageCache[orderNo]) {
            setFollowUpImagePreview(imageCache[orderNo]);
        } else if (record.有跟进情况图片 === 1) {
            // 按需加载图片
            try {
                const result = await refund1688Api.getFollowUpImage(orderNo);
                if (result?.跟进情况图片 && typeof result.跟进情况图片 === 'string' && result.跟进情况图片.trim() !== '') {
                    // 直接使用OSS URL，不需要base64转换
                    setFollowUpImagePreview(result.跟进情况图片);
                    setImageCache(prev => ({ ...prev, [orderNo]: result.跟进情况图片! }));
                } else {
                    setFollowUpImagePreview(undefined);
                }
            } catch (error) {
                console.error('加载图片失败:', error);
                setFollowUpImagePreview(undefined);
            }
        } else {
            setFollowUpImagePreview(undefined);
        }

        setEditModalVisible(true);
    };

    // 保存编辑
    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            if (!editingRecord) return;

            // 移除跟进人字段，后端会自动从当前登录用户获取
            const { 跟进人, ...updateData } = values;

            await refund1688Api.update(editingRecord.订单编号, updateData);
            message.success('保存成功');
            setEditModalVisible(false);
            await loadData();
        } catch (error: any) {
            message.error(error?.response?.data?.message || '保存失败');
            console.error(error);
        }
    };

    // 删除记录
    const handleDelete = async (record: Refund1688FollowUp) => {
        if (!canEdit) {
            message.warning('您没有删除权限');
            return;
        }

        try {
            await refund1688Api.delete(record.订单编号);
            message.success('删除成功');
            await loadData();
        } catch (error: any) {
            message.error(error?.response?.data?.message || '删除失败');
        }
    };

    // 批量删除记录
    const handleBatchDelete = async () => {
        console.log('[批量删除] 开始执行，选中数量:', selectedRowKeys.length, 'canEdit:', canEdit);

        if (!canEdit) {
            message.warning('您没有删除权限');
            return;
        }

        if (selectedRowKeys.length === 0) {
            message.warning('请至少选择一条记录');
            return;
        }

        try {
            console.log('[批量删除] 用户确认删除，开始执行');
            const orderNos = selectedRowKeys.map(key => String(key));
            console.log('[批量删除] 准备删除的订单编号:', orderNos);

            const result = await refund1688Api.batchDelete(orderNos);
            console.log('[批量删除] 删除成功，结果:', result);

            message.success(result.message || `成功删除 ${result.deletedCount} 条记录`);
            setSelectedRowKeys([]); // 清空选中
            await loadData();
        } catch (error: any) {
            console.error('[批量删除] 删除失败:', error);
            message.error(error?.response?.data?.message || error?.message || '批量删除失败');
        }
    };

    // 全选/取消全选
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRowKeys(data.map(record => record.订单编号));
        } else {
            setSelectedRowKeys([]);
        }
    };

    // 单行选择
    const handleSelect = (record: Refund1688FollowUp, checked: boolean) => {
        if (checked) {
            setSelectedRowKeys([...selectedRowKeys, record.订单编号]);
        } else {
            setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.订单编号));
        }
    };

    // 跳转到订单详情页
    const handleViewOrder = (orderNo: string) => {
        const url = `https://air.1688.com/app/ctf-page/trade-order-detail/index.html?orderId=${orderNo}`;
        window.open(url, '_blank');
    };


    // 使用 ref 标记是否已经初始加载
    const hasInitialLoadRef = useRef(false);

    // 如果恢复了状态，需要重新加载数据（只在组件挂载时执行一次）
    useEffect(() => {
        if (!hasInitialLoadRef.current) {
            hasInitialLoadRef.current = true;
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 只在组件挂载时执行一次

    // 当 currentPage 或 pageSize 变化时加载数据（排除初始加载）
    useEffect(() => {
        // 只有在初始加载之后才响应 currentPage 和 pageSize 的变化
        if (hasInitialLoadRef.current) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageSize]);

    // 处理搜索
    const handleSearch = () => {
        setCurrentPage(1); // 重置到第一页
        loadData();
    };

    const columns: ColumnType<Refund1688FollowUp>[] = useMemo(() => [
        {
            title: (
                <Checkbox
                    checked={selectedRowKeys.length > 0 && selectedRowKeys.length === data.length}
                    indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < data.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                />
            ),
            key: 'selection',
            width: 60,
            fixed: 'left',
            render: (_: any, record: Refund1688FollowUp) => (
                <Checkbox
                    checked={selectedRowKeys.includes(record.订单编号)}
                    onChange={(e) => handleSelect(record, e.target.checked)}
                />
            ),
        },
        {
            title: '收货人姓名',
            dataIndex: '收货人姓名',
            key: '收货人姓名',
            width: 120,
            fixed: 'left',
        },
        {
            title: '订单编号',
            dataIndex: '订单编号',
            key: '订单编号',
            width: 180,
            fixed: 'left',
        },
        {
            title: '买家会员名',
            dataIndex: '买家会员名',
            key: '买家会员名',
            width: 150,
        },
        {
            title: '订单详情',
            key: '订单详情页',
            width: 120,
            render: (_: any, record: Refund1688FollowUp) => (
                <Button
                    type="link"
                    icon={<LinkOutlined />}
                    onClick={() => record.订单编号 && handleViewOrder(record.订单编号)}
                    disabled={!record.订单编号}
                >
                    查看详情
                </Button>
            ),
        },
        {
            title: '请求获取订单状态',
            dataIndex: '请求获取订单状态',
            key: '请求获取订单状态',
            width: 180,
            ...({ mobileRequired: true } as any), // 移动端必须显示
            render: (text: any, record: Refund1688FollowUp) => {
                if (!record) return '-';
                return (
                    <Space>
                        <span>{text || '-'}</span>
                        <Button
                            size="small"
                            type="link"
                            icon={<SyncOutlined />}
                            onClick={() => handleRefreshOrderStatus(record)}
                            disabled={!record?.http请求url}
                            title="刷新订单状态"
                        />
                    </Space>
                );
            },
        },
        {
            title: '请求获取退款状态',
            dataIndex: '请求获取退款状态',
            key: '请求获取退款状态',
            width: 180,
            ...({ mobileRequired: true } as any), // 移动端必须显示
            render: (text: any, record: Refund1688FollowUp) => {
                if (!record) return '-';
                return (
                    <Space>
                        {text ? <Tag color="blue">{text}</Tag> : '-'}
                        <Button
                            size="small"
                            type="link"
                            icon={<SyncOutlined />}
                            onClick={() => handleRefreshRefundStatus(record)}
                            disabled={!record?.http请求url}
                            title="刷新退款状态"
                        />
                    </Space>
                );
            },
        },
        {
            title: '进度追踪',
            dataIndex: '进度追踪',
            key: '进度追踪',
            width: 180,
            render: (text: any) => {
                // 如果进度追踪为null或空，显示默认值
                const displayText = text || '等待商家同意退换';
                const colors: Record<string, string> = {
                    '等待商家同意退换': 'orange',
                    '商家拒退-修改后申请': 'red',
                    '换货/退货给商家': 'blue',
                    '等待商家确认收货': 'cyan',
                    '退款/退换货成功': 'green',
                    '申请售后流程(已收货)': 'purple',
                    '投诉商家(退换不成功)': 'volcano',
                };
                return <Tag color={colors[displayText] || 'default'}>{displayText}</Tag>;
            },
        },
        {
            title: '采购单号',
            dataIndex: '采购单号',
            key: '采购单号',
            width: 150,
            ...({ mobileRequired: true } as any), // 移动端必须显示
        },
        {
            title: '跟进情况/备注',
            dataIndex: '跟进情况备注',
            key: '跟进情况备注',
            width: 200,
            ellipsis: true,
            ...({ mobileRequired: true } as any), // 移动端必须显示
        },
        {
            title: '跟进情况/图片',
            dataIndex: '跟进情况图片',
            key: '跟进情况图片',
            width: 150,
            render: (text: any, record: Refund1688FollowUp) => {
                if (!record) return '-';
                const orderNo = record.订单编号;
                const hasImage = record.有跟进情况图片 === 1;
                const cachedImage = imageCache[orderNo];
                const isLoading = loadingImages[orderNo];

                // 如果已缓存，显示图片
                if (cachedImage && typeof cachedImage === 'string' && cachedImage.trim() !== '') {
                    return (
                        <Image
                            width={50}
                            height={50}
                            src={cachedImage}
                            alt="跟进情况图片"
                            style={{ objectFit: 'cover', cursor: 'pointer' }}
                            preview={{
                                mask: '点击查看大图'
                            }}
                        />
                    );
                }

                // 如果有图片但未加载，显示加载按钮
                if (hasImage) {
                    return (
                        <Button
                            size="small"
                            type="link"
                            loading={isLoading}
                            onClick={() => handleLoadImage(record)}
                        >
                            {isLoading ? '加载中...' : '查看图片'}
                        </Button>
                    );
                }

                // 没有图片
                return '-';
            },
        },
        {
            title: '差异单/出库单详情',
            dataIndex: '差异单出库单详情',
            key: '差异单出库单详情',
            width: 180,
            ellipsis: true,
        },
        {
            title: '牵牛花物流单号',
            dataIndex: '牵牛花物流单号',
            key: '牵牛花物流单号',
            width: 150,
            ...({ mobileRequired: true } as any), // 移动端必须显示
        },
        {
            title: '跟进人',
            dataIndex: '跟进人',
            key: '跟进人',
            width: 100,
        },
        {
            title: '跟进时间',
            dataIndex: '跟进时间',
            key: '跟进时间',
            width: 180,
            render: (text: any) => formatDateTime(text),
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            fixed: 'right',
            render: (_: any, record: Refund1688FollowUp) => {
                if (!record) return '-';
                return (
                    canEdit ? (
                        <Space>
                            <Button type="primary" size="small" onClick={() => handleEdit(record)}>
                                编辑
                            </Button>
                            <Popconfirm
                                title="确认删除？"
                                description={`确定要删除订单编号为 "${record.订单编号}" 的记录吗？此操作不可恢复。`}
                                onConfirm={() => handleDelete(record)}
                                okText="确定"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                            >
                                <Button
                                    danger
                                    size="small"
                                >
                                    删除
                                </Button>
                            </Popconfirm>
                        </Space>
                    ) : (
                        <span style={{ color: '#999' }}>仅查看</span>
                    )
                );
            },
        },
    ], [selectedRowKeys, data.length, imageCache, loadingImages, canEdit]);

    // 获取可配置的列（排除 selection 和 action）
    const configurableColumns = columns.filter(col => {
        const key = col.key as string;
        return key !== 'selection' && key !== 'action';
    });

    // 获取默认列顺序
    const getDefaultColumnOrder = (): string[] => {
        return configurableColumns.map(col => col.key as string);
    };

    // 获取列顺序（如果未设置，使用默认顺序）
    const defaultOrder = getDefaultColumnOrder();
    const currentColumnOrder = columnOrder.length > 0
        ? columnOrder
        : defaultOrder;

    // 如果列顺序为空，初始化默认顺序（仅在首次加载时）
    useEffect(() => {
        if (columnOrder.length === 0 && defaultOrder.length > 0) {
            const savedOrder = localStorage.getItem('refund1688_column_order');
            if (!savedOrder) {
                // 首次加载，保存默认顺序
                const order = getDefaultColumnOrder();
                saveColumnOrder(order);
                setColumnOrder(order);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 根据顺序和隐藏状态排序列
    const sortedColumns = [
        // 首先添加 selection 列
        columns.find(col => col.key === 'selection'),
        // 然后按照顺序添加可配置的列
        ...currentColumnOrder
            .map(key => configurableColumns.find(col => col.key === key))
            .filter(Boolean) as ColumnType<Refund1688FollowUp>[],
        // 最后添加 action 列
        columns.find(col => col.key === 'action'),
    ].filter(Boolean) as ColumnType<Refund1688FollowUp>[];

    // 过滤列：根据隐藏状态过滤，但保留 selection 和 action 列
    const visibleColumns = sortedColumns.filter(col => {
        const key = col.key as string;
        // 始终显示选择列和操作列
        if (key === 'selection' || key === 'action') {
            return true;
        }
        // 其他列根据隐藏状态决定
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
                title="1688退款(退货)跟进情况"
                extra={
                    <Space wrap>
                        <Input
                            placeholder="收货人姓名"
                            style={{ width: 150 }}
                            value={searchFilters.收货人姓名}
                            onChange={(e) => setSearchFilters({ ...searchFilters, 收货人姓名: e.target.value })}
                            allowClear
                        />
                        <Input
                            placeholder="订单编号"
                            style={{ width: 150 }}
                            value={searchFilters.订单编号}
                            onChange={(e) => setSearchFilters({ ...searchFilters, 订单编号: e.target.value })}
                            allowClear
                        />
                        <Input
                            placeholder="请求获取退款状态"
                            style={{ width: 150 }}
                            value={searchFilters.订单状态}
                            onChange={(e) => setSearchFilters({ ...searchFilters, 订单状态: e.target.value })}
                            allowClear
                        />
                        <Select
                            placeholder="进度追踪"
                            style={{ width: 180 }}
                            value={searchFilters.进度追踪}
                            onChange={(value) => setSearchFilters({ ...searchFilters, 进度追踪: value })}
                            allowClear
                        >
                            {PROGRESS_STATUS_OPTIONS.map(status => (
                                <Option key={status} value={status}>{status}</Option>
                            ))}
                        </Select>
                        <Input
                            placeholder="采购单号"
                            style={{ width: 150 }}
                            value={searchFilters.采购单号}
                            onChange={(e) => setSearchFilters({ ...searchFilters, 采购单号: e.target.value })}
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
                            // 先清空状态
                            setSearchText('');
                            setSearchFilters({});
                            setCurrentPage(1);
                            setSelectedRowKeys([]); // 重置时清空选中
                            // 立即使用空参数加载数据，确保使用新参数而不是状态值
                            loadData({
                                page: 1,
                                keyword: '', // 使用空字符串，loadData会将其转换为undefined
                                filters: {}
                            });
                        }}>重置</Button>
                        <Button
                            type="primary"
                            disabled={!canEdit}
                            onClick={async () => {
                                if (!canEdit) {
                                    message.warning('您没有编辑权限，无法执行同步操作');
                                    return;
                                }
                                const hide = message.loading({ content: '正在同步数据...', key: 'syncData', duration: 0 });
                                try {
                                    const result = await refund1688Api.syncData();
                                    hide();
                                    message.success({
                                        content: result?.message || `同步成功，共更新 ${result?.updatedCount || 0} 条记录`,
                                        key: 'syncData',
                                        duration: 5
                                    });
                                    await loadData(); // 重新加载数据
                                } catch (error: any) {
                                    hide();
                                    message.error({
                                        content: error?.response?.data?.message || '同步数据失败',
                                        key: 'syncData'
                                    });
                                    console.error(error);
                                }
                            }}
                        >
                            同步数据
                        </Button>
                        {selectedRowKeys.length > 0 && (
                            <Popconfirm
                                title="确认批量删除？"
                                description={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`}
                                onConfirm={handleBatchDelete}
                                okText="确定"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                                disabled={!canEdit}
                            >
                                <Button
                                    danger
                                    disabled={!canEdit}
                                >
                                    批量删除 ({selectedRowKeys.length})
                                </Button>
                            </Popconfirm>
                        )}
                        <Popover
                            content={columnSettingsContent}
                            title={null}
                            trigger="click"
                            placement="bottomRight"
                            open={columnSettingsOpen}
                            onOpenChange={setColumnSettingsOpen}
                        >
                            <Button icon={<SettingOutlined />}>
                                列设置
                            </Button>
                        </Popover>
                    </Space>
                }
            >
                <ResponsiveTable<Refund1688FollowUp>
                    tableId="refund-1688-follow-up"
                    columns={visibleColumns}
                    dataSource={data}
                    rowKey="订单编号"
                    loading={loading}
                    scroll={{ x: 2500, y: 600 }}
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: total,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50', '100', '200'],
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, size) => {
                            setCurrentPage(page);
                            if (size && size !== pageSize) {
                                setPageSize(size);
                                setCurrentPage(1); // 改变页面大小时重置到第一页
                            }
                        },
                    }}
                />
            </Card>

            {/* 编辑弹窗 */}
            <Modal
                title="编辑退款跟进信息"
                open={editModalVisible}
                onCancel={() => setEditModalVisible(false)}
                onOk={handleSave}
                width={800}
                okText="保存"
                cancelText="取消"
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="订单编号" name="订单编号">
                        <Input disabled />
                    </Form.Item>

                    <Form.Item label="请求获取订单状态" name="请求获取订单状态">
                        <Input disabled />
                    </Form.Item>

                    <Form.Item label="请求获取退款状态" name="请求获取退款状态">
                        <Input disabled />
                    </Form.Item>

                    <Form.Item label="进度追踪" name="进度追踪">
                        <Select placeholder="请选择进度状态">
                            {PROGRESS_STATUS_OPTIONS.map(status => (
                                <Option key={status} value={status}>
                                    {status}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label="采购单号" name="采购单号">
                        <Input />
                    </Form.Item>

                    <Form.Item label="跟进情况/备注" name="跟进情况备注">
                        <TextArea rows={4} />
                    </Form.Item>

                    <Form.Item label="跟进情况/图片" name="跟进情况图片">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {followUpImagePreview && typeof followUpImagePreview === 'string' && followUpImagePreview.trim() !== '' ? (
                                <Image
                                    width={120}
                                    height={120}
                                    src={followUpImagePreview}
                                    alt="跟进情况图片预览"
                                    style={{ objectFit: 'cover' }}
                                    preview={{
                                        mask: '点击查看大图'
                                    }}
                                />
                            ) : (
                                <span style={{ color: '#999' }}>当前暂无图片</span>
                            )}
                            <Upload
                                showUploadList={false}
                                accept="image/*"
                                beforeUpload={(file: RcFile) => {
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        const base64 = e.target?.result as string;
                                        form.setFieldsValue({ 跟进情况图片: base64 });
                                        setFollowUpImagePreview(base64);
                                    };
                                    reader.readAsDataURL(file);
                                    // 阻止 Upload 自己上传，改为表单统一提交
                                    return false;
                                }}
                            >
                                <Button type="primary">选择图片</Button>
                            </Upload>
                            {followUpImagePreview && (
                                <Button
                                    danger
                                    onClick={() => {
                                        // 使用空字符串，确保提交时会带上该字段，从而真正清空数据库中的值
                                        form.setFieldValue('跟进情况图片', '');
                                        setFollowUpImagePreview(undefined);
                                        // 同时清除缓存中的图片
                                        if (editingRecord?.订单编号) {
                                            setImageCache(prev => {
                                                const newCache = { ...prev };
                                                delete newCache[editingRecord.订单编号];
                                                return newCache;
                                            });
                                        }
                                    }}
                                >
                                    清除图片
                                </Button>
                            )}
                        </Space>
                    </Form.Item>

                    <Form.Item label="差异单/出库单详情" name="差异单出库单详情">
                        <TextArea rows={3} />
                    </Form.Item>

                    <Form.Item label="牵牛花物流单号" name="牵牛花物流单号">
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
