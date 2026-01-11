"use client";

import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';
import { formatDateTime } from '@/lib/dateUtils';
import {
  DownloadOutlined,
  FilterOutlined,
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
  InputNumber,
  message,
  Modal,
  Popover,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  Upload
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import zhCN from 'antd/locale/zh_CN';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { nonPurchaseBillRecordApi, transactionRecordApi } from '../lib/api';
import BatchAddModal, { FieldConfig } from './BatchAddModal';
import ColumnSettings from './ColumnSettings';
import ExcelExportModal from './ExcelExportModal';
import ResponsiveTable from './ResponsiveTable';

const { Search } = Input;
const { Title } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

type ChannelType = '1688先采后付' | '京东金融' | '微信' | '支付宝';

// 页面唯一标识符
const PAGE_KEY = 'transaction-record';

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
const getChannelColumns = (
  channel: ChannelType,
  onAddNonPurchase?: (record: any) => void,
  columnFilters?: Record<string, string[]>,
  onFilterChange?: (columnKey: string, selectedValues: string[]) => void,
  allRecords?: any[]
) => {
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
    {
      title: '绑定状态',
      dataIndex: '绑定状态',
      key: '绑定状态',
      width: 200,
      render: (statuses: string[]) => {
        if (!statuses || statuses.length === 0) {
          return '-';
        }
        return (
          <div>
            {statuses.map((status, index) => (
              <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                {status}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: '绑定状态对应情况',
      dataIndex: '绑定状态对应情况',
      key: '绑定状态对应情况',
      width: 200,
      render: (details: string[]) => {
        if (!details || details.length === 0) {
          return '-';
        }
        return (
          <div>
            {details.map((detail, index) => (
              <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                {detail}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: any) => {
        const hasNonPurchase = record.是否有非采购单流水;
        return (
          <Button
            type="primary"
            size="small"
            disabled={hasNonPurchase}
            onClick={() => onAddNonPurchase?.(record)}
          >
            添加非采购单流水
          </Button>
        );
      },
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


// 搜索框筛选组件
const SearchFilterDropdown = ({
  columnKey,
  columnTitle,
  searchText,
  onSearchChange,
  onConfirm,
  onClear,
  setSelectedKeys,
  confirm,
  clearFilters,
}: {
  columnKey: string;
  columnTitle: string;
  searchText: string;
  onSearchChange: (text: string) => void;
  onConfirm: (text: string) => void;
  onClear: () => void;
  setSelectedKeys: (keys: string[]) => void;
  confirm: () => void;
  clearFilters?: () => void;
}) => {
  const [localSearchText, setLocalSearchText] = useState(searchText);

  // 当外部 searchText 变化时，同步到本地状态
  useEffect(() => {
    setLocalSearchText(searchText);
  }, [searchText]);

  const handleConfirm = () => {
    onSearchChange(localSearchText);
    onConfirm(localSearchText);
    if (localSearchText) {
      setSelectedKeys([localSearchText]);
    } else {
      setSelectedKeys([]);
    }
    confirm();
  };

  const handleClear = () => {
    setLocalSearchText('');
    onSearchChange('');
    onClear();
    setSelectedKeys([]);
    if (clearFilters) {
      clearFilters();
    }
    confirm();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <div style={{ padding: 12, minWidth: 300 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#333' }}>
          搜索 {columnTitle}
        </div>
        <Input
          placeholder={`请输入${columnTitle}关键词进行搜索`}
          allowClear
          value={localSearchText}
          onChange={(e) => setLocalSearchText(e.target.value)}
          onPressEnter={handleKeyPress}
          size="small"
          prefix={<SearchOutlined />}
          autoFocus
        />
        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          将在数据库中搜索该列的所有匹配数据
        </div>
      </div>
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          onClick={handleClear}
        >
          清空
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={handleConfirm}
        >
          搜索
        </Button>
      </Space>
    </div>
  );
};

// 为所有渠道的列添加搜索筛选功能
const addSearchFiltersToColumns = (
  columns: any[],
  columnSearchKeywords: Record<string, string>,
  onSearchChange: (columnKey: string, keyword: string) => void,
  onSearchClear: (columnKey: string) => void
): any[] => {
  return columns.map(col => {
    const columnKey = col.key as string;
    const columnTitle = col.title as string;
    if (!columnKey || columnKey === 'action' || columnKey === '绑定状态' || columnKey === '绑定状态对应情况') {
      return col;
    }

    const searchKeyword = columnSearchKeywords[columnKey] || '';

    return {
      ...col,
      filteredValue: searchKeyword ? [searchKeyword] : null,
      filterIcon: (filtered: boolean) => (
        <FilterOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      filterDropdown: ({ setSelectedKeys, confirm, clearFilters }: any) => (
        <SearchFilterDropdown
          columnKey={columnKey}
          columnTitle={columnTitle}
          searchText={searchKeyword}
          onSearchChange={(text) => onSearchChange(columnKey, text)}
          onConfirm={(text) => {
            onSearchChange(columnKey, text);
          }}
          onClear={() => {
            onSearchClear(columnKey);
          }}
          setSelectedKeys={setSelectedKeys}
          confirm={confirm}
          clearFilters={clearFilters}
        />
      ),
    };
  });
};

export default function TransactionRecordPage() {
  // 定义默认状态
  const defaultState = {
    channel: '1688先采后付' as ChannelType,
    currentPage: 1,
    pageSize: 20,
    searchText: '',
    search支付渠道: '',
    search支付账号: '',
    search收支金额: '',
    search交易账单号: '',
    search账单交易时间范围: null as [Dayjs | null, Dayjs | null] | null,
    selectedBindingStatuses: [] as string[],
  };

  // 恢复保存的状态
  const restoredState = usePageStateRestore(PAGE_KEY, defaultState);

  const [channel, setChannel] = useState<ChannelType>(restoredState?.channel ?? defaultState.channel);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(restoredState?.currentPage ?? defaultState.currentPage);
  const [pageSize, setPageSize] = useState(restoredState?.pageSize ?? defaultState.pageSize);
  const [searchText, setSearchText] = useState(restoredState?.searchText ?? defaultState.searchText);

  // 5个公共字段的单独搜索
  const [search支付渠道, setSearch支付渠道] = useState(restoredState?.search支付渠道 ?? defaultState.search支付渠道);
  const [search支付账号, setSearch支付账号] = useState(restoredState?.search支付账号 ?? defaultState.search支付账号);
  const [search收支金额, setSearch收支金额] = useState(restoredState?.search收支金额 ?? defaultState.search收支金额);
  const [search交易账单号, setSearch交易账单号] = useState(restoredState?.search交易账单号 ?? defaultState.search交易账单号);
  // 恢复账单交易时间范围时，需要将字符串转换回 dayjs 对象
  const getRestored账单交易时间范围 = (): [Dayjs | null, Dayjs | null] | null => {
    if (!restoredState?.search账单交易时间范围) return defaultState.search账单交易时间范围;
    const restored = restoredState.search账单交易时间范围;
    // 如果是数组，尝试转换为 dayjs 对象
    if (Array.isArray(restored) && restored.length === 2) {
      const [start, end] = restored;
      const convertToDayjs = (val: any): Dayjs | null => {
        if (!val) return null;
        if (typeof val === 'string') {
          const d = dayjs(val);
          return d.isValid() ? d : null;
        }
        // 检查是否是 dayjs 对象（有 isValid 方法）
        if (val && typeof val.isValid === 'function') {
          return val.isValid() ? val : null;
        }
        return null;
      };
      return [convertToDayjs(start), convertToDayjs(end)] as [Dayjs | null, Dayjs | null];
    }
    return null;
  };
  const [search账单交易时间范围, setSearch账单交易时间范围] = useState<[Dayjs | null, Dayjs | null] | null>(getRestored账单交易时间范围());

  // 绑定状态筛选
  const [selectedBindingStatuses, setSelectedBindingStatuses] = useState<string[]>(restoredState?.selectedBindingStatuses ?? defaultState.selectedBindingStatuses);

  // 保存状态（自动保存，防抖 300ms）
  usePageStateSave(PAGE_KEY, {
    channel,
    currentPage,
    pageSize,
    searchText,
    search支付渠道,
    search支付账号,
    search收支金额,
    search交易账单号,
    search账单交易时间范围,
    selectedBindingStatuses,
  });

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [nonPurchaseModalVisible, setNonPurchaseModalVisible] = useState(false);
  const [nonPurchaseForm] = Form.useForm();
  const [nonPurchaseFormData, setNonPurchaseFormData] = useState<{ 账单流水: string; 记账金额: number } | null>(null);
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  // 列设置相关状态（按渠道独立）
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 所有渠道的列搜索关键词（每列的搜索关键词）
  const [columnSearchKeywords, setColumnSearchKeywords] = useState<Record<string, string>>({});

  // 加载记录列表
  const loadRecords = async (
    page: number = currentPage,
    search?: string,
    size?: number,
    overrideSearchParams?: {
      支付渠道?: string;
      支付账号?: string;
      交易账单号?: string;
      收支金额?: string;
      账单交易时间范围?: [Dayjs | null, Dayjs | null] | null;
    },
  ) => {
    try {
      setLoading(true);

      // 使用传入的参数或当前状态
      const currentSize = size ?? pageSize;
      const currentSearch支付渠道 = overrideSearchParams?.支付渠道 !== undefined ? overrideSearchParams.支付渠道 : search支付渠道;
      const currentSearch支付账号 = overrideSearchParams?.支付账号 !== undefined ? overrideSearchParams.支付账号 : search支付账号;
      const currentSearch交易账单号 = overrideSearchParams?.交易账单号 !== undefined ? overrideSearchParams.交易账单号 : search交易账单号;
      const currentSearch收支金额 = overrideSearchParams?.收支金额 !== undefined ? overrideSearchParams.收支金额 : search收支金额;
      const currentSearch账单交易时间范围 = overrideSearchParams?.账单交易时间范围 !== undefined ? overrideSearchParams.账单交易时间范围 : search账单交易时间范围;

      // 构建搜索条件 - 使用多个单独的搜索参数
      const searchParams: string[] = [];

      if (search && search.trim()) {
        searchParams.push(search.trim());
      }
      if (currentSearch支付渠道 && currentSearch支付渠道.trim()) {
        searchParams.push(`支付渠道:${currentSearch支付渠道.trim()}`);
      }
      if (currentSearch支付账号 && currentSearch支付账号.trim()) {
        searchParams.push(`支付账号:${currentSearch支付账号.trim()}`);
      }
      if (currentSearch交易账单号 && currentSearch交易账单号.trim()) {
        searchParams.push(`交易账单号:${currentSearch交易账单号.trim()}`);
      }
      if (currentSearch收支金额 && currentSearch收支金额.trim()) {
        const amountValue = currentSearch收支金额.trim();
        // 支持搜索正数和负数，如果输入的是正数，也搜索负数
        // 使用特殊格式：收支金额:18.50 表示搜索 18.50 或 -18.50
        searchParams.push(`收支金额:${amountValue}`);
      }

      // 添加列搜索关键词到搜索参数（支持所有渠道）
      const columnSearchParams = buildColumnSearchParams();
      searchParams.push(...columnSearchParams);

      const finalSearch = searchParams.length > 0 ? searchParams.join(' ') : undefined;

      const result = await transactionRecordApi.getAll({
        channel,
        page,
        limit: currentSize,
        search: finalSearch,
        bindingStatuses: selectedBindingStatuses.length > 0 ? selectedBindingStatuses.join(',') : undefined,
      });

      // 如果有时间范围筛选，在前端过滤
      let filteredData = result.data;
      let filteredTotal = result.total;
      if (currentSearch账单交易时间范围 && currentSearch账单交易时间范围[0] && currentSearch账单交易时间范围[1]) {
        // 使用与 FinanceReconciliationDifferencePage 相同的格式：YYYY-MM-DD 00:00:00 和 YYYY-MM-DD 23:59:59
        const startTimeStr = currentSearch账单交易时间范围[0].format('YYYY-MM-DD 00:00:00');
        const endTimeStr = currentSearch账单交易时间范围[1].format('YYYY-MM-DD 23:59:59');
        const startTime = dayjs(startTimeStr);
        const endTime = dayjs(endTimeStr);
        filteredData = result.data.filter((record: any) => {
          if (!record.账单交易时间) return false;
          const recordTime = dayjs(record.账单交易时间);
          if (!recordTime.isValid()) return false;
          // 包含边界值：大于等于开始时间（00:00:00）且小于等于结束时间（23:59:59）
          // 使用 diff 方法比较时间戳：>= 0 表示 >=，<= 0 表示 <=
          const startDiff = recordTime.diff(startTime);
          const endDiff = recordTime.diff(endTime);
          return startDiff >= 0 && endDiff <= 0;
        });
        // 如果前端过滤了数据，总数应该使用过滤后的数量
        // 但为了准确，应该重新查询总数，这里先用过滤后的数据长度
        filteredTotal = filteredData.length;
      }

      setRecords(filteredData);
      // 在异步分页模式下，如果前端过滤导致数据长度变化
      // 确保 total 合理设置：如果过滤后数据少于 pageSize，total 应该等于数据长度
      // 如果过滤后数据等于 pageSize，total 应该使用后端返回的值
      if (filteredData.length < currentSize) {
        // 如果过滤后数据少于 pageSize，说明已经是最后的数据了
        // total 应该等于实际数据长度
        setTotal(filteredData.length);
      } else {
        // 如果过滤后数据等于 pageSize，使用后端返回的 total
        // 但确保 total 至少等于当前数据长度
        setTotal(Math.max(filteredTotal, filteredData.length));
      }
    } catch (error: any) {
      message.error(error.message || '加载记录列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 将列搜索关键词转换为搜索参数（支持所有渠道）
  const buildColumnSearchParams = useCallback((): string[] => {
    const searchParams: string[] = [];
    Object.entries(columnSearchKeywords).forEach(([columnKey, keyword]) => {
      if (keyword && keyword.trim()) {
        // 将搜索关键词转换为搜索格式：列名:关键词
        searchParams.push(`${columnKey}:${keyword.trim()}`);
      }
    });
    return searchParams;
  }, [columnSearchKeywords]);


  // 检查是否有列搜索条件（支持所有渠道）
  const hasActiveColumnFilters = Object.values(columnSearchKeywords).some(keyword => keyword && keyword.trim());

  // 显示的数据就是当前加载的记录（筛选通过后端搜索实现）
  const displayedRecords = records;

  // 当列搜索关键词改变时，通过搜索重新加载数据（支持所有渠道）
  useEffect(() => {
    // 搜索关键词改变时，重置到第一页并重新加载数据（搜索关键词会通过buildColumnSearchParams自动添加到搜索参数）
    setCurrentPage(1);
    loadRecords(1, searchText || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSearchKeywords]);

  // 设置 dayjs 中文 locale
  useEffect(() => {
    dayjs.locale('zh-cn');
  }, []);

  // 使用 ref 标记是否已经初始加载
  const hasInitialLoadRef = useRef(false);

  // 如果恢复了状态，需要重新加载数据（只在组件挂载时执行一次）
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      // 切换渠道时，清除该渠道的列宽设置，使用默认列宽确保对齐
      const widthStorageKey = `table_column_widths_transaction-record-${channel}`;
      localStorage.removeItem(widthStorageKey);

      // 切换渠道时清除列搜索（所有渠道都支持，切换时清除）
      setColumnSearchKeywords({});

      // 使用恢复的搜索参数加载数据
      loadRecords(currentPage, searchText || undefined, pageSize, {
        支付渠道: search支付渠道 || undefined,
        支付账号: search支付账号 || undefined,
        交易账单号: search交易账单号 || undefined,
        收支金额: search收支金额 || undefined,
        账单交易时间范围: search账单交易时间范围 || undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 当 channel 变化时，重置状态并重新加载数据（排除初始加载）
  useEffect(() => {
    if (hasInitialLoadRef.current) {
      setCurrentPage(1);
      setSearchText('');
      setSearch支付渠道('');
      setSearch支付账号('');
      setSearch收支金额('');
      setSearch交易账单号('');
      setSearch账单交易时间范围(null);
      setSelectedBindingStatuses([]);

      // 切换渠道时，清除该渠道的列宽设置，使用默认列宽确保对齐
      const widthStorageKey = `table_column_widths_transaction-record-${channel}`;
      localStorage.removeItem(widthStorageKey);

      // 切换渠道时清除列搜索（所有渠道都支持，切换时清除）
      setColumnSearchKeywords({});

      loadRecords(1, undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // 当 currentPage 或 pageSize 变化时加载数据（排除初始加载）
  useEffect(() => {
    if (hasInitialLoadRef.current) {
      loadRecords(currentPage, searchText || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  // 当绑定状态筛选变化时，重新加载数据
  useEffect(() => {
    loadRecords(currentPage, searchText || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBindingStatuses]);

  // 从 localStorage 加载列显示偏好和顺序（按渠道独立）
  useEffect(() => {
    const storageKey = `transaction_record_${channel}_hidden_columns`;
    const savedHiddenColumns = localStorage.getItem(storageKey);
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        // 验证隐藏的列是否在当前渠道的列中存在
        const allColumnKeys = getChannelColumns(channel).map(col => col.key as string).filter(Boolean);
        const validHidden = parsed.filter((key: string) => allColumnKeys.includes(key));
        setHiddenColumns(new Set(validHidden));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
        setHiddenColumns(new Set());
      }
    } else {
      setHiddenColumns(new Set());
    }

    const orderKey = `transaction_record_${channel}_column_order`;
    const savedColumnOrder = localStorage.getItem(orderKey);
    if (savedColumnOrder) {
      try {
        const parsed = JSON.parse(savedColumnOrder);
        // 验证列顺序是否包含所有列
        const allColumnKeys = getChannelColumns(channel).map(col => col.key as string).filter(Boolean);
        const validOrder = parsed.filter((key: string) => allColumnKeys.includes(key));
        // 如果保存的顺序不完整，补充缺失的列
        const missingKeys = allColumnKeys.filter(key => !validOrder.includes(key));
        const newOrder = [...validOrder, ...missingKeys];
        setColumnOrder(newOrder);

        // 如果列顺序发生了变化（有新增的列），清除列宽设置以确保对齐
        if (missingKeys.length > 0) {
          const widthStorageKey = `table_column_widths_transaction-record-${channel}`;
          localStorage.removeItem(widthStorageKey);
        }
      } catch (error) {
        console.error('加载列顺序失败:', error);
        setColumnOrder([]);
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

    // 列顺序改变时，清除列宽设置以确保表头和内容对齐
    const widthStorageKey = `table_column_widths_transaction-record-${channel}`;
    localStorage.removeItem(widthStorageKey);
  };

  // 执行搜索
  const handleSearch = () => {
    setCurrentPage(1);
    loadRecords(1, searchText || undefined, undefined, {
      支付渠道: search支付渠道 || undefined,
      支付账号: search支付账号 || undefined,
      交易账单号: search交易账单号 || undefined,
      收支金额: search收支金额 || undefined,
      账单交易时间范围: search账单交易时间范围 || undefined,
    });
  };

  // 重置
  const handleReset = () => {
    // 先清除所有搜索条件
    setSearchText('');
    setSearch支付渠道('');
    setSearch支付账号('');
    setSearch收支金额('');
    setSearch交易账单号('');
    setSearch账单交易时间范围(null);
    setSelectedBindingStatuses([]);
    setCurrentPage(1);

    // 清除所有列搜索关键词（所有渠道的表头搜索）
    // 这会触发 useEffect，自动重新加载数据
    setColumnSearchKeywords({});

    // 对于非支付宝渠道，或者确保支付宝渠道也能立即重置，我们手动调用一次 loadRecords
    // 使用 setTimeout 确保 setState 完成后再加载数据
    setTimeout(() => {
      loadRecords(1, undefined, undefined, {
        支付渠道: '',
        支付账号: '',
        交易账单号: '',
        收支金额: '',
        账单交易时间范围: null,
      });
    }, 0);
  };

  // 文件转换为base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 图片上传前验证
  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('图片大小不能超过10MB！');
      return false;
    }
    return false; // 阻止自动上传，手动处理
  };

  // 图片变化处理
  const handleImageChange = (info: any) => {
    setImageFileList(info.fileList);
  };

  // 打开添加非采购单流水弹框
  const handleOpenNonPurchaseModal = (record: any) => {
    setNonPurchaseFormData({
      账单流水: record.交易账单号,
      记账金额: record.收支金额 || 0,
    });
    nonPurchaseForm.setFieldsValue({
      账单流水: record.交易账单号,
      记账金额: record.收支金额 || 0,
      账单类型: '',
      所属仓店: '',
      账单流水备注: '',
      财务记账凭证号: '',
      财务审核人: '',
    });
    setImageFileList([]);
    setNonPurchaseModalVisible(true);
  };

  // 保存非采购单流水
  const handleSaveNonPurchase = async () => {
    try {
      const values = await nonPurchaseForm.validateFields();

      // 处理图片
      let imageBase64: string | undefined;
      if (imageFileList.length > 0 && imageFileList[0].originFileObj) {
        imageBase64 = await fileToBase64(imageFileList[0].originFileObj);
      } else {
        imageBase64 = undefined;
      }

      const recordData = {
        账单流水: values.账单流水,
        记账金额: values.记账金额 || undefined,
        账单类型: values.账单类型 || undefined,
        所属仓店: values.所属仓店 || undefined,
        账单流水备注: values.账单流水备注 || undefined,
        图片: imageBase64,
        财务记账凭证号: values.财务记账凭证号 || undefined,
        财务审核状态: '0',
        财务审核人: values.财务审核人 || undefined,
      };

      await nonPurchaseBillRecordApi.create(recordData);
      message.success('创建成功');
      setNonPurchaseModalVisible(false);
      setImageFileList([]);
      loadRecords(currentPage, searchText || undefined);
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      let errorMessage = '未知错误';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      message.error('创建失败: ' + errorMessage);
    }
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
      loadRecords(currentPage, searchText || undefined);
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
      loadRecords(currentPage, searchText || undefined);
    } catch (e: any) {
      message.error('批量创建失败: ' + (e?.message || '未知错误'));
    }
  }, [channel, currentPage, searchText]);

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
  const baseColumns = getChannelColumns(channel, handleOpenNonPurchaseModal);

  // 为所有渠道添加搜索筛选功能
  const allColumns = addSearchFiltersToColumns(
    baseColumns,
    columnSearchKeywords,
    (columnKey: string, keyword: string) => {
      setColumnSearchKeywords(prev => ({
        ...prev,
        [columnKey]: keyword,
      }));
    },
    (columnKey: string) => {
      setColumnSearchKeywords(prev => {
        const newKeywords = { ...prev };
        delete newKeywords[columnKey];
        return newKeywords;
      });
    }
  );

  // 根据列设置过滤和排序列
  const getFilteredColumns = () => {
    // 获取所有列的key
    const allColumnKeys = allColumns.map(col => col.key as string).filter(Boolean);

    // 如果columnOrder为空，使用所有列的顺序
    let currentOrder: string[];
    if (columnOrder.length > 0) {
      // 合并保存的顺序和所有列，确保所有列都包含在内
      const savedKeys = new Set(columnOrder);
      const missingKeys = allColumnKeys.filter(key => !savedKeys.has(key));
      currentOrder = [...columnOrder, ...missingKeys];
    } else {
      currentOrder = allColumnKeys;
    }

    // 按照保存的顺序排列，但只包含实际存在的列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter(Boolean) as typeof allColumns;

    // 过滤隐藏的列
    const filtered = orderedColumns.filter(col => !hiddenColumns.has(col.key as string));

    // 确保每列都有明确的width属性，避免列宽不一致
    return filtered.map(col => {
      // 如果列没有width，使用默认值
      if (!col.width) {
        return { ...col, width: 150 };
      }
      return col;
    });
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
          <Space size="small">
            {/* 绑定状态筛选 */}
            <Select
              mode="multiple"
              placeholder="绑定状态"
              allowClear
              size="small"
              style={{ width: 160 }}
              value={selectedBindingStatuses}
              onChange={(values) => setSelectedBindingStatuses(values || [])}
            >
              <Select.Option value="已绑定采购单">已绑定采购单</Select.Option>
              <Select.Option value="已生成对账单">已生成对账单</Select.Option>
              <Select.Option value="非采购单流水">非采购单流水</Select.Option>
              <Select.Option value="无绑定状态">无绑定状态</Select.Option>
            </Select>
            {/* 5个公共字段的单独搜索框 */}
            <Input
              placeholder="支付渠道"
              allowClear
              size="small"
              style={{ width: 120 }}
              value={search支付渠道}
              onChange={(e) => setSearch支付渠道(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Input
              placeholder="支付账号"
              allowClear
              size="small"
              style={{ width: 120 }}
              value={search支付账号}
              onChange={(e) => setSearch支付账号(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Input
              placeholder="收支金额"
              allowClear
              size="small"
              style={{ width: 120 }}
              value={search收支金额}
              onChange={(e) => setSearch收支金额(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Input
              placeholder="交易账单号"
              allowClear
              size="small"
              style={{ width: 300 }}
              maxLength={500}
              value={search交易账单号}
              onChange={(e) => setSearch交易账单号(e.target.value)}
              onPressEnter={handleSearch}
            />
            <DatePicker.RangePicker
              size="small"
              style={{ width: 180, fontSize: '12px' }}
              value={search账单交易时间范围}
              onChange={(dates) => {
                setSearch账单交易时间范围(dates as [Dayjs | null, Dayjs | null] | null);
              }}
              format="YYYY-MM-DD"
              placeholder={['开始时间', '结束时间']}
              locale={zhCN.DatePicker}
            />
            <Button
              size="small"
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
              <Button size="small" icon={<SettingOutlined />}>列设置</Button>
            </Popover>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>
            <Button
              size="small"
              icon={<UploadOutlined />}
              onClick={handleBatchAdd}
            >
              批量新增
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => setExportModalVisible(true)}
            >
              导出数据
            </Button>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              重置
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

        <ResponsiveTable<any>
          tableId={`transaction-record-${channel}`}
          columns={columns as any}
          dataSource={displayedRecords}
          rowKey={(record) => record.交易账单号 || String(Math.random())}
          loading={loading}
          isMobile={false}
          scroll={{ x: 2000, y: 600 }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            // 在异步模式下，直接使用 total 状态值（已在 loadRecords 中正确设置）
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => {
              const filterHint = hasActiveColumnFilters ? '（已筛选）' : '';
              return `第 ${range[0]}-${range[1]} 条，共 ${total} 条${filterHint}`;
            },
            onChange: (page, size) => {
              setCurrentPage(page);
              if (!hasActiveColumnFilters) {
                // 如果没有筛选条件，正常加载数据
                if (size && size !== pageSize) {
                  setPageSize(size);
                  loadRecords(page, searchText || undefined, size);
                } else {
                  loadRecords(page, searchText || undefined);
                }
              } else {
                // 如果有筛选条件，也需要重新加载数据（筛选条件会在loadRecords中自动添加）
                if (size && size !== pageSize) {
                  setPageSize(size);
                  loadRecords(page, searchText || undefined, size);
                } else {
                  loadRecords(page, searchText || undefined);
                }
              }
            },
            onShowSizeChange: (current, size) => {
              setCurrentPage(1);
              setPageSize(size);
              if (!hasActiveColumnFilters) {
                // 如果没有筛选条件，正常加载数据
                loadRecords(1, searchText || undefined, size);
              } else {
                // 如果有筛选条件，也需要重新加载数据
                loadRecords(1, searchText || undefined, size);
              }
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

      {/* 添加非采购单流水弹框 */}
      <Modal
        title="添加非采购单流水"
        open={nonPurchaseModalVisible}
        onOk={handleSaveNonPurchase}
        onCancel={() => {
          setNonPurchaseModalVisible(false);
          nonPurchaseForm.resetFields();
          setImageFileList([]);
          setNonPurchaseFormData(null);
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={nonPurchaseForm}
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
            <Input placeholder="请输入账单流水" />
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
            label="图片"
            help="支持上传图片，大小不超过10MB"
            name="image"
            style={{ display: 'none' }}
          >
            <Input type="hidden" />
          </Form.Item>
          <Form.Item
            label=" "
            colon={false}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                listType="picture-card"
                fileList={imageFileList}
                beforeUpload={beforeUpload}
                onChange={handleImageChange}
                onRemove={() => {
                  setImageFileList([]);
                  return true;
                }}
                maxCount={1}
              >
                {imageFileList.length < 1 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传图片</div>
                  </div>
                )}
              </Upload>
              {imageFileList.length > 0 && (
                <Button
                  danger
                  size="small"
                  onClick={() => {
                    setImageFileList([]);
                  }}
                >
                  清空图片
                </Button>
              )}
            </Space>
          </Form.Item>

          <Form.Item
            label="财务记账凭证号"
            name="财务记账凭证号"
          >
            <Input placeholder="请输入财务记账凭证号" />
          </Form.Item>

          <Form.Item
            label="财务审核人"
            name="财务审核人"
          >
            <Input placeholder="请输入财务审核人" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
