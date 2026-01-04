"use client";

import { FinanceBill, financeManagementApi, FinanceReconciliationDifference, financeReconciliationDifferenceApi, NonPurchaseBillRecord, nonPurchaseBillRecordApi, PurchaseAmountAdjustment, purchaseAmountAdjustmentApi, PurchaseOrderInfo, purchaseOrderInfoApi, TransactionRecord, transactionRecordApi } from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';
import {
  CloseOutlined,
  ColumnWidthOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Popover,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import zhCN from 'antd/locale/zh_CN';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useEffect, useMemo, useRef, useState } from 'react';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { Title } = Typography;
const { TextArea } = Input;

export default function FinanceReconciliationDifferencePage() {
  const [records, setRecords] = useState<FinanceReconciliationDifference[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  // 单独的搜索字段（主表）
  const [search对账单号, setSearch对账单号] = useState('');
  const [search记录状态, setSearch记录状态] = useState<string[]>([]);
  const [search对账单收货状态, setSearch对账单收货状态] = useState<string[]>([]);
  const [search更新时间范围, setSearch更新时间范围] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [search采购单号, setSearch采购单号] = useState(''); // 采购单号搜索对账单号
  const [search交易单号, setSearch交易单号] = useState(''); // 交易单号搜索对账单号


  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);


  // 账单手动绑定采购单相关状态（FinanceManagement）
  const [financeBillModalVisible, setFinanceBillModalVisible] = useState(false);
  const [financeBillForm] = Form.useForm();
  const [financeBillImageFileList, setFinanceBillImageFileList] = useState<UploadFile[]>([]);
  const [financeBillPreviewImage, setFinanceBillPreviewImage] = useState<string | null>(null);
  const [financeBillPreviewVisible, setFinanceBillPreviewVisible] = useState(false);
  const [financeBillModalLoading, setFinanceBillModalLoading] = useState(false);

  // 采购单金额调整相关状态（用于牵牛花采购单号点击）
  const [purchaseAdjustmentModalVisible, setPurchaseAdjustmentModalVisible] = useState(false);
  const [purchaseAdjustmentForm] = Form.useForm();
  const [purchaseAdjustmentImageFileList, setPurchaseAdjustmentImageFileList] = useState<UploadFile[]>([]);
  const [purchaseAdjustmentModalLoading, setPurchaseAdjustmentModalLoading] = useState(false);

  // 非采购单流水记录相关状态
  const [nonPurchaseRecordModalVisible, setNonPurchaseRecordModalVisible] = useState(false);
  const [nonPurchaseRecordForm] = Form.useForm();
  const [nonPurchaseRecordImageFileList, setNonPurchaseRecordImageFileList] = useState<UploadFile[]>([]);
  const [nonPurchaseRecordPreviewImage, setNonPurchaseRecordPreviewImage] = useState<string | null>(null);
  const [nonPurchaseRecordPreviewVisible, setNonPurchaseRecordPreviewVisible] = useState(false);
  const [nonPurchaseRecordModalLoading, setNonPurchaseRecordModalLoading] = useState(false);

  // 选中行相关状态（改为点击整行选中，不再使用展开）
  const [selected对账单号, setSelected对账单号] = useState<string | null>(null);
  const [subRecords, setSubRecords] = useState<FinanceReconciliationDifference[]>([]);
  const [subLoading, setSubLoading] = useState<boolean>(false);
  const [subTotal, setSubTotal] = useState<number>(0);

  // 当前查询的数据（点击子维度数据后显示）
  const [selectedSubRecord, setSelectedSubRecord] = useState<FinanceReconciliationDifference | null>(null);

  // 左右框显示状态
  const [detailPanelsVisible, setDetailPanelsVisible] = useState<boolean>(false);

  // 左右框数据
  const [transactionRecordData, setTransactionRecordData] = useState<TransactionRecord[]>([]);
  const [transactionRecordLoading, setTransactionRecordLoading] = useState<boolean>(false);
  const [purchaseOrderInfoData, setPurchaseOrderInfoData] = useState<PurchaseOrderInfo[]>([]);
  const [purchaseOrderInfoLoading, setPurchaseOrderInfoLoading] = useState<boolean>(false);

  // 关联数据映射（用于判断是否绑定/调整，只存储是否存在，不存储完整数据）
  const [financeBillExistsMap, setFinanceBillExistsMap] = useState<Map<string, boolean>>(new Map()); // 交易账单号 -> 是否存在绑定记录
  const [purchaseAdjustmentExistsMap, setPurchaseAdjustmentExistsMap] = useState<Map<string, boolean>>(new Map()); // 采购单号 -> 是否存在调整记录

  // 详情弹窗状态
  const [financeBillDetailModalVisible, setFinanceBillDetailModalVisible] = useState<boolean>(false);
  const [financeBillDetailData, setFinanceBillDetailData] = useState<FinanceBill[]>([]);
  const [financeBillDetailLoading, setFinanceBillDetailLoading] = useState<boolean>(false);
  const [financeBillDetailTransactionNumber, setFinanceBillDetailTransactionNumber] = useState<string>('');
  const [purchaseAdjustmentDetailModalVisible, setPurchaseAdjustmentDetailModalVisible] = useState<boolean>(false);
  const [purchaseAdjustmentDetailData, setPurchaseAdjustmentDetailData] = useState<PurchaseAmountAdjustment[]>([]);
  const [purchaseAdjustmentDetailLoading, setPurchaseAdjustmentDetailLoading] = useState<boolean>(false);
  const [purchaseAdjustmentDetailPurchaseOrderNumber, setPurchaseAdjustmentDetailPurchaseOrderNumber] = useState<string>('');

  // 左右框高度（百分比，相对于下部分容器）
  const [detailPanelsHeight, setDetailPanelsHeight] = useState<number>(40);

  // 左右框宽度（百分比，左侧宽度，右侧自动计算）
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(50);

  // 标签页相关状态
  const [activeTab, setActiveTab] = useState<string>('对账单详细数据');
  const [visibleTabs, setVisibleTabs] = useState<Set<string>>(new Set(['对账单详细数据'])); // 可见的标签页
  const [splitViewTabs, setSplitViewTabs] = useState<Set<string>>(new Set()); // 开启分屏的标签页
  const [splitViewWidths, setSplitViewWidths] = useState<Record<string, number>>({}); // 每个分屏区域的宽度百分比

  // 三个查询结果的状态
  const [purchaseAdjustmentData, setPurchaseAdjustmentData] = useState<PurchaseAmountAdjustment[]>([]);
  const [purchaseAdjustmentQueryLoading, setPurchaseAdjustmentQueryLoading] = useState<boolean>(false);
  const [financeBillData, setFinanceBillData] = useState<FinanceBill[]>([]);
  const [financeBillQueryLoading, setFinanceBillQueryLoading] = useState<boolean>(false);
  const [nonPurchaseRecordData, setNonPurchaseRecordData] = useState<NonPurchaseBillRecord[]>([]);
  const [nonPurchaseRecordQueryLoading, setNonPurchaseRecordQueryLoading] = useState<boolean>(false);

  // 各标签页的独立搜索状态
  const [subDetailSearch交易单号, setSubDetailSearch交易单号] = useState('');
  const [subDetailSearch牵牛花采购单号, setSubDetailSearch牵牛花采购单号] = useState('');
  const [subDetailSearch采购单状态, setSubDetailSearch采购单状态] = useState('');
  const [subDetailSearch门店仓, setSubDetailSearch门店仓] = useState('');
  const [purchaseAdjustmentSearch采购单号, setPurchaseAdjustmentSearch采购单号] = useState('');
  const [financeBillSearch交易单号, setFinanceBillSearch交易单号] = useState('');
  const [financeBillSearch牵牛花采购单号, setFinanceBillSearch牵牛花采购单号] = useState('');
  const [nonPurchaseRecordSearch账单流水, setNonPurchaseRecordSearch账单流水] = useState('');

  // 选中行状态（用于高亮显示）
  const [selectedDetailRow, setSelectedDetailRow] = useState<string | null>(null);
  const [selectedPurchaseAdjustmentRow, setSelectedPurchaseAdjustmentRow] = useState<string | null>(null);
  const [selectedFinanceBillRow, setSelectedFinanceBillRow] = useState<string | null>(null);
  const [selectedNonPurchaseRecordRow, setSelectedNonPurchaseRecordRow] = useState<string | null>(null);

  // 上下分栏高度比例（默认上2/3，下1/3）
  const [topPanelHeight, setTopPanelHeight] = useState<number>(66.67); // 百分比

  // 表格滚动高度
  const [tableScrollY, setTableScrollY] = useState<number | undefined>(undefined);
  const [subTableScrollY, setSubTableScrollY] = useState<number | undefined>(undefined);
  const topTableContainerRef = useRef<HTMLDivElement>(null);
  const subTableContainerRef = useRef<HTMLDivElement>(null);
  const splitViewContainerRef = useRef<HTMLDivElement>(null);

  // 加载记录列表（对账单号维度）
  const loadRecords = async (
    page: number = currentPage,
    search?: string,
    对账单号?: string,
    记录状态?: string[],
    对账单收货状态?: string[],
    更新时间开始?: string,
    更新时间结束?: string,
    采购单号?: string,
    交易单号?: string,
  ) => {
    try {
      setLoading(true);
      // 构建请求参数，只包含有值的参数
      const params: any = {
        page,
        limit: pageSize,
      };
      if (search && search.trim()) {
        params.search = search.trim();
      }
      if (对账单号 && 对账单号.trim()) {
        params.对账单号 = 对账单号.trim();
      }
      if (记录状态 && 记录状态.length > 0) {
        params.记录状态 = 记录状态;
      }
      if (对账单收货状态 && 对账单收货状态.length > 0) {
        params.对账单收货状态 = 对账单收货状态;
      }
      if (更新时间开始) {
        params.更新时间开始 = 更新时间开始;
      }
      if (更新时间结束) {
        params.更新时间结束 = 更新时间结束;
      }
      if (采购单号 && 采购单号.trim()) {
        params.采购单号 = 采购单号.trim();
      }
      if (交易单号 && 交易单号.trim()) {
        params.交易单号 = 交易单号.trim();
      }
      const result = await financeReconciliationDifferenceApi.getByReconciliationNumber(params);
      setRecords(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载记录列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 设置 dayjs 中文 locale
  useEffect(() => {
    dayjs.locale('zh-cn');
  }, []);

  // 初始化加载
  useEffect(() => {
    const 更新时间开始 = search更新时间范围?.[0] ? search更新时间范围[0].format('YYYY-MM-DD 00:00:00') : undefined;
    const 更新时间结束 = search更新时间范围?.[1] ? search更新时间范围[1].format('YYYY-MM-DD 23:59:59') : undefined;
    loadRecords(
      currentPage,
      searchText?.trim() || undefined,
      search对账单号?.trim() || undefined,
      search记录状态.length > 0 ? search记录状态 : undefined,
      search对账单收货状态.length > 0 ? search对账单收货状态 : undefined,
      更新时间开始,
      更新时间结束,
      search采购单号?.trim() || undefined,
      search交易单号?.trim() || undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 计算上栏表格滚动高度
  useEffect(() => {
    const calculateScrollHeight = () => {
      if (topTableContainerRef.current) {
        const containerHeight = topTableContainerRef.current.clientHeight;
        // 减去分页器高度（约64px）和一些边距，确保分页器完全可见
        const scrollHeight = containerHeight - 72;
        // 确保至少有一个最小值，以便表头固定
        setTableScrollY(scrollHeight > 200 ? scrollHeight : 200);
      }
    };

    calculateScrollHeight();

    // 监听窗口大小变化
    window.addEventListener('resize', calculateScrollHeight);

    // 使用 ResizeObserver 监听容器大小变化
    let resizeObserver: ResizeObserver | null = null;
    if (topTableContainerRef.current) {
      resizeObserver = new ResizeObserver(calculateScrollHeight);
      resizeObserver.observe(topTableContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', calculateScrollHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [topPanelHeight]); // 当分栏高度变化时重新计算

  // 计算下栏表格滚动高度
  useEffect(() => {
    const calculateSubScrollHeight = () => {
      if (subTableContainerRef.current) {
        const containerHeight = subTableContainerRef.current.clientHeight;
        // 减去搜索区域和按钮区域的高度（约120px）
        const scrollHeight = containerHeight - 120;
        // 确保至少有一个最小值，以便表头固定
        setSubTableScrollY(scrollHeight > 150 ? scrollHeight : 150);
      }
    };

    calculateSubScrollHeight();

    // 监听窗口大小变化
    window.addEventListener('resize', calculateSubScrollHeight);

    // 使用 ResizeObserver 监听容器大小变化
    let resizeObserver: ResizeObserver | null = null;
    if (subTableContainerRef.current) {
      resizeObserver = new ResizeObserver(calculateSubScrollHeight);
      resizeObserver.observe(subTableContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', calculateSubScrollHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [topPanelHeight, selected对账单号]); // 当分栏高度变化或选中行变化时重新计算

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

  // 对账单收货状态选项
  const 对账单收货状态选项 = [
    '收货中',
    '全部完成',
  ];

  // 执行搜索（使用所有搜索条件）
  const handleSearchAll = () => {
    setCurrentPage(1);
    const 更新时间开始 = search更新时间范围?.[0] ? search更新时间范围[0].format('YYYY-MM-DD 00:00:00') : undefined;
    const 更新时间结束 = search更新时间范围?.[1] ? search更新时间范围[1].format('YYYY-MM-DD 23:59:59') : undefined;
    loadRecords(
      1,
      searchText?.trim() || undefined,
      search对账单号?.trim() || undefined,
      search记录状态.length > 0 ? search记录状态 : undefined,
      search对账单收货状态.length > 0 ? search对账单收货状态 : undefined,
      更新时间开始,
      更新时间结束,
      search采购单号?.trim() || undefined,
      search交易单号?.trim() || undefined,
    );
  };

  // 使用当前搜索条件刷新数据
  const refreshRecords = () => {
    const 更新时间开始 = search更新时间范围?.[0] ? search更新时间范围[0].format('YYYY-MM-DD 00:00:00') : undefined;
    const 更新时间结束 = search更新时间范围?.[1] ? search更新时间范围[1].format('YYYY-MM-DD 23:59:59') : undefined;
    loadRecords(
      currentPage,
      searchText?.trim() || undefined,
      search对账单号?.trim() || undefined,
      search记录状态.length > 0 ? search记录状态 : undefined,
      search对账单收货状态.length > 0 ? search对账单收货状态 : undefined,
      更新时间开始,
      更新时间结束,
      search采购单号?.trim() || undefined,
      search交易单号?.trim() || undefined,
    );
  };

  // 加载子维度数据
  const loadSubRecords = async (对账单号: string, 交易单号?: string, 牵牛花采购单号?: string, 采购单状态?: string, 门店仓?: string) => {
    if (!对账单号) return;

    try {
      setSubLoading(true);
      const result = await financeReconciliationDifferenceApi.getDetailsByReconciliationNumber(
        对账单号,
        {
          交易单号: 交易单号?.trim() || undefined,
          牵牛花采购单号: 牵牛花采购单号?.trim() || undefined,
          采购单状态: 采购单状态?.trim() || undefined,
          门店仓: 门店仓?.trim() || undefined,
        }
      );
      setSubRecords(result.data);
      setSubTotal(result.total);

      // 如果有子维度数据，加载默认的左右框数据（显示所有数据）
      if (result.data.length > 0) {
        // 显示左右框
        setDetailPanelsVisible(true);
        // 加载默认数据（所有交易单号和采购单号的数据）
        // 注意：这里result.data已经设置到subRecords，所以可以直接使用result.data
        const 交易单号列表 = [...new Set(result.data.map(r => r.交易单号).filter(Boolean))];
        const 采购单号列表 = [...new Set(result.data.map(r => r.牵牛花采购单号).filter(Boolean))];

        // 查询所有交易单号对应的数据
        try {
          setTransactionRecordLoading(true);
          const allTransactionResults: any[] = [];
          for (const 交易单号 of 交易单号列表) {
            try {
              const transactionResult = await transactionRecordApi.getByTransactionBillNumber(交易单号);
              if (transactionResult.data && transactionResult.data.length > 0) {
                allTransactionResults.push(...transactionResult.data);
              }
            } catch (error) {
              console.error(`查询交易单号 ${交易单号} 失败:`, error);
            }
          }
          // 去重（基于交易账单号）
          const uniqueTransactionData = Array.from(
            new Map(allTransactionResults.map(item => [item.交易账单号, item])).values()
          );
          setTransactionRecordData(uniqueTransactionData);
        } catch (error: any) {
          message.error(error.message || '查询交易单号信息失败');
          console.error(error);
          setTransactionRecordData([]);
        } finally {
          setTransactionRecordLoading(false);
        }

        // 查询所有采购单号对应的数据
        try {
          setPurchaseOrderInfoLoading(true);
          const allPurchaseResults: any[] = [];
          for (const 采购单号 of 采购单号列表) {
            try {
              const purchaseResult = await purchaseOrderInfoApi.getByPurchaseOrderNumber(采购单号);
              if (purchaseResult.data && purchaseResult.data.length > 0) {
                allPurchaseResults.push(...purchaseResult.data);
              }
            } catch (error) {
              console.error(`查询采购单号 ${采购单号} 失败:`, error);
            }
          }
          // 去重（基于采购单号）
          const uniquePurchaseData = Array.from(
            new Map(allPurchaseResults.map(item => [item.采购单号, item])).values()
          );
          setPurchaseOrderInfoData(uniquePurchaseData);
        } catch (error: any) {
          message.error(error.message || '查询采购单号信息失败');
          console.error(error);
          setPurchaseOrderInfoData([]);
        } finally {
          setPurchaseOrderInfoLoading(false);
        }

        // 同时查询所有账单手动绑定采购单数据，建立存在性映射
        const financeBillExistsMapTemp = new Map<string, boolean>();
        for (const 交易单号 of 交易单号列表) {
          try {
            const financeBillResult = await financeManagementApi.getAll({
              transactionNumber: 交易单号,
              limit: 1,
            });
            if (financeBillResult.data && financeBillResult.data.length > 0) {
              financeBillResult.data.forEach((bill: FinanceBill) => {
                const key = bill.transactionNumber;
                if (key) {
                  financeBillExistsMapTemp.set(key, true);
                }
              });
            }
          } catch (error) {
            console.error(`查询交易单号 ${交易单号} 的账单手动绑定采购单失败:`, error);
          }
        }
        setFinanceBillExistsMap(financeBillExistsMapTemp);

        // 同时查询所有采购单金额调整数据，建立存在性映射
        const purchaseAdjustmentExistsMapTemp = new Map<string, boolean>();
        for (const 采购单号 of 采购单号列表) {
          try {
            const adjustmentResult = await purchaseAmountAdjustmentApi.getAll({
              purchaseOrderNumber: 采购单号,
              limit: 1,
            });
            if (adjustmentResult.data && adjustmentResult.data.length > 0) {
              purchaseAdjustmentExistsMapTemp.set(采购单号, true);
            }
          } catch (error) {
            console.error(`查询采购单号 ${采购单号} 的采购单金额调整失败:`, error);
          }
        }
        setPurchaseAdjustmentExistsMap(purchaseAdjustmentExistsMapTemp);
      } else {
        // 没有子维度数据，隐藏左右框
        setDetailPanelsVisible(false);
        setTransactionRecordData([]);
        setPurchaseOrderInfoData([]);
      }
    } catch (error: any) {
      message.error(error.message || '加载子维度数据失败');
      console.error(error);
    } finally {
      setSubLoading(false);
    }
  };

  // 对账单详细数据搜索
  const handleDetailSearch = () => {
    if (!selected对账单号) return;
    loadSubRecords(
      selected对账单号,
      subDetailSearch交易单号,
      subDetailSearch牵牛花采购单号,
      subDetailSearch采购单状态,
      subDetailSearch门店仓
    );
  };

  // 对账单详细数据重置
  const handleDetailReset = () => {
    setSubDetailSearch交易单号('');
    setSubDetailSearch牵牛花采购单号('');
    setSubDetailSearch采购单状态('');
    setSubDetailSearch门店仓('');
    if (selected对账单号) {
      loadSubRecords(selected对账单号);
    }
  };

  // 加载默认的交易单号和采购单号信息（所有数据）
  const loadDefaultTransactionAndPurchaseData = async () => {
    if (!selected对账单号) {
      return;
    }

    // 如果subRecords为空，直接返回，不加载数据
    if (subRecords.length === 0) {
      console.log('[loadDefaultTransactionAndPurchaseData] subRecords为空，跳过加载');
      return;
    }

    // 收集所有唯一的交易单号和采购单号
    const 交易单号列表 = [...new Set(subRecords.map(r => r.交易单号).filter(Boolean))];
    const 采购单号列表 = [...new Set(subRecords.map(r => r.牵牛花采购单号).filter(Boolean))];

    // 查询所有交易单号对应的数据
    try {
      setTransactionRecordLoading(true);
      const allTransactionResults: any[] = [];
      for (const 交易单号 of 交易单号列表) {
        try {
          const result = await transactionRecordApi.getByTransactionBillNumber(交易单号);
          if (result.data && result.data.length > 0) {
            allTransactionResults.push(...result.data);
          }
        } catch (error) {
          console.error(`查询交易单号 ${交易单号} 失败:`, error);
        }
      }
      // 去重（基于交易账单号）
      const uniqueTransactionData = Array.from(
        new Map(allTransactionResults.map(item => [item.交易账单号, item])).values()
      );
      setTransactionRecordData(uniqueTransactionData);
    } catch (error: any) {
      message.error(error.message || '查询交易单号信息失败');
      console.error(error);
      setTransactionRecordData([]);
    } finally {
      setTransactionRecordLoading(false);
    }

    // 查询所有采购单号对应的数据
    try {
      setPurchaseOrderInfoLoading(true);
      const allPurchaseResults: any[] = [];
      for (const 采购单号 of 采购单号列表) {
        try {
          const result = await purchaseOrderInfoApi.getByPurchaseOrderNumber(采购单号);
          if (result.data && result.data.length > 0) {
            allPurchaseResults.push(...result.data);
          }
        } catch (error) {
          console.error(`查询采购单号 ${采购单号} 失败:`, error);
        }
      }
      // 去重（基于采购单号）
      const uniquePurchaseData = Array.from(
        new Map(allPurchaseResults.map(item => [item.采购单号, item])).values()
      );
      setPurchaseOrderInfoData(uniquePurchaseData);
    } catch (error: any) {
      message.error(error.message || '查询采购单号信息失败');
      console.error(error);
      setPurchaseOrderInfoData([]);
    } finally {
      setPurchaseOrderInfoLoading(false);
    }

    // 同时查询所有账单手动绑定采购单数据，建立存在性映射（只判断是否存在，不存储完整数据）
    // 注意：financeBillExistsMap的key是交易账单号（即TransactionRecord中的交易账单号字段）
    const financeBillExistsMapTemp = new Map<string, boolean>();
    for (const 交易单号 of 交易单号列表) {
      try {
        const result = await financeManagementApi.getAll({
          transactionNumber: 交易单号,
          limit: 1, // 只需要判断是否存在，所以limit=1即可
        });
        if (result.data && result.data.length > 0) {
          // 将查询结果按交易账单号（即transactionNumber）标记为存在
          result.data.forEach((bill: FinanceBill) => {
            const key = bill.transactionNumber;
            if (key) {
              financeBillExistsMapTemp.set(key, true);
            }
          });
        }
      } catch (error) {
        console.error(`查询交易单号 ${交易单号} 的账单手动绑定采购单失败:`, error);
      }
    }
    setFinanceBillExistsMap(financeBillExistsMapTemp);

    // 同时查询所有采购单金额调整数据，建立存在性映射（只判断是否存在，不存储完整数据）
    const purchaseAdjustmentExistsMapTemp = new Map<string, boolean>();
    for (const 采购单号 of 采购单号列表) {
      try {
        const result = await purchaseAmountAdjustmentApi.getAll({
          purchaseOrderNumber: 采购单号,
          limit: 1, // 只需要判断是否存在，所以limit=1即可
        });
        if (result.data && result.data.length > 0) {
          purchaseAdjustmentExistsMapTemp.set(采购单号, true);
        }
      } catch (error) {
        console.error(`查询采购单号 ${采购单号} 的采购单金额调整失败:`, error);
      }
    }
    setPurchaseAdjustmentExistsMap(purchaseAdjustmentExistsMapTemp);
  };

  // 处理行点击（选中对账单号）
  const handleRowClick = async (record: FinanceReconciliationDifference) => {
    const 对账单号 = record.对账单号;
    if (!对账单号) return;

    // 如果点击的是已选中的行，则取消选中
    if (selected对账单号 === 对账单号) {
      setSelected对账单号(null);
      setSubRecords([]);
      setSubTotal(0);
      setSelectedSubRecord(null);
      setDetailPanelsVisible(false);
      setTransactionRecordData([]);
      setPurchaseOrderInfoData([]);
    } else {
      // 选中新行
      setSelected对账单号(对账单号);
      // 清空选中状态（但保留左右框显示，会显示默认数据）
      setSelectedSubRecord(null);
      // 加载子维度数据（会自动加载默认的左右框数据）
      await loadSubRecords(对账单号);
    }
  };

  // 处理子维度数据点击
  const handleSubRecordClick = async (record: FinanceReconciliationDifference) => {
    setSelectedSubRecord(record);
    setDetailPanelsVisible(true);

    // 查询交易单号信息（具体记录）
    if (record.交易单号) {
      try {
        setTransactionRecordLoading(true);
        const result = await transactionRecordApi.getByTransactionBillNumber(record.交易单号);
        setTransactionRecordData(result.data || []);

        // 更新该交易单号的账单手动绑定采购单存在性标记
        try {
          const financeBillResult = await financeManagementApi.getAll({
            transactionNumber: record.交易单号,
            limit: 1, // 只需要判断是否存在
          });
          const newMap = new Map(financeBillExistsMap);
          if (financeBillResult.data && financeBillResult.data.length > 0) {
            financeBillResult.data.forEach((bill: FinanceBill) => {
              const key = bill.transactionNumber;
              if (key) {
                newMap.set(key, true);
              }
            });
          }
          setFinanceBillExistsMap(newMap);
        } catch (error) {
          console.error(`查询交易单号 ${record.交易单号} 的账单手动绑定采购单失败:`, error);
        }
      } catch (error: any) {
        message.error(error.message || '查询交易单号信息失败');
        console.error(error);
        setTransactionRecordData([]);
      } finally {
        setTransactionRecordLoading(false);
      }
    } else {
      setTransactionRecordData([]);
    }

    // 查询采购单号信息（具体记录）
    if (record.牵牛花采购单号) {
      try {
        setPurchaseOrderInfoLoading(true);
        const result = await purchaseOrderInfoApi.getByPurchaseOrderNumber(record.牵牛花采购单号);
        setPurchaseOrderInfoData(result.data || []);

        // 更新该采购单号的采购单金额调整存在性标记
        try {
          const adjustmentResult = await purchaseAmountAdjustmentApi.getAll({
            purchaseOrderNumber: record.牵牛花采购单号,
            limit: 1, // 只需要判断是否存在
          });
          const newMap = new Map(purchaseAdjustmentExistsMap);
          if (adjustmentResult.data && adjustmentResult.data.length > 0) {
            newMap.set(record.牵牛花采购单号, true);
          }
          setPurchaseAdjustmentExistsMap(newMap);
        } catch (error) {
          console.error(`查询采购单号 ${record.牵牛花采购单号} 的采购单金额调整失败:`, error);
        }
      } catch (error: any) {
        message.error(error.message || '查询采购单号信息失败');
        console.error(error);
        setPurchaseOrderInfoData([]);
      } finally {
        setPurchaseOrderInfoLoading(false);
      }
    } else {
      setPurchaseOrderInfoData([]);
    }
  };

  // 处理交易单号信息中的"是否手动绑定"点击
  // 复用financeManagementApi.getAll接口，传入transactionNumber参数查询详情
  const handleTransactionRecordIsBoundClick = async (交易账单号: string) => {
    if (!交易账单号) return;

    try {
      setFinanceBillDetailLoading(true);
      setFinanceBillDetailTransactionNumber(交易账单号);
      setFinanceBillDetailModalVisible(true);

      // 直接调用API查询完整数据（包括图片等）
      const result = await financeManagementApi.getAll({
        transactionNumber: 交易账单号,
        limit: 1000, // 获取所有相关记录
      });

      setFinanceBillDetailData(result.data || []);

      if (!result.data || result.data.length === 0) {
        message.info('该交易单号无账单手动绑定采购单关联数据');
      }
    } catch (error: any) {
      message.error(error.message || '查询账单手动绑定采购单详情失败');
      console.error(error);
      setFinanceBillDetailData([]);
    } finally {
      setFinanceBillDetailLoading(false);
    }
  };

  // 处理采购单号信息中的"是否调整金额"点击
  // 复用purchaseAmountAdjustmentApi.getAll接口，传入purchaseOrderNumber参数查询详情
  const handlePurchaseOrderIsAdjustedClick = async (采购单号: string) => {
    if (!采购单号) return;

    try {
      setPurchaseAdjustmentDetailLoading(true);
      setPurchaseAdjustmentDetailPurchaseOrderNumber(采购单号);
      setPurchaseAdjustmentDetailModalVisible(true);

      // 直接调用API查询完整数据（包括图片等）
      const result = await purchaseAmountAdjustmentApi.getAll({
        purchaseOrderNumber: 采购单号,
        limit: 1000, // 获取所有相关记录
      });

      setPurchaseAdjustmentDetailData(result.data || []);

      if (!result.data || result.data.length === 0) {
        message.info('该采购单号无采购单金额调整关联数据');
      }
    } catch (error: any) {
      message.error(error.message || '查询采购单金额调整详情失败');
      console.error(error);
      setPurchaseAdjustmentDetailData([]);
    } finally {
      setPurchaseAdjustmentDetailLoading(false);
    }
  };

  // 处理左右框关闭
  const handleCloseDetailPanels = async () => {
    setSelectedSubRecord(null);
    // 恢复到默认数据（所有交易单号和采购单号的数据）
    await loadDefaultTransactionAndPurchaseData();
    // 保持左右框显示，但数据已恢复到默认状态
  };

  // 计算对账单详细信息的合计值
  const subRecordsSummary = useMemo(() => {
    const total采购单金额 = subRecords.reduce((sum, record) => {
      const amount = typeof record.采购单金额 === 'number' ? record.采购单金额 : (typeof record.采购单金额 === 'string' ? parseFloat(record.采购单金额) : 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    const total采购单调整金额 = subRecords.reduce((sum, record) => {
      const amount = typeof record.采购单调整金额 === 'number' ? record.采购单调整金额 : (typeof record.采购单调整金额 === 'string' ? parseFloat(record.采购单调整金额) : 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    const total调整后采购单金额 = subRecords.reduce((sum, record) => {
      const amount = typeof record.调整后采购单金额 === 'number' ? record.调整后采购单金额 : (typeof record.调整后采购单金额 === 'string' ? parseFloat(record.调整后采购单金额) : 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    return { total采购单金额, total采购单调整金额, total调整后采购单金额 };
  }, [subRecords]);

  // 计算采购单详细信息的合计值
  const purchaseOrderInfoSummary = useMemo(() => {
    const total采购金额 = purchaseOrderInfoData.reduce((sum, record) => {
      const amount = typeof record.采购金额 === 'number' ? record.采购金额 : (typeof record.采购金额 === 'string' ? parseFloat(record.采购金额) : 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    const total实收金额 = purchaseOrderInfoData.reduce((sum, record) => {
      const amount = typeof record.实收金额 === 'number' ? record.实收金额 : (typeof record.实收金额 === 'string' ? parseFloat(record.实收金额) : 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    return { total采购金额, total实收金额 };
  }, [purchaseOrderInfoData]);

  // 查询采购单金额调整
  const loadPurchaseAdjustmentData = async (search采购单号?: string) => {
    if (!selected对账单号 || subRecords.length === 0) {
      message.warning('请先选择对账单号并加载子维度数据');
      return;
    }

    try {
      setPurchaseAdjustmentQueryLoading(true);

      // 添加标签到可见列表
      const newVisibleTabs = new Set(visibleTabs);
      newVisibleTabs.add('采购单金额调整');
      setVisibleTabs(newVisibleTabs);
      setActiveTab('采购单金额调整');

      // 从子维度数据中提取所有唯一的牵牛花采购单号
      const 牵牛花采购单号列表 = [...new Set(
        subRecords
          .map(r => r.牵牛花采购单号)
          .filter((v): v is string => !!v && v.trim() !== '')
      )];

      if (牵牛花采购单号列表.length === 0) {
        setPurchaseAdjustmentData([]);
        if (!search采购单号) {
          message.info('该对账单号无采购单金额调整关联数据');
        }
        return;
      }

      // 查询所有相关的采购单金额调整记录
      const allResults: PurchaseAmountAdjustment[] = [];
      for (const 采购单号 of 牵牛花采购单号列表) {
        try {
          const result = await purchaseAmountAdjustmentApi.getAll({
            purchaseOrderNumber: 采购单号,
            limit: 1000, // 获取所有记录
          });
          if (result.data && result.data.length > 0) {
            allResults.push(...result.data);
          }
        } catch (error) {
          console.error(`查询采购单号 ${采购单号} 的调整记录失败:`, error);
        }
      }

      // 如果有搜索条件，在结果中进行精确过滤
      let filteredResults = allResults;
      if (search采购单号 && search采购单号.trim()) {
        const searchTerm = search采购单号.trim();
        filteredResults = filteredResults.filter(item =>
          item.purchaseOrderNumber && item.purchaseOrderNumber === searchTerm
        );
      }

      if (filteredResults.length === 0) {
        setPurchaseAdjustmentData([]);
        if (!search采购单号) {
          message.info('该对账单号无采购单金额调整关联数据');
        }
      } else {
        setPurchaseAdjustmentData(filteredResults);
      }
    } catch (error: any) {
      message.error(error.message || '查询采购单金额调整失败');
      console.error(error);
    } finally {
      setPurchaseAdjustmentQueryLoading(false);
    }
  };

  // 查询账单手动绑定采购单
  const loadFinanceBillData = async (search交易单号?: string, search牵牛花采购单号?: string) => {
    if (!selected对账单号 || subRecords.length === 0) {
      message.warning('请先选择对账单号并加载子维度数据');
      return;
    }

    try {
      setFinanceBillQueryLoading(true);

      // 添加标签到可见列表
      const newVisibleTabs = new Set(visibleTabs);
      newVisibleTabs.add('账单手动绑定采购单');
      setVisibleTabs(newVisibleTabs);
      setActiveTab('账单手动绑定采购单');

      // 从子维度数据中提取所有唯一的牵牛花采购单号和交易单号
      const 牵牛花采购单号列表 = [...new Set(
        subRecords
          .map(r => r.牵牛花采购单号)
          .filter((v): v is string => !!v && v.trim() !== '')
      )];
      const 交易单号列表 = [...new Set(
        subRecords
          .map(r => r.交易单号)
          .filter((v): v is string => !!v && v.trim() !== '')
      )];

      if (牵牛花采购单号列表.length === 0 && 交易单号列表.length === 0) {
        setFinanceBillData([]);
        if (!search交易单号 && !search牵牛花采购单号) {
          message.info('该对账单号无账单手动绑定采购单关联数据');
        }
        return;
      }

      // 查询所有相关的账单手动绑定采购单记录
      const allResults: FinanceBill[] = [];
      const seenKeys = new Set<string>();

      // 根据牵牛花采购单号查询
      for (const 采购单号 of 牵牛花采购单号列表) {
        try {
          const result = await financeManagementApi.getAll({
            qianniuhuaPurchaseNumber: 采购单号,
            limit: 1000,
          });
          if (result.data && result.data.length > 0) {
            result.data.forEach(item => {
              const key = `${item.transactionNumber}_${item.qianniuhuaPurchaseNumber || ''}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allResults.push(item);
              }
            });
          }
        } catch (error) {
          console.error(`查询采购单号 ${采购单号} 的账单记录失败:`, error);
        }
      }

      // 根据交易单号查询
      for (const 交易单号 of 交易单号列表) {
        try {
          const result = await financeManagementApi.getAll({
            transactionNumber: 交易单号,
            limit: 1000,
          });
          if (result.data && result.data.length > 0) {
            result.data.forEach(item => {
              const key = `${item.transactionNumber}_${item.qianniuhuaPurchaseNumber || ''}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allResults.push(item);
              }
            });
          }
        } catch (error) {
          console.error(`查询交易单号 ${交易单号} 的账单记录失败:`, error);
        }
      }

      // 如果有搜索条件，在结果中进行精确过滤
      let filteredResults = allResults;
      if (search交易单号 && search交易单号.trim()) {
        const searchTerm = search交易单号.trim();
        filteredResults = filteredResults.filter(item =>
          item.transactionNumber && item.transactionNumber === searchTerm
        );
      }
      if (search牵牛花采购单号 && search牵牛花采购单号.trim()) {
        const searchTerm = search牵牛花采购单号.trim();
        filteredResults = filteredResults.filter(item =>
          item.qianniuhuaPurchaseNumber && item.qianniuhuaPurchaseNumber === searchTerm
        );
      }

      if (filteredResults.length === 0) {
        setFinanceBillData([]);
        if (!search交易单号 && !search牵牛花采购单号) {
          message.info('该对账单号无账单手动绑定采购单关联数据');
        }
      } else {
        setFinanceBillData(filteredResults);
      }
    } catch (error: any) {
      message.error(error.message || '查询账单手动绑定采购单失败');
      console.error(error);
    } finally {
      setFinanceBillQueryLoading(false);
    }
  };

  // 查询非采购单流水记录
  const loadNonPurchaseRecordData = async (search账单流水?: string) => {
    if (!selected对账单号 || subRecords.length === 0) {
      message.warning('请先选择对账单号并加载子维度数据');
      return;
    }

    try {
      setNonPurchaseRecordQueryLoading(true);

      // 添加标签到可见列表
      const newVisibleTabs = new Set(visibleTabs);
      newVisibleTabs.add('非采购单流水记录');
      setVisibleTabs(newVisibleTabs);
      setActiveTab('非采购单流水记录');

      // 从子维度数据中提取所有唯一的交易单号
      let 交易单号列表 = [...new Set(
        subRecords
          .map(r => r.交易单号)
          .filter((v): v is string => !!v && v.trim() !== '')
      )];

      if (交易单号列表.length === 0) {
        setNonPurchaseRecordData([]);
        if (!search账单流水) {
          message.info('该对账单号无非采购单流水记录关联数据');
        }
        return;
      }

      // 查询所有相关的非采购单流水记录
      // 注意：非采购单流水记录的API参数是账单流水，而交易单号应该对应账单流水
      const allResults: NonPurchaseBillRecord[] = [];
      for (const 交易单号 of 交易单号列表) {
        try {
          // 使用交易单号作为账单流水进行查询
          const result = await nonPurchaseBillRecordApi.getAll({
            账单流水: 交易单号,
            limit: 1000,
          });
          if (result.data && result.data.length > 0) {
            allResults.push(...result.data);
          }
        } catch (error) {
          console.error(`查询交易单号 ${交易单号} 的流水记录失败:`, error);
        }
      }

      // 如果有搜索条件，在结果中进行精确过滤
      let filteredResults = allResults;
      if (search账单流水 && search账单流水.trim()) {
        const searchTerm = search账单流水.trim();
        filteredResults = filteredResults.filter(item =>
          item.账单流水 && item.账单流水 === searchTerm
        );
      }

      if (filteredResults.length === 0) {
        setNonPurchaseRecordData([]);
        if (!search账单流水) {
          message.info('该对账单号无非采购单流水记录关联数据');
        }
      } else {
        setNonPurchaseRecordData(filteredResults);
      }
    } catch (error: any) {
      message.error(error.message || '查询非采购单流水记录失败');
      console.error(error);
    } finally {
      setNonPurchaseRecordQueryLoading(false);
    }
  };

  // 关闭标签
  const handleCloseTab = (tabKey: string) => {
    if (tabKey === '对账单详细数据') return; // 不能关闭默认标签

    const newVisibleTabs = new Set(visibleTabs);
    newVisibleTabs.delete(tabKey);
    setVisibleTabs(newVisibleTabs);

    // 如果关闭的是当前激活的标签，切换到对账单详细数据
    if (activeTab === tabKey) {
      setActiveTab('对账单详细数据');
    }

    // 如果该标签在分屏中，也移除并重新分配宽度
    if (splitViewTabs.has(tabKey)) {
      const newSplitViewTabs = new Set(splitViewTabs);
      newSplitViewTabs.delete(tabKey);
      setSplitViewTabs(newSplitViewTabs);

      // 重新分配剩余分屏的宽度
      const newWidths = { ...splitViewWidths };
      delete newWidths[tabKey];
      if (newSplitViewTabs.size > 0) {
        const remainingWidth = 50 / newSplitViewTabs.size;
        Array.from(newSplitViewTabs).forEach(key => {
          newWidths[key] = remainingWidth;
        });
      }
      setSplitViewWidths(newWidths);
    }
  };

  // 切换分屏
  const handleToggleSplitView = (tabKey: string) => {
    const newSplitViewTabs = new Set(splitViewTabs);
    const newWidths = { ...splitViewWidths };

    if (newSplitViewTabs.has(tabKey)) {
      // 取消分屏
      newSplitViewTabs.delete(tabKey);
      delete newWidths[tabKey];
      // 重新分配剩余分屏的宽度
      if (newSplitViewTabs.size > 0) {
        const remainingWidth = 50 / newSplitViewTabs.size;
        Array.from(newSplitViewTabs).forEach(key => {
          newWidths[key] = remainingWidth;
        });
      }
    } else {
      // 开启分屏
      newSplitViewTabs.add(tabKey);
      // 计算初始宽度：如果有n个分屏，每个占 50/n%，左侧对账单详细数据占50%
      const splitCount = newSplitViewTabs.size;
      const splitWidth = splitCount > 0 ? 50 / splitCount : 0;
      Array.from(newSplitViewTabs).forEach(key => {
        newWidths[key] = splitWidth;
      });
    }
    setSplitViewTabs(newSplitViewTabs);
    setSplitViewWidths(newWidths);
  };

  // 调整分屏宽度
  // separatorIndex: 0表示左侧和第一个分屏标签之间，1表示第一个和第二个之间，以此类推
  const handleResizeSplitView = (separatorIndex: number, deltaX: number, containerWidth: number) => {
    const deltaPercent = (deltaX / containerWidth) * 100;
    const splitTabsArray = Array.from(splitViewTabs);

    if (separatorIndex === 0) {
      // 调整左侧对账单详细数据和第一个分屏标签之间的宽度
      // 确保左侧宽度在20%-80%之间
      const firstTab = splitTabsArray[0];
      if (!firstTab) return;
      const currentLeftWidth = 100 - Object.values(splitViewWidths).reduce((sum, w) => sum + w, 0);
      const currentTabWidth = splitViewWidths[firstTab] || (50 / splitViewTabs.size);

      // 调整后左侧宽度
      const newLeftWidth = Math.max(20, Math.min(80, currentLeftWidth - deltaPercent));
      // 第一个分屏标签的新宽度（其他分屏标签宽度不变）
      const otherTabsWidth = Object.entries(splitViewWidths)
        .filter(([key]) => key !== firstTab)
        .reduce((sum, [, w]) => sum + w, 0);
      const newTabWidth = 100 - newLeftWidth - otherTabsWidth;

      if (newTabWidth >= 10) {
        setSplitViewWidths(prev => ({
          ...prev,
          [firstTab]: newTabWidth,
        }));
      }
    } else {
      // 调整两个分屏标签之间的宽度
      const prevTab = splitTabsArray[separatorIndex - 1];
      const currentTab = splitTabsArray[separatorIndex];
      if (!prevTab || !currentTab) return;

      const prevWidth = splitViewWidths[prevTab] || (50 / splitViewTabs.size);
      const currentWidth = splitViewWidths[currentTab] || (50 / splitViewTabs.size);

      const newPrevWidth = Math.max(10, Math.min(80, prevWidth - deltaPercent));
      const newCurrentWidth = Math.max(10, Math.min(80, currentWidth + deltaPercent));

      // 检查调整后左侧宽度是否还在合理范围内
      const otherTabsWidth = Object.entries(splitViewWidths)
        .filter(([key]) => key !== prevTab && key !== currentTab)
        .reduce((sum, [, w]) => sum + w, 0);
      const leftWidth = 100 - otherTabsWidth - newPrevWidth - newCurrentWidth;

      if (leftWidth >= 20 && leftWidth <= 80) {
        setSplitViewWidths(prev => ({
          ...prev,
          [prevTab]: newPrevWidth,
          [currentTab]: newCurrentWidth,
        }));
      }
    }
  };

  // 根据采购单金额调整数据定位到对账单详细数据
  const handlePurchaseAdjustmentRowClick = (record: PurchaseAmountAdjustment) => {
    setSelectedPurchaseAdjustmentRow(record.purchaseOrderNumber);
    // 只有在分屏模式下才定位到对账单详细数据
    if (splitViewTabs.has('采购单金额调整')) {
      const matchedRecord = subRecords.find(r => r.牵牛花采购单号 === record.purchaseOrderNumber);
      if (matchedRecord) {
        const rowKey = `${matchedRecord.交易单号}_${matchedRecord.牵牛花采购单号}`;
        setSelectedDetailRow(rowKey);
      }
    }
  };

  // 根据账单手动绑定采购单数据定位到对账单详细数据
  const handleFinanceBillRowClick = (record: FinanceBill) => {
    const rowKey = `${record.transactionNumber}_${record.qianniuhuaPurchaseNumber || ''}`;
    setSelectedFinanceBillRow(rowKey);
    // 只有在分屏模式下才定位到对账单详细数据
    if (splitViewTabs.has('账单手动绑定采购单')) {
      // 必须同时匹配交易单号和牵牛花采购单号
      const matchedRecord = subRecords.find(r =>
        r.交易单号 === record.transactionNumber && r.牵牛花采购单号 === record.qianniuhuaPurchaseNumber
      );
      if (matchedRecord) {
        const detailRowKey = `${matchedRecord.交易单号}_${matchedRecord.牵牛花采购单号}`;
        setSelectedDetailRow(detailRowKey);
      }
    }
  };

  // 根据非采购单流水记录定位到对账单详细数据
  const handleNonPurchaseRecordRowClick = (record: NonPurchaseBillRecord) => {
    setSelectedNonPurchaseRecordRow(record.账单流水);
    // 只有在分屏模式下才定位到对账单详细数据
    if (splitViewTabs.has('非采购单流水记录')) {
      const matchedRecord = subRecords.find(r => r.交易单号 === record.账单流水);
      if (matchedRecord) {
        const rowKey = `${matchedRecord.交易单号}_${matchedRecord.牵牛花采购单号}`;
        setSelectedDetailRow(rowKey);
      }
    }
  };

  // 格式化金额
  const formatAmount = (amount: number | null | undefined | string): string => {
    if (amount === null || amount === undefined || amount === '') return '-';
    // 确保是数字类型
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '-';
    return numAmount.toFixed(2);
  };

  // 渲染标签内容（用于普通标签和分屏标签）
  const renderTabContent = (tabKey: string, isSplitView: boolean = false) => {
    if (tabKey === '采购单金额调整') {
      return (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '8px' }}>
          {/* 搜索区域 */}
          <div style={{ marginBottom: 8 }}>
            <Space wrap>
              <Input
                placeholder="采购单号(牵牛花)"
                allowClear
                size="small"
                style={{ width: isSplitView ? 160 : 180 }}
                value={purchaseAdjustmentSearch采购单号}
                onChange={(e) => setPurchaseAdjustmentSearch采购单号(e.target.value)}
                onPressEnter={() => loadPurchaseAdjustmentData(purchaseAdjustmentSearch采购单号)}
              />
              <Button size="small" type="primary" icon={<SearchOutlined />} onClick={() => loadPurchaseAdjustmentData(purchaseAdjustmentSearch采购单号)}>搜索</Button>
              <Button size="small" onClick={() => {
                setPurchaseAdjustmentSearch采购单号('');
                loadPurchaseAdjustmentData();
              }}>重置</Button>
            </Space>
          </div>
          {purchaseAdjustmentData.length === 0 && !purchaseAdjustmentQueryLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', fontSize: 14 }}>
              该对账单号无采购单金额调整关联数据
            </div>
          ) : (
            <ResponsiveTable<PurchaseAmountAdjustment>
              tableId={`purchase-adjustment-data-${isSplitView ? 'split' : 'normal'}`}
              columns={[
                {
                  title: '采购单号(牵牛花)',
                  dataIndex: 'purchaseOrderNumber',
                  key: 'purchaseOrderNumber',
                  width: 200,
                  render: (text: string) => text || '-',
                },
                {
                  title: '调整金额',
                  dataIndex: 'adjustmentAmount',
                  key: 'adjustmentAmount',
                  width: 120,
                  align: 'right' as const,
                  render: (text: number) => formatAmount(text),
                },
                {
                  title: '异常调整原因备注',
                  dataIndex: 'adjustmentReason',
                  key: 'adjustmentReason',
                  width: 200,
                  render: (text: string) => text || '-',
                },
                {
                  title: '财务审核意见备注',
                  dataIndex: 'financeReviewRemark',
                  key: 'financeReviewRemark',
                  width: 200,
                  render: (text: string) => text || '-',
                },
                {
                  title: '财务审核状态',
                  dataIndex: 'financeReviewStatus',
                  key: 'financeReviewStatus',
                  width: 120,
                  render: (text: string) => {
                    const statusMap: Record<string, string> = {
                      '0': '待审核',
                      '1': '已审核',
                    };
                    return statusMap[text || ''] || text || '-';
                  },
                },
                {
                  title: '创建人',
                  dataIndex: 'creator',
                  key: 'creator',
                  width: 100,
                  render: (text: string) => text || '-',
                },
                {
                  title: '财务审核人',
                  dataIndex: 'financeReviewer',
                  key: 'financeReviewer',
                  width: 100,
                  render: (text: string) => text || '-',
                },
                {
                  title: '数据更新时间',
                  dataIndex: 'dataUpdateTime',
                  key: 'dataUpdateTime',
                  width: 180,
                  render: (text: string) => formatDateTime(text),
                },
              ]}
              dataSource={purchaseAdjustmentData}
              rowKey={(record) => record.purchaseOrderNumber}
              loading={purchaseAdjustmentQueryLoading}
              isMobile={false}
              scroll={{ x: isSplitView ? 600 : 1200, y: subTableScrollY || 150 }}
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => handlePurchaseAdjustmentRowClick(record),
                style: {
                  cursor: 'pointer',
                  backgroundColor: selectedPurchaseAdjustmentRow === record.purchaseOrderNumber ? '#e6f7ff' : undefined,
                },
              })}
            />
          )}
        </div>
      );
    }

    if (tabKey === '账单手动绑定采购单') {
      return (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '8px' }}>
          {/* 搜索区域 */}
          <div style={{ marginBottom: 8 }}>
            <Space wrap>
              <Input
                placeholder="交易单号"
                allowClear
                size="small"
                style={{ width: isSplitView ? 140 : 140 }}
                value={financeBillSearch交易单号}
                onChange={(e) => setFinanceBillSearch交易单号(e.target.value)}
                onPressEnter={() => loadFinanceBillData(financeBillSearch交易单号, financeBillSearch牵牛花采购单号)}
              />
              <Input
                placeholder="牵牛花采购单号"
                allowClear
                size="small"
                style={{ width: isSplitView ? 140 : 140 }}
                value={financeBillSearch牵牛花采购单号}
                onChange={(e) => setFinanceBillSearch牵牛花采购单号(e.target.value)}
                onPressEnter={() => loadFinanceBillData(financeBillSearch交易单号, financeBillSearch牵牛花采购单号)}
              />
              <Button size="small" type="primary" icon={<SearchOutlined />} onClick={() => loadFinanceBillData(financeBillSearch交易单号, financeBillSearch牵牛花采购单号)}>搜索</Button>
              <Button size="small" onClick={() => {
                setFinanceBillSearch交易单号('');
                setFinanceBillSearch牵牛花采购单号('');
                loadFinanceBillData();
              }}>重置</Button>
            </Space>
          </div>
          {financeBillData.length === 0 && !financeBillQueryLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', fontSize: 14 }}>
              该对账单号无账单手动绑定采购单关联数据
            </div>
          ) : (
            <ResponsiveTable<FinanceBill>
              tableId={`finance-bill-data-${isSplitView ? 'split' : 'normal'}`}
              columns={[
                {
                  title: '交易单号',
                  dataIndex: 'transactionNumber',
                  key: 'transactionNumber',
                  width: 200,
                  render: (text: string) => text || '-',
                },
                {
                  title: '牵牛花采购单号',
                  dataIndex: 'qianniuhuaPurchaseNumber',
                  key: 'qianniuhuaPurchaseNumber',
                  width: 200,
                  render: (text: string) => text || '-',
                },
                {
                  title: '导入异常备注',
                  dataIndex: 'importExceptionRemark',
                  key: 'importExceptionRemark',
                  width: 250,
                  render: (text: string) => text || '-',
                },
                {
                  title: '修改人',
                  dataIndex: 'modifier',
                  key: 'modifier',
                  width: 100,
                  render: (text: string) => text || '-',
                },
                {
                  title: '修改时间',
                  dataIndex: 'modifyTime',
                  key: 'modifyTime',
                  width: 180,
                  render: (text: string) => formatDateTime(text),
                },
                {
                  title: '是否有图片',
                  dataIndex: 'hasImage',
                  key: 'hasImage',
                  width: 100,
                  render: (hasImage: number) => hasImage === 1 ? '是' : '否',
                },
              ]}
              dataSource={financeBillData}
              rowKey={(record) => `${record.transactionNumber}_${record.qianniuhuaPurchaseNumber || ''}`}
              loading={financeBillQueryLoading}
              isMobile={false}
              scroll={{ x: isSplitView ? 600 : 1200, y: subTableScrollY || 150 }}
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => handleFinanceBillRowClick(record),
                style: {
                  cursor: 'pointer',
                  backgroundColor: selectedFinanceBillRow === `${record.transactionNumber}_${record.qianniuhuaPurchaseNumber || ''}` ? '#e6f7ff' : undefined,
                },
              })}
            />
          )}
        </div>
      );
    }

    if (tabKey === '非采购单流水记录') {
      return (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '8px' }}>
          {/* 搜索区域 */}
          <div style={{ marginBottom: 8 }}>
            <Space wrap>
              <Input
                placeholder="账单流水"
                allowClear
                size="small"
                style={{ width: isSplitView ? 160 : 180 }}
                value={nonPurchaseRecordSearch账单流水}
                onChange={(e) => setNonPurchaseRecordSearch账单流水(e.target.value)}
                onPressEnter={() => loadNonPurchaseRecordData(nonPurchaseRecordSearch账单流水)}
              />
              <Button size="small" type="primary" icon={<SearchOutlined />} onClick={() => loadNonPurchaseRecordData(nonPurchaseRecordSearch账单流水)}>搜索</Button>
              <Button size="small" onClick={() => {
                setNonPurchaseRecordSearch账单流水('');
                loadNonPurchaseRecordData();
              }}>重置</Button>
            </Space>
          </div>
          {nonPurchaseRecordData.length === 0 && !nonPurchaseRecordQueryLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', fontSize: 14 }}>
              该对账单号无非采购单流水记录关联数据
            </div>
          ) : (
            <ResponsiveTable<NonPurchaseBillRecord>
              tableId={`non-purchase-record-data-${isSplitView ? 'split' : 'normal'}`}
              columns={[
                {
                  title: '账单流水',
                  dataIndex: '账单流水',
                  key: '账单流水',
                  width: 200,
                  render: (text: string) => text || '-',
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
                  render: (text: string) => text || '-',
                },
                {
                  title: '财务记账凭证号',
                  dataIndex: '财务记账凭证号',
                  key: '财务记账凭证号',
                  width: 150,
                  render: (text: string) => text || '-',
                },
                {
                  title: '财务审核状态',
                  dataIndex: '财务审核状态',
                  key: '财务审核状态',
                  width: 120,
                  render: (text: string) => {
                    const statusMap: Record<string, string> = {
                      '0': '待审核',
                      '1': '已审核',
                    };
                    return statusMap[text || ''] || text || '-';
                  },
                },
                {
                  title: '财务审核人',
                  dataIndex: '财务审核人',
                  key: '财务审核人',
                  width: 100,
                  render: (text: string) => text || '-',
                },
                {
                  title: '记录修改人',
                  dataIndex: '记录修改人',
                  key: '记录修改人',
                  width: 100,
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
              ]}
              dataSource={nonPurchaseRecordData}
              rowKey={(record) => record.账单流水}
              loading={nonPurchaseRecordQueryLoading}
              isMobile={false}
              scroll={{ x: isSplitView ? 700 : 1500, y: subTableScrollY || 150 }}
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => handleNonPurchaseRecordRowClick(record),
                style: {
                  cursor: 'pointer',
                  backgroundColor: selectedNonPurchaseRecordRow === record.账单流水 ? '#e6f7ff' : undefined,
                },
              })}
            />
          )}
        </div>
      );
    }

    return <div>未知标签: {tabKey}</div>;
  };

  // 渲染标签项（用于Tabs items）
  const renderTabItem = (tabKey: string) => {
    return {
      key: tabKey,
      label: (
        <Space>
          <span>{tabKey}</span>
          <Button
            type="text"
            size="small"
            icon={<ColumnWidthOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSplitView(tabKey);
            }}
            title={splitViewTabs.has(tabKey) ? '取消分屏' : '开启分屏'}
          />
        </Space>
      ),
      closable: true,
      children: renderTabContent(tabKey, false),
    };
  };

  // 渲染分屏标签内容
  const renderSplitViewTabContent = (tabKey: string) => {
    return (
      <Tabs
        activeKey={tabKey}
        onChange={setActiveTab}
        type="card"
        hideAdd
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        items={[{
          key: tabKey,
          label: (
            <Space>
              <span>{tabKey}</span>
              <Button
                type="text"
                size="small"
                icon={<ColumnWidthOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSplitView(tabKey);
                }}
                title="取消分屏"
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tabKey);
                }}
              />
            </Space>
          ),
          children: renderTabContent(tabKey, true),
        }]}
      />
    );
  };

  // 图片上传前处理（用于采购单金额调整）
  const beforeUpload = (file: File): boolean => {
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

  // 图片变化处理（用于账单手动绑定采购单）
  const handleFinanceBillImageChange = (info: any) => {
    setFinanceBillImageFileList(info.fileList);
  };

  // 图片变化处理（用于采购单金额调整）
  const handlePurchaseAdjustmentImageChange = (info: any) => {
    setPurchaseAdjustmentImageFileList(info.fileList);
  };

  // 图片变化处理（用于非采购单流水记录）
  const handleNonPurchaseRecordImageChange = (info: any) => {
    setNonPurchaseRecordImageFileList(info.fileList);
  };

  // 将文件转换为base64（用于采购单金额调整）
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:image/xxx;base64, 前缀
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 保存采购单金额调整
  const handleSavePurchaseAdjustment = async () => {
    try {
      const values = await purchaseAdjustmentForm.validateFields();

      // 处理图片
      let imageBase64: string | undefined;
      if (purchaseAdjustmentImageFileList.length > 0 && purchaseAdjustmentImageFileList[0].originFileObj) {
        // 新上传的图片
        imageBase64 = await fileToBase64(purchaseAdjustmentImageFileList[0].originFileObj);
      }

      const adjustmentData: PurchaseAmountAdjustment = {
        purchaseOrderNumber: values.purchaseOrderNumber,
        adjustmentAmount: values.adjustmentAmount,
        adjustmentReason: values.adjustmentReason || undefined,
        image: imageBase64,
        financeReviewRemark: values.financeReviewRemark || undefined,
        // 财务审核状态在新增时默认为"0"
        financeReviewStatus: '0',
        financeReviewer: values.financeReviewer || undefined,
      };

      setPurchaseAdjustmentQueryLoading(true);
      await purchaseAmountAdjustmentApi.create(adjustmentData);
      message.success('创建成功');
      setPurchaseAdjustmentModalVisible(false);
      purchaseAdjustmentForm.resetFields();
      setPurchaseAdjustmentImageFileList([]);

      // 刷新子维度数据（如果已选中）
      if (selected对账单号) {
        loadSubRecords(selected对账单号);
      }

      // 刷新主表数据
      refreshRecords();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '保存失败');
      console.error(error);
    } finally {
      setPurchaseAdjustmentQueryLoading(false);
    }
  };

  // 保存账单手动绑定采购单（FinanceBill）
  const handleSaveFinanceBill = async () => {
    try {
      const values = await financeBillForm.validateFields();

      // 处理图片
      let imageBase64: string | undefined;
      if (financeBillImageFileList.length > 0 && financeBillImageFileList[0].originFileObj) {
        // 新上传的图片
        imageBase64 = await fileToBase64(financeBillImageFileList[0].originFileObj);
      }

      const billData: FinanceBill = {
        transactionNumber: values.transactionNumber,
        qianniuhuaPurchaseNumber: values.qianniuhuaPurchaseNumber || undefined,
        importExceptionRemark: values.importExceptionRemark || undefined,
        image: imageBase64,
      };

      setFinanceBillQueryLoading(true);
      await financeManagementApi.create(billData);
      message.success('创建成功');
      setFinanceBillModalVisible(false);
      financeBillForm.resetFields();
      setFinanceBillImageFileList([]);

      // 刷新子维度数据（如果已选中）
      if (selected对账单号) {
        loadSubRecords(selected对账单号);
      }

      // 刷新主表数据
      refreshRecords();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '保存失败');
      console.error(error);
    } finally {
      setFinanceBillQueryLoading(false);
    }
  };

  // 保存非采购单流水记录
  const handleSaveNonPurchaseRecord = async () => {
    try {
      const values = await nonPurchaseRecordForm.validateFields();

      // 处理图片
      let imageBase64: string | undefined;
      if (nonPurchaseRecordImageFileList.length > 0 && nonPurchaseRecordImageFileList[0].originFileObj) {
        // 新上传的图片
        imageBase64 = await fileToBase64(nonPurchaseRecordImageFileList[0].originFileObj);
      } else if (nonPurchaseRecordImageFileList.length > 0 && nonPurchaseRecordImageFileList[0].url) {
        // 编辑时，如果图片没有变化，使用原有的base64
        const url = nonPurchaseRecordImageFileList[0].url;
        if (url.startsWith('data:image')) {
          imageBase64 = url.split(',')[1];
        }
      } else {
        // 图片被清空或没有图片
        // 检查表单中的image字段，如果存在且不是空字符串，说明原来有图片但被清空了
        const formImageValue = nonPurchaseRecordForm.getFieldValue('image');
        if (formImageValue === '') {
          // 明确设置为空字符串，表示要清空数据库中的图片
          imageBase64 = '';
        } else {
          // 原来就没有图片，不设置image字段
          imageBase64 = undefined;
        }
      }

      const recordData: NonPurchaseBillRecord = {
        账单流水: values.账单流水,
        记账金额: values.记账金额 || undefined,
        账单类型: values.账单类型 || undefined,
        所属仓店: values.所属仓店 || undefined,
        账单流水备注: values.账单流水备注 || undefined,
        图片: imageBase64,
        财务记账凭证号: values.财务记账凭证号 || undefined,
        // 财务审核状态在新增时默认为"0"
        财务审核状态: '0',
        财务审核人: values.财务审核人 || undefined,
      };

      setNonPurchaseRecordQueryLoading(true);
      await nonPurchaseBillRecordApi.create(recordData);
      message.success('创建成功');
      setNonPurchaseRecordModalVisible(false);
      nonPurchaseRecordForm.resetFields();
      setNonPurchaseRecordImageFileList([]);

      // 刷新子维度数据（如果已选中）
      if (selected对账单号) {
        loadSubRecords(selected对账单号);
      }

      // 刷新主表数据
      refreshRecords();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '保存失败');
      console.error(error);
    } finally {
      setNonPurchaseRecordQueryLoading(false);
    }
  };

  // 表格列定义（对账单号维度）
  const allColumns = [
    {
      title: '对账单号',
      dataIndex: '对账单号',
      key: '对账单号',
      width: 150,
      ellipsis: true,
      fixed: 'left' as const,
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
            <Title level={4} style={{ margin: 0, fontSize: '14px' }}>账单对账汇总差异</Title>
          </Space>
        }
        extra={
          <Space wrap>
            {/* 对账单号维度搜索框 - 移到extra中 */}
            <Input
              placeholder="对账单号"
              allowClear
              size="small"
              style={{ width: 100, fontSize: '12px' }}
              value={search对账单号}
              onChange={(e) => setSearch对账单号(e.target.value)}
              onPressEnter={handleSearchAll}
            />
            <Input
              placeholder="采购单号搜索对账单号"
              allowClear
              size="small"
              style={{ width: 130, fontSize: '12px' }}
              value={search采购单号}
              onChange={(e) => setSearch采购单号(e.target.value)}
              onPressEnter={handleSearchAll}
            />
            <Input
              placeholder="交易单号搜索对账单号"
              allowClear
              size="small"
              style={{ width: 130, fontSize: '12px' }}
              value={search交易单号}
              onChange={(e) => setSearch交易单号(e.target.value)}
              onPressEnter={handleSearchAll}
            />
            <Select
              mode="multiple"
              placeholder="对账单收货状态"
              allowClear
              size="small"
              style={{ width: 140, fontSize: '12px' }}
              value={search对账单收货状态}
              onChange={(value) => {
                setSearch对账单收货状态(value || []);
              }}
            >
              {对账单收货状态选项.map((状态) => (
                <Select.Option key={状态} value={状态}>
                  {状态}
                </Select.Option>
              ))}
            </Select>
            <Select
              mode="multiple"
              placeholder="记录状态"
              allowClear
              size="small"
              style={{ width: 140, fontSize: '12px' }}
              value={search记录状态}
              onChange={(value) => {
                setSearch记录状态(value || []);
              }}
            >
              {记录状态选项.map((状态) => (
                <Select.Option key={状态} value={状态}>
                  {状态}
                </Select.Option>
              ))}
            </Select>
            <DatePicker.RangePicker
              size="small"
              style={{ width: 180, fontSize: '12px' }}
              value={search更新时间范围}
              onChange={(dates) => {
                setSearch更新时间范围(dates as [Dayjs | null, Dayjs | null] | null);
              }}
              format="YYYY-MM-DD"
              placeholder={['更新时间开始', '更新时间结束']}
              locale={zhCN.DatePicker}
            />
            {/* 综合搜索框 */}
            <Input
              placeholder="综合搜索（所有字段）"
              allowClear
              size="small"
              style={{ width: 150, fontSize: '12px' }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearchAll}
            />
            <Button
              type="primary"
              size="small"
              icon={<SearchOutlined />}
              onClick={handleSearchAll}
              style={{ fontSize: '12px' }}
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
              <Button size="small" icon={<SettingOutlined />} style={{ fontSize: '12px' }}>列设置</Button>
            </Popover>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                setSearch对账单号('');
                setSearch记录状态([]);
                setSearch对账单收货状态([]);
                setSearch更新时间范围(null);
                setSearch采购单号('');
                setSearch交易单号('');
                setCurrentPage(1);
                loadRecords(1, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
              }}
              style={{ fontSize: '12px' }}
            >
              重置
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                purchaseAdjustmentForm.resetFields();
                setPurchaseAdjustmentImageFileList([]);
                setPurchaseAdjustmentModalVisible(true);
              }}
              style={{ fontSize: '12px' }}
            >
              新增:采购单金额调整
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                financeBillForm.resetFields();
                setFinanceBillImageFileList([]);
                setFinanceBillModalVisible(true);
              }}
              style={{ fontSize: '12px' }}
            >
              新增:账单手动绑定采购单
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                nonPurchaseRecordForm.resetFields();
                setNonPurchaseRecordModalVisible(true);
              }}
              style={{ fontSize: '12px' }}
            >
              新增:非采购单流水记录
            </Button>
          </Space>
        }
      >
        {/* 上下分栏布局 */}
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 600, overflow: 'hidden' }}>
          {/* 上部分：对账单号维度数据（约2/3，可调整） */}
          <div
            ref={topTableContainerRef}
            style={{
              flex: `0 0 ${topPanelHeight}%`,
              minHeight: 300,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <ResponsiveTable<FinanceReconciliationDifference>
              tableId="finance-reconciliation-difference"
              columns={columns as any}
              dataSource={records}
              rowKey={(record) => record.对账单号 || ''}
              loading={loading}
              isMobile={false}
              scroll={{ x: 1500, y: tableScrollY || 200 }}
              onRow={(record) => ({
                onClick: () => handleRowClick(record),
                style: {
                  cursor: 'pointer',
                  backgroundColor: selected对账单号 === record.对账单号 ? '#e6f7ff' : undefined,
                },
              })}
              pagination={false}
              size="small"
            />
          </div>

          {/* 可拖拽调整的分隔线 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* 分页功能 */}
            <div style={{ padding: '8px 16px', backgroundColor: '#fafafa', borderTop: '1px solid #e8e8e8' }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={total}
                showSizeChanger={true}
                showQuickJumper={true}
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                onChange={(page, size) => {
                  setCurrentPage(page);
                  setPageSize(size || 20);
                  const 更新时间开始 = search更新时间范围?.[0] ? search更新时间范围[0].format('YYYY-MM-DD 00:00:00') : undefined;
                  const 更新时间结束 = search更新时间范围?.[1] ? search更新时间范围[1].format('YYYY-MM-DD 23:59:59') : undefined;
                  loadRecords(
                    page,
                    searchText?.trim() || undefined,
                    search对账单号?.trim() || undefined,
                    search记录状态.length > 0 ? search记录状态 : undefined,
                    search对账单收货状态.length > 0 ? search对账单收货状态 : undefined,
                    更新时间开始,
                    更新时间结束,
                    search采购单号?.trim() || undefined,
                    search交易单号?.trim() || undefined,
                  );
                }}
              />
            </div>
            {/* 分隔线 */}
            <div
              style={{
                height: '4px',
                backgroundColor: '#1890ff',
                cursor: 'ns-resize',
                position: 'relative',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startTopHeight = topPanelHeight;
                const containerHeight = e.currentTarget.parentElement?.parentElement?.clientHeight || 600;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaY = moveEvent.clientY - startY;
                  const deltaPercent = (deltaY / containerHeight) * 100;
                  // 取消上限限制，只保留最小高度限制
                  const newTopHeight = Math.max(5, startTopHeight + deltaPercent);
                  setTopPanelHeight(newTopHeight);
                };

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
          </div>

          {/* 下部分：子维度数据（约1/3，可调整） */}
          <div
            ref={subTableContainerRef}
            style={{
              flex: `0 0 ${100 - topPanelHeight}%`,
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              padding: '16px',
              backgroundColor: '#fafafa',
            }}
          >
            {selected对账单号 ? (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* 子维度数据列表 */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* 搜索区域 */}
                  <div style={{ marginBottom: 8 }}>
                    <Space wrap>
                      <Input
                        placeholder="交易单号"
                        allowClear
                        size="small"
                        style={{ width: 140 }}
                        value={subDetailSearch交易单号}
                        onChange={(e) => setSubDetailSearch交易单号(e.target.value)}
                        onPressEnter={handleDetailSearch}
                      />
                      <Input
                        placeholder="牵牛花采购单号"
                        allowClear
                        size="small"
                        style={{ width: 140 }}
                        value={subDetailSearch牵牛花采购单号}
                        onChange={(e) => setSubDetailSearch牵牛花采购单号(e.target.value)}
                        onPressEnter={handleDetailSearch}
                      />
                      <Input
                        placeholder="采购单状态"
                        allowClear
                        size="small"
                        style={{ width: 140 }}
                        value={subDetailSearch采购单状态}
                        onChange={(e) => setSubDetailSearch采购单状态(e.target.value)}
                        onPressEnter={handleDetailSearch}
                      />
                      <Input
                        placeholder="门店/仓"
                        allowClear
                        size="small"
                        style={{ width: 140 }}
                        value={subDetailSearch门店仓}
                        onChange={(e) => setSubDetailSearch门店仓(e.target.value)}
                        onPressEnter={handleDetailSearch}
                      />
                      <Button size="small" type="primary" icon={<SearchOutlined />} onClick={handleDetailSearch}>搜索</Button>
                      <Button size="small" onClick={handleDetailReset}>重置</Button>
                      <span style={{ marginLeft: 8, fontWeight: 500, fontSize: 14 }}>对账单详细信息</span>
                    </Space>
                  </div>

                  {/* 子维度数据表格 */}
                  <div style={{
                    flex: detailPanelsVisible ? `0 0 ${100 - detailPanelsHeight}%` : 1,
                    overflow: 'auto',
                    minHeight: 0
                  }}>
                    <ResponsiveTable<FinanceReconciliationDifference>
                      tableId="finance-reconciliation-difference-sub"
                      columns={[
                        {
                          title: '交易单号',
                          dataIndex: '交易单号',
                          key: '交易单号',
                          width: Math.round(180 * 0.7),
                          render: (text: string) => text || '-',
                        },
                        {
                          title: '牵牛花采购单号',
                          dataIndex: '牵牛花采购单号',
                          key: '牵牛花采购单号',
                          width: Math.round(180 * 0.7),
                          render: (text: string) => text || '-',
                        },
                        {
                          title: '采购单金额',
                          dataIndex: '采购单金额',
                          key: '采购单金额',
                          width: Math.round(120 * 0.7),
                          align: 'right' as const,
                          render: (text: number) => formatAmount(text),
                        },
                        {
                          title: '采购单调整金额',
                          dataIndex: '采购单调整金额',
                          key: '采购单调整金额',
                          width: Math.round(140 * 0.7),
                          align: 'right' as const,
                          render: (text: number) => formatAmount(text),
                        },
                        {
                          title: '调整后采购单金额',
                          dataIndex: '调整后采购单金额',
                          key: '调整后采购单金额',
                          width: Math.round(160 * 0.7),
                          align: 'right' as const,
                          render: (text: number) => formatAmount(text),
                        },
                        {
                          title: '采购单状态',
                          dataIndex: '采购单状态',
                          key: '采购单状态',
                          width: Math.round(120 * 0.7),
                          render: (text: string) => text || '-',
                        },
                        {
                          title: '门店/仓',
                          dataIndex: '门店仓',
                          key: '门店仓',
                          width: Math.round(120 * 0.7),
                          render: (text: string) => text || '-',
                        },
                        {
                          title: '下单账号',
                          dataIndex: '下单账号',
                          key: '下单账号',
                          width: Math.round(120 * 0.7),
                          render: (text: string) => text || '-',
                        },
                      ]}
                      dataSource={subRecords}
                      rowKey={(record) => `${record.交易单号}_${record.牵牛花采购单号}`}
                      loading={subLoading}
                      isMobile={false}
                      scroll={{ x: Math.round(1200 * 0.7) }}
                      pagination={false}
                      size="small"
                      style={{ fontSize: `${12 * 0.7}px` }}
                      summary={() => (
                        <Table.Summary fixed>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={2} />
                            <Table.Summary.Cell index={2} align="right">
                              <span style={{ fontWeight: 'bold' }}>{formatAmount(subRecordsSummary.total采购单金额)}</span>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3} align="right">
                              <span style={{ fontWeight: 'bold' }}>{formatAmount(subRecordsSummary.total采购单调整金额)}</span>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={4} align="right">
                              <span style={{ fontWeight: 'bold' }}>{formatAmount(subRecordsSummary.total调整后采购单金额)}</span>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5} colSpan={3} />
                          </Table.Summary.Row>
                        </Table.Summary>
                      )}
                      onRow={(record) => {
                        const rowKey = `${record.交易单号}_${record.牵牛花采购单号}`;
                        const isSelected = selectedSubRecord && `${selectedSubRecord.交易单号}_${selectedSubRecord.牵牛花采购单号}` === rowKey;
                        return {
                          onClick: () => handleSubRecordClick(record),
                          style: {
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#1890ff' : undefined,
                            color: isSelected ? '#fff' : undefined,
                          },
                        };
                      }}
                    />
                  </div>

                  {/* 分隔线：调整左右框高度 */}
                  {detailPanelsVisible && (
                    <div
                      style={{
                        height: '4px',
                        backgroundColor: '#1890ff',
                        cursor: 'ns-resize',
                        flexShrink: 0,
                        marginTop: 8,
                        marginBottom: 8,
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const startY = e.clientY;
                        const container = subTableContainerRef.current;
                        if (!container) return;
                        const containerHeight = container.clientHeight;

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const container = subTableContainerRef.current;
                          if (!container) return;
                          const containerRect = container.getBoundingClientRect();
                          const containerTop = containerRect.top;
                          const containerHeight = container.clientHeight;

                          // 计算鼠标相对于容器顶部的位置（即与上下栏分割线的距离）
                          const mouseY = moveEvent.clientY;
                          const relativeY = mouseY - containerTop;

                          // 计算分割线距离容器顶部的百分比
                          // 鼠标下移时，relativeY增加，分割线应该下移
                          // 分割线的位置 = 子维度表格的高度百分比
                          // 左右框的高度 = 100% - 分割线位置
                          // detailPanelsHeight表示左右框的高度百分比
                          const splitLinePosition = (relativeY / containerHeight) * 100;

                          // 限制：分割线最小位置为5%（不能超过容器顶部），最大位置为95%（留一些空间给左右框）
                          const minPosition = 5;
                          const maxPosition = 95;
                          const clampedPosition = Math.max(minPosition, Math.min(maxPosition, splitLinePosition));

                          // 左右框的高度 = 100% - 分割线位置
                          // 当分割线下移时，左右框应该变小
                          setDetailPanelsHeight(100 - clampedPosition);
                        };

                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    />
                  )}

                  {/* 左右框：交易单号信息和采购单号信息 */}
                  {detailPanelsVisible && (
                    <div style={{
                      flex: `0 0 ${detailPanelsHeight}%`,
                      display: 'flex',
                      gap: 0,
                      overflow: 'hidden',
                      minHeight: 200,
                    }}>
                      {/* 左框：交易单号信息 */}
                      <div style={{
                        flex: `0 0 ${leftPanelWidth}%`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        padding: '8px',
                        backgroundColor: '#fff',
                        minHeight: 0,
                      }}>
                        <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                          <span>交易单详细信息</span>
                          <Space size="small">
                            <Button
                              size="small"
                              type="primary"
                              style={{ fontSize: '11px', padding: '0 8px', height: '24px' }}
                              onClick={() => {
                                setFinanceBillModalVisible(true);
                              }}
                            >
                              账单手动绑定采购单
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={handleCloseDetailPanels}
                            />
                          </Space>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', marginBottom: 0, minHeight: 0 }}>
                          <ResponsiveTable<TransactionRecord>
                            tableId="transaction-record-data"
                            columns={[
                              {
                                title: '支付渠道',
                                dataIndex: '支付渠道',
                                key: '支付渠道',
                                width: Math.round(150 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '支付账号',
                                dataIndex: '支付账号',
                                key: '支付账号',
                                width: Math.round(150 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '收支金额',
                                dataIndex: '收支金额',
                                key: '收支金额',
                                width: Math.round(120 * 0.7),
                                align: 'right' as const,
                                render: (text: number) => formatAmount(text),
                              },
                              {
                                title: '交易账单号',
                                dataIndex: '交易账单号',
                                key: '交易账单号',
                                width: Math.round(180 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '账单交易时间',
                                dataIndex: '账单交易时间',
                                key: '账单交易时间',
                                width: Math.round(180 * 0.7),
                                render: (text: string) => formatDateTime(text),
                              },
                              {
                                title: '是否手动绑定',
                                key: '是否手动绑定',
                                width: Math.round(120 * 0.7),
                                render: (_: any, record: TransactionRecord) => {
                                  const 交易账单号 = record.交易账单号;
                                  const isBound = 交易账单号 ? financeBillExistsMap.get(交易账单号) || false : false;
                                  return (
                                    <span
                                      style={{
                                        color: isBound ? '#1890ff' : '#999',
                                        cursor: isBound ? 'pointer' : 'default',
                                        textDecoration: isBound ? 'underline' : 'none',
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isBound && 交易账单号) {
                                          handleTransactionRecordIsBoundClick(交易账单号);
                                        }
                                      }}
                                    >
                                      {isBound ? '是' : '否'}
                                    </span>
                                  );
                                },
                              },
                            ]}
                            dataSource={transactionRecordData}
                            rowKey={(record) => `${record.交易账单号 || ''}_${record.支付账号 || ''}_${record.账单交易时间 || ''}`}
                            loading={transactionRecordLoading}
                            isMobile={false}
                            scroll={{ x: Math.round(800 * 0.7) }}
                            pagination={false}
                            size="small"
                            style={{ fontSize: `${12 * 0.7}px` }}
                          />
                        </div>
                      </div>

                      {/* 分割线：左右框之间 */}
                      <div
                        style={{
                          width: '4px',
                          backgroundColor: '#1890ff',
                          cursor: 'ew-resize',
                          flexShrink: 0,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const container = subTableContainerRef.current;
                          if (!container) return;
                          const containerWidth = container.clientWidth;

                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaPercent = (deltaX / containerWidth) * 100;
                            const newWidth = Math.max(20, Math.min(80, leftPanelWidth + deltaPercent));
                            setLeftPanelWidth(newWidth);
                          };

                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };

                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      />

                      {/* 右框：采购单号信息 */}
                      <div style={{
                        flex: `0 0 ${100 - leftPanelWidth}%`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        padding: '8px',
                        backgroundColor: '#fff',
                        minHeight: 0,
                      }}>
                        <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                          <span>采购单详细信息</span>
                          <Space size="small">
                            <Button
                              size="small"
                              type="primary"
                              style={{ fontSize: '11px', padding: '0 8px', height: '24px' }}
                              onClick={() => {
                                setPurchaseAdjustmentModalVisible(true);
                              }}
                            >
                              采购单金额调整
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={handleCloseDetailPanels}
                            />
                          </Space>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', marginBottom: 0, minHeight: 0 }}>
                          <ResponsiveTable<PurchaseOrderInfo>
                            tableId="purchase-order-info-data"
                            columns={[
                              {
                                title: '采购单号',
                                dataIndex: '采购单号',
                                key: '采购单号',
                                width: Math.round(180 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '门店/仓',
                                dataIndex: '门店/仓',
                                key: '门店/仓',
                                width: Math.round(120 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '所属采购计划',
                                dataIndex: '所属采购计划',
                                key: '所属采购计划',
                                width: Math.round(150 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '采购金额',
                                dataIndex: '采购金额',
                                key: '采购金额',
                                width: Math.round(120 * 0.7),
                                align: 'right' as const,
                                render: (text: number) => formatAmount(text),
                              },
                              {
                                title: '实收金额',
                                dataIndex: '实收金额',
                                key: '实收金额',
                                width: Math.round(120 * 0.7),
                                align: 'right' as const,
                                render: (text: number) => formatAmount(text),
                              },
                              {
                                title: '关联收货单号',
                                dataIndex: '关联收货单号',
                                key: '关联收货单号',
                                width: Math.round(150 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '状态',
                                dataIndex: '状态',
                                key: '状态',
                                width: Math.round(100 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '付款状态',
                                dataIndex: '付款状态',
                                key: '付款状态',
                                width: Math.round(100 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '创建时间',
                                dataIndex: '创建时间',
                                key: '创建时间',
                                width: Math.round(180 * 0.7),
                                render: (text: string) => formatDateTime(text),
                              },
                              {
                                title: '创建人名称',
                                dataIndex: '创建人名称',
                                key: '创建人名称',
                                width: Math.round(120 * 0.7),
                                render: (text: string) => text || '-',
                              },
                              {
                                title: '是否调整金额',
                                key: '是否调整金额',
                                width: Math.round(120 * 0.7),
                                render: (_: any, record: PurchaseOrderInfo) => {
                                  const 采购单号 = record.采购单号;
                                  const isAdjusted = 采购单号 ? purchaseAdjustmentExistsMap.get(采购单号) || false : false;
                                  return (
                                    <span
                                      style={{
                                        color: isAdjusted ? '#1890ff' : '#999',
                                        cursor: isAdjusted ? 'pointer' : 'default',
                                        textDecoration: isAdjusted ? 'underline' : 'none',
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isAdjusted && 采购单号) {
                                          handlePurchaseOrderIsAdjustedClick(采购单号);
                                        }
                                      }}
                                    >
                                      {isAdjusted ? '是' : '否'}
                                    </span>
                                  );
                                },
                              },
                            ]}
                            dataSource={purchaseOrderInfoData}
                            rowKey={(record) => `${record.采购单号 || ''}_${record.创建时间 || ''}`}
                            loading={purchaseOrderInfoLoading}
                            isMobile={false}
                            scroll={{ x: Math.round(1400 * 0.7) }}
                            pagination={false}
                            size="small"
                            style={{ fontSize: `${12 * 0.7}px` }}
                            summary={() => (
                              <Table.Summary fixed>
                                <Table.Summary.Row>
                                  <Table.Summary.Cell index={0} colSpan={3} />
                                  <Table.Summary.Cell index={3} align="right">
                                    <span style={{ fontWeight: 'bold' }}>{formatAmount(purchaseOrderInfoSummary.total采购金额)}</span>
                                  </Table.Summary.Cell>
                                  <Table.Summary.Cell index={4} align="right">
                                    <span style={{ fontWeight: 'bold' }}>{formatAmount(purchaseOrderInfoSummary.total实收金额)}</span>
                                  </Table.Summary.Cell>
                                  <Table.Summary.Cell index={5} colSpan={6} />
                                </Table.Summary.Row>
                              </Table.Summary>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999',
                fontSize: 14
              }}>
                请在上方表格中点击一行以查看子维度数据
              </div>
            )}
          </div>
        </div>
      </Card>


      {/* 采购单金额调整 Modal（用于牵牛花采购单号点击） */}
      <Modal
        title="新增调整记录"
        open={purchaseAdjustmentModalVisible}
        onOk={handleSavePurchaseAdjustment}
        onCancel={() => {
          setPurchaseAdjustmentModalVisible(false);
          purchaseAdjustmentForm.resetFields();
          setPurchaseAdjustmentImageFileList([]);
        }}
        width={800}
        okText="保存"
        cancelText="取消"
        confirmLoading={purchaseAdjustmentModalLoading}
      >
        <Form
          form={purchaseAdjustmentForm}
          layout="vertical"
        >
          <Form.Item
            label="采购单号(牵牛花)"
            name="purchaseOrderNumber"
            rules={[
              { required: true, message: '请输入采购单号' },
              { whitespace: true, message: '采购单号不能为空' }
            ]}
          >
            <Input placeholder="请输入采购单号" />
          </Form.Item>

          <Form.Item
            label="调整金额"
            name="adjustmentAmount"
          >
            <InputNumber
              placeholder="请输入调整金额"
              style={{ width: '100%' }}
              precision={2}
              min={-999999999.99}
              max={999999999.99}
            />
          </Form.Item>

          <Form.Item
            label="异常调整原因备注"
            name="adjustmentReason"
          >
            <TextArea
              rows={4}
              placeholder="请输入异常调整原因备注"
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
                fileList={purchaseAdjustmentImageFileList}
                beforeUpload={beforeUpload}
                onChange={handlePurchaseAdjustmentImageChange}
                onRemove={() => {
                  setPurchaseAdjustmentImageFileList([]);
                  purchaseAdjustmentForm.setFieldValue('image', '');
                  return true;
                }}
                maxCount={1}
              >
                {purchaseAdjustmentImageFileList.length < 1 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传图片</div>
                  </div>
                )}
              </Upload>
              {purchaseAdjustmentImageFileList.length > 0 && (
                <Button
                  danger
                  size="small"
                  onClick={() => {
                    setPurchaseAdjustmentImageFileList([]);
                    purchaseAdjustmentForm.setFieldValue('image', '');
                  }}
                >
                  清空图片
                </Button>
              )}
            </Space>
          </Form.Item>

          <Form.Item
            label="财务审核意见备注"
            name="financeReviewRemark"
          >
            <TextArea
              rows={4}
              placeholder="请输入财务审核意见备注"
              maxLength={245}
              showCount
            />
          </Form.Item>

          {/* 财务审核状态不允许编辑，新增时默认为"0" */}

          <Form.Item
            label="财务审核人"
            name="financeReviewer"
          >
            <Input placeholder="请输入财务审核人" maxLength={20} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 账单手动绑定采购单 Modal（FinanceManagement） */}
      <Modal
        title="新增账单"
        open={financeBillModalVisible}
        onOk={handleSaveFinanceBill}
        onCancel={() => {
          setFinanceBillModalVisible(false);
          financeBillForm.resetFields();
          setFinanceBillImageFileList([]);
        }}
        width={800}
        okText="保存"
        cancelText="取消"
        confirmLoading={financeBillModalLoading}
      >
        <Form
          form={financeBillForm}
          layout="vertical"
        >
          <Form.Item
            label="交易单号"
            name="transactionNumber"
            rules={[
              { required: true, message: '请输入交易单号' },
              { whitespace: true, message: '交易单号不能为空' }
            ]}
          >
            <Input placeholder="请输入交易单号" />
          </Form.Item>

          <Form.Item
            label="牵牛花采购单号"
            name="qianniuhuaPurchaseNumber"
          >
            <Input placeholder="请输入牵牛花采购单号" />
          </Form.Item>

          <Form.Item
            label="导入异常备注"
            name="importExceptionRemark"
          >
            <TextArea
              rows={4}
              placeholder="请输入导入异常备注"
              maxLength={1000}
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
                fileList={financeBillImageFileList}
                beforeUpload={beforeUpload}
                onChange={handleFinanceBillImageChange}
                onRemove={() => {
                  setFinanceBillImageFileList([]);
                  financeBillForm.setFieldValue('image', '');
                  return true;
                }}
                maxCount={1}
              >
                {financeBillImageFileList.length < 1 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传图片</div>
                  </div>
                )}
              </Upload>
              {financeBillImageFileList.length > 0 && (
                <Button
                  danger
                  size="small"
                  onClick={() => {
                    setFinanceBillImageFileList([]);
                    financeBillForm.setFieldValue('image', '');
                  }}
                >
                  清空图片
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 非采购单流水记录 Modal */}
      <Modal
        title="新增记录"
        open={nonPurchaseRecordModalVisible}
        onOk={handleSaveNonPurchaseRecord}
        onCancel={() => {
          setNonPurchaseRecordModalVisible(false);
          nonPurchaseRecordForm.resetFields();
          setNonPurchaseRecordImageFileList([]);
        }}
        width={800}
        okText="保存"
        cancelText="取消"
        confirmLoading={nonPurchaseRecordModalLoading}
      >
        <Form
          form={nonPurchaseRecordForm}
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
                fileList={nonPurchaseRecordImageFileList}
                beforeUpload={beforeUpload}
                onChange={handleNonPurchaseRecordImageChange}
                onRemove={() => {
                  setNonPurchaseRecordImageFileList([]);
                  nonPurchaseRecordForm.setFieldValue('image', '');
                  return true;
                }}
                maxCount={1}
              >
                {nonPurchaseRecordImageFileList.length < 1 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传图片</div>
                  </div>
                )}
              </Upload>
              {nonPurchaseRecordImageFileList.length > 0 && (
                <Button
                  danger
                  size="small"
                  onClick={() => {
                    setNonPurchaseRecordImageFileList([]);
                    // 设置为空字符串，表示要清空数据库中的图片
                    nonPurchaseRecordForm.setFieldValue('image', '');
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

          {/* 财务审核状态不允许编辑，新增时默认为"0" */}

          <Form.Item
            label="财务审核人"
            name="财务审核人"
          >
            <Input placeholder="请输入财务审核人" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 图片预览 */}
      <Modal
        open={financeBillPreviewVisible}
        footer={null}
        onCancel={() => {
          setFinanceBillPreviewVisible(false);
          setFinanceBillPreviewImage(null);
        }}
        width={800}
        centered
      >
        {financeBillPreviewImage && (
          <Image
            src={financeBillPreviewImage}
            alt="预览"
            style={{ width: '100%' }}
          />
        )}
      </Modal>

      {/* 账单手动绑定采购单详情弹窗 */}
      <Modal
        title={`账单手动绑定采购单详情 - ${financeBillDetailTransactionNumber}`}
        open={financeBillDetailModalVisible}
        onCancel={() => {
          setFinanceBillDetailModalVisible(false);
          setFinanceBillDetailData([]);
          setFinanceBillDetailTransactionNumber('');
        }}
        width={1000}
        footer={null}
      >
        <ResponsiveTable<FinanceBill>
          tableId="finance-bill-detail-modal"
          columns={[
            {
              title: '交易单号',
              dataIndex: 'transactionNumber',
              key: 'transactionNumber',
              width: 200,
              render: (text: string) => text || '-',
            },
            {
              title: '牵牛花采购单号',
              dataIndex: 'qianniuhuaPurchaseNumber',
              key: 'qianniuhuaPurchaseNumber',
              width: 200,
              render: (text: string) => text || '-',
            },
            {
              title: '导入异常备注',
              dataIndex: 'importExceptionRemark',
              key: 'importExceptionRemark',
              width: 250,
              render: (text: string) => text || '-',
            },
            {
              title: '图片',
              dataIndex: 'hasImage',
              key: 'hasImage',
              width: 100,
              render: (hasImage: number, record: FinanceBill) => {
                if (hasImage === 1 && record.image) {
                  return (
                    <Image
                      width={50}
                      src={`data:image/jpeg;base64,${record.image}`}
                      preview={{
                        mask: <EyeOutlined />,
                      }}
                    />
                  );
                }
                return '-';
              },
            },
            {
              title: '修改人',
              dataIndex: 'modifier',
              key: 'modifier',
              width: 100,
              render: (text: string) => text || '-',
            },
            {
              title: '修改时间',
              dataIndex: 'modifyTime',
              key: 'modifyTime',
              width: 180,
              render: (text: string) => formatDateTime(text),
            },
          ]}
          dataSource={financeBillDetailData}
          rowKey={(record) => `${record.transactionNumber}_${record.qianniuhuaPurchaseNumber || ''}`}
          loading={financeBillDetailLoading}
          isMobile={false}
          scroll={{ x: 1100 }}
          pagination={false}
          size="small"
        />
      </Modal>

      {/* 采购单金额调整详情弹窗 */}
      <Modal
        title={`采购单金额调整详情 - ${purchaseAdjustmentDetailPurchaseOrderNumber}`}
        open={purchaseAdjustmentDetailModalVisible}
        onCancel={() => {
          setPurchaseAdjustmentDetailModalVisible(false);
          setPurchaseAdjustmentDetailData([]);
          setPurchaseAdjustmentDetailPurchaseOrderNumber('');
        }}
        width={1200}
        footer={null}
      >
        <ResponsiveTable<PurchaseAmountAdjustment>
          tableId="purchase-adjustment-detail-modal"
          columns={[
            {
              title: '采购单号(牵牛花)',
              dataIndex: 'purchaseOrderNumber',
              key: 'purchaseOrderNumber',
              width: 200,
              render: (text: string) => text || '-',
            },
            {
              title: '调整金额',
              dataIndex: 'adjustmentAmount',
              key: 'adjustmentAmount',
              width: 120,
              align: 'right' as const,
              render: (text: number) => formatAmount(text),
            },
            {
              title: '异常调整原因备注',
              dataIndex: 'adjustmentReason',
              key: 'adjustmentReason',
              width: 200,
              render: (text: string) => text || '-',
            },
            {
              title: '图片',
              dataIndex: 'hasImage',
              key: 'hasImage',
              width: 100,
              render: (hasImage: number, record: PurchaseAmountAdjustment) => {
                if (hasImage === 1 && record.image) {
                  return (
                    <Image
                      width={50}
                      src={`data:image/jpeg;base64,${record.image}`}
                      preview={{
                        mask: <EyeOutlined />,
                      }}
                    />
                  );
                }
                return '-';
              },
            },
            {
              title: '财务审核意见备注',
              dataIndex: 'financeReviewRemark',
              key: 'financeReviewRemark',
              width: 200,
              render: (text: string) => text || '-',
            },
            {
              title: '财务审核状态',
              dataIndex: 'financeReviewStatus',
              key: 'financeReviewStatus',
              width: 120,
              render: (text: string) => {
                const statusMap: Record<string, string> = {
                  '0': '待审核',
                  '1': '已审核',
                };
                return statusMap[text || ''] || text || '-';
              },
            },
            {
              title: '创建人',
              dataIndex: 'creator',
              key: 'creator',
              width: 100,
              render: (text: string) => text || '-',
            },
            {
              title: '财务审核人',
              dataIndex: 'financeReviewer',
              key: 'financeReviewer',
              width: 100,
              render: (text: string) => text || '-',
            },
          ]}
          dataSource={purchaseAdjustmentDetailData}
          rowKey={(record) => record.purchaseOrderNumber}
          loading={purchaseAdjustmentDetailLoading}
          isMobile={false}
          scroll={{ x: 1200 }}
          pagination={false}
          size="small"
        />
      </Modal>
    </div>
  );
}

