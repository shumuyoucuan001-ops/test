"use client";

import { FinanceBill, financeManagementApi, FinanceReconciliationDifference, financeReconciliationDifferenceApi, NonPurchaseBillRecord, nonPurchaseBillRecordApi, PurchaseAmountAdjustment, purchaseAmountAdjustmentApi } from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';
import {
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
  Tabs,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import zhCN from 'antd/locale/zh_CN';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useEffect, useRef, useState } from 'react';
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

  // 子维度搜索字段
  const [subSearch交易单号, setSubSearch交易单号] = useState('');
  const [subSearch牵牛花采购单号, setSubSearch牵牛花采购单号] = useState('');
  const [subSearch采购单状态, setSubSearch采购单状态] = useState('');
  const [subSearch门店仓, setSubSearch门店仓] = useState('');

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

  // 标签页相关状态
  const [activeTab, setActiveTab] = useState<string>('对账单详细数据');

  // 三个查询结果的状态
  const [purchaseAdjustmentData, setPurchaseAdjustmentData] = useState<PurchaseAmountAdjustment[]>([]);
  const [purchaseAdjustmentQueryLoading, setPurchaseAdjustmentQueryLoading] = useState<boolean>(false);
  const [financeBillData, setFinanceBillData] = useState<FinanceBill[]>([]);
  const [financeBillQueryLoading, setFinanceBillQueryLoading] = useState<boolean>(false);
  const [nonPurchaseRecordData, setNonPurchaseRecordData] = useState<NonPurchaseBillRecord[]>([]);
  const [nonPurchaseRecordQueryLoading, setNonPurchaseRecordQueryLoading] = useState<boolean>(false);

  // 上下分栏高度比例（默认上2/3，下1/3）
  const [topPanelHeight, setTopPanelHeight] = useState<number>(66.67); // 百分比

  // 表格滚动高度
  const [tableScrollY, setTableScrollY] = useState<number | undefined>(undefined);
  const [subTableScrollY, setSubTableScrollY] = useState<number | undefined>(undefined);
  const topTableContainerRef = useRef<HTMLDivElement>(null);
  const subTableContainerRef = useRef<HTMLDivElement>(null);

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
  const loadSubRecords = async (对账单号: string) => {
    if (!对账单号) return;

    try {
      setSubLoading(true);
      const result = await financeReconciliationDifferenceApi.getDetailsByReconciliationNumber(
        对账单号,
        {
          交易单号: subSearch交易单号?.trim() || undefined,
          牵牛花采购单号: subSearch牵牛花采购单号?.trim() || undefined,
          采购单状态: subSearch采购单状态?.trim() || undefined,
          门店仓: subSearch门店仓?.trim() || undefined,
        }
      );
      setSubRecords(result.data);
      setSubTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载子维度数据失败');
      console.error(error);
    } finally {
      setSubLoading(false);
    }
  };

  // 处理行点击（选中对账单号）
  const handleRowClick = (record: FinanceReconciliationDifference) => {
    const 对账单号 = record.对账单号;
    if (!对账单号) return;

    // 如果点击的是已选中的行，则取消选中
    if (selected对账单号 === 对账单号) {
      setSelected对账单号(null);
      setSubRecords([]);
      setSubTotal(0);
      setActiveTab('对账单详细数据');
      // 清空查询结果
      setPurchaseAdjustmentData([]);
      setFinanceBillData([]);
      setNonPurchaseRecordData([]);
    } else {
      // 选中新行
      setSelected对账单号(对账单号);
      // 加载子维度数据
      loadSubRecords(对账单号);
      setActiveTab('对账单详细数据');
      // 清空查询结果
      setPurchaseAdjustmentData([]);
      setFinanceBillData([]);
      setNonPurchaseRecordData([]);
    }
  };

  // 查询采购单金额调整
  const loadPurchaseAdjustmentData = async () => {
    if (!selected对账单号 || subRecords.length === 0) {
      message.warning('请先选择对账单号并加载子维度数据');
      return;
    }

    try {
      setPurchaseAdjustmentQueryLoading(true);
      setActiveTab('采购单金额调整');

      // 从子维度数据中提取所有唯一的牵牛花采购单号
      const 牵牛花采购单号列表 = [...new Set(
        subRecords
          .map(r => r.牵牛花采购单号)
          .filter((v): v is string => !!v && v.trim() !== '')
      )];

      if (牵牛花采购单号列表.length === 0) {
        setPurchaseAdjustmentData([]);
        message.info('该对账单号无采购单金额调整关联数据');
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

      if (allResults.length === 0) {
        setPurchaseAdjustmentData([]);
        message.info('该对账单号无采购单金额调整关联数据');
      } else {
        setPurchaseAdjustmentData(allResults);
      }
    } catch (error: any) {
      message.error(error.message || '查询采购单金额调整失败');
      console.error(error);
    } finally {
      setPurchaseAdjustmentQueryLoading(false);
    }
  };

  // 查询账单手动绑定采购单
  const loadFinanceBillData = async () => {
    if (!selected对账单号 || subRecords.length === 0) {
      message.warning('请先选择对账单号并加载子维度数据');
      return;
    }

    try {
      setFinanceBillQueryLoading(true);
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
        message.info('该对账单号无账单手动绑定采购单关联数据');
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

      if (allResults.length === 0) {
        setFinanceBillData([]);
        message.info('该对账单号无账单手动绑定采购单关联数据');
      } else {
        setFinanceBillData(allResults);
      }
    } catch (error: any) {
      message.error(error.message || '查询账单手动绑定采购单失败');
      console.error(error);
    } finally {
      setFinanceBillQueryLoading(false);
    }
  };

  // 查询非采购单流水记录
  const loadNonPurchaseRecordData = async () => {
    if (!selected对账单号 || subRecords.length === 0) {
      message.warning('请先选择对账单号并加载子维度数据');
      return;
    }

    try {
      setNonPurchaseRecordQueryLoading(true);
      setActiveTab('非采购单流水记录');

      // 从子维度数据中提取所有唯一的交易单号
      const 交易单号列表 = [...new Set(
        subRecords
          .map(r => r.交易单号)
          .filter((v): v is string => !!v && v.trim() !== '')
      )];

      if (交易单号列表.length === 0) {
        setNonPurchaseRecordData([]);
        message.info('该对账单号无非采购单流水记录关联数据');
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

      if (allResults.length === 0) {
        setNonPurchaseRecordData([]);
        message.info('该对账单号无非采购单流水记录关联数据');
      } else {
        setNonPurchaseRecordData(allResults);
      }
    } catch (error: any) {
      message.error(error.message || '查询非采购单流水记录失败');
      console.error(error);
    } finally {
      setNonPurchaseRecordQueryLoading(false);
    }
  };

  // 格式化金额
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-';
    return amount.toFixed(2);
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
            <Title level={4} style={{ margin: 0 }}>账单对账汇总差异</Title>
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
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 600 }}>
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
                  const newTopHeight = Math.max(30, Math.min(80, startTopHeight + deltaPercent));
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
              <>
                {/* 子维度搜索区域 */}
                <div style={{ marginBottom: 16 }}>
                  <Space wrap>
                    <Input
                      placeholder="交易单号"
                      allowClear
                      style={{ width: 180 }}
                      value={subSearch交易单号}
                      onChange={(e) => {
                        setSubSearch交易单号(e.target.value);
                      }}
                      onPressEnter={() => loadSubRecords(selected对账单号)}
                    />
                    <Input
                      placeholder="牵牛花采购单号"
                      allowClear
                      style={{ width: 180 }}
                      value={subSearch牵牛花采购单号}
                      onChange={(e) => {
                        setSubSearch牵牛花采购单号(e.target.value);
                      }}
                      onPressEnter={() => loadSubRecords(selected对账单号)}
                    />
                    <Input
                      placeholder="采购单状态"
                      allowClear
                      style={{ width: 180 }}
                      value={subSearch采购单状态}
                      onChange={(e) => {
                        setSubSearch采购单状态(e.target.value);
                      }}
                      onPressEnter={() => loadSubRecords(selected对账单号)}
                    />
                    <Input
                      placeholder="门店/仓"
                      allowClear
                      style={{ width: 180 }}
                      value={subSearch门店仓}
                      onChange={(e) => {
                        setSubSearch门店仓(e.target.value);
                      }}
                      onPressEnter={() => loadSubRecords(selected对账单号)}
                    />
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={() => loadSubRecords(selected对账单号)}
                    >
                      搜索
                    </Button>
                    <Button
                      onClick={() => {
                        setSubSearch交易单号('');
                        setSubSearch牵牛花采购单号('');
                        setSubSearch采购单状态('');
                        setSubSearch门店仓('');
                        loadSubRecords(selected对账单号);
                      }}
                    >
                      重置
                    </Button>
                  </Space>
                </div>

                {/* 查询关联数据按钮组 */}
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>查询与该对账单有关联的:</span>
                    <Button
                      size="small"
                      onClick={loadPurchaseAdjustmentData}
                      loading={purchaseAdjustmentQueryLoading}
                    >
                      采购单金额调整
                    </Button>
                    <Button
                      size="small"
                      onClick={loadFinanceBillData}
                      loading={financeBillQueryLoading}
                    >
                      账单手动绑定采购单
                    </Button>
                    <Button
                      size="small"
                      onClick={loadNonPurchaseRecordData}
                      loading={nonPurchaseRecordQueryLoading}
                    >
                      非采购单流水记录
                    </Button>
                  </Space>
                </div>

                {/* 标签页表格 */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    type="card"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                    items={[
                      {
                        key: '对账单详细数据',
                        label: '对账单详细数据',
                        children: (
                          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <ResponsiveTable<FinanceReconciliationDifference>
                              tableId="finance-reconciliation-difference-sub"
                              columns={[
                                {
                                  title: '交易单号',
                                  dataIndex: '交易单号',
                                  key: '交易单号',
                                  width: 180,
                                  render: (text: string) => text || '-',
                                },
                                {
                                  title: '牵牛花采购单号',
                                  dataIndex: '牵牛花采购单号',
                                  key: '牵牛花采购单号',
                                  width: 180,
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
                              ]}
                              dataSource={subRecords}
                              rowKey={(record) => `${record.交易单号}_${record.牵牛花采购单号}`}
                              loading={subLoading}
                              isMobile={false}
                              scroll={{ x: 1200, y: subTableScrollY || 150 }}
                              pagination={false}
                              size="small"
                            />
                          </div>
                        ),
                      },
                      {
                        key: '采购单金额调整',
                        label: '采购单金额调整',
                        children: (
                          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {purchaseAdjustmentData.length === 0 && !purchaseAdjustmentQueryLoading ? (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#999',
                                fontSize: 14
                              }}>
                                该对账单号无采购单金额调整关联数据
                              </div>
                            ) : (
                              <ResponsiveTable<PurchaseAmountAdjustment>
                                tableId="purchase-adjustment-data"
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
                                scroll={{ x: 1200, y: subTableScrollY || 150 }}
                                pagination={false}
                                size="small"
                              />
                            )}
                          </div>
                        ),
                      },
                      {
                        key: '账单手动绑定采购单',
                        label: '账单手动绑定采购单',
                        children: (
                          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {financeBillData.length === 0 && !financeBillQueryLoading ? (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#999',
                                fontSize: 14
                              }}>
                                该对账单号无账单手动绑定采购单关联数据
                              </div>
                            ) : (
                              <ResponsiveTable<FinanceBill>
                                tableId="finance-bill-data"
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
                                scroll={{ x: 1200, y: subTableScrollY || 150 }}
                                pagination={false}
                                size="small"
                              />
                            )}
                          </div>
                        ),
                      },
                      {
                        key: '非采购单流水记录',
                        label: '非采购单流水记录',
                        children: (
                          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {nonPurchaseRecordData.length === 0 && !nonPurchaseRecordQueryLoading ? (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#999',
                                fontSize: 14
                              }}>
                                该对账单号无非采购单流水记录关联数据
                              </div>
                            ) : (
                              <ResponsiveTable<NonPurchaseBillRecord>
                                tableId="non-purchase-record-data"
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
                                scroll={{ x: 1500, y: subTableScrollY || 150 }}
                                pagination={false}
                                size="small"
                              />
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              </>
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
    </div>
  );
}

