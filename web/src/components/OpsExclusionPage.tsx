"use client";

import { OpsExclusionItem, opsExclusionApi } from "@/lib/api";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, message } from "antd";
import { useEffect, useMemo, useState } from "react";

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
    const [q, setQ] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<OpsExclusionItem | null>(null);
    const [form] = Form.useForm<OpsExclusionItem>();

    const load = async (keyword?: string, page: number = currentPage, limit: number = pageSize) => {
        setLoading(true);
        try {
            const searchKeyword = keyword?.trim() || undefined;
            const res = await opsExclusionApi.list(searchKeyword, page, limit);
            // 处理返回格式：可能是 { data, total } 或直接是数组
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
        } catch (e) {
            message.error("加载失败");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(q, currentPage, pageSize);
    }, [currentPage, pageSize]);

    const handleSearch = () => {
        setCurrentPage(1);
        load(q.trim(), 1, pageSize);
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
            load(q.trim() || undefined, currentPage, pageSize);
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
            load(q.trim() || undefined, currentPage, pageSize);
        } catch (e) {
            message.error("删除失败");
            console.error(e);
        }
    };

    const columns = useMemo(() => {
        const baseCols = (Object.keys(fieldLabels) as (keyof OpsExclusionItem)[]).map((key) => ({
            title: fieldLabels[key],
            dataIndex: key,
            key,
        }));
        const actionCol = {
            title: "操作",
            key: "action" as const,
            width: 140,
            render: (_: any, record: OpsExclusionItem) => (
                <Space>
                    <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
                    <Popconfirm
                        title="确认删除？"
                        onConfirm={() => handleDelete(record)}
                    >
                        <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                </Space>
            ),
        };
        return [...baseCols, actionCol];
    }, [data]);

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="运营组管理(功能测试) - 排除活动商品"
                extra={
                    <Space>
                        <Input
                            allowClear
                            placeholder="搜索相关信息"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            onPressEnter={handleSearch}
                            style={{ width: 240 }}
                            prefix={<SearchOutlined />}
                        />
                        <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                        <Button icon={<ReloadOutlined />} onClick={() => { setQ(''); setCurrentPage(1); load(undefined, 1, pageSize); }}>刷新</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增</Button>
                    </Space>
                }
            >
                <Table
                    columns={columns as any}
                    dataSource={data}
                    rowKey={(r) => `${r["视图名称"]}_${r["门店编码"]}_${r["SKU编码"]}_${r["SPU编码"]}`}
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
        </div>
    );
}
