"use client";

import { OpsShelfExclusionItem, opsShelfExclusionApi } from "@/lib/api";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Space, Table, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof OpsShelfExclusionItem, string> = {
    "SPU": "SPU",
    "门店编码": "门店编码",
    "渠道编码": "渠道编码",
};

export default function OpsShelfExclusionPage() {
    const [data, setData] = useState<OpsShelfExclusionItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OpsShelfExclusionItem | null>(null);
    const [form] = Form.useForm<OpsShelfExclusionItem>();
    const [isMobile, setIsMobile] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]); // 选中的行
    const [batchModalOpen, setBatchModalOpen] = useState(false); // 批量新增弹窗
    const [batchItems, setBatchItems] = useState<OpsShelfExclusionItem[]>([]); // 批量新增的数据
    const [searchText, setSearchText] = useState(''); // 总搜索（全字段）
    const [searchFilters, setSearchFilters] = useState<{
        SPU?: string;
        门店编码?: string;
        渠道编码?: string;
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

            const res = await opsShelfExclusionApi.list({
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

    const openEdit = (record: OpsShelfExclusionItem) => {
        setEditing(record);
        form.setFieldsValue(record);
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            // 确保只传SPU（必填），其他字段为空字符串时转为 undefined/null
            const submitData: OpsShelfExclusionItem = {
                'SPU': values['SPU'] || '',
                '门店编码': values['门店编码']?.trim() || '',
                '渠道编码': values['渠道编码']?.trim() || '',
            };
            if (editing) {
                await opsShelfExclusionApi.update(editing, submitData);
                message.success("更新成功");
            } else {
                await opsShelfExclusionApi.create(submitData);
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

    const handleDelete = async (record: OpsShelfExclusionItem) => {
        try {
            await opsShelfExclusionApi.remove(record);
            message.success("删除成功");
            load();
        } catch (e) {
            message.error("删除失败");
            console.error(e);
        }
    };

    // 获取行的唯一标识
    const getRowKey = (record: OpsShelfExclusionItem): string => {
        return `${record["SPU"]}_${record["门店编码"]}_${record["渠道编码"]}`;
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

            const result = await opsShelfExclusionApi.batchDelete(selectedItems);
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
    const handleSelect = (record: OpsShelfExclusionItem, checked: boolean) => {
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

        // 检测分隔符类型（优先检测制表符，因为Excel通常使用制表符）
        let delimiter: string | RegExp = '\t';
        if (lines[0].includes('\t')) {
            delimiter = '\t';
        } else if (lines[0].includes(',')) {
            delimiter = ',';
        } else {
            delimiter = /\s{2,}/;
        }

        // 找出所有行中分隔符的最大数量，用于确定应该有多少列
        // 这样可以正确处理首列为空的情况
        let maxDelimiterCount = 0;
        for (const line of lines) {
            let count = 0;
            if (delimiter === '\t') {
                count = (line.match(/\t/g) || []).length;
            } else if (delimiter === ',') {
                count = (line.match(/,/g) || []).length;
            } else {
                count = (line.match(/\s{2,}/g) || []).length;
            }
            // 分隔符数量 + 1 = 列数
            maxDelimiterCount = Math.max(maxDelimiterCount, count);
        }
        const expectedColumnCount = maxDelimiterCount + 1;
        // 确保至少有3列
        const targetColumnCount = Math.max(expectedColumnCount, 3);

        // 解析每行为多个字段，确保保持列的对应关系（空值也要保留）
        const newItems: OpsShelfExclusionItem[] = [];
        for (const line of lines) {
            let parts: string[];

            if (delimiter === '\t') {
                // 使用 split 时保留所有空值，包括开头的空值
                parts = line.split('\t');
            } else if (delimiter === ',') {
                parts = line.split(',');
            } else {
                parts = line.split(/\s{2,}/);
            }

            // 去除每部分的前后空格，但保留空字符串本身
            parts = parts.map(p => p.trim());

            // 如果列数不足目标列数，说明前面有空列，需要在前面补空值
            // 这样可以保持列的对应关系，即使第一列是空值也不会被后面的列顶替
            while (parts.length < targetColumnCount) {
                parts.unshift(''); // 在前面插入空值，而不是在后面追加
            }

            // 只取前3列，确保列对应关系正确
            newItems.push({
                'SPU': parts[0] || '',
                '门店编码': parts[1] || '',
                '渠道编码': parts[2] || '',
            });
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

        try {
            const result = await opsShelfExclusionApi.batchCreate(batchItems);
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
            render: (_: any, record: OpsShelfExclusionItem) => (
                <Checkbox
                    checked={selectedRowKeys.includes(getRowKey(record))}
                    onChange={(e) => handleSelect(record, e.target.checked)}
                />
            ),
        };

        const baseCols = (Object.keys(fieldLabels) as (keyof OpsShelfExclusionItem)[]).map((key) => ({
            title: fieldLabels[key],
            dataIndex: key,
            key,
        }));
        const actionCol = {
            title: "操作",
            key: "action" as const,
            width: 140,
            fixed: 'right' as const,
            render: (_: any, record: OpsShelfExclusionItem) => (
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
                title="运营组管理 - 排除上下架商品"
                extra={
                    isMobile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <Input
                                placeholder="SPU"
                                style={{ width: '100%' }}
                                value={searchFilters.SPU}
                                onChange={(e) => setSearchFilters({ ...searchFilters, SPU: e.target.value })}
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
                                placeholder="渠道编码"
                                style={{ width: '100%' }}
                                value={searchFilters.渠道编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 渠道编码: e.target.value })}
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
                                placeholder="SPU"
                                style={{ width: 150 }}
                                value={searchFilters.SPU}
                                onChange={(e) => setSearchFilters({ ...searchFilters, SPU: e.target.value })}
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
                                placeholder="渠道编码"
                                style={{ width: 150 }}
                                value={searchFilters.渠道编码}
                                onChange={(e) => setSearchFilters({ ...searchFilters, 渠道编码: e.target.value })}
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
                <ResponsiveTable<OpsShelfExclusionItem>
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
                    <Form.Item name="SPU" label="SPU">
                        <Input maxLength={100} />
                    </Form.Item>
                    <Form.Item name="门店编码" label="门店编码">
                        <Input maxLength={50} />
                    </Form.Item>
                    <Form.Item name="渠道编码" label="渠道编码">
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
                        提示：您可以从 Excel 中复制数据（包含SPU、门店编码、渠道编码列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）
                    </div>
                    <Input.TextArea
                        placeholder="在此处粘贴 Excel 数据（Ctrl+V），每行一条记录，字段用制表符或逗号分隔&#10;格式：SPU	门店编码	渠道编码&#10;示例：SPU1	门店1	渠道1"
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
                                title: 'SPU',
                                dataIndex: 'SPU',
                                key: 'SPU',
                            },
                            { title: '门店编码', dataIndex: '门店编码', key: '门店编码' },
                            { title: '渠道编码', dataIndex: '渠道编码', key: '渠道编码' },
                            {
                                title: '操作',
                                key: 'action',
                                width: 100,
                                render: (_: any, record: OpsShelfExclusionItem, index: number) => (
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

