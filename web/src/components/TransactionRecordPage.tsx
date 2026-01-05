"use client";

import { formatDateTime } from '@/lib/dateUtils';
import {
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Popover,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { transactionRecordApi } from '../lib/api';
import BatchAddModal, { FieldConfig } from './BatchAddModal';
import ColumnSettings from './ColumnSettings';
import ExcelExportModal from './ExcelExportModal';
import ResponsiveTable from './ResponsiveTable';

const { Search } = Input;
const { Title } = Typography;
const { RangePicker } = DatePicker;

type ChannelType = '1688先采后付' | '京东金融' | '微信' | '支付宝';

// 定义各渠道的字段配置
const getChannelFields = (channel: ChannelType): FieldConfig<any>[] => {
  const commonFields: FieldConfig<any>[] = [
    { key: '支付渠道', label: '支付渠道', excelHeaderName: '支付渠道', required: true, index: 0 },
    { key: '支付账号', label: '支付账号', excelHeaderName: '支付账号', required: true, index: 1 },
    { key: '收支金额', label: '收支金额', excelHeaderName: '收支金额', required: true, index: 2 },
    { key: '交易账单号', label: '交易账单号', excelHeaderName: '交易账单号', required: true, index: 3 },
    { key: '账单交易时间', label: '账单交易时间', excelHeaderName: '账单交易时间', required: true, index: 4 },
  ];

  if (channel === '1688先采后付') {
    return [
      ...commonFields,
      { key: '订单号', label: '订单号', excelHeaderName: '订单号', required: true, index: 5 },
      { key: '订单支付时间', label: '订单支付时间', excelHeaderName: '订单支付时间', required: false, index: 6 },
      { key: '订单名称', label: '订单名称', excelHeaderName: '订单名称', required: false, index: 7 },
      { key: '支付金额(元)', label: '支付金额(元)', excelHeaderName: '支付金额(元)', required: true, index: 8 },
      { key: '确认收货金额(元)', label: '确认收货金额(元)', excelHeaderName: '确认收货金额(元)', required: false, index: 9 },
      { key: '确认收货时间', label: '确认收货时间', excelHeaderName: '确认收货时间', required: false, index: 10 },
      { key: '账期类型', label: '账期类型', excelHeaderName: '账期类型', required: false, index: 11 },
      { key: '是否有退款', label: '是否有退款', excelHeaderName: '是否有退款', required: false, index: 12 },
      { key: '退款金额(元)', label: '退款金额(元)', excelHeaderName: '退款金额(元)', required: false, index: 13 },
    ];
  } else if (channel === '京东金融') {
    return [
      ...commonFields,
      { key: '交易时间', label: '交易时间', excelHeaderName: '交易时间', required: false, index: 5 },
      { key: '商户名称', label: '商户名称', excelHeaderName: '商户名称', required: false, index: 6 },
      { key: '交易说明', label: '交易说明', excelHeaderName: '交易说明', required: false, index: 7 },
      { key: '金额', label: '金额', excelHeaderName: '金额', required: false, index: 8 },
      { key: '收/付款方式', label: '收/付款方式', excelHeaderName: '收/付款方式', required: false, index: 9 },
      { key: '交易状态', label: '交易状态', excelHeaderName: '交易状态', required: false, index: 10 },
      { key: '收/支', label: '收/支', excelHeaderName: '收/支', required: false, index: 11 },
      { key: '交易分类', label: '交易分类', excelHeaderName: '交易分类', required: false, index: 12 },
      { key: '交易订单号', label: '交易订单号', excelHeaderName: '交易订单号', required: false, index: 13 },
      { key: '商家订单号', label: '商家订单号', excelHeaderName: '商家订单号', required: false, index: 14 },
      { key: '备注', label: '备注', excelHeaderName: '备注', required: false, index: 15 },
    ];
  } else if (channel === '微信') {
    return [
      ...commonFields,
      { key: '交易时间', label: '交易时间', excelHeaderName: '交易时间', required: false, index: 5 },
      { key: '交易类型', label: '交易类型', excelHeaderName: '交易类型', required: false, index: 6 },
      { key: '交易对方', label: '交易对方', excelHeaderName: '交易对方', required: false, index: 7 },
      { key: '商品', label: '商品', excelHeaderName: '商品', required: false, index: 8 },
      { key: '收/支', label: '收/支', excelHeaderName: '收/支', required: false, index: 9 },
      { key: '金额(元)', label: '金额(元)', excelHeaderName: '金额(元)', required: false, index: 10 },
      { key: '支付方式', label: '支付方式', excelHeaderName: '支付方式', required: false, index: 11 },
      { key: '当前状态', label: '当前状态', excelHeaderName: '当前状态', required: false, index: 12 },
      { key: '交易单号', label: '交易单号', excelHeaderName: '交易单号', required: false, index: 13 },
      { key: '商户单号', label: '商户单号', excelHeaderName: '商户单号', required: false, index: 14 },
      { key: '备注', label: '备注', excelHeaderName: '备注', required: false, index: 15 },
    ];
  } else if (channel === '支付宝') {
    return [
      ...commonFields,
      { key: '交易时间', label: '交易时间', excelHeaderName: '交易时间', required: false, index: 5 },
      { key: '交易分类', label: '交易分类', excelHeaderName: '交易分类', required: false, index: 6 },
      { key: '交易对方', label: '交易对方', excelHeaderName: '交易对方', required: false, index: 7 },
      { key: '对方账号', label: '对方账号', excelHeaderName: '对方账号', required: false, index: 8 },
      { key: '商品说明', label: '商品说明', excelHeaderName: '商品说明', required: false, index: 9 },
      { key: '收/支', label: '收/支', excelHeaderName: '收/支', required: false, index: 10 },
      { key: '金额', label: '金额', excelHeaderName: '金额', required: false, index: 11 },
      { key: '收/付款方式', label: '收/付款方式', excelHeaderName: '收/付款方式', required: false, index: 12 },
      { key: '交易状态', label: '交易状态', excelHeaderName: '交易状态', required: false, index: 13 },
      { key: '交易订单号', label: '交易订单号', excelHeaderName: '交易订单号', required: false, index: 14 },
      { key: '商家订单号', label: '商家订单号', excelHeaderName: '商家订单号', required: false, index: 15 },
      { key: '备注', label: '备注', excelHeaderName: '备注', required: false, index: 16 },
    ];
  }
  return commonFields;
};

// 获取各渠道的表格列定义
const getChannelColumns = (channel: ChannelType) => {
  const commonColumns = [
    {
      title: '支付渠道',
      dataIndex: '支付渠道',
      key: '支付渠道',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: '支付账号',
      dataIndex: '支付账号',
      key: '支付账号',
      width: 150,
    },
    {
      title: '收支金额',
      dataIndex: '收支金额',
      key: '收支金额',
      width: 120,
      render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
    },
    {
      title: '交易账单号',
      dataIndex: '交易账单号',
      key: '交易账单号',
      width: 200,
      ellipsis: true,
    },
    {
      title: '账单交易时间',
      dataIndex: '账单交易时间',
      key: '账单交易时间',
      width: 180,
      render: (text: string) => formatDateTime(text),
    },
  ];

  if (channel === '1688先采后付') {
    return [
      ...commonColumns,
      { title: '订单号', dataIndex: '订单号', key: '订单号', width: 150, ellipsis: true, render: (text: string) => text || '-' },
      { title: '订单支付时间', dataIndex: '订单支付时间', key: '订单支付时间', width: 180, render: (text: string) => text || '-' },
      { title: '订单名称', dataIndex: '订单名称', key: '订单名称', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '支付金额(元)', dataIndex: '支付金额(元)', key: '支付金额(元)', width: 120, render: (text: string) => text || '-' },
      { title: '确认收货金额(元)', dataIndex: '确认收货金额(元)', key: '确认收货金额(元)', width: 150, render: (text: string) => text || '-' },
      { title: '确认收货时间', dataIndex: '确认收货时间', key: '确认收货时间', width: 180, render: (text: string) => text || '-' },
      { title: '账期类型', dataIndex: '账期类型', key: '账期类型', width: 120, render: (text: string) => text || '-' },
      { title: '是否有退款', dataIndex: '是否有退款', key: '是否有退款', width: 120, render: (text: string) => text || '-' },
      { title: '退款金额(元)', dataIndex: '退款金额(元)', key: '退款金额(元)', width: 120, render: (text: string) => text || '-' },
    ];
  } else if (channel === '京东金融') {
    return [
      ...commonColumns,
      { title: '交易时间', dataIndex: '交易时间', key: '交易时间', width: 180, render: (text: string) => text || '-' },
      { title: '商户名称', dataIndex: '商户名称', key: '商户名称', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '交易说明', dataIndex: '交易说明', key: '交易说明', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '金额', dataIndex: '金额', key: '金额', width: 120, render: (text: string) => text || '-' },
      { title: '收/付款方式', dataIndex: '收/付款方式', key: '收/付款方式', width: 120, render: (text: string) => text || '-' },
      { title: '交易状态', dataIndex: '交易状态', key: '交易状态', width: 120, render: (text: string) => text || '-' },
      { title: '收/支', dataIndex: '收/支', key: '收/支', width: 100, render: (text: string) => text || '-' },
      { title: '交易分类', dataIndex: '交易分类', key: '交易分类', width: 120, render: (text: string) => text || '-' },
      { title: '交易订单号', dataIndex: '交易订单号', key: '交易订单号', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '商家订单号', dataIndex: '商家订单号', key: '商家订单号', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '备注', dataIndex: '备注', key: '备注', width: 200, ellipsis: true, render: (text: string) => text || '-' },
    ];
  } else if (channel === '微信') {
    return [
      ...commonColumns,
      { title: '交易时间', dataIndex: '交易时间', key: '交易时间', width: 180, render: (text: string) => text || '-' },
      { title: '交易类型', dataIndex: '交易类型', key: '交易类型', width: 120, render: (text: string) => text || '-' },
      { title: '交易对方', dataIndex: '交易对方', key: '交易对方', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '商品', dataIndex: '商品', key: '商品', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '收/支', dataIndex: '收/支', key: '收/支', width: 100, render: (text: string) => text || '-' },
      { title: '金额(元)', dataIndex: '金额(元)', key: '金额(元)', width: 120, render: (text: string) => text || '-' },
      { title: '支付方式', dataIndex: '支付方式', key: '支付方式', width: 120, render: (text: string) => text || '-' },
      { title: '当前状态', dataIndex: '当前状态', key: '当前状态', width: 120, render: (text: string) => text || '-' },
      { title: '交易单号', dataIndex: '交易单号', key: '交易单号', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '商户单号', dataIndex: '商户单号', key: '商户单号', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '备注', dataIndex: '备注', key: '备注', width: 200, ellipsis: true, render: (text: string) => text || '-' },
    ];
  } else if (channel === '支付宝') {
    return [
      ...commonColumns,
      { title: '交易时间', dataIndex: '交易时间', key: '交易时间', width: 180, render: (text: string) => text || '-' },
      { title: '交易分类', dataIndex: '交易分类', key: '交易分类', width: 120, render: (text: string) => text || '-' },
      { title: '交易对方', dataIndex: '交易对方', key: '交易对方', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '对方账号', dataIndex: '对方账号', key: '对方账号', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '商品说明', dataIndex: '商品说明', key: '商品说明', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '收/支', dataIndex: '收/支', key: '收/支', width: 100, render: (text: string) => text || '-' },
      { title: '金额', dataIndex: '金额', key: '金额', width: 120, render: (text: string) => text || '-' },
      { title: '收/付款方式', dataIndex: '收/付款方式', key: '收/付款方式', width: 120, render: (text: string) => text || '-' },
      { title: '交易状态', dataIndex: '交易状态', key: '交易状态', width: 120, render: (text: string) => text || '-' },
      { title: '交易订单号', dataIndex: '交易订单号', key: '交易订单号', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '商家订单号', dataIndex: '商家订单号', key: '商家订单号', width: 200, ellipsis: true, render: (text: string) => text || '-' },
      { title: '备注', dataIndex: '备注', key: '备注', width: 200, ellipsis: true, render: (text: string) => text || '-' },
    ];
  }
  return commonColumns;
};

export default function TransactionRecordPage() {
  const [channel, setChannel] = useState<ChannelType>('1688先采后付');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');

  // 5个公共字段的单独搜索
  const [search支付渠道, setSearch支付渠道] = useState('');
  const [search支付账号, setSearch支付账号] = useState('');
  const [search收支金额, setSearch收支金额] = useState('');
  const [search交易账单号, setSearch交易账单号] = useState('');
  const [search账单交易时间范围, setSearch账单交易时间范围] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 列设置相关状态（按渠道独立）
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 加载记录列表
  const loadRecords = async (
    page: number = currentPage,
    search?: string,
  ) => {
    try {
      setLoading(true);
      // 构建搜索条件
      let finalSearch = search || '';
      if (search支付渠道) {
        finalSearch += (finalSearch ? ' ' : '') + `支付渠道:${search支付渠道}`;
      }
      if (search支付账号) {
        finalSearch += (finalSearch ? ' ' : '') + `支付账号:${search支付账号}`;
      }
      if (search交易账单号) {
        finalSearch += (finalSearch ? ' ' : '') + `交易账单号:${search交易账单号}`;
      }
      if (search收支金额) {
        finalSearch += (finalSearch ? ' ' : '') + `收支金额:${search收支金额}`;
      }

      const result = await transactionRecordApi.getAll({
        channel,
        page,
        limit: pageSize,
        search: finalSearch || undefined,
      });

      // 如果有时间范围筛选，在前端过滤
      let filteredData = result.data;
      if (search账单交易时间范围 && search账单交易时间范围[0] && search账单交易时间范围[1]) {
        const startTime = search账单交易时间范围[0].startOf('day');
        const endTime = search账单交易时间范围[1].endOf('day');
        filteredData = result.data.filter((record: any) => {
          if (!record.账单交易时间) return false;
          const recordTime = dayjs(record.账单交易时间);
          return recordTime.isAfter(startTime) && recordTime.isBefore(endTime);
        });
      }

      setRecords(filteredData);
      setTotal(filteredData.length);
    } catch (error: any) {
      message.error(error.message || '加载记录列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    setCurrentPage(1);
    setSearchText('');
    setSearch支付渠道('');
    setSearch支付账号('');
    setSearch收支金额('');
    setSearch交易账单号('');
    setSearch账单交易时间范围(null);
    loadRecords(1, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // 从 localStorage 加载列显示偏好和顺序（按渠道独立）
  useEffect(() => {
    const storageKey = `transaction_record_${channel}_hidden_columns`;
    const savedHiddenColumns = localStorage.getItem(storageKey);
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    } else {
      setHiddenColumns(new Set());
    }

    const orderKey = `transaction_record_${channel}_column_order`;
    const savedColumnOrder = localStorage.getItem(orderKey);
    if (savedColumnOrder) {
      try {
        const parsed = JSON.parse(savedColumnOrder);
        setColumnOrder(parsed);
      } catch (error) {
        console.error('加载列顺序失败:', error);
      }
    } else {
      setColumnOrder([]);
    }
  }, [channel]);

  // 保存列显示偏好到 localStorage（按渠道独立）
  const saveHiddenColumns = (hidden: Set<string>) => {
    const storageKey = `transaction_record_${channel}_hidden_columns`;
    localStorage.setItem(storageKey, JSON.stringify(Array.from(hidden)));
  };

  // 保存列顺序到 localStorage（按渠道独立）
  const saveColumnOrder = (order: string[]) => {
    const orderKey = `transaction_record_${channel}_column_order`;
    localStorage.setItem(orderKey, JSON.stringify(order));
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

  // 执行搜索
  const handleSearch = () => {
    setCurrentPage(1);
    loadRecords(1, searchText || undefined);
  };

  // 重置
  const handleReset = () => {
    setSearchText('');
    setSearch支付渠道('');
    setSearch支付账号('');
    setSearch收支金额('');
    setSearch交易账单号('');
    setSearch账单交易时间范围(null);
    setCurrentPage(1);
    loadRecords(1, undefined);
  };

  // 打开新增模态框
  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({ 支付渠道: channel });
    setModalVisible(true);
  };

  // 保存单个记录
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await transactionRecordApi.batchCreate(channel, [values]);
      message.success('创建成功');
      setModalVisible(false);
      loadRecords();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error('创建失败: ' + (error?.message || '未知错误'));
    }
  };

  // 打开批量新增模态框
  const handleBatchAdd = () => {
    setBatchModalVisible(true);
  };

  // 创建批量新增数据项
  const createBatchItem = useCallback((parts: string[]): Partial<any> => {
    const fields = getChannelFields(channel);
    const item: any = {};
    fields.forEach((field, index) => {
      if (parts[index] !== undefined) {
        const value = parts[index]?.trim();
        if (value) {
          item[field.key] = value;
        }
      }
    });
    // 确保支付渠道设置
    item.支付渠道 = channel;
    return item;
  }, [channel]);

  // 批量保存
  const handleBatchSave = useCallback(async (validItems: any[]) => {
    try {
      const result = await transactionRecordApi.batchCreate(channel, validItems);
      if (result.errors && result.errors.length > 0) {
        message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
      }
      message.success(`成功创建 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      loadRecords();
    } catch (e: any) {
      message.error('批量创建失败: ' + (e?.message || '未知错误'));
    }
  }, [channel]);

  // 获取导出字段配置
  const getExportFields = () => {
    const allColumns = getChannelColumns(channel);
    return allColumns.map(col => ({
      key: col.key as string,
      label: col.title as string,
    }));
  };

  // 获取全部数据用于导出
  const fetchAllData = useCallback(async () => {
    return await transactionRecordApi.getAllForExport({
      channel,
      search: searchText || undefined,
    });
  }, [channel, searchText]);

  // 表格列定义
  const allColumns = getChannelColumns(channel);

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
    return orderedColumns.filter(col => !hiddenColumns.has(col.key as string));
  };

  const columns = getFilteredColumns();

  return (
    <div style={{ padding: 0 }}>
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>流水记录</Title>
          </Space>
        }
        extra={
          <Space>
            <Search
              placeholder="综合搜索"
              allowClear
              style={{ width: 250 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
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
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              重置
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => setExportModalVisible(true)}
            >
              导出数据
            </Button>
          </Space>
        }
      >
        {/* 渠道切换 */}
        <div style={{ marginBottom: 16 }}>
          <Segmented
            options={['1688先采后付', '京东金融', '微信', '支付宝']}
            value={channel}
            onChange={(value) => {
              setChannel(value as ChannelType);
              setCurrentPage(1);
              setSearchText('');
              setSearch支付渠道('');
              setSearch支付账号('');
              setSearch收支金额('');
              setSearch交易账单号('');
              setSearch账单交易时间范围(null);
            }}
            size="large"
            block
          />
        </div>

        {/* 5个公共字段的单独搜索框 */}
        <div style={{ marginBottom: 16, padding: '16px', backgroundColor: '#fafafa', borderRadius: 4 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>单独搜索</div>
            <Space wrap>
              <Input
                placeholder="支付渠道"
                allowClear
                style={{ width: 150 }}
                value={search支付渠道}
                onChange={(e) => setSearch支付渠道(e.target.value)}
                onPressEnter={handleSearch}
              />
              <Input
                placeholder="支付账号"
                allowClear
                style={{ width: 150 }}
                value={search支付账号}
                onChange={(e) => setSearch支付账号(e.target.value)}
                onPressEnter={handleSearch}
              />
              <Input
                placeholder="收支金额"
                allowClear
                style={{ width: 150 }}
                value={search收支金额}
                onChange={(e) => setSearch收支金额(e.target.value)}
                onPressEnter={handleSearch}
              />
              <Input
                placeholder="交易账单号"
                allowClear
                style={{ width: 200 }}
                value={search交易账单号}
                onChange={(e) => setSearch交易账单号(e.target.value)}
                onPressEnter={handleSearch}
              />
              <RangePicker
                placeholder={['开始时间', '结束时间']}
                value={search账单交易时间范围}
                onChange={(dates) => setSearch账单交易时间范围(dates as [Dayjs | null, Dayjs | null] | null)}
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                style={{ width: 400 }}
              />
            </Space>
          </Space>
        </div>

        <ResponsiveTable<any>
          tableId={`transaction-record-${channel}`}
          columns={columns as any}
          dataSource={records}
          rowKey={(record) => record.交易账单号 || String(Math.random())}
          loading={loading}
          isMobile={false}
          scroll={{ x: 2000, y: 600 }}
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
              loadRecords(page, searchText || undefined);
            },
          }}
        />
      </Card>

      {/* 新增模态框 */}
      <Modal
        title={`新增${channel}记录`}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
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
          {getChannelFields(channel).map((field) => (
            <Form.Item
              key={field.key as string}
              label={field.label}
              name={field.key as string}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
            >
              <Input placeholder={`请输入${field.label}`} />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {/* 批量新增模态框 */}
      <BatchAddModal<any>
        open={batchModalVisible}
        title={
          <Space>
            <span>批量新增</span>
            <Tag color="blue" style={{ marginBottom: 4 }}>{channel}</Tag>
            <span>记录</span>
          </Space>
        }
        hint={`您可以从 Excel 中复制数据，然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件。`}
        fields={getChannelFields(channel)}
        formatHint={`格式：${getChannelFields(channel).map(f => f.label).join('\t')}`}
        onCancel={() => setBatchModalVisible(false)}
        onSave={handleBatchSave}
        createItem={createBatchItem}
      />

      {/* 导出数据模态框 */}
      <ExcelExportModal<any>
        open={exportModalVisible}
        title={`导出${channel}数据`}
        fields={getExportFields()}
        selectedData={records}
        fetchAllData={fetchAllData}
        onCancel={() => setExportModalVisible(false)}
        fileName={`${channel}流水记录`}
      />
    </div>
  );
}
