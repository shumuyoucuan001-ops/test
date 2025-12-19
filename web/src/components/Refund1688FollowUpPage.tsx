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
    Table,
    Tag,
} from 'antd';
import { ColumnType } from 'antd/es/table';
import { useEffect, useState } from 'react';

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

    // 加载数据
    const loadData = async () => {
        setLoading(true);
        try {
            const result = await refund1688Api.getAll({
                page: currentPage,
                limit: pageSize,
                keyword: searchText || undefined,
                ...searchFilters,
            });
            setData(result.data || []);
            setTotal(result.total || 0);
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

    // 打开编辑弹窗
    const handleEdit = (record: Refund1688FollowUp) => {
        setEditingRecord(record);
        form.setFieldsValue({
            ...record,
        });
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
            title: '订单状态',
            dataIndex: '订单状态',
            key: '订单状态',
            width: 120,
            render: (text) => text ? <Tag color="blue">{text}</Tag> : '-',
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
            render: (text, record) => (
                <Space>
                    <span>{text || '-'}</span>
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
        },
        {
            title: '跟进情况/备注',
            dataIndex: '跟进情况备注',
            key: '跟进情况备注',
            width: 200,
            ellipsis: true,
        },
        {
            title: '出库单号（回库）',
            dataIndex: '出库单号回库',
            key: '出库单号回库',
            width: 150,
        },
        {
            title: '差异单/出库单详情',
            dataIndex: '差异单出库单详情',
            key: '差异单出库单详情',
            width: 180,
            ellipsis: true,
        },
        {
            title: '退款详情',
            dataIndex: '退款详情',
            key: '退款详情',
            width: 150,
            ellipsis: true,
        },
        {
            title: '物流单号',
            dataIndex: '物流单号',
            key: '物流单号',
            width: 150,
        },
        {
            title: '发货截图',
            dataIndex: '发货截图',
            key: '发货截图',
            width: 120,
            render: (text) => text ? (
                <Image
                    width={50}
                    height={50}
                    src={text}
                    alt="发货截图"
                    style={{ objectFit: 'cover' }}
                />
            ) : '-',
        },
        {
            title: '跟进人',
            dataIndex: '跟进人',
            key: '跟进人',
            width: 100,
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            fixed: 'right',
            render: (_, record) => (
                <Button type="primary" size="small" onClick={() => handleEdit(record)}>
                    编辑
                </Button>
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
                            setSearchText('');
                            setSearchFilters({});
                            setCurrentPage(1);
                            loadData();
                        }}>重置</Button>
                        <Button icon={<SyncOutlined />} onClick={loadData} loading={loading}>
                            刷新
                        </Button>
                    </Space>
                }
            >
                <Table
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

                    <Form.Item label="出库单号（回库）" name="出库单号回库">
                        <Input />
                    </Form.Item>

                    <Form.Item label="差异单/出库单详情" name="差异单出库单详情">
                        <TextArea rows={3} />
                    </Form.Item>

                    <Form.Item label="退款详情" name="退款详情">
                        <TextArea rows={3} />
                    </Form.Item>

                    <Form.Item label="物流单号" name="物流单号">
                        <Input />
                    </Form.Item>

                    <Form.Item label="发货截图" name="发货截图">
                        <TextArea rows={2} placeholder="图片URL，多个用逗号分隔" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
