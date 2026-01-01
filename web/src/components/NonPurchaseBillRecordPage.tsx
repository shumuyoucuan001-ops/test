"use client";

import { formatDateTime } from '@/lib/dateUtils';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { NonPurchaseBillRecord, nonPurchaseBillRecordApi } from '../lib/api';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { Title } = Typography;
const { TextArea } = Input;

export default function NonPurchaseBillRecordPage() {
  const [records, setRecords] = useState<NonPurchaseBillRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  // 单独的搜索字段
  const [search账单流水, setSearch账单流水] = useState('');
  const [search账单类型, setSearch账单类型] = useState('');
  const [search所属仓店, setSearch所属仓店] = useState('');
  const [search财务审核状态, setSearch财务审核状态] = useState('');
  const [search记录修改人, setSearch记录修改人] = useState('');

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NonPurchaseBillRecord | null>(null);
  const [form] = Form.useForm();

  // 批量新增模态框状态
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchItems, setBatchItems] = useState<NonPurchaseBillRecord[]>([]);
  const [invalidItems, setInvalidItems] = useState<Array<{ item: NonPurchaseBillRecord; reasons: string[] }>>([]);

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  /**
   * 从错误对象中提取错误消息
   * 优先从 error.response.data.message 获取，其次从 error.message 获取
   */
  const extractErrorMessage = (error: any): string => {
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    if (error?.message) {
      return error.message;
    }
    return '未知错误';
  };

  // 加载记录列表
  const loadRecords = async (
    page: number = currentPage,
    search?: string,
    账单流水?: string,
    账单类型?: string,
    所属仓店?: string,
    财务审核状态?: string,
    记录修改人?: string,
  ) => {
    try {
      setLoading(true);
      const result = await nonPurchaseBillRecordApi.getAll({
        page,
        limit: pageSize,
        search,
        账单流水,
        账单类型,
        所属仓店,
        财务审核状态,
        记录修改人,
      });
      setRecords(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载记录列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadRecords();
  }, []);

  // 从 localStorage 加载列显示偏好和顺序
  useEffect(() => {
    const savedHiddenColumns = localStorage.getItem('non_purchase_bill_record_hidden_columns');
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    }

    const savedColumnOrder = localStorage.getItem('non_purchase_bill_record_column_order');
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
    localStorage.setItem('non_purchase_bill_record_hidden_columns', JSON.stringify(Array.from(hidden)));
  };

  // 保存列顺序到 localStorage
  const saveColumnOrder = (order: string[]) => {
    localStorage.setItem('non_purchase_bill_record_column_order', JSON.stringify(order));
  };

  // 切换列显示/隐藏
  const handleToggleColumnVisibility = (columnKey: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(columnKey)) {
      newHidden.delete(columnKey);
    } else {
      newHidden.add(columnKey);
    }
    setHiddenColumns(newHidden);
    saveHiddenColumns(newHidden);
  };

  // 列顺序变更
  const handleColumnOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    saveColumnOrder(newOrder);
  };

  // 执行搜索（使用所有搜索条件）
  const handleSearchAll = () => {
    setCurrentPage(1);
    loadRecords(
      1,
      searchText || undefined,
      search账单流水 || undefined,
      search账单类型 || undefined,
      search所属仓店 || undefined,
      search财务审核状态 || undefined,
      search记录修改人 || undefined,
    );
  };

  // 使用当前搜索条件刷新数据
  const refreshRecords = () => {
    loadRecords(
      currentPage,
      searchText || undefined,
      search账单流水 || undefined,
      search账单类型 || undefined,
      search所属仓店 || undefined,
      search财务审核状态 || undefined,
      search记录修改人 || undefined,
    );
  };

  // 打开新增模态框
  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (record: NonPurchaseBillRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      账单流水: record.账单流水,
      记账金额: record.记账金额,
      账单类型: record.账单类型,
      所属仓店: record.所属仓店,
      账单流水备注: record.账单流水备注,
      财务记账凭证号: record.财务记账凭证号,
      财务审核状态: record.财务审核状态,
      财务审核人: record.财务审核人,
    });
    setModalVisible(true);
  };

  // 保存记录
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const recordData: NonPurchaseBillRecord = {
        账单流水: values.账单流水,
        记账金额: values.记账金额 || undefined,
        账单类型: values.账单类型 || undefined,
        所属仓店: values.所属仓店 || undefined,
        账单流水备注: values.账单流水备注 || undefined,
        财务记账凭证号: values.财务记账凭证号 || undefined,
        财务审核状态: values.财务审核状态 || undefined,
        财务审核人: values.财务审核人 || undefined,
      };

      if (editingRecord && editingRecord.账单流水) {
        // 更新
        await nonPurchaseBillRecordApi.update(editingRecord.账单流水, recordData);
        message.success('更新成功');
      } else {
        // 新增
        await nonPurchaseBillRecordApi.create(recordData);
        message.success('创建成功');
      }

      setModalVisible(false);
      refreshRecords();
    } catch (error: any) {
      // 表单验证错误，直接返回，不显示错误提示
      if (error?.errorFields) {
        return;
      }

      // 提取并显示错误消息（用于处理重复数据等业务错误）
      const errorMessage = extractErrorMessage(error);
      const action = editingRecord ? '更新' : '创建';
      message.error(`${action}失败: ${errorMessage}`);
      console.error(`${action}失败:`, error);
    }
  };

  // 删除记录
  const handleDelete = async (账单流水: string) => {
    try {
      await nonPurchaseBillRecordApi.delete(账单流水);
      message.success('删除成功');
      refreshRecords();
    } catch (error: any) {
      message.error(error.message || '删除失败');
      console.error(error);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }

    try {
      const 账单流水列表 = selectedRowKeys.map((key: React.Key) => String(key));
      const result = await nonPurchaseBillRecordApi.batchDelete(账单流水列表);
      message.success(`成功删除 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      setSelectedRowKeys([]);
      refreshRecords();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
      console.error(error);
    }
  };

  // 打开批量新增模态框
  const handleBatchAdd = () => {
    setBatchModalVisible(true);
    setBatchItems([]);
    setInvalidItems([]);
  };

  // 处理粘贴事件
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

    const newItems: NonPurchaseBillRecord[] = [];
    const newInvalidItems: Array<{ item: NonPurchaseBillRecord; reasons: string[] }> = [];

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

        // 验证账单流水必填
        if (!parts[0] || parts[0].trim() === '') {
          reasons.push('账单流水为必填');
        }

        const item: NonPurchaseBillRecord = {
          账单流水: parts[0] || '',
          记账金额: parts[1] && parts[1].trim() !== '' ? parseFloat(parts[1]) : undefined,
          账单类型: parts[2] && parts[2].trim() !== '' ? parts[2].trim() : undefined,
          所属仓店: parts[3] && parts[3].trim() !== '' ? parts[3].trim() : undefined,
          账单流水备注: parts[4] && parts[4].trim() !== '' ? parts[4].trim() : undefined,
          财务记账凭证号: parts[5] && parts[5].trim() !== '' ? parts[5].trim() : undefined,
          财务审核状态: parts[6] && parts[6].trim() !== '' ? parts[6].trim() : undefined,
          财务审核人: parts[7] && parts[7].trim() !== '' ? parts[7].trim() : undefined,
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
  }, []);

  // 批量新增保存
  const handleBatchSave = async () => {
    if (batchItems.length === 0 && invalidItems.length === 0) {
      message.warning('请先粘贴数据');
      return;
    }

    // 验证数据
    const newInvalidItems: Array<{ item: NonPurchaseBillRecord; reasons: string[] }> = [];

    const validItems = batchItems.filter(item => {
      if (!item.账单流水 || item.账单流水.trim() === '') {
        newInvalidItems.push({ item, reasons: ['账单流水为必填'] });
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
      message.warning('请至少填写一条有效数据（账单流水为必填）');
      return;
    }

    try {
      const result = await nonPurchaseBillRecordApi.batchCreate(validItems);
      message.success(`成功创建 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      if (result.errors && result.errors.length > 0) {
        message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
      }
      setBatchModalVisible(false);
      setBatchItems([]);
      setInvalidItems([]);
      refreshRecords();
    } catch (error: any) {
      // 提取并显示错误消息（用于处理批量创建失败等错误）
      const errorMessage = extractErrorMessage(error);
      message.error(`批量创建失败: ${errorMessage}`);
      console.error('批量创建失败:', error);
    }
  };

  // 格式化金额
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-';
    return amount.toFixed(2);
  };

  // 表格列定义
  const allColumns = [
    {
      title: '账单流水',
      dataIndex: '账单流水',
      key: '账单流水',
      width: 180,
      fixed: 'left' as const,
    },
    {
      title: '记账金额',
      dataIndex: '记账金额',
      key: '记账金额',
      width: 120,
      align: 'right' as const,
      render: (text: number) => formatAmount(text),
    },
    {
      title: '账单类型',
      dataIndex: '账单类型',
      key: '账单类型',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '所属仓店',
      dataIndex: '所属仓店',
      key: '所属仓店',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '账单流水备注',
      dataIndex: '账单流水备注',
      key: '账单流水备注',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '财务记账凭证号',
      dataIndex: '财务记账凭证号',
      key: '财务记账凭证号',
      width: 180,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '财务审核状态',
      dataIndex: '财务审核状态',
      key: '财务审核状态',
      width: 140,
      render: (text: string) => text || '-',
    },
    {
      title: '记录修改人',
      dataIndex: '记录修改人',
      key: '记录修改人',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '财务审核人',
      dataIndex: '财务审核人',
      key: '财务审核人',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '记录增加时间',
      dataIndex: '记录增加时间',
      key: '记录增加时间',
      width: 180,
      render: (text: string) => formatDateTime(text),
    },
    {
      title: '最近修改时间',
      dataIndex: '最近修改时间',
      key: '最近修改时间',
      width: 180,
      render: (text: string) => formatDateTime(text),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (record: NonPurchaseBillRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.账单流水)}
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
    },
  ];

  // 根据列设置过滤和排序列
  const getFilteredColumns = () => {
    const currentOrder = columnOrder.length > 0
      ? columnOrder
      : allColumns.map(col => col.key as string).filter(Boolean);

    // 确保操作列在顺序中
    if (!currentOrder.includes('action')) {
      currentOrder.push('action');
    }

    // 按照保存的顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter(Boolean) as typeof allColumns;

    // 过滤隐藏的列，但始终显示操作列
    return orderedColumns.filter(col => {
      const colKey = col.key as string;
      // 操作列始终显示
      if (colKey === 'action') {
        return true;
      }
      return !hiddenColumns.has(colKey);
    });
  };

  const columns = getFilteredColumns();

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
  };

  return (
    <div style={{ padding: 0 }}>
      {/* 主要内容 */}
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>非采购单流水记录</Title>
          </Space>
        }
        extra={
          <Space>
            {/* 综合搜索框 */}
            <Input
              placeholder="综合搜索（所有字段）"
              allowClear
              style={{ width: 220 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearchAll}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearchAll}
            >
              搜索
            </Button>
            <Popover
              content={
                <ColumnSettings
                  columns={allColumns}
                  hiddenColumns={hiddenColumns}
                  columnOrder={columnOrder}
                  onToggleVisibility={handleToggleColumnVisibility}
                  onMoveColumn={() => { }}
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={handleBatchAdd}
            >
              批量新增
            </Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                >
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                setSearch账单流水('');
                setSearch账单类型('');
                setSearch所属仓店('');
                setSearch财务审核状态('');
                setSearch记录修改人('');
                setCurrentPage(1);
                loadRecords(1, undefined);
              }}
            >
              重置
            </Button>
          </Space>
        }
      >
        {/* 搜索区域 */}
        <div style={{ marginBottom: 16, padding: '16px', backgroundColor: '#fafafa', borderRadius: 4 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>单独搜索</div>
            <Space wrap>
              <Input
                placeholder="账单流水"
                allowClear
                style={{ width: 180 }}
                value={search账单流水}
                onChange={(e) => setSearch账单流水(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="账单类型"
                allowClear
                style={{ width: 180 }}
                value={search账单类型}
                onChange={(e) => setSearch账单类型(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="所属仓店"
                allowClear
                style={{ width: 180 }}
                value={search所属仓店}
                onChange={(e) => setSearch所属仓店(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="财务审核状态"
                allowClear
                style={{ width: 180 }}
                value={search财务审核状态}
                onChange={(e) => setSearch财务审核状态(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="记录修改人"
                allowClear
                style={{ width: 180 }}
                value={search记录修改人}
                onChange={(e) => setSearch记录修改人(e.target.value)}
                onPressEnter={handleSearchAll}
              />
            </Space>
          </Space>
        </div>
        <ResponsiveTable<NonPurchaseBillRecord>
          columns={columns as any}
          dataSource={records}
          rowKey={(record) => record.账单流水}
          loading={loading}
          isMobile={false}
          scroll={{ x: 2000 }}
          rowSelection={rowSelection}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 20);
              loadRecords(
                page,
                searchText || undefined,
                search账单流水 || undefined,
                search账单类型 || undefined,
                search所属仓店 || undefined,
                search财务审核状态 || undefined,
                search记录修改人 || undefined,
              );
            },
          }}
        />
      </Card>

      {/* 新增/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑记录' : '新增记录'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="账单流水"
            name="账单流水"
            rules={[
              { required: true, message: '请输入账单流水' },
              { whitespace: true, message: '账单流水不能为空' }
            ]}
          >
            <Input placeholder="请输入账单流水" disabled={!!editingRecord} />
          </Form.Item>

          <Form.Item
            label="记账金额"
            name="记账金额"
          >
            <InputNumber
              placeholder="请输入记账金额"
              style={{ width: '100%' }}
              precision={2}
            />
          </Form.Item>

          <Form.Item
            label="账单类型"
            name="账单类型"
          >
            <Input placeholder="请输入账单类型" />
          </Form.Item>

          <Form.Item
            label="所属仓店"
            name="所属仓店"
          >
            <Input placeholder="请输入所属仓店" />
          </Form.Item>

          <Form.Item
            label="账单流水备注"
            name="账单流水备注"
          >
            <TextArea
              rows={4}
              placeholder="请输入账单流水备注"
              maxLength={245}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="财务记账凭证号"
            name="财务记账凭证号"
          >
            <Input placeholder="请输入财务记账凭证号" />
          </Form.Item>

          <Form.Item
            label="财务审核状态"
            name="财务审核状态"
          >
            <Input placeholder="请输入财务审核状态" />
          </Form.Item>

          <Form.Item
            label="财务审核人"
            name="财务审核人"
          >
            <Input placeholder="请输入财务审核人" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量新增模态框 */}
      <Modal
        title="批量新增记录"
        open={batchModalVisible}
        onOk={handleBatchSave}
        onCancel={() => {
          setBatchModalVisible(false);
          setBatchItems([]);
          setInvalidItems([]);
        }}
        okText="确定创建"
        cancelText="取消"
        width={1000}
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
            提示：您可以从 Excel 中复制数据（包含账单流水、记账金额、账单类型、所属仓店、账单流水备注、财务记账凭证号、财务审核状态、财务审核人列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）。
          </div>
          <Input.TextArea
            placeholder="在此处粘贴 Excel 数据（Ctrl+V），每行一条记录，字段用制表符或逗号分隔&#10;格式：账单流水	记账金额	账单类型	所属仓店	账单流水备注	财务记账凭证号	财务审核状态	财务审核人&#10;示例：BL001	1000.00	类型A	仓店1	备注	凭证001	已审核	审核人"
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
                  title: '账单流水',
                  dataIndex: '账单流水',
                  key: '账单流水',
                  render: (text: string) => (
                    <span style={{ color: !text ? 'red' : 'inherit' }}>
                      {text || '(必填)'}
                    </span>
                  ),
                },
                {
                  title: '记账金额',
                  dataIndex: '记账金额',
                  key: '记账金额',
                  render: (v: any) => v ? formatAmount(v) : '-',
                },
                {
                  title: '账单类型',
                  dataIndex: '账单类型',
                  key: '账单类型',
                  render: (v: any) => v || '-',
                },
                {
                  title: '所属仓店',
                  dataIndex: '所属仓店',
                  key: '所属仓店',
                  render: (v: any) => v || '-',
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_: any, record: NonPurchaseBillRecord, index: number) => (
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
                  title: '账单流水',
                  key: '账单流水',
                  render: (_: any, record: { item: NonPurchaseBillRecord; reasons: string[] }) => (
                    <span style={{ color: !record.item.账单流水 ? 'red' : 'inherit' }}>
                      {record.item.账单流水 || '(必填)'}
                    </span>
                  ),
                },
                {
                  title: '记账金额',
                  key: '记账金额',
                  render: (_: any, record: { item: NonPurchaseBillRecord; reasons: string[] }) =>
                    record.item.记账金额 ? formatAmount(record.item.记账金额) : '-'
                },
                {
                  title: '账单类型',
                  key: '账单类型',
                  render: (_: any, record: { item: NonPurchaseBillRecord; reasons: string[] }) =>
                    record.item.账单类型 || '-'
                },
                {
                  title: '所属仓店',
                  key: '所属仓店',
                  render: (_: any, record: { item: NonPurchaseBillRecord; reasons: string[] }) =>
                    record.item.所属仓店 || '-'
                },
                {
                  title: '失败原因',
                  key: 'reasons',
                  width: 300,
                  render: (_: any, record: { item: NonPurchaseBillRecord; reasons: string[] }) => (
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
                  render: (_: any, record: { item: NonPurchaseBillRecord; reasons: string[] }, index: number) => (
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

