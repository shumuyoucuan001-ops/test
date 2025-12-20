"use client";

import { refund1688Api, Refund1688FollowUp } from '@/lib/api';
import { LinkOutlined, SyncOutlined } from '@ant-design/icons';
import {
    Button,
    Card,
    Form,
    Image,
    Input,
    message,
    Modal,
    Select,
    Space,
    Tag
} from 'antd';
import { ColumnType } from 'antd/es/table';
import Upload from 'antd/es/upload';
import type { RcFile } from 'antd/es/upload/interface';
import { useEffect, useState } from 'react';
import ResponsiveTable from './ResponsiveTable';

const { TextArea } = Input;
const { Option } = Select;

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
    const [data, setData] = useState<Refund1688FollowUp[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Refund1688FollowUp | null>(null);
    const [form] = Form.useForm();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [searchText, setSearchText] = useState('');
    const [searchFilters, setSearchFilters] = useState<{
        收货人姓名?: string;
        订单编号?: string;
        订单状态?: string;
        进度追踪?: string;
        采购单号?: string;
    }>({});
    const [followUpImagePreview, setFollowUpImagePreview] = useState<string | undefined>(undefined);
    const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
    const [imageCache, setImageCache] = useState<Record<string, string>>({});
    const [canEdit, setCanEdit] = useState<boolean>(true); // 默认允许编辑

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

            const result = await refund1688Api.getAll({
                page: finalPage,
                limit: pageSize,
                keyword: finalKeyword,
                ...finalFilters,
            });
            setData(result.data || []);
            setTotal(result.total || 0);
            setCanEdit(result.canEdit !== false); // 如果返回false则不允许编辑，否则允许
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
            if (result.跟进情况图片) {
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
        });

        // 如果有缓存，使用缓存；否则如果有图片标识，按需加载
        const orderNo = record.订单编号;
        if (imageCache[orderNo]) {
            setFollowUpImagePreview(imageCache[orderNo]);
        } else if (record.有跟进情况图片 === 1) {
            // 按需加载图片
            try {
                const result = await refund1688Api.getFollowUpImage(orderNo);
                if (result.跟进情况图片) {
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

    // 跳转到订单详情页
    const handleViewOrder = (orderNo: string) => {
        const url = `https://air.1688.com/app/ctf-page/trade-order-detail/index.html?orderId=${orderNo}`;
        window.open(url, '_blank');
    };


    useEffect(() => {
        loadData();
    }, [currentPage, pageSize]);

    // 处理搜索
    const handleSearch = () => {
        setCurrentPage(1); // 重置到第一页
        loadData();
    };

    const columns: ColumnType<Refund1688FollowUp>[] = [
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
            render: (_, record) => (
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
            render: (text, record) => (
                <Space>
                    <span>{text || '-'}</span>
                    <Button
                        size="small"
                        type="link"
                        icon={<SyncOutlined />}
                        onClick={() => handleRefreshOrderStatus(record)}
                        disabled={!record.http请求url}
                        title="刷新订单状态"
                    />
                </Space>
            ),
        },
        {
            title: '请求获取退款状态',
            dataIndex: '请求获取退款状态',
            key: '请求获取退款状态',
            width: 180,
            ...({ mobileRequired: true } as any), // 移动端必须显示
            render: (text, record) => (
                <Space>
                    {text ? <Tag color="blue">{text}</Tag> : '-'}
                    <Button
                        size="small"
                        type="link"
                        icon={<SyncOutlined />}
                        onClick={() => handleRefreshRefundStatus(record)}
                        disabled={!record.http请求url}
                        title="刷新退款状态"
                    />
                </Space>
            ),
        },
        {
            title: '进度追踪',
            dataIndex: '进度追踪',
            key: '进度追踪',
            width: 180,
            render: (text) => {
                const colors: Record<string, string> = {
                    '等待商家同意退换': 'orange',
                    '商家拒退-修改后申请': 'red',
                    '换货/退货给商家': 'blue',
                    '等待商家确认收货': 'cyan',
                    '退款/退换货成功': 'green',
                    '申请售后流程(已收货)': 'purple',
                    '投诉商家(退换不成功)': 'volcano',
                };
                return text ? <Tag color={colors[text] || 'default'}>{text}</Tag> : '-';
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
            render: (text, record) => {
                const orderNo = record.订单编号;
                const hasImage = record.有跟进情况图片 === 1;
                const cachedImage = imageCache[orderNo];
                const isLoading = loadingImages[orderNo];

                // 如果已缓存，显示图片
                if (cachedImage) {
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
            render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            fixed: 'right',
            render: (_, record) => (
                canEdit ? (
                    <Button type="primary" size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                ) : (
                    <span style={{ color: '#999' }}>仅查看</span>
                )
            ),
        },
    ];

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
                            placeholder="订单状态"
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
                            // 立即使用空参数加载数据，确保使用新参数而不是状态值
                            loadData({
                                page: 1,
                                keyword: '', // 使用空字符串，loadData会将其转换为undefined
                                filters: {}
                            });
                        }}>重置</Button>
                        <Button
                            type="primary"
                            onClick={async () => {
                                try {
                                    message.loading({ content: '正在同步数据...', key: 'syncData' });
                                    const result = await refund1688Api.syncData();
                                    message.success({
                                        content: result.message || `同步成功，共更新 ${result.updatedCount} 条记录`,
                                        key: 'syncData',
                                        duration: 5
                                    });
                                    await loadData(); // 重新加载数据
                                } catch (error: any) {
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
                    </Space>
                }
            >
                <ResponsiveTable<Refund1688FollowUp>
                    columns={columns}
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
                            {followUpImagePreview ? (
                                <Image
                                    width={120}
                                    height={120}
                                    src={followUpImagePreview}
                                    alt="跟进情况图片预览"
                                    style={{ objectFit: 'cover' }}
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
                                        // 使用空字符串而不是 undefined，确保提交时会带上该字段，从而真正清空数据库中的值
                                        form.setFieldsValue({ 跟进情况图片: '' });
                                        setFollowUpImagePreview(undefined);
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
