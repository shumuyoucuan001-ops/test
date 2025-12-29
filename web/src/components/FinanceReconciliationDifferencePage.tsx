"use client";

import { FinanceReconciliationDifference, financeReconciliationDifferenceApi } from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';
import {
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Input,
  Popover,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { Title } = Typography;

export default function FinanceReconciliationDifferencePage() {
  const [records, setRecords] = useState<FinanceReconciliationDifference[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  // 单独的搜索字段
  const [search交易单号, setSearch交易单号] = useState('');
  const [search牵牛花采购单号, setSearch牵牛花采购单号] = useState('');
  const [search对账单号, setSearch对账单号] = useState('');
  const [search记录状态, setSearch记录状态] = useState<string[]>([]);

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 加载记录列表
  const loadRecords = async (
    page: number = currentPage,
    search?: string,
    交易单号?: string,
    牵牛花采购单号?: string,
    对账单号?: string,
    记录状态?: string[],
  ) => {
    try {
      setLoading(true);
      const result = await financeReconciliationDifferenceApi.getAll({
        page,
        limit: pageSize,
        search,
        交易单号,
        牵牛花采购单号,
        对账单号,
        记录状态: 记录状态 && 记录状态.length > 0 ? 记录状态 : undefined,
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
    const savedHiddenColumns = localStorage.getItem('finance_reconciliation_difference_hidden_columns');
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    }

    const savedColumnOrder = localStorage.getItem('finance_reconciliation_difference_column_order');
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
    localStorage.setItem('finance_reconciliation_difference_hidden_columns', JSON.stringify(Array.from(hidden)));
  };

  // 保存列顺序到 localStorage
  const saveColumnOrder = (order: string[]) => {
    localStorage.setItem('finance_reconciliation_difference_column_order', JSON.stringify(order));
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

  // 记录状态选项
  const 记录状态选项 = [
    '全部完成收货金额有误',
    '已核对无误',
    '收货中金额有误',
    '金额无误待收货',
  ];

  // 执行搜索（使用所有搜索条件）
  const handleSearchAll = () => {
    setCurrentPage(1);
    loadRecords(
      1,
      searchText || undefined,
      search交易单号 || undefined,
      search牵牛花采购单号 || undefined,
      search对账单号 || undefined,
      search记录状态.length > 0 ? search记录状态 : undefined,
    );
  };

  // 使用当前搜索条件刷新数据
  const refreshRecords = () => {
    loadRecords(
      currentPage,
      searchText || undefined,
      search交易单号 || undefined,
      search牵牛花采购单号 || undefined,
      search对账单号 || undefined,
      search记录状态.length > 0 ? search记录状态 : undefined,
    );
  };

  // 格式化金额
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-';
    return amount.toFixed(2);
  };

  // 表格列定义
  const allColumns = [
    {
      title: '交易单号',
      dataIndex: '交易单号',
      key: '交易单号',
      width: 180,
      fixed: 'left' as const,
    },
    {
      title: '牵牛花采购单号',
      dataIndex: '牵牛花采购单号',
      key: '牵牛花采购单号',
      width: 180,
      ellipsis: true,
    },
    {
      title: '对账单号',
      dataIndex: '对账单号',
      key: '对账单号',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '采购单金额',
      dataIndex: '采购单金额',
      key: '采购单金额',
      width: 120,
      align: 'right' as const,
      render: (text: number) => formatAmount(text),
    },
    {
      title: '采购单调整金额',
      dataIndex: '采购单调整金额',
      key: '采购单调整金额',
      width: 140,
      align: 'right' as const,
      render: (text: number) => formatAmount(text),
    },
    {
      title: '调整后采购单金额',
      dataIndex: '调整后采购单金额',
      key: '调整后采购单金额',
      width: 160,
      align: 'right' as const,
      render: (text: number) => formatAmount(text),
    },
    {
      title: '采购单状态',
      dataIndex: '采购单状态',
      key: '采购单状态',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '对账单收货状态',
      dataIndex: '对账单收货状态',
      key: '对账单收货状态',
      width: 140,
      render: (text: string) => text || '-',
    },
    {
      title: '门店/仓',
      dataIndex: '门店仓',
      key: '门店仓',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '下单账号',
      dataIndex: '下单账号',
      key: '下单账号',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '交易账单金额',
      dataIndex: '交易账单金额',
      key: '交易账单金额',
      width: 140,
      align: 'right' as const,
      render: (text: number) => formatAmount(text),
    },
    {
      title: '同账单对应采购合计金额',
      dataIndex: '同账单对应采购合计金额',
      key: '同账单对应采购合计金额',
      width: 200,
      align: 'right' as const,
      render: (text: number) => formatAmount(text),
    },
    {
      title: '同采购对应账单合计金额',
      dataIndex: '同采购对应账单合计金额',
      key: '同采购对应账单合计金额',
      width: 200,
      align: 'right' as const,
      render: (text: number) => formatAmount(text),
    },
    {
      title: '对账单差额',
      dataIndex: '对账单差额',
      key: '对账单差额',
      width: 120,
      align: 'right' as const,
      render: (text: number) => {
        if (text === null || text === undefined) return '-';
        const formatted = formatAmount(text);
        // 如果是负数，显示为红色
        if (text < 0) {
          return <span style={{ color: '#ff4d4f' }}>{formatted}</span>;
        }
        return formatted;
      },
    },
    {
      title: '记录状态',
      dataIndex: '记录状态',
      key: '记录状态',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '更新时间',
      dataIndex: '更新时间',
      key: '更新时间',
      width: 180,
      render: (text: string) => formatDateTime(text),
    },
  ];

  // 根据列设置过滤和排序列
  const getFilteredColumns = () => {
    const currentOrder = columnOrder.length > 0
      ? columnOrder
      : allColumns.map(col => col.key as string).filter(Boolean);

    // 按照保存的顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter(Boolean) as typeof allColumns;

    // 过滤隐藏的列
    return orderedColumns.filter(col => {
      const colKey = col.key as string;
      return !hiddenColumns.has(colKey);
    });
  };

  const columns = getFilteredColumns();

  return (
    <div style={{ padding: 0 }}>
      {/* 主要内容 */}
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>账单对账汇总差异</Title>
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
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                setSearch交易单号('');
                setSearch牵牛花采购单号('');
                setSearch对账单号('');
                setSearch记录状态([]);
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
                placeholder="交易单号"
                allowClear
                style={{ width: 180 }}
                value={search交易单号}
                onChange={(e) => setSearch交易单号(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="牵牛花采购单号"
                allowClear
                style={{ width: 180 }}
                value={search牵牛花采购单号}
                onChange={(e) => setSearch牵牛花采购单号(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="对账单号"
                allowClear
                style={{ width: 180 }}
                value={search对账单号}
                onChange={(e) => setSearch对账单号(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Select
                mode="multiple"
                placeholder="记录状态"
                allowClear
                style={{ width: 200 }}
                value={search记录状态}
                onChange={(value) => setSearch记录状态(value)}
              >
                {记录状态选项.map((状态) => (
                  <Select.Option key={状态} value={状态}>
                    {状态}
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </Space>
        </div>
        <ResponsiveTable<FinanceReconciliationDifference>
          columns={columns as any}
          dataSource={records}
          rowKey={(record) => `${record.交易单号}_${record.牵牛花采购单号}`}
          loading={loading}
          isMobile={false}
          scroll={{ x: 3000 }}
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
                search交易单号 || undefined,
                search牵牛花采购单号 || undefined,
                search对账单号 || undefined,
                search记录状态.length > 0 ? search记录状态 : undefined,
              );
            },
          }}
        />
      </Card>
    </div>
  );
}

