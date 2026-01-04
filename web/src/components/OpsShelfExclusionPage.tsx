"use client";

import { OpsShelfExclusionItem, opsShelfExclusionApi } from "@/lib/api";
import { showErrorBoth } from "@/lib/errorUtils";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Space, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import BatchAddModal, { FieldConfig } from "./BatchAddModal";
import ResponsiveTable from "./ResponsiveTable";

const fieldLabels: Record<keyof OpsShelfExclusionItem, string> = {
    "SPU": "SPU",
    "门店编码": "门店编码",
    "渠道编码": "渠道编码",
    "备注": "备注",
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

    const load = useCallback(async (overrideParams?: {
        page?: number;
        keyword?: string;
        filters?: typeof searchFilters;
    }) => {
        setLoading(true);
        try {
            // 使用传入参数或当前状态值
            const finalPage = overrideParams?.page ?? currentPage;
            const finalKeyword = overrideParams?.keyword !== undefined
                ? (overrideParams.keyword || undefined)
                : (searchText || undefined);
            const finalFilters = overrideParams?.filters ?? searchFilters;

            // 过滤掉空值
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
    }, [currentPage, pageSize, searchText, searchFilters]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSearch = () => {
        setCurrentPage(1);
        load({
            page: 1,
            keyword: searchText || undefined,
            filters: searchFilters,
        });
    };

    // 重置搜索条件
    const handleReset = () => {
        setSearchText('');
        setSearchFilters({});
        setCurrentPage(1);
        setSelectedRowKeys([]);
        load({
            page: 1,
            keyword: '',
            filters: {}
        });
    };

    const openCreate = useCallback(() => {
        setEditing(null);
        form.resetFields();
        setModalOpen(true);
    }, [form]);

    const openEdit = useCallback((record: OpsShelfExclusionItem) => {
        setEditing(record);
        form.setFieldsValue(record);
        setModalOpen(true);
    }, [form]);

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            // 处理表单数据：trim 字符串字段，空字符串转为 null
            const submitData: OpsShelfExclusionItem = {
                'SPU': values['SPU']?.trim() || '',
                '门店编码': values['门店编码']?.trim() || '',
                '渠道编码': values['渠道编码']?.trim() || '',
                '备注': values['备注']?.trim() || null,
            };
            if (editing) {
                await opsShelfExclusionApi.update(editing, submitData);
                message.success("更新成功");
            } else {
                console.log('开始创建数据:', submitData);
                await opsShelfExclusionApi.create(submitData);
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

    const handleDelete = useCallback(async (record: OpsShelfExclusionItem) => {
        try {
            await opsShelfExclusionApi.remove(record);
            message.success("删除成功");
            load();
        } catch (e) {
            message.error("删除失败");
            console.error(e);
        }
    }, [load]);

    // 获取行的唯一标识
    const getRowKey = useCallback((record: OpsShelfExclusionItem): string => {
        return `${record["SPU"]}_${record["门店编码"]}_${record["渠道编码"]}`;
    }, []);

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
    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedRowKeys(data.map(item => getRowKey(item)));
        } else {
            setSelectedRowKeys([]);
        }
    }, [data, getRowKey]);

    // 单行选择
    const handleSelect = useCallback((record: OpsShelfExclusionItem, checked: boolean) => {
        const rowKey = getRowKey(record);
        if (checked) {
            setSelectedRowKeys(prev => [...prev, rowKey]);
        } else {
            setSelectedRowKeys(prev => prev.filter(key => key !== rowKey));
        }
    }, [getRowKey]);

    // 打开批量新增弹窗
    const openBatchCreate = () => {
        setBatchModalOpen(true);
    };

    // 批量新增字段配置
    const batchAddFields: FieldConfig<OpsShelfExclusionItem>[] = [
        {
            key: 'SPU',
            label: 'SPU',
            excelHeaderName: 'SPU',
            required: false,
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
            key: '渠道编码',
            label: '渠道编码',
            excelHeaderName: '渠道编码',
            required: false,
            index: 2,
        },
        {
            key: '备注',
            label: '备注',
            excelHeaderName: '备注',
            required: false,
            index: 3,
        },
    ];

    // 创建数据项
    const createBatchItem = useCallback((parts: string[]): Partial<OpsShelfExclusionItem> => {
        return {
            'SPU': parts[0] || '',
            '门店编码': parts[1] || '',
            '渠道编码': parts[2] || '',
            '备注': parts[3] || null,
        };
    }, []);

    // 批量保存
    const handleBatchSave = useCallback(async (validItems: OpsShelfExclusionItem[]) => {
        try {
            const result = await opsShelfExclusionApi.batchCreate(validItems);
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
    }, [data, selectedRowKeys, handleSelectAll, handleSelect, getRowKey, openEdit, handleDelete]);

    // 渲染搜索和操作区域
    const renderSearchAndActions = () => {
        const searchInputs = (
            <>
                <Input
                    placeholder="SPU"
                    style={isMobile ? { width: '100%' } : { width: 150 }}
                    value={searchFilters.SPU}
                    onChange={(e) => setSearchFilters({ ...searchFilters, SPU: e.target.value })}
                    allowClear
                />
                <Input
                    placeholder="门店编码"
                    style={isMobile ? { width: '100%' } : { width: 150 }}
                    value={searchFilters.门店编码}
                    onChange={(e) => setSearchFilters({ ...searchFilters, 门店编码: e.target.value })}
                    allowClear
                />
                <Input
                    placeholder="渠道编码"
                    style={isMobile ? { width: '100%' } : { width: 150 }}
                    value={searchFilters.渠道编码}
                    onChange={(e) => setSearchFilters({ ...searchFilters, 渠道编码: e.target.value })}
                    allowClear
                />
                <Input.Search
                    placeholder="总搜索（全字段）"
                    style={isMobile ? { width: '100%' } : { width: 200 }}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onSearch={handleSearch}
                    allowClear
                />
            </>
        );

        if (isMobile) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    {searchInputs}
                    <Space style={{ width: '100%' }}>
                        <Button type="primary" onClick={handleSearch} style={{ flex: 1 }}>搜索</Button>
                        <Button onClick={handleReset} style={{ flex: 1 }}>重置</Button>
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
            );
        }

        return (
            <Space wrap>
                {searchInputs}
                <Button type="primary" onClick={handleSearch}>搜索</Button>
                <Button onClick={handleReset}>重置</Button>
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
        );
    };

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="运营组管理 - 排除上下架商品"
                extra={renderSearchAndActions()}
            >
                <ResponsiveTable<OpsShelfExclusionItem>
                    tableId="ops-shelf-exclusion"
                    columns={columns as any}
                    dataSource={data}
                    rowKey={getRowKey}
                    loading={loading}
                    scroll={{ x: 1500, y: 600 }}
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
                    <Form.Item name="备注" label="备注">
                        <Input.TextArea rows={3} maxLength={500} placeholder="请输入备注信息" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量新增弹窗 */}
            <BatchAddModal<OpsShelfExclusionItem>
                open={batchModalOpen}
                title="批量新增规则"
                hint="您可以从 Excel 中复制数据（包含SPU、门店编码、渠道编码、备注列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件"
                fields={batchAddFields}
                formatHint="格式：SPU	门店编码	渠道编码	备注"
                example="SPU1	门店1	渠道1	备注1"
                onCancel={() => setBatchModalOpen(false)}
                onSave={handleBatchSave}
                createItem={createBatchItem}
            />
        </div>
    );
}

