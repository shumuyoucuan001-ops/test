"use client";

import { OpsExclusionItem, opsExclusionApi } from "@/lib/api";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Space, Table, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof OpsExclusionItem, string> = {
    "视图名称": "视图名称",
    "门店编码": "门店编码",
    "SKU编码": "SKU编码",
    "SPU编码": "SPU编码",
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
    const [batchItems, setBatchItems] = useState<OpsExclusionItem[]>([]); // 批量新增的数据
    const [searchText, setSearchText] = useState(''); // 总搜索（全字段）
    const [searchFilters, setSearchFilters] = useState<{
        视图名称?: string;
        门店编码?: string;
        SKU编码?: string;
        SPU编码?: string;
    }>({});

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
            };
            if (editing) {
                await opsExclusionApi.update(editing, submitData);
                message.success("更新成功");
            } else {
                await opsExclusionApi.create(submitData);
                message.success("新增成功");
            }
            setModalOpen(false);
            load();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.message || "保存失败");
            console.error(e);
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
        setBatchItems([]);
    };

    // 处理粘贴事件（参考 purchase-pass-difference 的方式）
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');

        // 将粘贴的内容按行分割，过滤空行
        const lines = pastedText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            message.warning('粘贴的内容为空');
            return;
        }

        // 解析每行为多个字段（支持制表符、逗号、多个空格分隔）
        const newItems: OpsExclusionItem[] = [];
        for (const line of lines) {
            let parts: string[];

            // 优先使用制表符分隔（Excel 粘贴通常是制表符）
            if (line.includes('\t')) {
                parts = line.split('\t').map(p => p.trim());
            }
            // 其次使用逗号分隔
            else if (line.includes(',')) {
                parts = line.split(',').map(p => p.trim());
            }
            // 最后使用多个空格分隔
            else {
                parts = line.split(/\s{2,}/).map(p => p.trim());
            }

            // 确保至少有视图名称（必填字段）
            if (parts.length >= 1 && parts[0]) {
                newItems.push({
                    '视图名称': parts[0] || '',
                    '门店编码': parts[1] || '',
                    'SKU编码': parts[2] || '',
                    'SPU编码': parts[3] || '',
                });
            }
        }

        if (newItems.length > 0) {
            setBatchItems(prev => [...prev, ...newItems]);
            message.success(`已粘贴 ${newItems.length} 条数据`);
        } else {
            message.warning('未能解析出有效数据，请检查格式');
        }

        // 清空输入框
        const target = e.target as HTMLTextAreaElement;
        if (target) {
            target.value = '';
        }
    }, [message]);

    // 批量保存
    const handleBatchSave = async () => {
        if (batchItems.length === 0) {
            message.warning('请先粘贴数据');
            return;
        }

        // 过滤掉视图名称为空的项
        const validItems = batchItems.filter(item => item['视图名称']);

        if (validItems.length === 0) {
            message.warning('请至少填写一条有效数据（视图名称为必填）');
            return;
        }

        try {
            const result = await opsExclusionApi.batchCreate(validItems);
            message.success(result.message);
            if (result.errors && result.errors.length > 0) {
                message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
            }

            setBatchModalOpen(false);
            setBatchItems([]);
            load();
        } catch (e: any) {
            message.error(e?.response?.data?.message || e?.message || "批量创建失败");
            console.error(e);
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

        const baseCols = (Object.keys(fieldLabels) as (keyof OpsExclusionItem)[]).map((key) => ({
            title: fieldLabels[key],
            dataIndex: key,
            key,
        }));
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
        return [selectionCol, ...baseCols, actionCol];
    }, [data, selectedRowKeys]);

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
                    columns={columns as any}
                    dataSource={data}
                    rowKey={getRowKey}
                    loading={loading}
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
                        <Input maxLength={64} />
                    </Form.Item>
                    <Form.Item name="SPU编码" label="SPU编码">
                        <Input maxLength={64} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增弹窗 */}
            <Modal
                open={batchModalOpen}
                title="批量新增规则"
                onCancel={() => {
                    setBatchModalOpen(false);
                    setBatchItems([]);
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
                        提示：您可以从 Excel 中复制数据（包含视图名称、门店编码、SKU编码、SPU编码列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）
                    </div>
                    <Input.TextArea
                        placeholder="在此处粘贴 Excel 数据（Ctrl+V），每行一条记录，字段用制表符或逗号分隔&#10;格式：视图名称	门店编码	SKU编码	SPU编码&#10;示例：视图1	门店1	SKU1	SPU1"
                        rows={4}
                        onPaste={handlePaste}
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 14,
                        }}
                    />
                </div>

                {/* 预览表格 */}
                {batchItems.length > 0 ? (
                    <Table
                        columns={[
                            {
                                title: '视图名称',
                                dataIndex: '视图名称',
                                key: '视图名称',
                                render: (text: string) => (
                                    <span style={{ color: !text ? 'red' : 'inherit' }}>
                                        {text || '(必填)'}
                                    </span>
                                ),
                            },
                            { title: '门店编码', dataIndex: '门店编码', key: '门店编码' },
                            { title: 'SKU编码', dataIndex: 'SKU编码', key: 'SKU编码' },
                            { title: 'SPU编码', dataIndex: 'SPU编码', key: 'SPU编码' },
                            {
                                title: '操作',
                                key: 'action',
                                width: 100,
                                render: (_: any, record: OpsExclusionItem, index: number) => (
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
                ) : (
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
