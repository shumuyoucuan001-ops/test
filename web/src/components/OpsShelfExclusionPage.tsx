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
                // 检查是否已存在
                try {
                    console.log('检查重复数据:', submitData);
                    const checkResult = await opsShelfExclusionApi.checkExists(submitData);
                    console.log('检查结果:', checkResult);
                    if (checkResult && checkResult.exists) {
                        console.log('数据已存在，阻止提交');
                        message.error("该数据已存在，请勿重复添加");
                        return;
                    }
                    console.log('数据不存在，继续创建');
                } catch (checkError: any) {
                    console.error('检查重复数据失败:', checkError);
                    // 如果检查失败，继续尝试创建，让后端验证
                }
                console.log('开始创建数据:', submitData);
                await opsShelfExclusionApi.create(submitData);
                message.success("新增成功");
            }
            setModalOpen(false);
            load();
        } catch (e: any) {
            if (e?.errorFields) return;
            // 提取后端返回的错误消息
            let errorMessage = '保存失败';
            if (e?.response?.data?.message) {
                errorMessage = e.response.data.message;
            } else if (e?.response?.data?.error) {
                errorMessage = e.response.data.error;
            } else if (e?.message) {
                errorMessage = e.message;
            }
            message.error(errorMessage);
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
        setBatchItems([]);
    };

    // 检测分隔符类型
    const detectDelimiter = (line: string): string | RegExp => {
        if (line.includes('\t')) return '\t';
        if (line.includes(',')) return ',';
        return /\s{2,}/;
    };

    // 解析单行数据（处理备注列可能包含分隔符的情况）
    // 方法：先找到前N-1个分隔符，将后面的分隔符临时替换为占位符，分割后再恢复
    const parseLine = (line: string, delimiter: string | RegExp): string[] => {
        if (delimiter === '\t' || delimiter === ',') {
            return parseWithDelimiterEscaped(line, delimiter as string);
        } else {
            // 空格分隔
            const spaceParts = line.split(/\s{2,}/);
            if (spaceParts.length > 3) {
                return [
                    ...spaceParts.slice(0, 3).map(p => p.trim()),
                    spaceParts.slice(3).join('  ').trim()
                ];
            }
            return spaceParts.map(p => p.trim());
        }
    };

    // 通用分隔符解析函数（使用转义机制处理备注列中的分隔符）
    const parseWithDelimiterEscaped = (line: string, delimiter: string): string[] => {
        // 占位符：使用一个不太可能出现在数据中的字符串
        const PLACEHOLDER_TAB = '___TAB_PLACEHOLDER___';
        const PLACEHOLDER_COMMA = '___COMMA_PLACEHOLDER___';
        const placeholder = delimiter === '\t' ? PLACEHOLDER_TAB : PLACEHOLDER_COMMA;

        // 找到前3个分隔符的位置
        const indices: number[] = [];
        for (let i = 0; i < line.length && indices.length < 3; i++) {
            if (line[i] === delimiter) {
                indices.push(i);
            }
        }

        if (indices.length >= 3) {
            // 将第4个分隔符之后的所有分隔符替换为占位符
            let processedLine = line;
            if (indices.length < line.split(delimiter).length - 1) {
                // 说明备注列中还有分隔符，需要转义
                const beforeRemark = line.substring(0, indices[2] + 1);
                const remarkPart = line.substring(indices[2] + 1);
                // 将备注部分的分隔符替换为占位符
                const escapedRemark = remarkPart.replace(new RegExp(delimiter === '\t' ? '\\t' : ',', 'g'), placeholder);
                processedLine = beforeRemark + escapedRemark;
            }

            // 现在可以安全地分割了
            const parts = processedLine.split(delimiter);

            // 恢复备注列中的占位符
            if (parts.length > 3) {
                parts[3] = parts[3].replace(new RegExp(placeholder, 'g'), delimiter);
                // 如果备注被分割成多部分，合并它们
                if (parts.length > 4) {
                    parts[3] = [parts[3], ...parts.slice(4)].join(delimiter);
                    parts.splice(4);
                }
            }

            return [
                parts[0]?.trim() || '',
                parts[1]?.trim() || '',
                parts[2]?.trim() || '',
                parts[3]?.trim() || ''
            ];
        } else {
            // 如果分隔符少于3个，直接使用split
            const splitParts = line.split(delimiter);
            return [
                splitParts[0]?.trim() || '',
                splitParts[1]?.trim() || '',
                splitParts[2]?.trim() || '',
                splitParts.slice(3).join(delimiter) || ''
            ];
        }
    };

    // 处理粘贴事件
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');

        // 将粘贴的内容按行分割（不trim，保留原始格式，因为备注列可能包含换行）
        const rawLines = pastedText.split(/\r?\n/);

        if (rawLines.length === 0) {
            message.warning('粘贴的内容为空');
            return;
        }

        // 检测分隔符类型（使用第一行）
        const firstLine = rawLines[0].trim();
        if (!firstLine) {
            message.warning('粘贴的内容为空');
            return;
        }
        const delimiter = detectDelimiter(firstLine);

        // 合并多行：如果某行的列数不足，说明是上一行备注列的延续
        const mergedLines: string[] = [];
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            if (!line.trim()) continue; // 跳过空行

            // 检测当前行的列数（通过统计分隔符数量）
            let columnCount = 1; // 至少1列
            if (delimiter === '\t') {
                columnCount = (line.match(/\t/g) || []).length + 1;
            } else if (delimiter === ',') {
                columnCount = (line.match(/,/g) || []).length + 1;
            } else {
                columnCount = line.split(/\s{2,}/).length;
            }

            // 如果列数不足4列，且上一行有数据，则合并到上一行
            if (columnCount < 4 && mergedLines.length > 0) {
                // 这是备注列的延续，合并到上一行（用空格连接，替换换行符）
                mergedLines[mergedLines.length - 1] += ' ' + line.trim();
            } else {
                // 这是新的一行数据
                mergedLines.push(line);
            }
        }

        // 解析合并后的行
        const newItems: OpsShelfExclusionItem[] = [];
        for (const line of mergedLines) {
            let parts = parseLine(line, delimiter);

            // 确保至少有SPU（必填字段）
            if (parts.length >= 1 && parts[0]) {
                // 如果列数不足4列，在后面补空值
                while (parts.length < 4) {
                    parts.push('');
                }

                // 只取前4列，确保列对应关系正确（SPU、门店编码、渠道编码、备注）
                // 备注列中的换行符替换为空格
                const remark = parts[3] ? parts[3].replace(/\r?\n/g, ' ').trim() : null;
                newItems.push({
                    'SPU': parts[0] || '',
                    '门店编码': parts[1] || '',
                    '渠道编码': parts[2] || '',
                    '备注': remark,
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
    }, []);

    // 批量保存
    const handleBatchSave = async () => {
        if (batchItems.length === 0) {
            message.warning('请先粘贴数据');
            return;
        }

        try {
            // 检查是否有重复数据
            try {
                const checkResult = await opsShelfExclusionApi.checkBatchExists(batchItems);
                if (checkResult && checkResult.exists) {
                    const duplicateInfo = checkResult.duplicateItems.map(item =>
                        `SPU:${item['SPU']}, 门店编码:${item['门店编码']}, 渠道编码:${item['渠道编码']}`
                    ).join('; ');
                    message.error(`以下数据已存在，请勿重复添加：${duplicateInfo}`);
                    return;
                }
            } catch (checkError: any) {
                console.error('检查重复数据失败:', checkError);
                // 如果检查失败，继续尝试创建，让后端验证
            }

            const result = await opsShelfExclusionApi.batchCreate(batchItems);
            message.success(result.message);
            if (result.errors && result.errors.length > 0) {
                message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
            }

            setBatchModalOpen(false);
            setBatchItems([]);
            load();
        } catch (e: any) {
            // 提取后端返回的错误消息
            let errorMessage = '批量创建失败';
            if (e?.response?.data?.message) {
                errorMessage = e.response.data.message;
            } else if (e?.response?.data?.error) {
                errorMessage = e.response.data.error;
            } else if (e?.message) {
                errorMessage = e.message;
            }
            message.error(errorMessage);
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
                    columns={columns as any}
                    dataSource={data}
                    rowKey={getRowKey}
                    loading={loading}
                    scroll={{ x: 1500 }}
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
                        提示：您可以从 Excel 中复制数据（包含SPU、门店编码、渠道编码、备注列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）
                    </div>
                    <Input.TextArea
                        placeholder="在此处粘贴 Excel 数据（Ctrl+V），每行一条记录，字段用制表符或逗号分隔&#10;格式：SPU	门店编码	渠道编码	备注&#10;示例：SPU1	门店1	渠道1	备注1"
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
                            ...(Object.keys(fieldLabels) as (keyof OpsShelfExclusionItem)[]).map((key) => ({
                                title: fieldLabels[key],
                                dataIndex: key,
                                key,
                            })),
                            {
                                title: '操作',
                                key: 'action',
                                width: 100,
                                render: (_: any, _record: OpsShelfExclusionItem, index: number) => (
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

