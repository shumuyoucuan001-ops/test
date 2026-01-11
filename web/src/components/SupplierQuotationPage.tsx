"use client";

import { InventorySummary, SupplierQuotation, supplierQuotationApi, SupplierSkuBinding } from '@/lib/api';
import { DownloadOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Layout,
  message,
  Modal,
  Pagination,
  Popover,
  Segmented,
  Select,
  Space,
  Table,
  Tag
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import ColumnSettings from './ColumnSettings';

const { Search } = Input;

export default function SupplierQuotationPage() {
  // 左栏数据
  const [leftData, setLeftData] = useState<SupplierQuotation[]>([]);
  const [allLeftData, setAllLeftData] = useState<SupplierQuotation[]>([]); // 所有供应商报价数据（用于筛选）
  const [leftLoading, setLeftLoading] = useState(false);
  const [leftTotal, setLeftTotal] = useState(0);
  const [leftCurrentPage, setLeftCurrentPage] = useState(1);
  const [leftPageSize, setLeftPageSize] = useState(10);
  const [leftSearchText, setLeftSearchText] = useState(''); // 保留用于兼容，后续可移除
  // 拆分为多个独立的搜索框
  const [supplierNameSearch, setSupplierNameSearch] = useState(''); // 供应商名称搜索
  const [supplierCodeSearch, setSupplierCodeSearch] = useState(''); // 供应商编码搜索
  const [productNameSearch, setProductNameSearch] = useState(''); // 商品名称搜索
  const [upcCodeSearch, setUpcCodeSearch] = useState(''); // 最小销售规格UPC商品条码搜索

  const [selectedSupplierCodes, setSelectedSupplierCodes] = useState<string[]>([]); // 选中的供应商编码列表
  const [allSupplierCodes, setAllSupplierCodes] = useState<string[]>([]); // 所有供应商编码列表
  const [supplierCodeSearchValue, setSupplierCodeSearchValue] = useState(''); // 供应商编码选择框的搜索输入值

  // 库存汇总搜索
  const [inventorySkuSearch, setInventorySkuSearch] = useState(''); // SKU搜索

  // 右栏数据
  const [rightData, setRightData] = useState<InventorySummary[]>([]); // 所有库存汇总数据（未分页）
  const [rightAllData, setRightAllData] = useState<InventorySummary[]>([]); // 所有库存汇总数据（用于匹配）
  const [rightLoading, setRightLoading] = useState(false);
  const [inventoryType, setInventoryType] = useState<'全部' | '仓店' | '城市'>('全部');
  const [selectedLeftRecord, setSelectedLeftRecord] = useState<SupplierQuotation | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1); // 记录选中的行索引
  const [rightCurrentPage, setRightCurrentPage] = useState(1);
  const [rightPageSize, setRightPageSize] = useState(10);
  const [rightTotal, setRightTotal] = useState(0); // 库存汇总总数
  const [comparisonResultFilter, setComparisonResultFilter] = useState<string[]>([]); // 对比结果筛选
  const [storeNameFilter, setStoreNameFilter] = useState<string>(''); // 门店/仓名称筛选（仅仓店维度，单选）
  const [cityFilter, setCityFilter] = useState<string>(''); // 城市筛选（仅城市维度，单选）
  const [warehousePriorities, setWarehousePriorities] = useState<string[]>([]); // 仓库优先级列表
  const [cities, setCities] = useState<string[]>([]); // 城市列表
  const [upcToSkuMap, setUpcToSkuMap] = useState<Record<string, string[]>>({}); // UPC条码到SKU编码的映射
  const [supplierNameFields, setSupplierNameFields] = useState<string[]>([]); // 需要查询的供应商名称字段（默认空数组）
  const [supplierNameData, setSupplierNameData] = useState<Record<string, string>>({}); // 存储查询到的供应商名称数据
  const [editingRatioQuotation, setEditingRatioQuotation] = useState<string | null>(null); // 当前正在编辑比例的供应商报价（使用"供应商编码_UPC"作为key）
  const [ratioData, setRatioData] = useState<Record<string, { supplierRatio?: number; qianniuhuaRatio?: number }>>({}); // 存储报价比例数据（key为"供应商编码_UPC"）
  const [quotationBindingFlags, setQuotationBindingFlags] = useState<Record<string, boolean>>({}); // 存储哪些供应商报价有绑定标记（key为"供应商编码_供应商商品编码"）
  const [editingSkuQuotation, setEditingSkuQuotation] = useState<string | null>(null); // 当前正在编辑SKU绑定的SKU（使用SKU作为key）
  const [skuBindingInput, setSkuBindingInput] = useState<Record<string, string>>({}); // 存储SKU绑定输入框的值（key为SKU）
  const [skuBindingMap, setSkuBindingMap] = useState<Record<string, string>>({}); // 存储SKU绑定映射（原SKU -> 绑定SKU，key为"供应商编码_供应商商品编码"）
  const [skuBindingFlags, setSkuBindingFlags] = useState<Record<string, boolean>>({}); // 存储哪些SKU有绑定标记（key为原SKU）

  // 下栏数据
  const [bottomData, setBottomData] = useState<SupplierSkuBinding[]>([]);
  const [bottomLoading, setBottomLoading] = useState(false);
  const [editingSkus, setEditingSkus] = useState<Record<string, string>>({});
  const [orderChannel, setOrderChannel] = useState<string | null>(null); // 采购下单渠道
  const [form] = Form.useForm();

  // 其他信息容器相关状态
  const [otherInfoActiveMenu, setOtherInfoActiveMenu] = useState<'sku-binding' | 'product-info'>('sku-binding'); // 默认显示SKU绑定信息
  const [productInfoData, setProductInfoData] = useState<any[]>([]); // 商品信息数据
  const [productInfoLoading, setProductInfoLoading] = useState(false); // 商品信息加载状态
  const [productInfoHiddenColumns, setProductInfoHiddenColumns] = useState<Set<string>>(new Set()); // 商品信息隐藏列
  const [productInfoColumnOrder, setProductInfoColumnOrder] = useState<string[]>([]); // 商品信息列顺序
  const [productInfoColumnSettingsOpen, setProductInfoColumnSettingsOpen] = useState(false); // 商品信息列设置弹窗
  const [otherInfoHeight, setOtherInfoHeight] = useState<number>(300); // 其他信息容器高度
  const [isResizing, setIsResizing] = useState(false); // 是否正在调整高度

  // 左栏列设置相关状态
  const [leftHiddenColumns, setLeftHiddenColumns] = useState<Set<string>>(new Set());
  const [leftColumnOrder, setLeftColumnOrder] = useState<string[]>([]);

  // 表格容器ref，用于计算滚动高度和同步滚动
  const leftTableContainerRef = useRef<HTMLDivElement>(null);
  const rightTableContainerRef = useRef<HTMLDivElement>(null);
  const [leftTableHeight, setLeftTableHeight] = useState<number>(400);
  const [rightTableHeight, setRightTableHeight] = useState<number>(400);
  const isScrolling = useRef(false);
  const [leftColumnSettingsOpen, setLeftColumnSettingsOpen] = useState(false);

  // 其他信息容器高度调整相关
  const otherInfoResizeRef = useRef<HTMLDivElement>(null);
  const resizeStartYRef = useRef<number>(0);
  const resizeStartHeightRef = useRef<number>(300);

  // 用于跟踪正在进行的 loadRightData 请求，避免竞态条件
  const loadRightDataRequestIdRef = useRef<number>(0);

  // 用于跟踪是否正在手动加载数据，避免 useEffect 重复触发
  const isLoadingManuallyRef = useRef<boolean>(false);

  // 用于跟踪用户是否已经点击过搜索按钮（用于判断是否需要提示用户）
  const hasClickedSearchRef = useRef<boolean>(false);

  // 缓存管理相关状态和逻辑
  // 缓存结构：key为供应商编码组合（多个编码用逗号分隔）+ 搜索条件hash，value为缓存数据
  interface CacheEntry<T> {
    data: T;
    timestamp: number; // 缓存创建时间戳
    supplierCodes: string[]; // 供应商编码列表
    searchParams: Record<string, any>; // 搜索参数
  }

  const quotationCacheRef = useRef<Map<string, CacheEntry<SupplierQuotation[]>>>(new Map());
  const inventoryCacheRef = useRef<Map<string, CacheEntry<InventorySummary[]>>>(new Map());
  const upcToSkuCacheRef = useRef<Map<string, CacheEntry<Record<string, string[]>>>>(new Map());

  const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 缓存过期时间：5分钟

  // 生成缓存key：供应商编码排序后的组合 + 搜索条件hash
  const generateCacheKey = (supplierCodes: string[], searchParams: Record<string, any>): string => {
    const sortedCodes = [...supplierCodes].sort().join(',');
    const paramsStr = JSON.stringify(searchParams);
    const paramsHash = paramsStr.split('').reduce((acc, char) => {
      const hash = ((acc << 5) - acc) + char.charCodeAt(0);
      return hash & hash;
    }, 0);
    return `${sortedCodes}_${paramsHash}`;
  };

  // 检查缓存是否过期
  const isCacheExpired = <T,>(entry: CacheEntry<T> | undefined): boolean => {
    if (!entry) return true;
    return Date.now() - entry.timestamp > CACHE_EXPIRY_TIME;
  };

  // 从缓存获取供应商报价数据
  const getQuotationFromCache = (supplierCodes: string[], searchParams: Record<string, any>): SupplierQuotation[] | null => {
    const cacheKey = generateCacheKey(supplierCodes, searchParams);
    const entry = quotationCacheRef.current.get(cacheKey);
    if (!isCacheExpired(entry)) {
      return entry!.data;
    }
    if (entry) {
      quotationCacheRef.current.delete(cacheKey); // 删除过期缓存
    }
    return null;
  };

  // 保存供应商报价数据到缓存
  const setQuotationCache = (supplierCodes: string[], searchParams: Record<string, any>, data: SupplierQuotation[]): void => {
    const cacheKey = generateCacheKey(supplierCodes, searchParams);
    quotationCacheRef.current.set(cacheKey, {
      data,
      timestamp: Date.now(),
      supplierCodes: [...supplierCodes],
      searchParams: { ...searchParams },
    });
  };

  // 从缓存获取库存汇总数据
  const getInventoryFromCache = (supplierCodes: string[], inventoryType: string, storeName?: string, city?: string): InventorySummary[] | null => {
    const cacheKey = generateCacheKey(supplierCodes, { inventoryType, storeName, city });
    const entry = inventoryCacheRef.current.get(cacheKey);
    if (!isCacheExpired(entry)) {
      return entry!.data;
    }
    if (entry) {
      inventoryCacheRef.current.delete(cacheKey); // 删除过期缓存
    }
    return null;
  };

  // 保存库存汇总数据到缓存
  const setInventoryCache = (supplierCodes: string[], inventoryType: string, storeName: string | undefined, city: string | undefined, data: InventorySummary[]): void => {
    const cacheKey = generateCacheKey(supplierCodes, { inventoryType, storeName, city });
    inventoryCacheRef.current.set(cacheKey, {
      data,
      timestamp: Date.now(),
      supplierCodes: [...supplierCodes],
      searchParams: { inventoryType, storeName, city },
    });
  };

  // 从缓存获取UPC到SKU映射
  const getUpcToSkuMapFromCache = (upcCodes: string[]): Record<string, string[]> | null => {
    const sortedUpcCodes = [...upcCodes].sort();
    const cacheKey = sortedUpcCodes.join(',');
    const entry = upcToSkuCacheRef.current.get(cacheKey);
    if (!isCacheExpired(entry)) {
      return entry!.data;
    }
    if (entry) {
      upcToSkuCacheRef.current.delete(cacheKey); // 删除过期缓存
    }
    return null;
  };

  // 保存UPC到SKU映射到缓存
  const setUpcToSkuMapCache = (upcCodes: string[], data: Record<string, string[]>): void => {
    const sortedUpcCodes = [...upcCodes].sort();
    const cacheKey = sortedUpcCodes.join(',');
    upcToSkuCacheRef.current.set(cacheKey, {
      data,
      timestamp: Date.now(),
      supplierCodes: [], // UPC映射不依赖供应商编码
      searchParams: { upcCodes: sortedUpcCodes },
    });
  };

  // 清除指定供应商编码的缓存
  const clearCacheForSupplierCodes = (supplierCodes: string[]): void => {
    const codesSet = new Set(supplierCodes);
    // 清除供应商报价缓存
    for (const [key, entry] of quotationCacheRef.current.entries()) {
      if (entry.supplierCodes.some(code => codesSet.has(code))) {
        quotationCacheRef.current.delete(key);
      }
    }
    // 清除库存汇总缓存（库存汇总可能涉及多个供应商）
    for (const [key, entry] of inventoryCacheRef.current.entries()) {
      if (entry.supplierCodes.some(code => codesSet.has(code))) {
        inventoryCacheRef.current.delete(key);
      }
    }
  };

  // 清除所有缓存
  const clearAllCache = (): void => {
    quotationCacheRef.current.clear();
    inventoryCacheRef.current.clear();
    upcToSkuCacheRef.current.clear();
  };

  // 右栏列设置相关状态
  const [rightHiddenColumns, setRightHiddenColumns] = useState<Set<string>>(new Set());
  const [rightColumnOrder, setRightColumnOrder] = useState<string[]>([]);
  const [rightColumnSettingsOpen, setRightColumnSettingsOpen] = useState(false);

  // 右栏搜索
  const [rightSearchText, setRightSearchText] = useState('');

  // 导出相关状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState<string[]>([]);

  // 手动绑定SKU Modal相关状态
  const [manualBindingModalOpen, setManualBindingModalOpen] = useState(false);
  const [manualBindingRecord, setManualBindingRecord] = useState<{
    record: InventorySummary;
    upc: string;
    matchedQuotations: SupplierQuotation[];
  } | null>(null);
  const [manualBindingSkuInput, setManualBindingSkuInput] = useState('');
  const [manualBindingSelectedQuotation, setManualBindingSelectedQuotation] = useState<SupplierQuotation | null>(null);

  // 合并表格相关状态
  const [selectedMergedRowKey, setSelectedMergedRowKey] = useState<string | null>(null); // 选中的合并表格行key
  const mergedTableContainerRef = useRef<HTMLDivElement>(null);
  const [mergedTableHeight, setMergedTableHeight] = useState<number>(400);

  // 左栏默认显示的字段（按顺序）
  const defaultVisibleColumns = ['序号', '供应商名称', '供应商编码', '商品名称', '商品规格', '供货价格'];

  // 右栏默认显示的字段（全部类型）：SKU, 最低采购价, 对比结果（SKU商品标签、城市、门店/仓库名称默认隐藏）
  const defaultRightVisibleColumns = ['SKU', '最低采购价', '对比结果'];

  // 右栏默认显示的字段（仓店/城市类型）：SKU, 最近采购价, 对比结果（SKU商品标签、城市、门店/仓库名称默认隐藏）
  const defaultRightVisibleColumnsStoreCity = ['SKU', '最近采购价', '对比结果'];

  // 初始化左栏列设置（参考Refund1688FollowUpPage的实现方式）
  useEffect(() => {
    const savedHidden = localStorage.getItem('supplier-quotation-left-hidden-columns');
    if (savedHidden) {
      try {
        const parsed = JSON.parse(savedHidden);
        setLeftHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    }

    const savedOrder = localStorage.getItem('supplier-quotation-left-column-order');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        setLeftColumnOrder(parsed);
      } catch (error) {
        console.error('加载列顺序失败:', error);
      }
    }
  }, []);

  // 如果列顺序为空，初始化默认顺序（仅在首次加载时）
  useEffect(() => {
    if (leftColumnOrder.length === 0) {
      const savedOrder = localStorage.getItem('supplier-quotation-left-column-order');
      if (!savedOrder) {
        // 首次加载，保存默认顺序
        const allColumns = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
        // 先添加默认显示的列（按顺序）
        const defaultOrder = defaultVisibleColumns.filter(key => allColumns.includes(key));
        // 然后添加其他列
        const otherColumns = allColumns.filter(key => !defaultVisibleColumns.includes(key));
        const order = [...defaultOrder, ...otherColumns];
        setLeftColumnOrder(order);
        localStorage.setItem('supplier-quotation-left-column-order', JSON.stringify(order));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 初始化右栏列设置（参考Refund1688FollowUpPage的实现方式）
  useEffect(() => {
    const savedHidden = localStorage.getItem('supplier-quotation-right-hidden-columns');
    if (savedHidden) {
      try {
        const parsed = JSON.parse(savedHidden);
        setRightHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    }

    const savedOrder = localStorage.getItem('supplier-quotation-right-column-order');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        setRightColumnOrder(parsed);
      } catch (error) {
        console.error('加载列顺序失败:', error);
      }
    }
  }, []);

  // 如果列顺序为空，初始化默认顺序（仅在首次加载时）
  useEffect(() => {
    if (rightColumnOrder.length === 0) {
      const savedOrder = localStorage.getItem('supplier-quotation-right-column-order');
      if (!savedOrder) {
        // 首次加载，保存默认顺序
        const allColumns = getRightColumns().map(col => col.key as string).filter(Boolean);
        const defaultVisible = inventoryType === '全部'
          ? defaultRightVisibleColumns
          : defaultRightVisibleColumnsStoreCity;
        // 先添加默认显示的列（按顺序）
        const defaultOrder = defaultVisible.filter(key => allColumns.includes(key));
        // 然后添加其他列（排除对比结果列）
        const otherColumns = allColumns.filter(key => !defaultVisible.includes(key) && key !== '对比结果');
        // 最后添加对比结果列
        const order = [...defaultOrder, ...otherColumns, '对比结果'];
        setRightColumnOrder(order);
        localStorage.setItem('supplier-quotation-right-column-order', JSON.stringify(order));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当 inventoryType 改变时，只过滤掉不存在的列，不自动保存（参考Refund1688FollowUpPage的实现方式）
  useEffect(() => {
    // 只有在已经有保存的列顺序时才需要过滤
    if (rightColumnOrder.length > 0) {
      const allColumnKeys = getRightColumns().map(col => col.key as string).filter(Boolean);
      // 过滤掉不存在的列，保留存在的列的顺序（完全保持用户保存的顺序）
      const validOrder = rightColumnOrder.filter(key => allColumnKeys.includes(key));
      // 添加新出现的列到末尾（排除对比结果列）
      const missingKeys = allColumnKeys.filter(key => !validOrder.includes(key) && key !== '对比结果');
      // 确保对比结果列在最后（如果用户保存的顺序中已经有对比结果列，保持其位置）
      let finalOrder: string[];
      if (validOrder.includes('对比结果')) {
        // 如果用户保存的顺序中已经有对比结果列，保持其位置，只添加缺失的列
        finalOrder = [...validOrder, ...missingKeys];
      } else {
        // 如果用户保存的顺序中没有对比结果列，添加到末尾
        finalOrder = [...validOrder, ...missingKeys, '对比结果'];
      }
      // 只有在顺序确实有变化时才更新（避免不必要的更新）
      if (finalOrder.join(',') !== rightColumnOrder.join(',')) {
        setRightColumnOrder(finalOrder);
        // 不自动保存，只有在用户手动修改时才保存
      }
    }

    // 同步隐藏列设置：移除不存在的列，保留用户的隐藏设置
    if (rightHiddenColumns.size > 0) {
      const allColumnKeys = getRightColumns().map(col => col.key as string).filter(Boolean);
      const validHidden = Array.from(rightHiddenColumns).filter(key => allColumnKeys.includes(key));
      if (validHidden.length !== rightHiddenColumns.size) {
        setRightHiddenColumns(new Set(validHidden));
        // 不自动保存，只有在用户手动修改时才保存
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]); // 当 inventoryType 改变时，只过滤不存在的列，不自动保存

  // 保存左栏列设置
  const saveLeftColumnSettings = () => {
    localStorage.setItem('supplier-quotation-left-hidden-columns', JSON.stringify(Array.from(leftHiddenColumns)));
    localStorage.setItem('supplier-quotation-left-column-order', JSON.stringify(leftColumnOrder));
  };

  // 保存右栏列设置
  const saveRightColumnSettings = () => {
    localStorage.setItem('supplier-quotation-right-hidden-columns', JSON.stringify(Array.from(rightHiddenColumns)));
    localStorage.setItem('supplier-quotation-right-column-order', JSON.stringify(rightColumnOrder));
  };

  // 左栏切换列显示/隐藏
  const handleLeftToggleVisibility = (columnKey: string) => {
    const newHidden = new Set(leftHiddenColumns);
    if (newHidden.has(columnKey)) {
      newHidden.delete(columnKey);
    } else {
      newHidden.add(columnKey);
    }
    setLeftHiddenColumns(newHidden);
    saveLeftColumnSettings();
  };

  // 右栏切换列显示/隐藏
  const handleRightToggleVisibility = (columnKey: string) => {
    const newHidden = new Set(rightHiddenColumns);
    if (newHidden.has(columnKey)) {
      newHidden.delete(columnKey);
    } else {
      newHidden.add(columnKey);
    }
    setRightHiddenColumns(newHidden);
    saveRightColumnSettings();
  };

  // 左栏移动列
  const handleLeftMoveColumn = (columnKey: string, direction: 'up' | 'down') => {
    const currentOrder = leftColumnOrder.length > 0 ? leftColumnOrder : getAllLeftColumns().map(col => col.key as string).filter(Boolean);
    const index = currentOrder.indexOf(columnKey);
    if (index === -1) return;

    const newOrder = [...currentOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setLeftColumnOrder(newOrder);
    saveLeftColumnSettings();
  };

  // 右栏移动列
  const handleRightMoveColumn = (columnKey: string, direction: 'up' | 'down') => {
    const currentOrder = rightColumnOrder.length > 0 ? rightColumnOrder : getRightColumns().map(col => col.key as string).filter(Boolean);
    const index = currentOrder.indexOf(columnKey);
    if (index === -1) return;

    const newOrder = [...currentOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setRightColumnOrder(newOrder);
    saveRightColumnSettings();
  };

  // 左栏直接设置列顺序
  const handleLeftColumnOrderChange = (newOrder: string[]) => {
    setLeftColumnOrder(newOrder);
    saveLeftColumnSettings();
  };

  // 右栏直接设置列顺序
  const handleRightColumnOrderChange = (newOrder: string[]) => {
    setRightColumnOrder(newOrder);
    saveRightColumnSettings();
  };

  // 商品信息列设置相关函数
  const saveProductInfoColumnSettings = () => {
    localStorage.setItem('supplier-quotation-product-info-hidden-columns', JSON.stringify(Array.from(productInfoHiddenColumns)));
    localStorage.setItem('supplier-quotation-product-info-column-order', JSON.stringify(productInfoColumnOrder));
  };

  const handleProductInfoToggleVisibility = (columnKey: string) => {
    const newHidden = new Set(productInfoHiddenColumns);
    if (newHidden.has(columnKey)) {
      newHidden.delete(columnKey);
    } else {
      newHidden.add(columnKey);
    }
    setProductInfoHiddenColumns(newHidden);
    saveProductInfoColumnSettings();
  };

  const handleProductInfoMoveColumn = (columnKey: string, direction: 'up' | 'down') => {
    const currentOrder = productInfoColumnOrder.length > 0 ? productInfoColumnOrder : getAllProductInfoColumns().map(col => col.key as string).filter(Boolean);
    const index = currentOrder.indexOf(columnKey);
    if (index === -1) return;

    const newOrder = [...currentOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setProductInfoColumnOrder(newOrder);
    saveProductInfoColumnSettings();
  };

  const handleProductInfoColumnOrderChange = (newOrder: string[]) => {
    setProductInfoColumnOrder(newOrder);
    saveProductInfoColumnSettings();
  };

  // 获取商品信息所有列定义
  const getAllProductInfoColumns = (): ColumnType<any>[] => {
    return [
      { title: 'SPU编码', dataIndex: 'SPU编码', key: 'SPU编码', width: 150 },
      { title: '商品名称', dataIndex: '商品名称', key: '商品名称', width: 200, ellipsis: true },
      { title: 'SKU编码', dataIndex: 'SKU编码', key: 'SKU编码', width: 200 },
      { title: '采购规格', dataIndex: '采购规格', key: '采购规格', width: 150, ellipsis: true },
      { title: '基础单位', dataIndex: '基础单位', key: '基础单位', width: 100 },
      { title: '供货关系编码', dataIndex: '供货关系编码', key: '供货关系编码', width: 150 },
      { title: '采购单位', dataIndex: '采购单位', key: '采购单位', width: 100 },
      { title: '转换比例', dataIndex: '转换比例', key: '转换比例', width: 100 },
      { title: '供应商编码', dataIndex: '供应商编码', key: '供应商编码', width: 150 },
      { title: '供应商名称', dataIndex: '供应商名称', key: '供应商名称', width: 150, ellipsis: true },
      { title: '采购下单渠道', dataIndex: '采购下单渠道', key: '采购下单渠道', width: 150, ellipsis: true },
      { title: '渠道店铺', dataIndex: '渠道店铺', key: '渠道店铺', width: 150, ellipsis: true },
      { title: '供应商到货天数', dataIndex: '供应商到货天数', key: '供应商到货天数', width: 130 },
      { title: '最小起订量', dataIndex: '最小起订量', key: '最小起订量', width: 100 },
      { title: '是否默认供货关系', dataIndex: '是否默认供货关系', key: '是否默认供货关系', width: 150 },
      {
        title: '采购价（元）',
        dataIndex: '采购价（元）',
        key: '采购价（元）',
        width: 120,
        render: (text: any) => text !== null && text !== undefined ? `¥${Number(text).toFixed(2)}` : '-'
      },
      { title: '结算方式', dataIndex: '结算方式', key: '结算方式', width: 120, ellipsis: true },
      { title: '付款方式', dataIndex: '付款方式', key: '付款方式', width: 120, ellipsis: true },
      { title: '1688商品offerid', dataIndex: '1688商品offerid', key: '1688商品offerid', width: 150, ellipsis: true },
      { title: '供应商商品 编码', dataIndex: '供应商商品 编码', key: '供应商商品 编码', width: 180, ellipsis: true },
      {
        title: '下单比例-供应商商品',
        dataIndex: '下单比例-供应商商品',
        key: '下单比例-供应商商品',
        width: 160,
        render: (text: any) => text !== null && text !== undefined ? Number(text).toFixed(2) : '-'
      },
      {
        title: '下单比例-牵牛花商品',
        dataIndex: '下单比例-牵牛花商品',
        key: '下单比例-牵牛花商品',
        width: 160,
        render: (text: any) => text !== null && text !== undefined ? Number(text).toFixed(2) : '-'
      },
      { title: '供应商商品 名称', dataIndex: '供应商商品 名称', key: '供应商商品 名称', width: 200, ellipsis: true },
      { title: '供应商商品 规格', dataIndex: '供应商商品 规格', key: '供应商商品 规格', width: 150, ellipsis: true },
      { title: '供应商商品 备注', dataIndex: '供应商商品 备注', key: '供应商商品 备注', width: 200, ellipsis: true },
      { title: '供应商商品 链接', dataIndex: '供应商商品 链接', key: '供应商商品 链接', width: 200, ellipsis: true },
      { title: '1688下单方式', dataIndex: '1688下单方式', key: '1688下单方式', width: 120, ellipsis: true },
      {
        title: '数据更新时间',
        dataIndex: '数据更新时间',
        key: '数据更新时间',
        width: 180,
        render: (text: string | Date) => {
          if (!text) return '-';
          try {
            const date = typeof text === 'string' ? new Date(text) : text;
            const formatted = date.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            return formatted || String(text);
          } catch {
            return String(text);
          }
        },
      },
    ];
  };

  // 获取过滤后的商品信息列
  const getFilteredProductInfoColumns = (): ColumnType<any>[] => {
    const allColumns = getAllProductInfoColumns();
    let currentOrder: string[];
    if (productInfoColumnOrder.length > 0) {
      currentOrder = productInfoColumnOrder;
    } else {
      const savedOrder = localStorage.getItem('supplier-quotation-product-info-column-order');
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          currentOrder = parsed;
        } catch {
          currentOrder = allColumns.map(col => col.key as string).filter(Boolean);
        }
      } else {
        currentOrder = allColumns.map(col => col.key as string).filter(Boolean);
      }
    }

    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter((col): col is ColumnType<any> => col !== undefined);

    let hiddenSet: Set<string>;
    if (productInfoHiddenColumns.size > 0) {
      hiddenSet = productInfoHiddenColumns;
    } else {
      const savedHidden = localStorage.getItem('supplier-quotation-product-info-hidden-columns');
      if (savedHidden) {
        try {
          const parsed = JSON.parse(savedHidden);
          hiddenSet = new Set(parsed);
        } catch {
          hiddenSet = new Set();
        }
      } else {
        hiddenSet = new Set();
      }
    }

    return orderedColumns.filter(col => !hiddenSet.has(col.key as string));
  };

  // 导出商品信息数据
  const handleExportProductInfo = () => {
    if (productInfoData.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    try {
      const columns = getFilteredProductInfoColumns();
      const headers = columns.map(col => col.title as string);
      const rows = productInfoData.map(item => {
        return columns.map(col => {
          const key = col.dataIndex as string;
          const value = (item as any)[key];
          if (col.render && value !== null && value !== undefined) {
            if (key === '采购价（元）') {
              return value ? `¥${Number(value).toFixed(2)}` : '-';
            } else if (key === '下单比例-供应商商品' || key === '下单比例-牵牛花商品') {
              return value !== null && value !== undefined ? Number(value).toFixed(2) : '-';
            } else if (key === '数据更新时间') {
              if (!value) return '-';
              try {
                const date = typeof value === 'string' ? new Date(value) : value;
                return date.toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
              } catch {
                return String(value);
              }
            }
          }
          return value ?? '';
        });
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, '商品信息');
      XLSX.writeFile(wb, `商品信息_${new Date().toISOString().split('T')[0]}.xlsx`);
      message.success(`成功导出 ${productInfoData.length} 条数据`);
    } catch (error: any) {
      console.error('导出商品信息失败:', error);
      message.error(`导出失败: ${error?.message || '未知错误'}`);
    }
  };

  // 获取左栏所有列定义（按默认显示顺序）
  const getAllLeftColumns = (): ColumnType<SupplierQuotation>[] => {
    return [
      {
        title: '序号',
        dataIndex: '序号',
        key: '序号',
        width: 80,
        fixed: 'left' as const,
      },
      {
        title: '供应商名称',
        dataIndex: '供应商名称',
        key: '供应商名称',
        width: 150,
        ellipsis: true,
      },
      {
        title: '供应商编码',
        dataIndex: '供应商编码',
        key: '供应商编码',
        width: 120,
      },
      {
        title: '商品名称',
        dataIndex: '商品名称',
        key: '商品名称',
        width: 200,
        ellipsis: true,
      },
      {
        title: '商品规格',
        dataIndex: '商品规格',
        key: '商品规格',
        width: 150,
        ellipsis: true,
      },
      {
        title: '供货价格',
        dataIndex: '供货价格',
        key: '供货价格',
        width: 120,
        render: (text: number, record: SupplierQuotation) => {
          // 优先使用计算后供货价格，如果为NULL则使用原供货价格
          const displayPrice = record.计算后供货价格 !== undefined && record.计算后供货价格 !== null
            ? record.计算后供货价格
            : text;

          // 生成唯一标识符：供应商编码_UPC
          const quotationKey = record.供应商编码 && record.最小销售规格UPC商品条码
            ? `${record.供应商编码}_${record.最小销售规格UPC商品条码}`
            : null;

          // 检查是否有绑定标记（使用供应商编码_供应商商品编码作为key）
          const bindingKey = record.供应商编码 && record.供应商商品编码
            ? `${record.供应商编码}_${record.供应商商品编码}`
            : null;
          const hasBinding = bindingKey ? quotationBindingFlags[bindingKey] : false;

          // 检查是否正在编辑
          const isEditing = quotationKey ? editingRatioQuotation === quotationKey : false;

          // 获取当前比例数据
          const currentRatio = quotationKey ? (ratioData[quotationKey] || {}) : {};

          // 报价比例设置弹框内容
          const ratioContent = (
            <div style={{ padding: 8, minWidth: 200 }}>
              <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                设置报价比例（至少一边为1）
              </div>
              <Space>
                <Input
                  type="number"
                  placeholder="供应商"
                  value={currentRatio.supplierRatio}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    if (quotationKey) {
                      setRatioData({
                        ...ratioData,
                        [quotationKey]: {
                          ...currentRatio,
                          supplierRatio: value,
                        },
                      });
                    }
                  }}
                  style={{ width: 80 }}
                  min={0}
                  step={0.01}
                />
                <span>:</span>
                <Input
                  type="number"
                  placeholder="牵牛花"
                  value={currentRatio.qianniuhuaRatio}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    if (quotationKey) {
                      setRatioData({
                        ...ratioData,
                        [quotationKey]: {
                          ...currentRatio,
                          qianniuhuaRatio: value,
                        },
                      });
                    }
                  }}
                  style={{ width: 80 }}
                  min={0}
                  step={0.01}
                />
              </Space>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <Button
                  size="small"
                  danger
                  onClick={async () => {
                    if (!record.供应商编码 || !record.最小销售规格UPC商品条码) {
                      message.error('未找到匹配的供应商报价数据');
                      return;
                    }

                    try {
                      await supplierQuotationApi.clearPriceRatios({
                        supplierCode: record.供应商编码,
                        upcCode: record.最小销售规格UPC商品条码,
                      });
                      message.success('清空成功');

                      // 清除相关供应商编码的缓存，因为报价比例会影响计算后供货价格
                      if (record.供应商编码) {
                        clearCacheForSupplierCodes([record.供应商编码]);
                        console.log('[缓存] 已清除供应商编码的缓存:', record.供应商编码);
                      }

                      // 清空本地数据
                      if (quotationKey) {
                        const updatedRatioData = { ...ratioData };
                        updatedRatioData[quotationKey] = {
                          supplierRatio: undefined,
                          qianniuhuaRatio: undefined,
                        };
                        setRatioData(updatedRatioData);
                      }
                      setEditingRatioQuotation(null);
                      // 重新加载绑定标记和数据（强制刷新，跳过缓存）
                      // 先强制刷新加载所有数据
                      await loadAllLeftData([record.供应商编码], true, true);
                      // 等待状态更新，然后重新加载当前页数据
                      await loadLeftData();
                      // 获取刷新后的数据（使用最新的allLeftData或leftData）
                      const refreshedDataSource = allLeftData.length > 0 ? allLeftData : leftData;
                      if (rightAllData.length > 0 && refreshedDataSource.length > 0) {
                        await loadQuotationBindingFlags(rightAllData, refreshedDataSource);
                        // 如果库存汇总数据存在，也需要刷新（因为对比结果可能受影响，强制刷新，跳过缓存）
                        if (selectedSupplierCodes.length > 0 && refreshedDataSource.length > 0) {
                          await loadRightData(refreshedDataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                        }
                      }
                    } catch (error: any) {
                      console.error('清空报价比例失败:', error);
                      message.error(`清空失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
                    }
                  }}
                >
                  清空
                </Button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingRatioQuotation(null);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    onClick={async () => {
                      const supplierRatio = currentRatio.supplierRatio;
                      const qianniuhuaRatio = currentRatio.qianniuhuaRatio;

                      // 验证：至少有一边为1
                      if ((supplierRatio !== 1 && qianniuhuaRatio !== 1) ||
                        (supplierRatio === undefined && qianniuhuaRatio === undefined) ||
                        (supplierRatio === undefined && qianniuhuaRatio !== 1) ||
                        (qianniuhuaRatio === undefined && supplierRatio !== 1)) {
                        message.error('左右框中必须有一边为1');
                        return;
                      }

                      if (!record.供应商编码 || !record.最小销售规格UPC商品条码) {
                        message.error('未找到匹配的供应商报价数据');
                        return;
                      }

                      try {
                        await supplierQuotationApi.updatePriceRatios({
                          supplierCode: record.供应商编码,
                          upcCode: record.最小销售规格UPC商品条码,
                          supplierRatio: supplierRatio || 1,
                          qianniuhuaRatio: qianniuhuaRatio || 1,
                        });
                        message.success('保存成功');

                        // 清除相关供应商编码的缓存，因为报价比例会影响计算后供货价格
                        if (record.供应商编码) {
                          clearCacheForSupplierCodes([record.供应商编码]);
                          console.log('[缓存] 已清除供应商编码的缓存:', record.供应商编码);
                        }

                        // 更新本地数据
                        if (quotationKey) {
                          const updatedRatioData = { ...ratioData };
                          updatedRatioData[quotationKey] = {
                            supplierRatio: supplierRatio || 1,
                            qianniuhuaRatio: qianniuhuaRatio || 1,
                          };
                          setRatioData(updatedRatioData);
                        }
                        setEditingRatioQuotation(null);
                        // 重新加载绑定标记和数据（强制刷新，跳过缓存）
                        // 先强制刷新加载所有数据
                        await loadAllLeftData([record.供应商编码], true, true);
                        // 等待状态更新，然后重新加载当前页数据
                        await loadLeftData();
                        // 获取刷新后的数据
                        const refreshedDataSource = allLeftData.length > 0 ? allLeftData : leftData;
                        if (rightAllData.length > 0 && refreshedDataSource.length > 0) {
                          await loadQuotationBindingFlags(rightAllData, refreshedDataSource);
                          // 如果库存汇总数据存在，也需要刷新（因为对比结果可能受影响，强制刷新，跳过缓存）
                          if (selectedSupplierCodes.length > 0 && refreshedDataSource.length > 0) {
                            await loadRightData(refreshedDataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                          }
                        }
                      } catch (error: any) {
                        console.error('保存报价比例失败:', error);
                        message.error(`保存失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
                      }
                    }}
                  >
                    保存
                  </Button>
                </div>
              </div>
            </div>
          );

          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Popover
                content={ratioContent}
                title="报价比例设置"
                trigger="click"
                open={isEditing}
                onOpenChange={(open) => {
                  if (open) {
                    setEditingRatioQuotation(quotationKey);
                    // 加载当前比例数据
                    if (quotationKey && record.供应商编码 && record.最小销售规格UPC商品条码) {
                      loadPriceRatios(record.供应商编码, record.最小销售规格UPC商品条码, quotationKey);
                    }
                  } else {
                    setEditingRatioQuotation(null);
                  }
                }}
                placement="top"
              >
                <span style={{ cursor: 'pointer', color: '#FF6A00', display: 'inline-flex', alignItems: 'center' }}>
                  {displayPrice !== undefined && displayPrice !== null ? `¥${Number(displayPrice).toFixed(4)}` : '-'}
                </span>
              </Popover>
              {hasBinding && (
                <Tag color="blue" style={{ margin: 0 }}>转</Tag>
              )}
            </span>
          );
        },
      },
      {
        title: '最小销售单位',
        dataIndex: '最小销售单位',
        key: '最小销售单位',
        width: 120,
      },
      {
        title: '商品型号',
        dataIndex: '商品型号',
        key: '商品型号',
        width: 120,
      },
      {
        title: '供应商商品编码',
        dataIndex: '供应商商品编码',
        key: '供应商商品编码',
        width: 150,
      },
      {
        title: '最小销售规格UPC商品条码',
        dataIndex: '最小销售规格UPC商品条码',
        key: '最小销售规格UPC商品条码',
        width: 200,
      },
      {
        title: '中包或整件销售规格条码',
        dataIndex: '中包或整件销售规格条码',
        key: '中包或整件销售规格条码',
        width: 200,
      },
      {
        title: '供应商商品备注',
        dataIndex: '供应商商品备注',
        key: '供应商商品备注',
        width: 200,
        ellipsis: true,
      },
      {
        title: '数据更新时间',
        dataIndex: '数据更新时间',
        key: '数据更新时间',
        width: 180,
        render: (text: string | Date) => {
          if (!text) return '-';
          try {
            const date = typeof text === 'string' ? new Date(text) : text;
            const formatted = date.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            return formatted || String(text);
          } catch {
            return String(text);
          }
        },
      },
    ];
  };

  // 获取过滤后的左栏列
  const getFilteredLeftColumns = (): ColumnType<SupplierQuotation>[] => {
    const allColumns = getAllLeftColumns();

    // 如果状态为空，尝试从 localStorage 读取（参考Refund1688FollowUpPage的实现方式）
    let currentOrder: string[];
    if (leftColumnOrder.length > 0) {
      currentOrder = leftColumnOrder;
    } else {
      // 尝试从 localStorage 读取
      const savedOrder = localStorage.getItem('supplier-quotation-left-column-order');
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          currentOrder = parsed;
        } catch (error) {
          // 如果解析失败，使用默认顺序
          currentOrder = allColumns.map(col => col.key as string).filter(Boolean);
        }
      } else {
        // 如果没有保存的顺序，使用默认顺序
        currentOrder = allColumns.map(col => col.key as string).filter(Boolean);
      }
    }

    // 按顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter((col): col is ColumnType<SupplierQuotation> => col !== undefined);

    // 获取隐藏列（如果状态为空，尝试从 localStorage 读取）
    let hiddenSet: Set<string>;
    if (leftHiddenColumns.size > 0) {
      hiddenSet = leftHiddenColumns;
    } else {
      const savedHidden = localStorage.getItem('supplier-quotation-left-hidden-columns');
      if (savedHidden) {
        try {
          const parsed = JSON.parse(savedHidden);
          hiddenSet = new Set(parsed);
        } catch (error) {
          hiddenSet = new Set();
        }
      } else {
        hiddenSet = new Set();
      }
    }

    // 过滤隐藏的列
    return orderedColumns.filter(col => !hiddenSet.has(col.key as string));
  };

  // 获取过滤后的右栏列
  const getFilteredRightColumns = (): ColumnType<InventorySummary>[] => {
    const allColumns = getRightColumns();

    // 供应商名称相关列
    const supplierNameKeys = ['供应商名称', '供应商名称(最低价)', '供应商名称(最近时间)'];
    const selectedSupplierNameKeys = supplierNameKeys.filter(key => supplierNameFields.includes(key));

    // 如果状态为空，尝试从 localStorage 读取（参考Refund1688FollowUpPage的实现方式）
    let currentOrder: string[];
    if (rightColumnOrder.length > 0) {
      currentOrder = [...rightColumnOrder];
    } else {
      // 尝试从 localStorage 读取
      const savedOrder = localStorage.getItem('supplier-quotation-right-column-order');
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          currentOrder = parsed;
        } catch (error) {
          // 如果解析失败，使用默认顺序
          currentOrder = allColumns.map(col => col.key as string).filter(Boolean);
        }
      } else {
        // 如果没有保存的顺序，使用默认顺序
        currentOrder = allColumns.map(col => col.key as string).filter(Boolean);
      }
    }
    const allColumnKeys = allColumns.map(col => col.key as string).filter(Boolean);

    // 确保所有选择的供应商名称列都在顺序中
    selectedSupplierNameKeys.forEach(key => {
      if (!currentOrder.includes(key) && allColumnKeys.includes(key)) {
        // 如果列不在顺序中，插入到SKU商品标签列之后
        const skuTagIndex = currentOrder.indexOf('SKU商品标签');
        if (skuTagIndex >= 0) {
          currentOrder.splice(skuTagIndex + 1, 0, key);
        } else {
          // 如果没有SKU商品标签列，添加到对比结果列之前
          const comparisonIndex = currentOrder.indexOf('对比结果');
          if (comparisonIndex >= 0) {
            currentOrder.splice(comparisonIndex, 0, key);
          } else {
            currentOrder.push(key);
          }
        }
      }
    });

    // 按顺序排列
    let orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter((col): col is ColumnType<InventorySummary> => col !== undefined);

    // 获取隐藏列（如果状态为空，尝试从 localStorage 读取）
    let hiddenSet: Set<string>;
    if (rightHiddenColumns.size > 0) {
      hiddenSet = rightHiddenColumns;
    } else {
      const savedHidden = localStorage.getItem('supplier-quotation-right-hidden-columns');
      if (savedHidden) {
        try {
          const parsed = JSON.parse(savedHidden);
          hiddenSet = new Set(parsed);
        } catch (error) {
          hiddenSet = new Set();
        }
      } else {
        hiddenSet = new Set();
      }
    }

    // 过滤隐藏的列，但供应商名称相关列不能隐藏（如果已选择）
    orderedColumns = orderedColumns.filter(col => {
      const key = col.key as string;
      // 如果列是供应商名称相关列，且已选择，则始终显示
      if (supplierNameKeys.includes(key) && supplierNameFields.includes(key)) {
        return true;
      }
      // 其他列按隐藏列表过滤
      return !hiddenSet.has(key);
    });

    // 确保对比结果列始终在最后（如果存在）
    const comparisonResultCol = orderedColumns.find(col => col.key === '对比结果');
    if (comparisonResultCol) {
      orderedColumns = orderedColumns.filter(col => col.key !== '对比结果');
      orderedColumns.push(comparisonResultCol);
    }

    return orderedColumns;
  };

  // 对比结果的所有可能值（提前定义，供getRightColumns使用）
  const comparisonResultOptions = [
    { label: '价格优势', value: '价格优势', color: 'green' },
    { label: '价格偏高', value: '价格偏高', color: 'red' },
    { label: '价格相同', value: '价格相同', color: 'default' },
    { label: '无供货价信息', value: '无供货价信息', color: 'orange' },
    { label: '无采购价信息', value: '无采购价信息', color: 'orange' },
    { label: '无匹配数据', value: '无匹配数据', color: 'default' },
  ];

  // 获取右栏列定义（按默认显示顺序：城市/门店/仓库名称（根据维度）、SKU、最低采购价/最近采购价、SKU商品标签、对比结果，然后是其他列）
  const getRightColumns = (): ColumnType<InventorySummary>[] => {
    const columns: ColumnType<InventorySummary>[] = [];

    // 根据维度添加城市或门店/仓库名称列（默认隐藏，排在第一列）
    if (inventoryType === '城市') {
      columns.push({
        title: '城市',
        dataIndex: '城市',
        key: '城市',
        width: 120,
        fixed: 'left' as const,
      });
    } else if (inventoryType === '仓店') {
      columns.push({
        title: '门店/仓库名称',
        dataIndex: '门店/仓库名称',
        key: '门店/仓库名称',
        width: 150,
        fixed: 'left' as const,
      });
    }

    // SKU列
    columns.push({
      title: 'SKU',
      dataIndex: 'SKU',
      key: 'SKU',
      width: 120,
      fixed: 'left' as const,
      render: (text: string, record: InventorySummary, index?: number) => {
        // 处理SKU值：可能是"-"、undefined、null或空字符串
        // 注意：text可能是undefined、null、空字符串或"-"
        const textStr = text === null || text === undefined ? '' : String(text);
        const skuText = textStr === '-' || textStr.trim() === '' ? '-' : textStr.trim();
        const isSkuEmpty = skuText === '-';

        // 使用唯一标识符作为key：如果有SKU则用SKU，否则用UPC，如果都没有则用索引+UPC组合
        // 确保uniqueKey稳定，即使SKU为"-"也能正确工作
        const skuValue = !isSkuEmpty ? skuText : null;
        const upcValue = record.UPC && String(record.UPC).trim() !== '' ? String(record.UPC).trim() : null;
        const uniqueKey = skuValue || upcValue || `row-${index || 0}-${upcValue || ''}`;
        const isEditing = editingSkuQuotation === uniqueKey;
        const currentSkuInput = skuBindingInput[uniqueKey] || '';

        // 调试日志：检查render函数是否被调用（仅当SKU为空时输出）
        if (isSkuEmpty) {
          console.log('[SKU绑定] Render函数被调用，SKU为空或"-"', {
            text,
            textStr,
            skuText,
            isSkuEmpty,
            recordUPC: record.UPC,
            uniqueKey,
            hasRecord: !!record,
          });
        }

        // 找到匹配的供应商报价（通过UPC条码和SKU）
        let matchedQuotation: SupplierQuotation | null = null;
        let supplierCode: string | undefined = undefined;
        let supplierProductCode: string | undefined = undefined;

        // 方法1：通过SKU找到对应的UPC条码，再找到供应商报价（只有当SKU不为空时才执行）
        if (!isSkuEmpty && skuText && upcToSkuMap) {
          Object.keys(upcToSkuMap).forEach(upc => {
            if (upcToSkuMap[upc].includes(skuText)) {
              const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
              const quotation = dataSource.find(q => q.最小销售规格UPC商品条码 === upc);
              if (quotation && quotation.供应商编码 && quotation.供应商商品编码) {
                matchedQuotation = quotation;
                supplierCode = quotation.供应商编码;
                supplierProductCode = quotation.供应商商品编码;
              }
            }
          });
        }

        // 方法2：即使SKU为空（显示"-"），也可以通过UPC直接匹配供应商报价
        // 处理UPC字段可能包含多个值（用逗号分隔）的情况
        if (!matchedQuotation && record.UPC) {
          const upcStr = record.UPC ? String(record.UPC).trim() : '';
          if (upcStr !== '') {
            const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
            // 处理UPC字段可能包含多个值（用逗号分隔）的情况
            const upcArray = upcStr.split(',').map(u => u.trim()).filter(u => u !== '');

            // 调试日志：检查数据源和UPC（仅当SKU为空时输出）
            if (isSkuEmpty) {
              console.log('[SKU绑定] 尝试通过UPC匹配，数据源数量:', dataSource.length, 'UPC:', upcArray, 'text:', text, 'isSkuEmpty:', isSkuEmpty);
            }

            // 遍历所有UPC值，找到第一个匹配的供应商报价
            for (const recordUpc of upcArray) {
              const quotation = dataSource.find(q => {
                if (!q.最小销售规格UPC商品条码) return false;
                const qUpc = String(q.最小销售规格UPC商品条码).trim();
                return qUpc === recordUpc;
              });

              if (quotation && quotation.供应商编码 && quotation.供应商商品编码) {
                matchedQuotation = quotation;
                supplierCode = quotation.供应商编码;
                supplierProductCode = quotation.供应商商品编码;

                // 调试日志：匹配成功（仅当SKU为空时输出）
                if (isSkuEmpty) {
                  console.log('[SKU绑定] 通过UPC匹配成功:', {
                    supplierCode,
                    supplierProductCode,
                    upc: recordUpc,
                    matchedUpc: recordUpc,
                  });
                }
                break; // 找到第一个匹配的就退出
              }
            }

            // 调试日志：匹配失败（仅当SKU为空时输出）
            if (!matchedQuotation && isSkuEmpty) {
              console.log('[SKU绑定] 通过UPC匹配失败，未找到匹配的供应商报价，UPC:', upcArray, '数据源数量:', dataSource.length);
            }
          }
        }

        // 调试日志：检查最终匹配情况（仅当SKU为空时输出）
        if (isSkuEmpty) {
          console.log('[SKU绑定] SKU为空或"-"，最终匹配情况:', {
            text,
            skuText,
            isSkuEmpty,
            recordUpc: record.UPC,
            hasMatchedQuotation: !!matchedQuotation,
            supplierCode,
            supplierProductCode,
            uniqueKey,
            dataSourceLength: (allLeftData.length > 0 ? allLeftData : leftData).length,
          });
        }

        // 检查是否有SKU绑定
        const bindingKey = supplierCode && supplierProductCode ? `${supplierCode}_${supplierProductCode}` : null;
        const boundSku = bindingKey ? skuBindingMap[bindingKey] : null;
        // 如果有绑定SKU，直接显示"绑"标签；否则检查原SKU是否在绑定标记中
        const hasBinding = boundSku ? true : (skuText && !isSkuEmpty ? (skuBindingFlags[skuText] || false) : false);

        // 显示绑定的SKU，如果没有绑定则显示原SKU
        const displaySku = boundSku || skuText || '-';

        // 优先检查：如果通过最小销售规格UPC商品条码去获取'商品主档销售规格'的'SKU编码'时没有获取到数据，显示"绑定SKU"按钮
        const upcStr = record.UPC ? String(record.UPC).trim() : '';

        // 处理UPC字段可能包含多个值（用逗号分隔）的情况
        // 将UPC字符串拆分为数组（去除空格）
        const upcArray = upcStr !== '' ? upcStr.split(',').map(u => u.trim()).filter(u => u !== '') : [];

        // 检查该UPC（或多个UPC）在upcToSkuMap中是否有对应的SKU编码（通过UPC获取商品主档销售规格的SKU编码）
        // 如果所有UPC都没有获取到数据（upcToSkuMap中没有任何一个UPC，或者所有UPC对应的数组都为空），则显示"绑定SKU"按钮
        let hasUpcToSkuMapping = false;
        if (upcArray.length > 0 && upcToSkuMap) {
          // 检查是否有任何一个UPC在upcToSkuMap中有映射
          hasUpcToSkuMapping = upcArray.some(upc => {
            const skuCodesFromUpc = upcToSkuMap[upc];
            return skuCodesFromUpc && Array.isArray(skuCodesFromUpc) && skuCodesFromUpc.length > 0;
          });
        }

        // 添加详细的调试日志
        console.log('[SKU绑定] 检查绑定SKU按钮显示条件', {
          text,
          textStr: typeof text === 'string' ? text : String(text),
          skuText,
          isSkuEmpty,
          recordUPC: record.UPC,
          upcStr,
          upcArray,
          upcArrayLength: upcArray.length,
          hasUpcToSkuMapping,
          hasMatchedQuotation: !!matchedQuotation,
          matchedQuotationUpc: matchedQuotation?.最小销售规格UPC商品条码,
          upcToSkuMapKeys: upcToSkuMap ? Object.keys(upcToSkuMap).length : 0,
          shouldShowButton: upcArray.length > 0 && !hasUpcToSkuMapping && !!matchedQuotation,
        });

        // 如果UPC不为空，且通过UPC获取商品主档销售规格的SKU编码时没有获取到数据，且已找到匹配的供应商报价，显示"绑定SKU"按钮
        // 使用已经匹配到的matchedQuotation作为供应商报价数据（不需要再去查找）
        if (upcArray.length > 0 && !hasUpcToSkuMapping && matchedQuotation && supplierCode && supplierProductCode) {
          // 使用匹配到的供应商报价的UPC
          const quotationToUse = matchedQuotation; // 类型保护：此时matchedQuotation一定不为null
          const upcToUse = quotationToUse.最小销售规格UPC商品条码 ? String(quotationToUse.最小销售规格UPC商品条码).trim() : upcArray[0];

          console.log('[SKU绑定] 通过UPC未获取到SKU编码，显示绑定SKU按钮', {
            text,
            skuText,
            isSkuEmpty,
            recordUPC: record.UPC,
            upcStr,
            upcArray,
            matchedQuotation: quotationToUse,
            supplierCode,
            supplierProductCode,
            upcToUse,
          });

          return (
            <div
              data-sku-column="true"
              onClick={(e) => {
                // 阻止事件冒泡，避免触发行点击事件
                e.stopPropagation();
                console.log('[SKU绑定] 点击绑定SKU区域', {
                  record,
                  matchedQuotation: quotationToUse,
                  supplierCode,
                  supplierProductCode,
                  upc: upcToUse,
                });
                // 打开手动绑定SKU Modal（与点击匹配出数据的SKU时的同款弹框）
                // 直接使用已经匹配到的matchedQuotation作为供应商报价数据
                setManualBindingRecord({
                  record,
                  upc: upcToUse,
                  matchedQuotations: [quotationToUse], // 使用已匹配的供应商报价
                });
                setManualBindingSkuInput('');
                setManualBindingSelectedQuotation(quotationToUse); // 直接使用已匹配的供应商报价
                setManualBindingModalOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <Tag color="orange" style={{ margin: 0, cursor: 'pointer' }}>
                绑定SKU
              </Tag>
            </div>
          );
        }

        // 如果仍然没有找到匹配的供应商报价，检查是否可以显示可点击的元素
        if (!matchedQuotation || !supplierCode || !supplierProductCode) {
          // 调试日志：没有找到匹配的供应商报价
          console.log('[SKU绑定] 没有找到匹配的供应商报价', {
            isSkuEmpty,
            hasUPC: !!record.UPC,
            upcValue: record.UPC,
            hasBinding,
            boundSku,
          });

          // 如果有绑定SKU，显示绑定信息（即使没有匹配到供应商报价）
          if (hasBinding && boundSku) {
            return (
              <div
                data-sku-column="true"
                onClick={(e) => e.stopPropagation()}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {boundSku}
                  <Tag color="green" style={{ margin: 0 }}>绑</Tag>
                </span>
              </div>
            );
          }

          // 如果没有UPC或SKU，显示普通文本（不可点击）
          console.log('[SKU绑定] 没有匹配且无UPC，显示普通文本', { text, skuText, isSkuEmpty, recordUPC: record.UPC });
          return <span>{skuText || '-'}</span>;
        }

        // SKU绑定弹框内容
        const skuBindingContent = (
          <div style={{ padding: 8, minWidth: 200 }}>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
              手动绑定SKU
            </div>
            <Input
              placeholder="请输入SKU"
              value={currentSkuInput}
              onChange={(e) => {
                setSkuBindingInput({
                  ...skuBindingInput,
                  [uniqueKey]: e.target.value,
                });
              }}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button
                size="small"
                danger
                onClick={async () => {
                  if (!supplierCode || !supplierProductCode) {
                    return;
                  }

                  try {
                    // 清空SKU绑定（通过保存空字符串）
                    await supplierQuotationApi.updateSkuBinding({
                      supplierCode: supplierCode,
                      supplierProductCode: supplierProductCode,
                      sku: '',
                    });
                    message.success('清空成功');

                    // 清除相关供应商编码的缓存，因为SKU绑定会影响匹配
                    if (supplierCode) {
                      clearCacheForSupplierCodes([supplierCode]);
                      console.log('[缓存] 已清除供应商编码的缓存:', supplierCode);
                    }

                    // 清空本地输入
                    const updatedInput = { ...skuBindingInput };
                    updatedInput[uniqueKey] = '';
                    setSkuBindingInput(updatedInput);
                    setEditingSkuQuotation(null);
                    // 重新加载数据（强制刷新，跳过缓存）
                    const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                    if (rightAllData.length > 0 && dataSource.length > 0) {
                      await loadQuotationBindingFlags(rightAllData, dataSource);
                      // 重新加载SKU绑定数据
                      await loadSkuBindingMap(dataSource, upcToSkuMap);
                      // 如果当前选中的是这条记录，重新加载下栏数据
                      if (selectedLeftRecord &&
                        selectedLeftRecord.供应商编码 === supplierCode &&
                        selectedLeftRecord.供应商商品编码 === supplierProductCode) {
                        await loadBottomData();
                      }
                      // 重新加载库存汇总数据以更新匹配（强制刷新，跳过缓存）
                      if (selectedSupplierCodes.length > 0 && dataSource.length > 0) {
                        await loadRightData(dataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                      }
                    }
                  } catch (error: any) {
                    console.error('清空SKU绑定失败:', error);
                    message.error(`清空失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
                  }
                }}
              >
                清空
              </Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  onClick={() => {
                    setEditingSkuQuotation(null);
                  }}
                >
                  取消
                </Button>
                <Button
                  type="primary"
                  size="small"
                  onClick={async () => {
                    if (!supplierCode || !supplierProductCode) {
                      message.error('未找到匹配的供应商报价数据');
                      return;
                    }

                    const skuValue = currentSkuInput?.trim() || '';
                    if (!skuValue) {
                      message.warning('请输入SKU');
                      return;
                    }

                    try {
                      await supplierQuotationApi.updateSkuBinding({
                        supplierCode: supplierCode,
                        supplierProductCode: supplierProductCode,
                        sku: skuValue,
                      });
                      message.success('保存成功');

                      // 清除相关供应商编码的缓存，因为SKU绑定会影响匹配
                      if (supplierCode) {
                        clearCacheForSupplierCodes([supplierCode]);
                        console.log('[缓存] 已清除供应商编码的缓存:', supplierCode);
                      }

                      setEditingSkuQuotation(null);
                      // 重新加载数据（强制刷新，跳过缓存）
                      const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                      if (rightAllData.length > 0 && dataSource.length > 0) {
                        await loadQuotationBindingFlags(rightAllData, dataSource);
                        // 重新加载SKU绑定数据
                        await loadSkuBindingMap(dataSource, upcToSkuMap);
                        // 如果当前选中的是这条记录，重新加载下栏数据
                        if (selectedLeftRecord &&
                          selectedLeftRecord.供应商编码 === supplierCode &&
                          selectedLeftRecord.供应商商品编码 === supplierProductCode) {
                          await loadBottomData();
                        }
                        // 重新加载库存汇总数据以更新匹配（强制刷新，跳过缓存）
                        if (selectedSupplierCodes.length > 0 && dataSource.length > 0) {
                          await loadRightData(dataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                        }
                      }
                    } catch (error: any) {
                      console.error('保存SKU绑定失败:', error);
                      message.error(`保存失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
                    }
                  }}
                >
                  保存
                </Button>
              </div>
            </div>
          </div>
        );

        // 如果找到了匹配的供应商报价，显示可点击的绑定弹框
        // 使用controlled模式，确保即使SKU为"-"也能正确显示
        return (
          <div
            data-sku-column="true"
            onClick={(e) => {
              // 阻止事件冒泡，避免触发行点击事件
              e.stopPropagation();
            }}
          >
            <Popover
              className="sku-binding-popover"
              data-sku-binding="true"
              content={skuBindingContent}
              title="手动绑定SKU"
              trigger="click"
              open={isEditing}
              onOpenChange={(open) => {
                console.log('[SKU绑定] Popover onOpenChange:', {
                  open,
                  uniqueKey,
                  isEditing,
                  matchedQuotation: !!matchedQuotation,
                  supplierCode,
                  supplierProductCode,
                });

                if (open) {
                  setEditingSkuQuotation(uniqueKey);
                  // 加载当前SKU绑定数据
                  if (supplierCode && supplierProductCode) {
                    // 查询当前绑定的SKU
                    supplierQuotationApi.getSkuBindings({
                      supplierCode: supplierCode,
                      supplierProductCode: supplierProductCode,
                    }).then(result => {
                      if (result && result.length > 0 && result[0].SKU) {
                        setSkuBindingInput(prev => ({
                          ...prev,
                          [uniqueKey]: result[0].SKU || '',
                        }));
                      } else {
                        setSkuBindingInput(prev => ({
                          ...prev,
                          [uniqueKey]: '',
                        }));
                      }
                    }).catch(error => {
                      console.error('加载SKU绑定数据失败:', error);
                      setSkuBindingInput(prev => ({
                        ...prev,
                        [uniqueKey]: '',
                      }));
                    });
                  } else {
                    // 如果没有supplierCode和supplierProductCode，初始化输入为空
                    setSkuBindingInput(prev => ({
                      ...prev,
                      [uniqueKey]: '',
                    }));
                  }
                } else {
                  setEditingSkuQuotation(null);
                }
              }}
              placement="top"
              overlayInnerStyle={{
                zIndex: 2000, // 设置较高的z-index，确保显示在其他元素之上
              }}
              getPopupContainer={(triggerNode) => {
                // 确保Popover渲染在body中，避免被表格遮挡
                // 使用document.body确保Popover能正确显示在其他元素之上
                return document.body;
              }}
              zIndex={2000}
            >
              <span
                data-sku-column="true"
                style={{ cursor: 'pointer', color: '#FF6A00', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={(e) => {
                  // 阻止事件冒泡，避免触发行点击事件
                  e.stopPropagation();
                  console.log('[SKU绑定] 点击SKU列:', {
                    text,
                    skuText,
                    isSkuEmpty,
                    uniqueKey,
                    recordUPC: record.UPC,
                    matchedQuotation: !!matchedQuotation,
                    supplierCode,
                    supplierProductCode,
                    currentEditing: editingSkuQuotation,
                  });
                  // 如果点击时还没有设置editingSkuQuotation，立即设置
                  if (editingSkuQuotation !== uniqueKey) {
                    console.log('[SKU绑定] 设置editingSkuQuotation为:', uniqueKey);
                    setEditingSkuQuotation(uniqueKey);
                  }
                }}
              >
                {displaySku || '-'}
                {hasBinding && (
                  <Tag color="green" style={{ margin: 0 }}>绑</Tag>
                )}
              </span>
            </Popover>
          </div>
        );
      },
    });

    // 根据维度动态显示一列：全部显示最低采购价，仓店/城市显示最近采购价
    if (inventoryType === '全部') {
      columns.push({
        title: '最低采购价',
        dataIndex: '最低采购价',
        key: '最低采购价',
        width: 120,
        render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
      });
    } else {
      // 仓店/城市显示最近采购价
      columns.push({
        title: '最近采购价',
        dataIndex: '最近采购价',
        key: '最近采购价',
        width: 120,
        render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
      });
    }

    // SKU商品标签列
    columns.push({
      title: 'SKU商品标签',
      dataIndex: 'SKU商品标签',
      key: 'SKU商品标签',
      width: 150,
      ellipsis: true,
    });

    // 供应商名称列（根据维度不同显示不同列）
    if (inventoryType === '仓店') {
      // 仓店维度：供应商名称（只有当用户选择了对应字段时才显示列）
      if (supplierNameFields.includes('供应商名称')) {
        columns.push({
          title: '供应商名称',
          dataIndex: '供应商名称',
          key: '供应商名称',
          width: 150,
          ellipsis: true,
          render: (text: string, record: InventorySummary) => {
            if (!record.SKU || !record['门店/仓库名称']) return '-';
            const key = `${record.SKU}_${record['门店/仓库名称']}`;
            return supplierNameData[key] || '-';
          },
        });
      }
    } else if (inventoryType === '城市' || inventoryType === '全部') {
      // 城市/全部维度：供应商名称(最低价)和供应商名称(最近时间)
      // 只有当用户选择了对应字段时才显示列
      if (supplierNameFields.includes('供应商名称(最低价)')) {
        columns.push({
          title: '供应商名称(最低价)',
          dataIndex: '供应商名称(最低价)',
          key: '供应商名称(最低价)',
          width: 180,
          ellipsis: true,
          render: (text: string, record: InventorySummary) => {
            if (!record.SKU) return '-';
            // 确保SKU是字符串格式，避免类型不匹配
            const skuStr = String(record.SKU).trim();
            const key = `${skuStr}_最低价`;
            return supplierNameData[key] || '-';
          },
        });
      }
      if (supplierNameFields.includes('供应商名称(最近时间)')) {
        columns.push({
          title: '供应商名称(最近时间)',
          dataIndex: '供应商名称(最近时间)',
          key: '供应商名称(最近时间)',
          width: 180,
          ellipsis: true,
          render: (text: string, record: InventorySummary) => {
            if (!record.SKU) return '-';
            // 确保SKU是字符串格式，避免类型不匹配
            const skuStr = String(record.SKU).trim();
            const key = `${skuStr}_最近时间`;
            const value = supplierNameData[key];
            return value || '-';
          },
        });
      }
    }

    // 其他列（默认隐藏）
    columns.push(
      {
        title: '商品名称',
        dataIndex: '商品名称',
        key: '商品名称',
        width: 200,
        ellipsis: true,
      },
      {
        title: '规格',
        dataIndex: '规格',
        key: '规格',
        width: 150,
        ellipsis: true,
      },
      {
        title: '总部零售价',
        dataIndex: '总部零售价',
        key: '总部零售价',
        width: 120,
        render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
      },
      {
        title: '成本单价',
        dataIndex: '成本单价',
        key: '成本单价',
        width: 120,
        render: (text: number) => (text !== undefined && text !== null) ? `¥${Number(text).toFixed(2)}` : '-',
      },
      {
        title: '对比字段类型',
        dataIndex: '对比字段类型',
        key: '对比字段类型',
        width: 120,
        render: (text: string) => text || '-',
      },
      {
        title: '差价',
        dataIndex: '差价',
        key: '差价',
        width: 120,
        render: (text: number) => {
          if (text === undefined || text === null) return '-';
          const sign = text >= 0 ? '+' : '';
          return `${sign}¥${Number(text).toFixed(2)}`;
        },
      }
    );

    // 对比结果列 - 固定在右侧，放在所有列的最后
    // 使用与筛选框一致的渲染方式
    columns.push({
      title: '对比结果',
      dataIndex: '对比结果',
      key: '对比结果',
      width: 120,
      fixed: 'right' as const,
      render: (text: string) => {
        // 查找对应的选项以获取颜色
        const option = comparisonResultOptions.find(opt => opt.value === text);
        if (option) {
          return <Tag color={option.color}>{text}</Tag>;
        }
        return text || '-';
      },
    });

    return columns;
  };

  // 加载所有供应商编码列表
  const loadAllSupplierCodes = async () => {
    try {
      const result = await supplierQuotationApi.getAllSupplierCodes();
      setAllSupplierCodes(result || []);
    } catch (error) {
      console.error('加载供应商编码列表失败:', error);
    }
  };

  // 构建搜索参数（不再合并为单个字符串，而是分别传递）
  const buildSearchParams = () => {
    return {
      supplierName: supplierNameSearch.trim() || undefined,
      supplierCode: supplierCodeSearch.trim() || undefined,
      productName: productNameSearch.trim() || undefined,
      upcCode: upcCodeSearch.trim() || undefined,
    };
  };

  // 加载所有供应商报价数据（不分页，用于筛选）- 支持缓存
  const loadAllLeftData = async (supplierCodesOverride?: string[], useCache: boolean = true, forceRefresh: boolean = false) => {
    // 使用传入的参数或当前状态
    const codesToUse = supplierCodesOverride || selectedSupplierCodes;

    // 如果没有选择供应商编码，不加载数据
    if (codesToUse.length === 0) {
      setAllLeftData([]);
      return;
    }

    try {
      const searchParams = buildSearchParams();

      // 如果使用缓存且不强制刷新，先从缓存读取
      if (useCache && !forceRefresh) {
        const cachedData = getQuotationFromCache(codesToUse, searchParams);
        if (cachedData) {
          console.log('[缓存] 从缓存读取供应商报价数据，数量:', cachedData.length);
          setAllLeftData(cachedData);
          return;
        }
      }

      // 缓存未命中或强制刷新，从API加载
      console.log('[缓存] 从API加载供应商报价数据');
      const result = await supplierQuotationApi.getAll({
        page: 1,
        limit: 10000, // 设置一个足够大的值以获取所有数据
        ...searchParams,
        supplierCodes: codesToUse,
      });

      // 验证返回的数据是否匹配选择的供应商编码
      const filteredData = (result.data || []).filter(item =>
        item.供应商编码 && codesToUse.includes(item.供应商编码)
      );

      // 如果过滤后的数据数量不一致，记录警告
      if (filteredData.length !== (result.data || []).length) {
        const returnedCodes = [...new Set((result.data || []).map((d: any) => d.供应商编码))];
        const unexpectedCodes = returnedCodes.filter((code: string) => !codesToUse.includes(code));
        console.warn('API返回的数据包含未选择的供应商编码，已过滤', {
          selected: codesToUse,
          returned: returnedCodes,
          unexpected: unexpectedCodes,
          filtered: filteredData.length,
          total: (result.data || []).length
        });
      }

      // 保存到缓存
      setQuotationCache(codesToUse, searchParams, filteredData);
      setAllLeftData(filteredData);
    } catch (error) {
      console.error('加载所有供应商报价数据失败:', error);
    }
  };

  // 加载左栏数据
  const loadLeftData = async (
    supplierCodesOverride?: string[],
    storeNameFilterOverride?: string,
    cityFilterOverride?: string,
    pageOverride?: number,
    pageSizeOverride?: number
  ) => {
    // 标记为手动加载（如果有传入参数）
    if (supplierCodesOverride || storeNameFilterOverride !== undefined || cityFilterOverride !== undefined || pageOverride !== undefined || pageSizeOverride !== undefined) {
      isLoadingManuallyRef.current = true;
    }

    try {
      // 使用传入的参数或当前状态
      const codesToUse = supplierCodesOverride || selectedSupplierCodes;
      const storeNameToUse = storeNameFilterOverride !== undefined ? storeNameFilterOverride : storeNameFilter;
      const cityToUse = cityFilterOverride !== undefined ? cityFilterOverride : cityFilter;
      const pageToUse = pageOverride !== undefined ? pageOverride : leftCurrentPage;
      const pageSizeToUse = pageSizeOverride !== undefined ? pageSizeOverride : leftPageSize;

      // 如果没有选择供应商编码，不加载数据
      if (codesToUse.length === 0) {
        setLeftData([]);
        setLeftTotal(0);
        setRightData([]);
        setUpcToSkuMap({}); // 清空UPC到SKU的映射
        setLeftLoading(false);
        return;
      }

      // 仓店维度必须选择门店/仓名称，否则不加载数据
      if (inventoryType === '仓店' && (!storeNameToUse || storeNameToUse.trim() === '')) {
        setLeftData([]);
        setLeftTotal(0);
        setRightData([]);
        setUpcToSkuMap({});
        setLeftLoading(false);
        // 重置标志
        if (supplierCodesOverride || storeNameFilterOverride !== undefined || cityFilterOverride !== undefined || pageOverride !== undefined || pageSizeOverride !== undefined) {
          setTimeout(() => {
            isLoadingManuallyRef.current = false;
          }, 200);
        }
        return;
      }

      // 城市维度必须选择城市，否则不加载数据
      if (inventoryType === '城市' && (!cityToUse || cityToUse.trim() === '')) {
        setLeftData([]);
        setLeftTotal(0);
        setRightData([]);
        setUpcToSkuMap({});
        setLeftLoading(false);
        // 重置标志
        if (supplierCodesOverride || storeNameFilterOverride !== undefined || cityFilterOverride !== undefined || pageOverride !== undefined || pageSizeOverride !== undefined) {
          setTimeout(() => {
            isLoadingManuallyRef.current = false;
          }, 200);
        }
        return;
      }

      setLeftLoading(true);

      const searchParams = buildSearchParams();
      const result = await supplierQuotationApi.getAll({
        page: pageToUse,
        limit: pageSizeToUse,
        ...searchParams,
        supplierCodes: codesToUse,
      });

      // 验证返回的数据是否匹配选择的供应商编码
      const filteredData = (result.data || []).filter(item =>
        item.供应商编码 && codesToUse.includes(item.供应商编码)
      );

      // 如果过滤后的数据数量不一致，记录警告并提示用户
      if (filteredData.length !== (result.data || []).length) {
        const returnedCodes = [...new Set((result.data || []).map((d: any) => d.供应商编码))];
        const unexpectedCodes = returnedCodes.filter((code: string) => !codesToUse.includes(code));
        console.error('[SupplierQuotation] API返回的数据包含未选择的供应商编码，已过滤', {
          selected: codesToUse,
          returned: returnedCodes,
          unexpected: unexpectedCodes,
          filtered: filteredData.length,
          total: (result.data || []).length,
          requestParams: {
            supplierCodes: codesToUse,
            ...buildSearchParams(),
          }
        });
        if (unexpectedCodes.length > 0) {
          message.error(`API返回了错误的供应商编码数据。选择的: ${codesToUse.join(', ')}, 返回的: ${unexpectedCodes.join(', ')}。数据已过滤。`);
        }
      }

      setLeftData(filteredData);
      // 更新总数（使用后端返回的总数，而不是当前页的数据数量）
      // 注意：如果后端返回的数据包含不匹配的供应商编码，我们需要使用 result.total
      // 因为 total 是基于查询条件的总数，而不是当前页的数量
      setLeftTotal(result.total || 0);

      // 注意：如果有筛选条件（对比结果筛选或SKU搜索），不应该在这里加载所有数据
      // 因为筛选逻辑会在搜索按钮的onClick中处理，这里只处理正常的分页加载
      // 如果有筛选条件，allLeftData 应该在搜索按钮的onClick中加载

      // 加载完供应商报价数据后，自动加载库存汇总数据
      // 使用最新的 filteredData 和 codesToUse，确保状态同步
      // 传递 storeNameToUse 和 cityToUse，避免依赖异步状态更新
      if (filteredData && filteredData.length > 0) {
        // 直接使用 filteredData 和 codesToUse，不依赖状态更新
        // 确保使用传入的参数，而不是状态
        await loadRightData(filteredData, codesToUse, storeNameToUse, cityToUse);
      } else {
        // 如果没有数据，清空库存汇总
        setRightData([]);
        setRightAllData([]);
        setRightTotal(0);
        setUpcToSkuMap({});
      }
    } catch (error) {
      message.error('加载供应商报价数据失败');
      console.error(error);
    } finally {
      setLeftLoading(false);
      // 注意：标志的重置由调用者（onChange/onDeselect）控制，这里不再重置
    }
  };

  // 获取调整后的供货价格（根据报价比例）
  const getAdjustedSupplierPrice = (
    supplierPrice: number | undefined | null,
    supplierCode: string | undefined,
    upcCode: string | undefined,
  ): number | undefined | null => {
    if (supplierPrice === undefined || supplierPrice === null || !supplierCode || !upcCode) {
      return supplierPrice;
    }

    // 查找对应的报价比例数据
    // 需要通过供应商编码和UPC找到对应的供应商商品编码，然后查找比例
    // 这里我们使用ratioData，但需要建立正确的映射
    // 简化处理：在计算对比结果时动态查询
    return supplierPrice;
  };

  // 根据报价比例调整供货价格
  const adjustSupplierPriceByRatio = (
    supplierPrice: number | undefined | null,
    supplierRatio?: number | null,
    qianniuhuaRatio?: number | null,
  ): number | undefined | null => {
    if (supplierPrice === undefined || supplierPrice === null) {
      return supplierPrice;
    }

    if (supplierRatio === undefined || qianniuhuaRatio === undefined || supplierRatio === null || qianniuhuaRatio === null) {
      return supplierPrice;
    }

    if (supplierRatio === 0) {
      return supplierPrice;
    }

    // 公式：供货价格 = '供货价格' / '报价比例_供应商商品' * '报价比例_牵牛花商品'
    const adjustedPrice = (supplierPrice / supplierRatio) * qianniuhuaRatio;
    return adjustedPrice;
  };

  // 加载报价比例数据
  const loadPriceRatios = async (supplierCode: string, upcCode: string, quotationKey: string) => {
    try {
      const result = await supplierQuotationApi.getPriceRatios({
        supplierCode,
        upcCode,
      });
      // 使用函数式更新确保使用最新状态
      if (result) {
        setRatioData(prev => ({
          ...prev,
          [quotationKey]: {
            supplierRatio: result.报价比例_供应商商品,
            qianniuhuaRatio: result.报价比例_牵牛花商品,
          },
        }));
      } else {
        setRatioData(prev => ({
          ...prev,
          [quotationKey]: {
            supplierRatio: undefined,
            qianniuhuaRatio: undefined,
          },
        }));
      }
    } catch (error) {
      console.error('加载报价比例失败:', error);
      setRatioData(prev => ({
        ...prev,
        [quotationKey]: {
          supplierRatio: undefined,
          qianniuhuaRatio: undefined,
        },
      }));
    }
  };

  // 加载SKU绑定数据（批量查询所有供应商报价的SKU绑定）
  const loadSkuBindingMap = async (quotationData: SupplierQuotation[], upcToSkuMapParam?: Record<string, string[]>) => {
    if (!quotationData || quotationData.length === 0) {
      setSkuBindingMap({});
      setSkuBindingFlags({});
      return;
    }

    try {
      // 使用传入的upcToSkuMap参数，如果没有则使用状态中的
      const upcMapToUse = upcToSkuMapParam || upcToSkuMap;

      // 收集所有唯一的供应商编码和供应商商品编码组合
      const quotationKeys = new Set<string>();
      quotationData.forEach(quotation => {
        if (quotation.供应商编码 && quotation.供应商商品编码) {
          const key = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
          quotationKeys.add(key);
        }
      });

      // 批量查询SKU绑定数据
      const bindingMap: Record<string, string> = {}; // key为"供应商编码_供应商商品编码"，value为绑定的SKU
      const bindingFlags: Record<string, boolean> = {}; // key为原SKU，value为是否有绑定

      // 为每个供应商报价查询SKU绑定
      const promises = Array.from(quotationKeys).map(async (key) => {
        const [supplierCode, supplierProductCode] = key.split('_');
        try {
          const result = await supplierQuotationApi.getSkuBindings({
            supplierCode: supplierCode,
            supplierProductCode: supplierProductCode,
          });
          if (result && result.length > 0 && result[0].SKU) {
            bindingMap[key] = result[0].SKU;
            // 找到对应的原SKU（通过UPC和供应商报价）
            const quotation = quotationData.find(q =>
              q.供应商编码 === supplierCode && q.供应商商品编码 === supplierProductCode
            );
            if (quotation && quotation.最小销售规格UPC商品条码 && upcMapToUse[quotation.最小销售规格UPC商品条码]) {
              // 为所有匹配的原SKU设置绑定标记
              upcMapToUse[quotation.最小销售规格UPC商品条码].forEach(originalSku => {
                bindingFlags[originalSku] = true;
              });
            }
          }
        } catch (error) {
          console.error(`加载SKU绑定数据失败 (${key}):`, error);
        }
      });

      await Promise.all(promises);
      setSkuBindingMap(bindingMap);
      setSkuBindingFlags(bindingFlags);
    } catch (error) {
      console.error('加载SKU绑定数据失败:', error);
      setSkuBindingMap({});
      setSkuBindingFlags({});
    }
  };

  // 加载供应商报价绑定标记（返回供应商报价的绑定标记，key为"供应商编码_供应商商品编码"）
  const loadQuotationBindingFlags = async (
    items: InventorySummary[],
    quotationData: SupplierQuotation[],
    upcToSkuMapParam?: Record<string, string[]>
  ) => {
    if (!items || items.length === 0 || !quotationData || quotationData.length === 0) {
      setQuotationBindingFlags({});
      return;
    }

    try {
      // 使用传入的upcToSkuMap参数，如果没有则使用状态中的
      const upcMapToUse = upcToSkuMapParam || upcToSkuMap;
      const skuBindingResult = await supplierQuotationApi.getSkuBindingFlags({
        items: items,
        quotationData: quotationData,
        upcToSkuMap: upcMapToUse,
      });

      // 将SKU绑定标记转换为供应商报价绑定标记
      // 通过UPC条码和SKU找到对应的供应商报价，然后使用"供应商编码_供应商商品编码"作为key
      const quotationBindingResult: Record<string, boolean> = {};

      quotationData.forEach(quotation => {
        if (quotation.供应商编码 && quotation.供应商商品编码 && quotation.最小销售规格UPC商品条码) {
          const bindingKey = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
          // 检查这个UPC对应的SKU是否有绑定标记
          const upc = quotation.最小销售规格UPC商品条码;
          const skuCodes = upcMapToUse[upc] || [];
          // 如果任何一个SKU有绑定标记，则这个供应商报价也有绑定标记
          const hasBinding = skuCodes.some(sku => skuBindingResult[sku] === true);
          if (hasBinding) {
            quotationBindingResult[bindingKey] = true;
          }
        }
      });

      setQuotationBindingFlags(quotationBindingResult);
    } catch (error) {
      console.error('加载供应商报价绑定标记失败:', error);
      setQuotationBindingFlags({});
    }
  };

  // 加载供应商名称数据
  // 注意：只查询当前表格显示的SKU，而不是全部数据，这样翻页时也会自动查询新页面的SKU
  const loadSupplierNames = async (items: InventorySummary[], fields: string[]) => {
    if (!items || items.length === 0 || !fields || fields.length === 0) {
      setSupplierNameData({});
      return;
    }

    try {
      // 只查询当前表格显示的SKU（传入的items就是当前页的数据）
      // 这样可以确保当前页的SKU都能查询到，且性能更好
      // 翻页时会自动触发查询新页面的SKU

      // 从当前页数据中提取SKU信息，去重
      // 如果有SKU绑定，使用绑定的SKU；否则使用原SKU
      const skuSet = new Set<string>();
      const currentPageData: Array<{ SKU?: string | number; '门店/仓库名称'?: string; 城市?: string; originalSku?: string }> = [];
      const skuMapping: Record<string, string> = {}; // 原SKU -> 绑定SKU的映射

      items.forEach(item => {
        if (item.SKU) {
          const originalSku = String(item.SKU).trim();
          // 检查是否有SKU绑定
          let skuToUse = originalSku;

          // 找到匹配的供应商报价
          if (upcToSkuMap) {
            Object.keys(upcToSkuMap).forEach(upc => {
              if (upcToSkuMap[upc].includes(originalSku)) {
                const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                const quotation = dataSource.find(q => q.最小销售规格UPC商品条码 === upc);
                if (quotation && quotation.供应商编码 && quotation.供应商商品编码) {
                  const bindingKey = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
                  const boundSku = skuBindingMap[bindingKey];
                  if (boundSku) {
                    skuToUse = boundSku;
                    skuMapping[originalSku] = boundSku;
                  }
                }
              }
            });
          }

          if (!skuSet.has(skuToUse)) {
            skuSet.add(skuToUse);
            currentPageData.push({
              SKU: skuToUse, // 使用绑定的SKU
              '门店/仓库名称': item['门店/仓库名称'],
              城市: item.城市,
              originalSku: originalSku, // 保存原SKU用于后续映射
            });
          }
        }
      });

      // 如果没有找到SKU，直接返回
      if (currentPageData.length === 0) {
        setSupplierNameData({});
        return;
      }

      const limitedItems = currentPageData;

      // 城市维度时传递城市名称
      const cityParam = inventoryType === '城市' && cityFilter ? cityFilter : undefined;

      const result = await supplierQuotationApi.getSupplierNames({
        type: inventoryType,
        items: limitedItems as InventorySummary[],
        fields: fields,
        city: cityParam,
      });


      // 将绑定SKU的查询结果映射回原SKU
      // 因为后端返回的是基于绑定SKU的结果（key为绑定SKU），需要映射回原SKU
      const mappedResult: Record<string, string> = {};
      if (result) {
        Object.keys(result).forEach(key => {
          // key格式可能是：绑定SKU_最低价、绑定SKU_最近时间、绑定SKU_门店名称等
          // 需要找到对应的原SKU
          const parts = key.split('_');
          const boundSku = parts[0];

          // 找到对应的原SKU
          const originalSku = Object.keys(skuMapping).find(origSku => skuMapping[origSku] === boundSku);

          if (originalSku) {
            // 使用原SKU构建新的key
            const suffix = parts.slice(1).join('_'); // 保留后面的部分（如"最低价"、"最近时间"等）
            const newKey = suffix ? `${originalSku}_${suffix}` : originalSku;
            mappedResult[newKey] = result[key];
          } else {
            // 如果没有找到映射，可能是没有绑定的SKU，直接使用原key
            mappedResult[key] = result[key];
          }
        });
      }

      // 合并新的查询结果到现有的supplierNameData中
      // 这样即使SKU不在当前页，只要之前查询过，也能保留数据
      setSupplierNameData(prev => ({
        ...prev,
        ...mappedResult
      }));
    } catch (error: any) {
      console.error('加载供应商名称失败:', error);
      const errorMsg = error?.response?.data?.message || error?.message || '加载供应商名称失败';
      if (errorMsg.includes('timeout') || errorMsg.includes('504')) {
        message.error('查询超时，数据量较大，请减少查询范围或稍后重试');
      } else {
        message.error(`加载供应商名称失败: ${errorMsg}`);
      }
      setSupplierNameData({});
    }
  };

  // 加载仓库优先级列表
  const loadWarehousePriorities = async () => {
    try {
      const result = await supplierQuotationApi.getWarehousePriorities();
      setWarehousePriorities(result || []);
    } catch (error) {
      console.error('加载仓库优先级失败:', error);
    }
  };

  // 加载城市列表
  const loadCities = async () => {
    try {
      const result = await supplierQuotationApi.getCities();
      setCities(result || []);
    } catch (error) {
      console.error('加载城市列表失败:', error);
    }
  };

  // 加载右栏数据
  const loadRightData = async (
    leftDataOverride?: SupplierQuotation[],
    selectedSupplierCodesOverride?: string[],
    storeNameFilterOverride?: string,
    cityFilterOverride?: string,
    skipSkuFilter?: boolean, // 是否跳过SKU搜索过滤（用于筛选对比结果时加载所有数据）
    forceRefresh: boolean = false // 是否强制刷新（跳过缓存）
  ) => {
    // 生成新的请求ID，用于追踪当前请求
    const currentRequestId = ++loadRightDataRequestIdRef.current;

    // 使用传入的参数或当前状态
    const codesToUse = selectedSupplierCodesOverride || selectedSupplierCodes;
    const quotationDataToUse = leftDataOverride || leftData;
    const storeNameToUse = storeNameFilterOverride !== undefined ? storeNameFilterOverride : storeNameFilter;
    const cityToUse = cityFilterOverride !== undefined ? cityFilterOverride : cityFilter;

    // 如果没有选择供应商编码，不加载库存汇总数据
    if (codesToUse.length === 0) {
      // 只有在这是最新请求时才更新状态
      if (currentRequestId === loadRightDataRequestIdRef.current) {
        setRightData([]);
        setRightAllData([]);
        setRightTotal(0);
        setUpcToSkuMap({});
        setRightLoading(false);
      }
      return;
    }

    // 仓店维度必须选择门店/仓名称
    if (inventoryType === '仓店') {
      if (!storeNameToUse || storeNameToUse.trim() === '') {
        // 只有在这是最新请求时才更新状态
        if (currentRequestId === loadRightDataRequestIdRef.current) {
          setRightData([]);
          setRightAllData([]);
          setRightTotal(0);
          setUpcToSkuMap({});
          setRightLoading(false);
        }
        return;
      }
    }

    // 城市维度必须选择城市
    if (inventoryType === '城市') {
      if (!cityToUse || cityToUse.trim() === '') {
        // 只有在这是最新请求时才更新状态
        if (currentRequestId === loadRightDataRequestIdRef.current) {
          setRightData([]);
          setRightAllData([]);
          setRightTotal(0);
          setUpcToSkuMap({});
          setRightLoading(false);
        }
        return;
      }
    }

    setRightLoading(true);
    try {
      // 在关键步骤检查是否是最新请求，如果不是则取消后续操作
      if (currentRequestId !== loadRightDataRequestIdRef.current) {
        setRightLoading(false);
        return;
      }
      // 获取库存汇总数据
      // 仓店维度：传递storeNameFilter（单选）
      // 城市维度：传递cityFilter（单选，复用storeNames参数名）
      // 使用传入的参数，而不是状态，避免异步状态更新导致的问题
      let storeNamesParam: string[] | undefined;
      if (inventoryType === '仓店' && storeNameToUse) {
        storeNamesParam = [storeNameToUse];
      } else if (inventoryType === '城市' && cityToUse) {
        storeNamesParam = [cityToUse];
      }

      // 尝试从缓存获取库存汇总数据
      // 注意：库存汇总数据可能涉及多个供应商编码，这里使用codesToUse作为缓存key的一部分
      // forceRefresh参数从函数参数获取，不再重新定义
      const useCache = true; // 默认使用缓存，可以通过参数控制
      let result: InventorySummary[] | null = null;

      if (useCache && !forceRefresh) {
        const cachedInventory = getInventoryFromCache(codesToUse, inventoryType, storeNameToUse, cityToUse);
        if (cachedInventory) {
          console.log('[缓存] 从缓存读取库存汇总数据，数量:', cachedInventory.length);
          result = cachedInventory;

          // 从缓存读取时，也需要检查是否仍然是最新请求
          if (currentRequestId !== loadRightDataRequestIdRef.current) {
            setRightLoading(false);
            return;
          }
        }
      }

      // 如果缓存未命中，从API加载
      if (!result) {
        console.log('[缓存] 从API加载库存汇总数据');
        const apiResult = await supplierQuotationApi.getInventorySummary({
          type: inventoryType,
          storeNames: storeNamesParam,
        });

        // 检查是否仍然是最新请求
        if (currentRequestId !== loadRightDataRequestIdRef.current) {
          setRightLoading(false);
          return;
        }

        result = apiResult;

        // 保存到缓存
        setInventoryCache(codesToUse, inventoryType, storeNameToUse, cityToUse, result);
      }

      // 确保result不为null
      if (!result) {
        result = [];
      }

      // 注意：SKU搜索的过滤不应该在这里进行，应该在 filteredAlignedData 中进行
      // 这里总是加载所有库存汇总数据，不进行SKU过滤，确保筛选对比结果基于所有数据
      // 无论是否有SKU搜索，都先加载所有数据，然后在 filteredAlignedData 中进行SKU精确匹配过滤

      // 检查是否仍然是最新请求
      if (currentRequestId !== loadRightDataRequestIdRef.current) {
        setRightLoading(false);
        return;
      }

      // 保存原始结果长度（用于设置总数）
      // 注意：这里 result 包含所有库存汇总数据（未过滤），因为SKU过滤会在 filteredAlignedData 中进行
      const originalResultLength = result.length;

      // 第一步：从供应商报价中提取所有UPC条码，批量获取对应的SKU编码（支持缓存）
      const upcCodes = (quotationDataToUse || [])
        .map(q => q.最小销售规格UPC商品条码)
        .filter((upc): upc is string => !!upc && upc.trim() !== '');

      // UPC -> SKU编码数组的映射
      let upcToSkuMapLocal: Record<string, string[]> = {};

      if (upcCodes.length > 0) {
        // 尝试从缓存获取UPC到SKU映射
        const uniqueUpcCodes = [...new Set(upcCodes)];
        const cachedUpcToSkuMap = forceRefresh ? null : getUpcToSkuMapFromCache(uniqueUpcCodes);

        if (cachedUpcToSkuMap && useCache && !forceRefresh) {
          console.log('[缓存] 从缓存读取UPC到SKU映射');
          upcToSkuMapLocal = cachedUpcToSkuMap;
          // 保存到状态中，供 alignedData 使用
          setUpcToSkuMap(upcToSkuMapLocal);

          // 检查是否仍然是最新请求
          if (currentRequestId !== loadRightDataRequestIdRef.current) {
            setRightLoading(false);
            return;
          }
        } else {
          try {
            console.log('[缓存] 从API加载UPC到SKU映射');
            upcToSkuMapLocal = await supplierQuotationApi.getSkuCodesByUpcCodes({
              upcCodes: uniqueUpcCodes,
            });

            // 检查是否仍然是最新请求
            if (currentRequestId !== loadRightDataRequestIdRef.current) {
              setRightLoading(false);
              return;
            }

            // 保存到缓存
            setUpcToSkuMapCache(uniqueUpcCodes, upcToSkuMapLocal);
            // 保存到状态中，供 alignedData 使用
            setUpcToSkuMap(upcToSkuMapLocal);
          } catch (error) {
            console.error('获取SKU编码失败:', error);

            // 检查是否仍然是最新请求
            if (currentRequestId !== loadRightDataRequestIdRef.current) {
              setRightLoading(false);
              return;
            }

            message.warning('获取SKU编码失败，将使用原有匹配方式');
            setUpcToSkuMap({});
          }
        }
      } else {
        // 检查是否仍然是最新请求
        if (currentRequestId !== loadRightDataRequestIdRef.current) {
          setRightLoading(false);
          return;
        }
        setUpcToSkuMap({});
      }

      // 第二步：加载SKU绑定数据（在计算对比结果前，需要先获取SKU绑定信息）
      // 注意：需要在这里加载SKU绑定数据，以便在计算对比结果时使用绑定SKU
      let skuBindingMapLocal: Record<string, string> = {}; // key为"供应商编码_供应商商品编码"，value为绑定的SKU
      if (quotationDataToUse && quotationDataToUse.length > 0) {
        try {
          // 收集所有唯一的供应商编码和供应商商品编码组合
          const quotationKeys = new Set<string>();
          quotationDataToUse.forEach(quotation => {
            if (quotation.供应商编码 && quotation.供应商商品编码) {
              const key = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
              quotationKeys.add(key);
            }
          });

          // 批量查询SKU绑定数据（限制并发数量，避免性能问题）
          const BATCH_SIZE = 50;
          const keyArray = Array.from(quotationKeys);
          for (let i = 0; i < keyArray.length; i += BATCH_SIZE) {
            const batch = keyArray.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (key) => {
              const [supplierCode, supplierProductCode] = key.split('_');
              try {
                const result = await supplierQuotationApi.getSkuBindings({
                  supplierCode: supplierCode,
                  supplierProductCode: supplierProductCode,
                });
                if (result && result.length > 0 && result[0].SKU) {
                  skuBindingMapLocal[key] = result[0].SKU;
                }
              } catch (error) {
                console.error(`查询SKU绑定失败 [${key}]:`, error);
              }
            });
            await Promise.all(batchPromises);
          }
        } catch (error) {
          console.error('批量加载SKU绑定数据失败:', error);
        }
      }

      // 第三步：计算对比结果：为每个库存汇总项找到匹配的供应商报价项
      // 注意：报价比例数据不再在这里批量加载，而是在用户需要时按需加载（比如点击编辑报价比例时）
      // 这样可以避免在有大量数据时（如21265条）创建大量并发请求导致超时和性能问题
      // 计算对比结果时直接使用供应商报价数据中的"计算后供货价格"，这个价格已经在后端计算好了
      // 现在使用SKU编码进行匹配，并考虑SKU绑定
      const dataWithComparison = result.map(item => {
        // 如果没有供应商报价数据，直接返回库存汇总数据（不显示对比结果）
        if (!quotationDataToUse || quotationDataToUse.length === 0) {
          return item;
        }

        // 获取原始SKU和可能的绑定SKU
        const originalSku = item.SKU;
        let skuToUse = originalSku; // 默认使用原SKU

        // 通过SKU编码匹配供应商报价
        // 1. 找到所有包含当前库存汇总SKU的UPC条码（先尝试原SKU）
        const matchedUpcCodes: string[] = [];
        Object.entries(upcToSkuMapLocal).forEach(([upc, skuCodes]) => {
          if (skuToUse && skuCodes.includes(skuToUse)) {
            matchedUpcCodes.push(upc);
          }
        });

        // 1.5. 如果没有通过原SKU找到匹配的UPC，尝试通过UPC直接匹配（适用于SKU为"-"的情况）
        if (matchedUpcCodes.length === 0 && item.UPC) {
          const itemUpc = item.UPC.trim();
          if (itemUpc) {
            Object.keys(upcToSkuMapLocal).forEach(upc => {
              if (upc.trim() === itemUpc) {
                matchedUpcCodes.push(upc);
              }
            });
          }
        }

        // 2. 通过匹配的UPC条码找到对应的供应商报价
        let matchedQuotations = quotationDataToUse.filter(quotation => {
          if (!quotation.最小销售规格UPC商品条码) return false;
          return matchedUpcCodes.includes(quotation.最小销售规格UPC商品条码);
        });

        // 3. 如果找到匹配的供应商报价，检查是否有绑定SKU
        let updatedItem = { ...item };
        if (matchedQuotations.length > 0) {
          const matchedQuotation = matchedQuotations[0];
          const bindingKey = `${matchedQuotation.供应商编码}_${matchedQuotation.供应商商品编码}`;
          const boundSku = skuBindingMapLocal[bindingKey];

          // 如果有绑定SKU，使用绑定SKU去查找对应的库存汇总数据
          if (boundSku && boundSku !== originalSku) {
            // 使用绑定SKU查找对应的库存汇总数据（在当前结果集中查找）
            const boundSkuItem = result.find(r => {
              if (r.SKU !== boundSku) return false;

              // 根据维度应用筛选条件
              // 仓店维度：需要匹配门店/仓名称
              if (inventoryType === '仓店' && storeNameToUse) {
                return r['门店/仓库名称'] === item['门店/仓库名称'];
              }

              // 城市维度：需要匹配城市
              if (inventoryType === '城市' && cityToUse) {
                return r.城市 === item.城市;
              }

              // 全部维度：不需要额外筛选条件
              return true;
            });

            // 如果找到绑定SKU对应的数据，使用绑定SKU的数据更新字段
            if (boundSkuItem) {
              // 更新SKU商品标签、商品名称、规格、成本单价等字段
              updatedItem = {
                ...updatedItem,
                SKU商品标签: boundSkuItem.SKU商品标签,
                商品名称: boundSkuItem.商品名称,
                规格: boundSkuItem.规格,
                成本单价: boundSkuItem.成本单价,
                最低采购价: boundSkuItem.最低采购价,
                最近采购价: boundSkuItem.最近采购价,
                // 保留原SKU字段（因为表格显示需要），但使用绑定SKU的数据
              };
            }
          }
        }

        // 使用更新后的item
        item = updatedItem;

        // 如果没有匹配的供应商报价，不显示对比结果
        if (matchedQuotations.length === 0) {
          return item;
        }

        // 使用第一个匹配的供应商报价进行对比（如果有多个，取第一个）
        const matchedQuotation = matchedQuotations[0];
        // 优先使用计算后供货价格，如果为NULL则使用原供货价格
        let supplierPrice = matchedQuotation.计算后供货价格 !== undefined && matchedQuotation.计算后供货价格 !== null
          ? matchedQuotation.计算后供货价格
          : matchedQuotation.供货价格;

        // 如果供货价格为空，显示'无供货价信息'
        if (supplierPrice === undefined || supplierPrice === null) {
          return {
            ...item,
            对比结果: '无供货价信息',
            对比字段类型: undefined,
            差价: undefined,
          };
        }

        // 根据类型选择对比逻辑（使用更新后的item数据）
        let comparePrice: number | undefined;
        let compareFieldType: string | undefined;

        if (inventoryType === '全部') {
          // 全部：优先比最低采购价，为空则比最近采购价，还为空则比成本单价
          if (item.最低采购价 !== undefined && item.最低采购价 !== null) {
            comparePrice = item.最低采购价;
            compareFieldType = '最低采购价';
          } else if (item.最近采购价 !== undefined && item.最近采购价 !== null) {
            comparePrice = item.最近采购价;
            compareFieldType = '最近采购价';
          } else if (item.成本单价 !== undefined && item.成本单价 !== null) {
            comparePrice = item.成本单价;
            compareFieldType = '成本单价';
          }
        } else {
          // 仓店/城市：优先比最近采购价，为空则比成本单价
          if (item.最近采购价 !== undefined && item.最近采购价 !== null) {
            comparePrice = item.最近采购价;
            compareFieldType = '最近采购价';
          } else if (item.成本单价 !== undefined && item.成本单价 !== null) {
            comparePrice = item.成本单价;
            compareFieldType = '成本单价';
          }
        }

        // 如果所有采购价都为空，显示'无采购价信息'
        if (comparePrice === undefined || comparePrice === null) {
          return {
            ...item,
            对比结果: '无采购价信息',
            对比字段类型: undefined,
            差价: undefined,
          };
        }

        // 供货价格 < 采购价，显示'价格优势'（供应商报价更便宜）
        const diff = comparePrice - supplierPrice;
        return {
          ...item,
          对比结果: diff > 0 ? '价格优势' : diff < 0 ? '价格偏高' : '价格相同',
          对比字段类型: compareFieldType,
          差价: diff,
        };
      });

      // 检查是否仍然是最新请求
      if (currentRequestId !== loadRightDataRequestIdRef.current) {
        setRightLoading(false);
        return;
      }

      // 保存所有数据（用于匹配和筛选）
      // 使用展开运算符创建新数组，确保引用变化，触发useEffect
      // 注意：这里保存的是所有库存汇总数据（包含计算后的对比结果），用于后续的筛选和SKU搜索
      // SKU搜索和筛选对比结果的过滤会在 filteredAlignedData 中进行，而不是在这里
      setRightAllData([...dataWithComparison]);

      // 设置总数：使用 dataWithComparison 的长度（所有数据，包含对比结果）
      // SKU搜索和筛选对比结果的过滤会在 filteredAlignedData 中进行，所以这里使用所有数据的长度
      setRightTotal(dataWithComparison.length);

      // 查询供应商报价绑定标记（在设置rightAllData之后立即调用，确保初始加载时就能显示'转'字）
      // 使用upcToSkuMapLocal而不是状态中的upcToSkuMap，确保使用最新的映射
      if (dataWithComparison.length > 0 && quotationDataToUse && quotationDataToUse.length > 0) {
        await loadQuotationBindingFlags(dataWithComparison, quotationDataToUse, upcToSkuMapLocal);
        // 加载SKU绑定数据（确保从缓存加载时也能显示'绑'标识）
        // 注意：这里使用quotationDataToUse（当前显示的供应商报价数据），而不是所有数据，避免性能问题
        await loadSkuBindingMap(quotationDataToUse, upcToSkuMapLocal);
      }

      // 应用分页（使用最新的分页状态）
      // 注意：分页会在useEffect中自动应用，但为了确保初始加载时也能正确分页，这里也设置一次
      // 关键：不要在 loadRightData 中查询供应商名称，因为这里的 paginatedData 可能不是用户真正看到的第一页
      // 应该在 useEffect 中查询，使用 rightAllData 计算的分页数据
      const currentPage = rightCurrentPage;
      const currentPageSize = rightPageSize;
      const start = (currentPage - 1) * currentPageSize;
      const end = start + currentPageSize;
      const paginatedData = dataWithComparison.slice(start, end);
      setRightData(paginatedData);

      // 注意：供应商名称查询会在 useEffect 中自动触发，因为 rightAllData 会更新

      // 最后检查是否仍然是最新请求
      if (currentRequestId !== loadRightDataRequestIdRef.current) {
        setRightLoading(false);
        return;
      }
    } catch (error) {
      // 检查是否仍然是最新请求
      if (currentRequestId !== loadRightDataRequestIdRef.current) {
        setRightLoading(false);
        return;
      }
      message.error('加载库存汇总数据失败');
      console.error(error);
    } finally {
      // 只有在是最新请求时才更新加载状态
      if (currentRequestId === loadRightDataRequestIdRef.current) {
        setRightLoading(false);
      }
    }
  };

  // 重置供应商报价搜索条件（清空所有搜索框和供应商编码筛选框）
  const handleResetSearch = () => {
    setSupplierNameSearch('');
    setSupplierCodeSearch('');
    setProductNameSearch('');
    setUpcCodeSearch('');
    setLeftSearchText('');
    setSelectedSupplierCodes([]);
    setLeftCurrentPage(1);
    // 清空数据
    setLeftData([]);
    setLeftTotal(0);
    setRightData([]);
    setRightAllData([]);
    setRightTotal(0);
    setUpcToSkuMap({});
  };

  // 加载下栏数据
  const loadBottomData = async (record?: SupplierQuotation) => {
    // 优先使用传入的record参数，如果没有则使用状态中的selectedLeftRecord
    const targetRecord = record || selectedLeftRecord;

    if (!targetRecord || !targetRecord.供应商编码 || !targetRecord.供应商商品编码) {
      setBottomData([]);
      setEditingSkus({});
      setOrderChannel(null);
      return;
    }

    setBottomLoading(true);
    try {
      // 并行加载SKU绑定数据和采购下单渠道
      const [result, channel] = await Promise.all([
        supplierQuotationApi.getSkuBindings({
          supplierCode: targetRecord.供应商编码,
          supplierProductCode: targetRecord.供应商商品编码,
        }),
        supplierQuotationApi.getSupplierOrderChannel(targetRecord.供应商编码).catch(() => null),
      ]);

      // 设置采购下单渠道
      setOrderChannel(channel);

      // 如果没有数据,创建一个空记录用于编辑
      if (!result || result.length === 0) {
        setBottomData([{
          供应商编码: targetRecord.供应商编码,
          供应商商品编码: targetRecord.供应商商品编码,
          SKU: '',
        }]);
        // 使用稳定的唯一标识符作为key
        const uniqueKey = `${targetRecord.供应商编码}_${targetRecord.供应商商品编码}`;
        setEditingSkus({ [uniqueKey]: '' });
      } else {
        setBottomData(result);
        // 初始化编辑状态，使用稳定的唯一标识符作为key
        const initialEditing: Record<string, string> = {};
        result.forEach((item) => {
          const uniqueKey = `${item.供应商编码}_${item.供应商商品编码}`;
          initialEditing[uniqueKey] = item.SKU || '';
        });
        setEditingSkus(initialEditing);
      }
    } catch (error) {
      message.error('加载SKU绑定数据失败');
      console.error(error);
      // 即使加载失败,也创建一个空记录用于编辑
      setBottomData([{
        供应商编码: targetRecord.供应商编码,
        供应商商品编码: targetRecord.供应商商品编码,
        SKU: '',
      }]);
      // 使用稳定的唯一标识符作为key
      const uniqueKey = `${targetRecord.供应商编码}_${targetRecord.供应商商品编码}`;
      setEditingSkus({ [uniqueKey]: '' });
      setOrderChannel(null);
    } finally {
      setBottomLoading(false);
    }
  };

  // 加载商品信息数据（从右栏库存汇总的SKU列获取数据）
  const loadProductInfoData = async () => {
    // 从右栏（库存汇总）数据中提取所有唯一的SKU
    const skus = rightData
      .map(item => item.SKU)
      .filter((sku): sku is string => !!sku && sku.trim() !== '' && sku !== '-')
      .filter((sku, index, self) => self.indexOf(sku) === index); // 去重

    console.log('[商品信息] 从右栏提取的SKU列表:', skus);
    console.log('[商品信息] 右栏数据总数:', rightData.length);

    if (skus.length === 0) {
      console.log('[商品信息] 没有找到有效的SKU，清空数据');
      setProductInfoData([]);
      return;
    }

    setProductInfoLoading(true);
    try {
      // 对每个SKU查询商品供货关系，然后合并结果
      const allResults = await Promise.all(
        skus.map(async (sku) => {
          try {
            console.log('[商品信息] 查询SKU:', sku);
            const result = await supplierQuotationApi.getProductSupplyRelations(sku);
            console.log(`[商品信息] SKU ${sku} 查询结果数量:`, result?.length || 0);
            if (result && result.length > 0) {
              console.log(`[商品信息] SKU ${sku} 查询结果示例:`, result[0]);
            }
            return result || [];
          } catch (error) {
            console.error(`[商品信息] SKU ${sku} 查询失败:`, error);
            return [];
          }
        })
      );

      // 合并所有结果
      const mergedResults = allResults.flat();
      console.log('[商品信息] 合并后的结果数量:', mergedResults.length);

      // 按供应商编码去重（使用Map保留第一条记录）
      const supplierCodeMap = new Map<string, any>();
      mergedResults.forEach(item => {
        const supplierCode = item['供应商编码'];
        if (supplierCode && !supplierCodeMap.has(supplierCode)) {
          supplierCodeMap.set(supplierCode, item);
        }
      });

      const finalData = Array.from(supplierCodeMap.values());
      console.log('[商品信息] 去重后的结果数量:', finalData.length);
      console.log('[商品信息] 最终数据:', finalData);
      setProductInfoData(finalData);
    } catch (error) {
      message.error('加载商品信息失败');
      console.error('[商品信息] 加载失败:', error);
      setProductInfoData([]);
    } finally {
      setProductInfoLoading(false);
    }
  };

  // 处理高度调整
  const handleResize = (e: MouseEvent) => {
    if (!isResizing) return;
    const deltaY = e.clientY - resizeStartYRef.current;
    const newHeight = Math.max(200, Math.min(800, resizeStartHeightRef.current + deltaY));
    setOtherInfoHeight(newHeight);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  // 监听菜单切换，当切换到商品信息时加载数据
  useEffect(() => {
    if (otherInfoActiveMenu === 'product-info' && rightData.length > 0) {
      loadProductInfoData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherInfoActiveMenu, rightData]);

  // 清理事件监听器
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // 左栏行点击
  const handleLeftRowClick = (record: SupplierQuotation, event?: React.MouseEvent) => {
    setSelectedLeftRecord(record);
    // 清空之前的采购下单渠道，等待新数据加载
    setOrderChannel(null);
    // 重置为默认菜单
    setOtherInfoActiveMenu('sku-binding');

    // 找到被点击行在 paginatedLeftData 中的索引
    const rowIndex = paginatedLeftData.findIndex(
      item => item.序号 === record.序号 ||
        (item.供应商编码 === record.供应商编码 && item.供应商商品编码 === record.供应商商品编码)
    );
    setSelectedRowIndex(rowIndex);

    // 注意：库存汇总数据已经基于所有供应商报价数据自动显示，不需要重新加载
    // 只需要加载下栏数据（包含采购下单渠道）
    loadBottomData(record);
  };

  // 右栏筛选变化
  const handleInventoryTypeChange = (value: '全部' | '仓店' | '城市') => {
    setInventoryType(value);
    // 切换维度时清空已选择的供应商名称字段
    setSupplierNameFields([]);
    setSupplierNameData({});
    // 如果切换到仓店维度，加载仓库优先级列表
    if (value === '仓店') {
      if (warehousePriorities.length === 0) {
        loadWarehousePriorities();
      }
      // 清空城市筛选
      setCityFilter('');
      // 清空门店筛选（切换维度时重置）
      setStoreNameFilter('');
      // 清空所有数据，因为必须选择门店/仓名称才能显示数据
      setLeftData([]);
      setLeftTotal(0);
      setRightData([]);
      setRightAllData([]);
      setRightTotal(0);
      setUpcToSkuMap({});
    } else if (value === '城市') {
      // 如果切换到城市维度，加载城市列表
      if (cities.length === 0) {
        loadCities();
      }
      // 清空门店筛选
      setStoreNameFilter('');
      // 清空城市筛选（切换维度时重置）
      setCityFilter('');
      // 清空所有数据，因为必须选择城市才能显示数据
      setLeftData([]);
      setLeftTotal(0);
      setRightData([]);
      setRightAllData([]);
      setRightTotal(0);
      setUpcToSkuMap({});
    } else {
      // 全部维度，清空所有筛选
      setStoreNameFilter('');
      setCityFilter('');
      // 重置分页
      setRightCurrentPage(1);
      // 注意：不在这里调用 loadRightData()，因为 inventoryType 变化会触发 useEffect
      // useEffect 会调用 loadLeftData()，而 loadLeftData() 完成后会自动调用 loadRightData()
      // 这样可以避免重复调用和竞态条件
      // 只有在已经选择了供应商编码的情况下，才会通过 useEffect 触发数据加载
    }
  };

  // 导出数据
  const handleExportData = () => {
    setExportFilter([]);
    setExportModalOpen(true);
  };

  // 确认导出
  const handleConfirmExport = async () => {
    setExportModalOpen(false);
    await performExport(exportFilter);
  };

  // 执行导出
  const performExport = async (exportFilter: string[] = []) => {
    try {
      message.loading({ content: '正在准备导出数据...', key: 'export' });

      // 1. 根据用户筛选的供应商编码获取供应商报价数据
      let allQuotations: SupplierQuotation[] = [];
      if (selectedSupplierCodes.length === 0) {
        message.warning('请先选择至少一个供应商编码');
        message.destroy('export');
        return;
      }

      // 如果有筛选条件或需要导出筛选的数据，使用 allLeftData（如果已加载）
      // 否则根据搜索条件和供应商编码加载数据
      if (allLeftData.length > 0 && selectedSupplierCodes.every(code => allLeftData.some(q => q.供应商编码 === code))) {
        // 如果 allLeftData 已经包含选中的供应商编码，直接使用
        allQuotations = allLeftData.filter(q =>
          q.供应商编码 && selectedSupplierCodes.includes(q.供应商编码)
        );
      } else {
        // 否则需要根据搜索条件和供应商编码加载数据
        const searchParams = buildSearchParams();
        const result = await supplierQuotationApi.getAll({
          page: 1,
          limit: 10000,
          ...searchParams,
          supplierCodes: selectedSupplierCodes,
        });
        allQuotations = (result.data || []).filter(item =>
          item.供应商编码 && selectedSupplierCodes.includes(item.供应商编码)
        );
      }

      if (allQuotations.length === 0) {
        message.warning('没有找到符合条件的供应商报价数据');
        message.destroy('export');
        return;
      }

      // 2. 根据仓店/城市维度筛选库存汇总数据
      let storeNamesParam: string[] | undefined;
      if (inventoryType === '仓店' && storeNameFilter && storeNameFilter.trim()) {
        // 仓店维度：只导出选中的门店/仓名称的数据
        storeNamesParam = [storeNameFilter.trim()];
      } else if (inventoryType === '城市' && cityFilter && cityFilter.trim()) {
        // 城市维度：只导出选中的城市的数据
        storeNamesParam = [cityFilter.trim()];
      }
      // 全部维度：不需要过滤，导出所有数据

      // 获取库存汇总数据（根据维度筛选）
      const inventoryResult = await supplierQuotationApi.getInventorySummary({
        type: inventoryType,
        storeNames: storeNamesParam,
      });

      // 3. 获取UPC到SKU的映射（用于匹配）
      const upcCodes = allQuotations
        .map(q => q.最小销售规格UPC商品条码)
        .filter((upc): upc is string => !!upc && upc.trim() !== '');

      let upcToSkuMapForExport: Record<string, string[]> = {};
      if (upcCodes.length > 0) {
        upcToSkuMapForExport = await supplierQuotationApi.getSkuCodesByUpcCodes({
          upcCodes: [...new Set(upcCodes)], // 去重
        });
      }

      // 4. 创建对齐的数据结构（与 alignedData 相同的逻辑）
      const exportAlignedData = allQuotations.map((quotation) => {
        // 找到匹配的库存汇总（通过SKU编码匹配，与 alignedData 逻辑一致）
        let matchedInventory: InventorySummary | null = null;

        if (quotation.最小销售规格UPC商品条码) {
          // 1. 通过UPC条码获取对应的SKU编码列表
          const skuCodes = upcToSkuMapForExport[quotation.最小销售规格UPC商品条码] || [];

          // 2. 通过SKU编码匹配库存汇总
          if (skuCodes.length > 0) {
            matchedInventory = inventoryResult.find(item => {
              if (!item.SKU) return false;
              return skuCodes.includes(item.SKU);
            }) || null;
          }
        }

        // 如果匹配到了库存汇总，计算对比结果（与 alignedData 相同的逻辑）
        if (matchedInventory) {
          // 优先使用计算后供货价格，如果为NULL则使用原供货价格
          let supplierPrice = quotation.计算后供货价格 !== undefined && quotation.计算后供货价格 !== null
            ? quotation.计算后供货价格
            : quotation.供货价格;

          // 如果供货价格为空，显示'无供货价信息'
          if (supplierPrice === undefined || supplierPrice === null) {
            matchedInventory = {
              ...matchedInventory,
              对比结果: '无供货价信息',
              对比字段类型: undefined,
              差价: undefined,
            };
          } else {
            // 根据类型选择对比逻辑
            let comparePrice: number | undefined;
            let compareFieldType: string | undefined;

            if (inventoryType === '全部') {
              // 全部：优先比最低采购价，为空则比最近采购价，还为空则比成本单价
              if (matchedInventory.最低采购价 !== undefined && matchedInventory.最低采购价 !== null) {
                comparePrice = matchedInventory.最低采购价;
                compareFieldType = '最低采购价';
              } else if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
                comparePrice = matchedInventory.最近采购价;
                compareFieldType = '最近采购价';
              } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
                comparePrice = matchedInventory.成本单价;
                compareFieldType = '成本单价';
              }
            } else {
              // 仓店/城市：优先比最近采购价，为空则比成本单价
              if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
                comparePrice = matchedInventory.最近采购价;
                compareFieldType = '最近采购价';
              } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
                comparePrice = matchedInventory.成本单价;
                compareFieldType = '成本单价';
              }
            }

            // 如果所有采购价都为空，显示'无采购价信息'
            if (comparePrice === undefined || comparePrice === null) {
              matchedInventory = {
                ...matchedInventory,
                对比结果: '无采购价信息',
                对比字段类型: undefined,
                差价: undefined,
              };
            } else {
              // 供货价格 < 采购价，显示'价格优势'（供应商报价更便宜）
              const diff = comparePrice - supplierPrice;
              matchedInventory = {
                ...matchedInventory,
                对比结果: diff > 0 ? '价格优势' : diff < 0 ? '价格偏高' : '价格相同',
                对比字段类型: compareFieldType,
                差价: diff,
              };
            }
          }
        } else {
          // 无匹配数据
          matchedInventory = {
            SKU: '',
            商品名称: '',
            规格: '',
            总部零售价: 0,
            最近采购价: 0,
            最低采购价: 0,
            成本单价: 0,
            UPC: '',
            对比结果: '无匹配数据',
          } as InventorySummary;
        }

        return {
          quotation,
          inventory: matchedInventory,
        };
      });

      // 5. 根据筛选条件过滤数据
      let filteredData = exportAlignedData;

      // 首先根据用户已经选择的对比结果筛选（comparisonResultFilter）
      if (comparisonResultFilter.length > 0) {
        filteredData = filteredData.filter(item => {
          const inventory = item.inventory;
          let result: string;

          // 判断对比结果
          if (!inventory || Object.keys(inventory).length === 0 || !inventory.对比结果) {
            result = '无匹配数据';
          } else {
            result = inventory.对比结果;
          }

          // 如果筛选条件包含'无匹配数据'，需要特殊处理空对象
          if (comparisonResultFilter.includes('无匹配数据')) {
            return comparisonResultFilter.includes(result) || (!inventory || Object.keys(inventory).length === 0);
          }
          return comparisonResultFilter.includes(result);
        });
      }

      // 然后根据导出模态框中选择的对比结果筛选（exportFilter）
      if (exportFilter.length > 0) {
        filteredData = filteredData.filter(item => {
          const inventory = item.inventory;
          let result: string;

          // 判断对比结果
          if (!inventory || Object.keys(inventory).length === 0 || !inventory.对比结果) {
            result = '无匹配数据';
          } else {
            result = inventory.对比结果;
          }

          // 如果筛选条件包含'无匹配数据'，需要特殊处理空对象
          if (exportFilter.includes('无匹配数据')) {
            return exportFilter.includes(result) || (!inventory || Object.keys(inventory).length === 0);
          }
          return exportFilter.includes(result);
        });
      }

      if (filteredData.length === 0) {
        message.warning('没有找到符合条件的导出数据');
        message.destroy('export');
        return;
      }

      // 获取可见的列
      const leftColumns = getFilteredLeftColumns();
      const rightColumns = getFilteredRightColumns();

      // 构建表头：供应商报价字段 + 分隔列 + 库存汇总字段
      const headers: string[] = [];
      leftColumns.forEach(col => {
        headers.push(col.title as string);
      });
      // 添加分隔列
      headers.push('分隔列');
      rightColumns.forEach(col => {
        headers.push(col.title as string);
      });

      // 构建数据行
      const rows = filteredData.map(item => {
        const row: any[] = [];

        // 供应商报价字段
        leftColumns.forEach(col => {
          const key = col.dataIndex as string;
          const value = (item.quotation as any)[key];
          if (col.render && typeof value !== 'undefined' && value !== null) {
            // 对于有render函数的列，需要手动格式化
            if (key === '供货价格') {
              row.push(value ? `¥${Number(value).toFixed(4)}` : '-');
            } else {
              row.push(value ?? '');
            }
          } else {
            row.push(value ?? '');
          }
        });

        // 添加分隔列（空值）
        row.push('');

        // 库存汇总字段
        rightColumns.forEach(col => {
          const key = col.dataIndex as string;
          let value = item.inventory ? ((item.inventory as any)[key]) : '';

          // 对于供应商名称字段，从supplierNameData中获取数据
          if (key === '供应商名称' || key === '供应商名称(最低价)' || key === '供应商名称(最近时间)') {
            const inventory = item.inventory as InventorySummary;
            if (inventory?.SKU) {
              if (key === '供应商名称') {
                if (inventoryType === '仓店' && inventory['门店/仓库名称']) {
                  const supplierKey = `${inventory.SKU}_${inventory['门店/仓库名称']}`;
                  value = supplierNameData[supplierKey] || '';
                } else if (inventoryType === '全部') {
                  const supplierKey = `${inventory.SKU}`;
                  value = supplierNameData[supplierKey] || '';
                }
              } else if (key === '供应商名称(最低价)') {
                const supplierKey = `${inventory.SKU}_最低价`;
                value = supplierNameData[supplierKey] || '';
              } else if (key === '供应商名称(最近时间)') {
                const supplierKey = `${inventory.SKU}_最近时间`;
                value = supplierNameData[supplierKey] || '';
              }
            }
          }

          if (col.render && typeof value !== 'undefined' && value !== null) {
            // 对于有render函数的列，需要手动格式化
            if (key === '总部零售价' || key === '最近采购价' || key === '最低采购价' || key === '成本单价') {
              row.push(value ? `¥${Number(value).toFixed(2)}` : '-');
            } else if (key === '对比结果') {
              row.push(value || '无匹配数据');
            } else {
              row.push(value ?? '');
            }
          } else {
            row.push(value ?? '');
          }
        });

        return row;
      });

      // 创建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // 设置列宽
      const colWidths = headers.map((_, index) => {
        // 分隔列使用固定宽度
        if (headers[index] === '分隔列') {
          return { wch: 5 };
        }
        const columnData = rows.map(row => row[index]);
        const maxLength = Math.max(
          headers[index]?.length || 10,
          ...columnData.map(cell => String(cell).length)
        );
        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
      ws['!cols'] = colWidths;

      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '供应商报价与库存汇总');

      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filterText = exportFilter.length > 0 ? `_${exportFilter.join('_')}` : '';
      const finalFileName = `供应商报价与库存汇总${filterText}_${timestamp}.xlsx`;

      // 导出文件
      XLSX.writeFile(wb, finalFileName);

      message.destroy('export');
      message.success(`成功导出 ${filteredData.length} 条数据`);
    } catch (error: any) {
      message.destroy('export');
      console.error('导出失败:', error);
      message.error(`导出失败: ${error?.message || '未知错误'}`);
    }
  };

  // 保存下栏SKU绑定
  const handleSaveSkuBindings = async () => {
    if (!selectedLeftRecord || !selectedLeftRecord.供应商编码 || !selectedLeftRecord.供应商商品编码) {
      message.warning('请先选择左栏数据');
      return;
    }

    try {
      // 获取所有编辑的SKU值，使用新的唯一标识符格式
      const skuValues = Object.entries(editingSkus)
        .map(([key, sku]) => {
          // key格式为: 供应商编码_供应商商品编码
          const skuValue = sku?.trim() || '';
          return { key, sku: skuValue };
        })
        .filter(item => item.sku); // 只保存非空的SKU

      if (skuValues.length === 0) {
        message.warning('请输入至少一个SKU');
        return;
      }

      // 保存所有SKU绑定
      const promises = skuValues.map(({ sku }) =>
        supplierQuotationApi.updateSkuBinding({
          supplierCode: selectedLeftRecord.供应商编码!,
          supplierProductCode: selectedLeftRecord.供应商商品编码!,
          sku: sku,
        })
      );

      await Promise.all(promises);
      message.success('保存成功');
      loadBottomData();
    } catch (error) {
      message.error('保存失败');
      console.error(error);
    }
  };

  // 初始化加载供应商编码列表
  useEffect(() => {
    loadAllSupplierCodes();
  }, []);

  // 移除自动搜索：所有筛选和搜索都需要点击搜索按钮才会执行
  // 只保留分页变化时的自动加载（这是表格分页器的正常行为）
  useEffect(() => {
    // 如果正在手动加载，跳过（避免重复调用）
    if (isLoadingManuallyRef.current) {
      return;
    }

    // 只有在分页变化时才自动加载数据（这是表格分页器的正常行为）
    // 其他条件（供应商编码、搜索条件等）的变化不会触发自动加载
    // 如果没有选择供应商编码，清空数据
    if (selectedSupplierCodes.length === 0) {
      setLeftData([]);
      setLeftTotal(0);
      setRightData([]);
      setRightAllData([]);
      setRightTotal(0);
      setUpcToSkuMap({});
      return;
    }

    // 只有在有数据且分页变化时才加载对应页的数据
    if (leftTotal > 0) {
      loadLeftData(undefined, undefined, undefined, leftCurrentPage, leftPageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftCurrentPage, leftPageSize]);

  // 当右侧分页或数据变化时，重新应用分页（不重新加载数据，只重新切片）
  // 注意：供应商名称查询逻辑已移到下面的 useEffect 中，避免重复查询

  // 移除自动搜索：当库存汇总SKU搜索条件变化时，不再自动重新过滤数据
  // 用户需要点击搜索按钮才会触发搜索

  // 当右侧分页或数据变化时，重新应用分页（不重新加载数据，只重新切片）
  // 同时延迟加载当前页的SKU绑定数据（避免在大量数据时创建大量并发请求）
  useEffect(() => {
    // 只有在有数据且不在加载中时才重新切片
    if (rightAllData.length > 0 && !rightLoading) {
      const start = (rightCurrentPage - 1) * rightPageSize;
      const end = start + rightPageSize;
      const paginatedData = rightAllData.slice(start, end);
      setRightData(paginatedData);

      // 延迟加载当前页的SKU绑定数据（延迟500ms，避免阻塞页面渲染）
      // 只加载当前页对应的供应商报价数据的SKU绑定，而不是所有数据
      const timer = setTimeout(async () => {
        // 获取当前页对应的供应商报价数据
        // 通过alignedData找到当前页的库存汇总数据对应的供应商报价数据
        const currentPageQuotations: SupplierQuotation[] = [];
        const upcMap = upcToSkuMap; // 使用当前状态值
        const leftDataToUse = allLeftData.length > 0 ? allLeftData : leftData; // 使用当前状态值

        paginatedData.forEach((inventoryItem: InventorySummary) => {
          if (inventoryItem.SKU && upcMap) {
            // 通过SKU找到对应的UPC
            const matchedUpc = Object.entries(upcMap).find(([upc, skus]) =>
              skus.includes(inventoryItem.SKU!)
            )?.[0];
            if (matchedUpc) {
              // 通过UPC找到对应的供应商报价
              const matchedQuotation = leftDataToUse.find(q => q.最小销售规格UPC商品条码 === matchedUpc);
              if (matchedQuotation && !currentPageQuotations.find(q =>
                q.供应商编码 === matchedQuotation.供应商编码 &&
                q.供应商商品编码 === matchedQuotation.供应商商品编码
              )) {
                currentPageQuotations.push(matchedQuotation);
              }
            }
          }
        });

        // 只加载当前页的SKU绑定数据（最多10条，不会造成性能问题）
        if (currentPageQuotations.length > 0) {
          await loadSkuBindingMap(currentPageQuotations, upcMap);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightCurrentPage, rightPageSize, rightAllData, rightLoading]);

  // 注意：移除了当库存类型变化时的 useEffect，因为 loadLeftData 完成后会自动调用 loadRightData
  // 这样可以避免重复调用和竞态条件

  // 初始化加载仓库优先级列表和城市列表
  useEffect(() => {
    if (inventoryType === '仓店' && warehousePriorities.length === 0) {
      loadWarehousePriorities();
    } else if (inventoryType === '城市' && cities.length === 0) {
      loadCities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]);

  // 移除自动筛选：筛选对比结果不再自动触发，需要点击搜索按钮才执行
  // 筛选逻辑已在点击搜索按钮时处理，并在 filteredAlignedData 中实现

  // 数据加载完成后重新计算表格高度
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mergedTableContainerRef.current) {
        const containerHeight = mergedTableContainerRef.current.clientHeight;
        // 减去分页器高度（约64px）和padding（32px）
        const calculatedHeight = containerHeight - 96;
        setMergedTableHeight(Math.max(300, calculatedHeight));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [leftData, rightData, leftLoading, rightLoading]);


  // 计算表格高度
  useEffect(() => {
    const updateTableHeights = () => {
      // 使用setTimeout确保DOM已渲染
      setTimeout(() => {
        if (mergedTableContainerRef.current) {
          const containerHeight = mergedTableContainerRef.current.clientHeight;
          // 减去分页器高度（约64px）和padding（32px）
          const calculatedHeight = containerHeight - 96;
          setMergedTableHeight(Math.max(300, calculatedHeight));
        }
      }, 100);
    };

    updateTableHeights();

    // 使用ResizeObserver监听容器大小变化
    const mergedObserver = mergedTableContainerRef.current
      ? new ResizeObserver(updateTableHeights)
      : null;

    if (mergedObserver && mergedTableContainerRef.current) {
      mergedObserver.observe(mergedTableContainerRef.current);
    }

    window.addEventListener('resize', updateTableHeights);

    return () => {
      window.removeEventListener('resize', updateTableHeights);
      if (mergedObserver) mergedObserver.disconnect();
    };
  }, []);

  // 获取当前页的供应商报价数据
  // 注意：leftData 已经是 API 返回的当前页数据，不需要再次切片
  const paginatedLeftData = useMemo(() => {
    return leftData;
  }, [leftData]);

  // 根据是否有筛选条件决定使用哪些数据
  // 如果有筛选对比结果或SKU搜索，使用所有数据（allLeftData）；否则使用当前页数据（paginatedLeftData）
  // 注意：当有筛选对比结果或SKU搜索时，必须使用 allLeftData，不能使用 leftData（当前页数据）
  const dataForAlignment = useMemo(() => {
    const hasFilter = comparisonResultFilter.length > 0 || inventorySkuSearch.trim();
    if (hasFilter) {
      // 如果有筛选对比结果或SKU搜索，必须使用 allLeftData（所有数据）
      // 如果 allLeftData 为空，说明还没有加载所有数据
      // 如果用户已经点击过搜索按钮，说明数据正在加载中，返回空数组等待数据加载
      // 如果用户还没有点击过搜索按钮，返回空数组（不会提示，因为用户还没有触发搜索）
      if (allLeftData.length === 0 && !hasClickedSearchRef.current) {
        // 数据未加载且用户未点击过搜索，返回空数组（不会显示数据，用户需要点击搜索）
        return [];
      }
      // 数据已加载或用户已点击过搜索（数据正在加载中），返回当前数据
      return allLeftData;
    }
    return paginatedLeftData;
  }, [comparisonResultFilter, inventorySkuSearch, allLeftData, paginatedLeftData]);

  // 创建对齐的数据结构：以供应商报价为主，为每条报价找到匹配的库存汇总
  const alignedData = useMemo(() => {
    // 为每条供应商报价找到匹配的库存汇总
    // 使用rightAllData（所有数据）进行匹配，而不是分页后的rightData
    return dataForAlignment.map((quotation) => {
      // 找到匹配的库存汇总（通过SKU编码匹配）
      let matchedInventory: InventorySummary | null = null;

      if (quotation.最小销售规格UPC商品条码) {
        // 1. 通过UPC条码获取对应的SKU编码列表
        const skuCodes = upcToSkuMap[quotation.最小销售规格UPC商品条码] || [];

        // 2. 通过SKU编码匹配库存汇总
        if (skuCodes.length > 0) {
          matchedInventory = rightAllData.find(item => {
            if (!item.SKU) return false;
            return skuCodes.includes(item.SKU);
          }) || null;
        }
      }

      // 如果匹配到了库存汇总，计算对比结果（与导出逻辑一致，确保基于当前供应商报价数据）
      // 注意：为了确保对比结果的准确性和一致性，这里总是重新计算对比结果
      // 因为 rightAllData 中的对比结果可能是基于不同的供应商报价数据计算的
      if (matchedInventory) {
        // 优先使用计算后供货价格，如果为NULL则使用原供货价格
        let supplierPrice = quotation.计算后供货价格 !== undefined && quotation.计算后供货价格 !== null
          ? quotation.计算后供货价格
          : quotation.供货价格;

        // 如果供货价格为空，显示'无供货价信息'
        if (supplierPrice === undefined || supplierPrice === null) {
          matchedInventory = {
            ...matchedInventory,
            对比结果: '无供货价信息',
            对比字段类型: undefined,
            差价: undefined,
          };
        } else {
          // 根据类型选择对比逻辑
          let comparePrice: number | undefined;
          let compareFieldType: string | undefined;

          if (inventoryType === '全部') {
            // 全部：优先比最低采购价，为空则比最近采购价，还为空则比成本单价
            if (matchedInventory.最低采购价 !== undefined && matchedInventory.最低采购价 !== null) {
              comparePrice = matchedInventory.最低采购价;
              compareFieldType = '最低采购价';
            } else if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
              comparePrice = matchedInventory.最近采购价;
              compareFieldType = '最近采购价';
            } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
              comparePrice = matchedInventory.成本单价;
              compareFieldType = '成本单价';
            }
          } else {
            // 仓店/城市：优先比最近采购价，为空则比成本单价
            if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
              comparePrice = matchedInventory.最近采购价;
              compareFieldType = '最近采购价';
            } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
              comparePrice = matchedInventory.成本单价;
              compareFieldType = '成本单价';
            }
          }

          // 如果所有采购价都为空，显示'无采购价信息'
          if (comparePrice === undefined || comparePrice === null) {
            matchedInventory = {
              ...matchedInventory,
              对比结果: '无采购价信息',
              对比字段类型: undefined,
              差价: undefined,
            };
          } else {
            // 供货价格 < 采购价，显示'价格优势'（供应商报价更便宜）
            const diff = comparePrice - supplierPrice;
            matchedInventory = {
              ...matchedInventory,
              对比结果: diff > 0 ? '价格优势' : diff < 0 ? '价格偏高' : '价格相同',
              对比字段类型: compareFieldType,
              差价: diff,
            };
          }
        }
      }

      return {
        quotation,
        inventory: matchedInventory,
      };
    });
  }, [dataForAlignment, rightAllData, inventoryType, upcToSkuMap, ratioData]);

  // 应用对比结果筛选后的对齐数据
  // 注意：这里会对所有数据进行筛选（alignedData 基于 allLeftData 和 rightAllData）
  // 筛选逻辑：
  // 1. 如果有SKU搜索，先进行SKU精确匹配过滤（只保留SKU完全匹配的数据，排除没匹配上的供应商报价）
  // 2. 如果有筛选对比结果，再进行筛选对比结果过滤
  const filteredAlignedData = useMemo(() => {
    let dataToFilter = alignedData;

    // 如果有SKU搜索，先进行SKU LIKE匹配过滤（不区分大小写）
    // 注意：没匹配上的SKU对应的供应商报价数据也应该被排除
    if (inventorySkuSearch.trim()) {
      const searchSku = inventorySkuSearch.trim().toLowerCase();
      dataToFilter = alignedData.filter(item => {
        const inventory = item.inventory;
        // 如果没有匹配的库存汇总数据，在SKU搜索时应该排除（排除没匹配上的供应商报价）
        if (!inventory || Object.keys(inventory).length === 0 || !inventory.SKU) {
          return false;
        }
        // SKU LIKE匹配（不区分大小写）：SKU包含搜索值
        const sku = String(inventory.SKU).toLowerCase();
        return sku.includes(searchSku);
      });
    }

    // 如果有筛选对比结果，再进行筛选对比结果过滤
    if (comparisonResultFilter.length === 0) {
      return dataToFilter;
    }

    return dataToFilter.filter((item, index) => {
      const inventory = item.inventory;
      let result: string;

      // 判断对比结果
      if (!inventory || Object.keys(inventory).length === 0) {
        result = '无匹配数据';
      } else {
        result = inventory.对比结果 || '无匹配数据';
      }

      // 如果筛选条件包含'无匹配数据'，需要特殊处理空对象
      if (comparisonResultFilter.includes('无匹配数据')) {
        return comparisonResultFilter.includes(result) || (!inventory || Object.keys(inventory).length === 0);
      }
      return comparisonResultFilter.includes(result);
    });
  }, [alignedData, comparisonResultFilter, inventorySkuSearch]);

  // 右栏对齐的数据（与左栏行数一致，没有匹配的用null占位），并应用对比结果筛选
  const alignedRightData = useMemo(() => {
    return filteredAlignedData.map(item => item.inventory || ({} as InventorySummary));
  }, [filteredAlignedData]);

  // 左栏筛选后的数据（与右栏对齐），并应用分页
  // 注意：如果有SKU搜索或对比结果筛选，需要基于 filteredAlignedData 进行分页
  const filteredLeftData = useMemo(() => {
    const allFiltered = filteredAlignedData.map(item => item.quotation);
    // 如果有SKU搜索或对比结果筛选，需要分页显示
    const hasFilter = comparisonResultFilter.length > 0 || inventorySkuSearch.trim();
    if (hasFilter) {
      const start = (leftCurrentPage - 1) * leftPageSize;
      const end = start + leftPageSize;
      return allFiltered.slice(start, end);
    }
    // 如果没有筛选条件，使用当前页数据（leftData）
    return paginatedLeftData;
  }, [filteredAlignedData, comparisonResultFilter.length, inventorySkuSearch, leftCurrentPage, leftPageSize, paginatedLeftData]);

  // 右栏筛选后的数据（与左栏对齐），并应用分页
  // 注意：如果有SKU搜索或对比结果筛选，需要基于 filteredAlignedData 进行分页
  const filteredRightData = useMemo(() => {
    const hasFilter = comparisonResultFilter.length > 0 || inventorySkuSearch.trim();
    if (hasFilter) {
      const allFiltered = filteredAlignedData.map(item => item.inventory || ({} as InventorySummary));
      // 如果有筛选条件，需要分页显示
      const start = (leftCurrentPage - 1) * leftPageSize;
      const end = start + leftPageSize;
      return allFiltered.slice(start, end);
    }
    // 如果没有筛选条件，使用当前页数据（rightData）
    return rightData;
  }, [filteredAlignedData, comparisonResultFilter.length, inventorySkuSearch, leftCurrentPage, leftPageSize, rightData]);

  // 计算所有匹配的供应商报价数据（用于分页和显示）
  const matchedQuotations = useMemo(() => {
    const currentAlignedData = comparisonResultFilter.length > 0 ? filteredAlignedData : alignedData;
    // 只返回匹配到库存汇总的供应商报价数据
    return currentAlignedData
      .filter(item => item.inventory && Object.keys(item.inventory).length > 0)
      .map(item => item.quotation);
  }, [filteredAlignedData, alignedData, comparisonResultFilter.length]);

  // 计算所有供应商报价数据总数（用于分页）
  // 注意：如果有SKU搜索或对比结果筛选，使用 filteredAlignedData.length（基于所有数据筛选后的结果）
  // 如果没有筛选条件，使用 leftTotal（后端返回的总数）
  const matchedQuotationTotal = useMemo(() => {
    const hasFilter = comparisonResultFilter.length > 0 || inventorySkuSearch.trim();
    // 如果有筛选条件，使用 filteredAlignedData 的长度（基于所有数据的筛选结果）
    if (hasFilter) {
      return filteredAlignedData.length;
    }
    // 如果没有筛选条件，使用后端返回的总数
    return leftTotal;
  }, [leftTotal, filteredAlignedData.length, comparisonResultFilter.length, inventorySkuSearch]);

  // 合并后的数据：将供应商报价和库存汇总数据合并，并标识数据来源
  // 注意：如果有SKU搜索或对比结果筛选，使用 filteredAlignedData（基于所有数据筛选后的结果）
  // 如果没有筛选条件，使用 alignedData（基于当前页数据）
  const mergedData = useMemo(() => {
    const result: Array<{
      key: string;
      dataType: 'quotation' | 'inventory';
      quotation?: SupplierQuotation;
      inventory?: InventorySummary;
      hasMatch: boolean;
    }> = [];

    // 如果有SKU搜索或对比结果筛选，使用 filteredAlignedData（基于所有数据筛选后的结果）
    // 如果没有筛选条件，使用 alignedData（基于当前页数据）
    const hasFilter = comparisonResultFilter.length > 0 || inventorySkuSearch.trim();
    const currentAlignedData = hasFilter ? filteredAlignedData : alignedData;

    // 获取所有供应商报价数据（包括匹配和未匹配的）
    // 使用组合字段确保 key 的唯一性：供应商编码_供应商商品编码_序号_index
    const allQuotationData = currentAlignedData.map((item, index) => {
      // 组合多个字段确保 key 唯一性
      const quotationKey = [
        item.quotation.供应商编码 || '',
        item.quotation.供应商商品编码 || '',
        item.quotation.序号 || '',
        index
      ].filter(Boolean).join('_');

      // 判断是否有匹配的库存汇总
      const hasMatch = item.inventory && Object.keys(item.inventory).length > 0;

      return {
        key: `quotation-${quotationKey}`,
        dataType: 'quotation' as const,
        quotation: item.quotation,
        inventory: hasMatch ? item.inventory : undefined,
        hasMatch,
      };
    });

    // 注意：根据用户需求，SKU搜索和对比结果筛选只显示匹配的数据，不显示未匹配的库存汇总数据
    // 如果有筛选条件（SKU搜索或对比结果筛选），allQuotationData 已经基于 filteredAlignedData（完整筛选后的数据）
    // 需要基于 allQuotationData 进行分页
    // 如果没有筛选条件，allQuotationData 基于 alignedData（当前页数据），不需要再次分页

    if (hasFilter) {
      // 如果有筛选条件，需要基于完整筛选后的数据进行分页
      const start = (leftCurrentPage - 1) * leftPageSize;
      const end = start + leftPageSize;
      return allQuotationData.slice(start, end);
    }

    // 如果没有筛选条件，allQuotationData 已经是当前页数据，直接返回
    return allQuotationData;
  }, [filteredAlignedData, alignedData, comparisonResultFilter.length, inventorySkuSearch, leftCurrentPage, leftPageSize]);

  // 关键修复：从 mergedData 中提取第一页显示的库存汇总数据，查询供应商名称
  // mergedData 是用户真正看到的第一页数据，而 rightAllData 不是
  useEffect(() => {
    // 只有在有数据且不在加载中，且选择了供应商名称字段时才查询
    if (mergedData.length > 0 && !rightLoading && supplierNameFields.length > 0) {
      // 从 mergedData 中提取第一页显示的库存汇总数据的SKU
      // mergedData 中的每一项都有 inventory 字段，如果存在且是库存汇总数据，则提取SKU
      const currentPageInventoryData: InventorySummary[] = mergedData
        .filter(item => item.inventory && item.inventory.SKU) // 只提取有SKU的库存汇总数据
        .map(item => item.inventory!); // 提取 inventory 数据

      // 去重：同一个SKU可能出现在多个供应商报价的匹配中
      const uniqueInventoryData = currentPageInventoryData.reduce((acc, item) => {
        const skuKey = String(item.SKU).trim();
        if (!acc.find(existing => String(existing.SKU).trim() === skuKey)) {
          acc.push(item);
        }
        return acc;
      }, [] as InventorySummary[]);

      if (uniqueInventoryData.length > 0) {
        // 查询所有当前页的SKU（包括已查询的，因为可能只查询了部分字段）
        loadSupplierNames(uniqueInventoryData, supplierNameFields);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedData, rightLoading, supplierNameFields]);

  // 获取合并后的表格列定义
  const getMergedColumns = (): ColumnType<any>[] => {
    // 获取过滤后的左栏列（应用列设置）
    const filteredLeftColumns = getFilteredLeftColumns();
    // 获取过滤后的右栏列（应用列设置）
    const filteredRightColumns = getFilteredRightColumns();

    // 合并列，供应商报价列在前，库存汇总列在后
    const merged: ColumnType<any>[] = [];

    // 添加数据来源标识列（隐藏，仅用于标识）
    merged.push({
      title: '数据来源',
      dataIndex: 'dataType',
      key: 'dataType',
      width: 0,
      render: () => null,
    });

    // 添加供应商报价列（只添加未隐藏的列）
    filteredLeftColumns.forEach(col => {
      merged.push({
        ...col,
        render: (text: any, record: any) => {
          if (record.dataType === 'quotation' && record.quotation) {
            const value = (record.quotation as any)[col.dataIndex as string];
            const renderedValue = col.render ? col.render(value, record.quotation, 0) : (value ?? '-');
            // 供应商报价数据使用蓝色文字
            return <span style={{ color: '#1890ff' }}>{renderedValue}</span>;
          }
          return '-';
        },
      });
    });

    // 添加库存汇总列（只添加未隐藏的列）
    filteredRightColumns.forEach(col => {
      merged.push({
        ...col,
        render: (text: any, record: any) => {
          // 处理库存汇总数据（可能没有匹配的供应商报价）
          if (record.inventory) {
            const value = (record.inventory as any)[col.dataIndex as string];
            // 对于SKU列，确保即使value为空也能正确传递给render函数
            const valueToRender = col.key === 'SKU' ? (value ?? null) : value;
            const renderedValue = col.render ? col.render(valueToRender, record.inventory, 0) : (value ?? '-');
            // 库存汇总数据使用黑色文字
            // 如果是对比结果列或SKU列，需要特殊处理
            if (col.key === '对比结果') {
              return renderedValue; // 对比结果列已经有Tag渲染，不需要再包裹
            }
            if (col.key === 'SKU') {
              // SKU列已经有Popover和Tag渲染，不需要再包裹
              // 确保返回的是React元素，而不是字符串
              if (renderedValue && typeof renderedValue === 'object' && 'type' in renderedValue) {
                // 如果已经是React元素，确保它有data-sku-column属性
                // 由于renderedValue已经是React元素，我们需要用div包裹它以确保有data-sku-column属性
                return (
                  <div
                    data-sku-column="true"
                    onClick={(e) => {
                      // 阻止事件冒泡，避免触发行点击事件
                      e.stopPropagation();
                    }}
                  >
                    {renderedValue}
                  </div>
                );
              }
              // 如果不是React元素，说明render函数可能返回了字符串或其他值
              // 这种情况下，应该返回一个可点击的元素
              return (
                <div
                  data-sku-column="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('[SKU绑定] 合并表格中SKU列render返回非React元素，点击事件:', {
                      value,
                      renderedValue,
                      inventory: record.inventory,
                      colKey: col.key,
                    });
                  }}
                >
                  <span style={{ cursor: 'pointer', color: '#999' }}>{renderedValue || '-'}</span>
                </div>
              );
            }
            return <span style={{ color: '#000000' }}>{renderedValue}</span>;
          }
          return '-';
        },
      });
    });

    return merged;
  };

  // 获取过滤后的合并列
  const getFilteredMergedColumns = (): ColumnType<any>[] => {
    const allColumns = getMergedColumns();
    // 过滤掉数据来源列（隐藏列）
    return allColumns.filter(col => col.key !== 'dataType');
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          /* 点击后的高亮样式 */
          .ant-table-tbody > tr.merged-row-selected > td {
            background-color: #e6f7ff !important;
          }
          .ant-table-tbody > tr.merged-row-selected:hover > td {
            background-color: #e6f7ff !important;
          }
          
          /* 确保SKU绑定的Popover显示在其他元素之上 */
          .ant-popover.sku-binding-popover {
            z-index: 2000 !important;
          }
          .ant-popover.sku-binding-popover .ant-popover-content {
            z-index: 2000 !important;
          }
          .ant-popover.sku-binding-popover .ant-popover-inner {
            z-index: 2000 !important;
          }
          /* 确保Popover不会被表格遮挡 */
          .ant-popover[data-sku-binding="true"] {
            z-index: 2000 !important;
          }
        `
      }} />
      <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 合并的表格容器 */}
        <Card
          title="供应商报价与库存汇总"
          extra={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {/* 供应商报价搜索区域 */}
              <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 4, marginBottom: 4 }}>
                <div style={{ marginBottom: 4, fontWeight: 500, color: '#1890ff', fontSize: '13px' }}>供应商报价</div>
                <Space wrap size="small">
                  <Select
                    mode="multiple"
                    value={selectedSupplierCodes}
                    options={allSupplierCodes
                      .filter(code =>
                        !supplierCodeSearchValue ||
                        code.toLowerCase().includes(supplierCodeSearchValue.toLowerCase())
                      )
                      .map(code => ({
                        value: code,
                        label: code,
                      }))}
                    onSearch={(value) => setSupplierCodeSearchValue(value)}
                    onChange={(values) => {
                      // 只保留在allSupplierCodes中存在的值
                      const validValues = values.filter(v => allSupplierCodes.includes(v));
                      // 如果过滤后有值被移除，提示用户
                      if (values.length > validValues.length) {
                        setSupplierCodeSearchValue('');
                        message.warning('只能选择下拉框中的供应商编码');
                      }
                      // 只更新状态，不自动加载数据，需要点击搜索按钮才执行
                      setSelectedSupplierCodes(validValues);
                    }}
                    onDeselect={(value) => {
                      // 取消选择时，只更新状态，不自动加载数据
                      const newValues = selectedSupplierCodes.filter(v => v !== value);
                      setSelectedSupplierCodes(newValues);
                    }}
                    placeholder="选择供应商编码（可输入筛选）"
                    style={{ width: 200 }}
                    size="small"
                    allowClear
                    showSearch
                    maxTagCount="responsive"
                    dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
                    filterOption={false}
                    notFoundContent={supplierCodeSearchValue ? '未找到匹配的供应商编码' : '请输入供应商编码进行筛选'}
                  />
                  <Input
                    placeholder="搜索供应商名称"
                    value={supplierNameSearch}
                    onChange={(e) => setSupplierNameSearch(e.target.value)}
                    allowClear
                    style={{ width: 150 }}
                    size="small"
                  />
                  <Input
                    placeholder="搜索供应商编码"
                    value={supplierCodeSearch}
                    onChange={(e) => setSupplierCodeSearch(e.target.value)}
                    allowClear
                    style={{ width: 150 }}
                    size="small"
                  />
                  <Input
                    placeholder="搜索商品名称"
                    value={productNameSearch}
                    onChange={(e) => setProductNameSearch(e.target.value)}
                    allowClear
                    style={{ width: 150 }}
                    size="small"
                  />
                  <Input
                    placeholder="搜索最小销售规格UPC商品条码"
                    value={upcCodeSearch}
                    onChange={(e) => setUpcCodeSearch(e.target.value)}
                    allowClear
                    style={{ width: 200 }}
                    size="small"
                  />
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={async () => {
                      if (selectedSupplierCodes.length === 0) {
                        message.warning('请至少选择一个供应商编码');
                        return;
                      }
                      // 标记用户已点击过搜索按钮
                      hasClickedSearchRef.current = true;
                      setLeftCurrentPage(1);
                      setRightCurrentPage(1);
                      // 传递页码1，确保加载第一页数据
                      await loadLeftData(undefined, undefined, undefined, 1, leftPageSize);
                      // 如果没有筛选条件，清空 allLeftData
                      if (!comparisonResultFilter.length && !inventorySkuSearch.trim()) {
                        setAllLeftData([]);
                      }
                    }}
                    disabled={selectedSupplierCodes.length === 0}
                    size="small"
                  >
                    搜索
                  </Button>
                  <Popover
                    content={
                      <ColumnSettings
                        columns={getAllLeftColumns()}
                        hiddenColumns={leftHiddenColumns}
                        columnOrder={leftColumnOrder}
                        onToggleVisibility={handleLeftToggleVisibility}
                        onMoveColumn={handleLeftMoveColumn}
                        onColumnOrderChange={handleLeftColumnOrderChange}
                      />
                    }
                    title="列设置"
                    trigger="click"
                    open={leftColumnSettingsOpen}
                    onOpenChange={setLeftColumnSettingsOpen}
                    placement="bottomRight"
                  >
                    <Button icon={<SettingOutlined />} size="small">列设置</Button>
                  </Popover>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleResetSearch}
                    loading={leftLoading}
                    size="small"
                  >
                    重置
                  </Button>
                </Space>
              </div>
              {/* 库存汇总搜索区域 */}
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500, color: '#52c41a', fontSize: '13px' }}>库存汇总</div>
                <Space wrap size="small">
                  <Input
                    placeholder="搜索SKU"
                    value={inventorySkuSearch}
                    onChange={(e) => setInventorySkuSearch(e.target.value)}
                    allowClear
                    style={{ width: 150 }}
                    size="small"
                  />
                  <Select
                    mode="multiple"
                    placeholder="筛选对比结果"
                    value={comparisonResultFilter}
                    onChange={(values) => {
                      // 只更新状态，不自动筛选，需要点击搜索按钮才执行
                      setComparisonResultFilter(values);
                    }}
                    style={{ minWidth: 150 }}
                    maxTagCount="responsive"
                    allowClear
                    size="small"
                    options={comparisonResultOptions.map(opt => ({
                      label: (
                        <Space>
                          <Tag color={opt.color}>{opt.label}</Tag>
                        </Space>
                      ),
                      value: opt.value,
                    }))}
                  />
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={async () => {
                      if (selectedSupplierCodes.length === 0) {
                        message.warning('请至少选择一个供应商编码');
                        return;
                      }
                      // 重置到第一页
                      setLeftCurrentPage(1);
                      setRightCurrentPage(1);

                      // 标记用户已点击过搜索按钮
                      hasClickedSearchRef.current = true;

                      // 如果有对比结果筛选或SKU搜索，需要加载所有供应商报价数据和所有库存汇总数据用于筛选
                      if (comparisonResultFilter.length > 0 || inventorySkuSearch.trim()) {
                        // 设置加载状态
                        setLeftLoading(true);
                        setRightLoading(true);

                        try {
                          // 先直接获取所有供应商报价数据（包含搜索条件），支持缓存
                          const searchParams = buildSearchParams();
                          let allQuotationData: SupplierQuotation[] = [];

                          // 尝试从缓存读取
                          const cachedData = getQuotationFromCache(selectedSupplierCodes, searchParams);
                          if (cachedData) {
                            console.log('[缓存] 从缓存读取供应商报价数据，数量:', cachedData.length);
                            allQuotationData = cachedData;
                            setAllLeftData(cachedData);
                          } else {
                            // 缓存未命中，从API加载
                            console.log('[缓存] 从API加载供应商报价数据');
                            const allQuotationResult = await supplierQuotationApi.getAll({
                              page: 1,
                              limit: 10000,
                              ...searchParams,
                              supplierCodes: selectedSupplierCodes,
                            });
                            allQuotationData = (allQuotationResult.data || []).filter(item =>
                              item.供应商编码 && selectedSupplierCodes.includes(item.供应商编码)
                            );
                            // 保存到缓存
                            setQuotationCache(selectedSupplierCodes, searchParams, allQuotationData);
                            // 更新 allLeftData 状态（先设置，确保 dataForAlignment 能使用）
                            setAllLeftData(allQuotationData);
                          }

                          // 同时更新 leftData 和 leftTotal（用于分页器显示）
                          setLeftData(allQuotationData.slice(0, leftPageSize));
                          setLeftTotal(allQuotationData.length);

                          if (allQuotationData.length > 0) {
                            // 加载所有库存汇总数据（不进行SKU过滤），筛选逻辑会在前端基于所有数据执行
                            // 注意：即使有SKU搜索，也要先加载所有数据，计算对比结果，然后再在 filteredAlignedData 中进行SKU过滤和筛选对比结果过滤
                            await loadRightData(allQuotationData, selectedSupplierCodes, storeNameFilter, cityFilter, true);
                          } else {
                            // 如果没有数据，清空库存汇总
                            setRightData([]);
                            setRightAllData([]);
                            setRightTotal(0);
                            setUpcToSkuMap({});
                            setRightLoading(false);
                          }
                        } catch (error) {
                          message.error('加载数据失败');
                          console.error(error);
                        } finally {
                          setLeftLoading(false);
                          // rightLoading 会在 loadRightData 中设置为 false
                        }
                      } else {
                        // 如果没有对比结果筛选和SKU搜索，正常加载数据
                        // 先加载供应商报价数据（第一页，用于显示）
                        await loadLeftData(undefined, storeNameFilter, cityFilter, 1, leftPageSize);
                        // 加载库存汇总数据（不进行SKU过滤，因为SKU过滤会在 filteredAlignedData 中进行）
                        if (leftData.length > 0) {
                          await loadRightData(leftData, selectedSupplierCodes, storeNameFilter, cityFilter, true);
                        }
                        // 如果选择了供应商名称字段，查询供应商名称
                        if (supplierNameFields.length > 0 && rightData.length > 0) {
                          await loadSupplierNames(rightData, supplierNameFields);
                        }
                        // 清空 allLeftData（因为没有筛选条件，不需要所有数据）
                        setAllLeftData([]);
                      }
                    }}
                    disabled={selectedSupplierCodes.length === 0}
                    size="small"
                  >
                    搜索
                  </Button>
                  {inventoryType === '仓店' && (
                    <Select
                      placeholder="选择供应商名称字段"
                      value={supplierNameFields.length > 0 ? supplierNameFields[0] : undefined}
                      onChange={(value) => {
                        // 只更新状态，不自动查询，需要点击搜索按钮才执行
                        const newFields = value ? [value] : [];
                        setSupplierNameFields(newFields);
                        if (newFields.length === 0) {
                          // 取消选择时立即清空数据
                          setSupplierNameData({});
                        }
                      }}
                      style={{ minWidth: 150 }}
                      allowClear
                      size="small"
                      options={[
                        { label: '供应商名称', value: '供应商名称' },
                      ]}
                    />
                  )}
                  {(inventoryType === '城市' || inventoryType === '全部') && (
                    <Select
                      mode="multiple"
                      placeholder="选择供应商名称字段"
                      value={supplierNameFields}
                      onChange={(values) => {
                        // 只更新状态，不自动查询，需要点击搜索按钮才执行
                        const newFields = values || [];
                        setSupplierNameFields(newFields);
                        if (newFields.length === 0) {
                          // 取消选择时立即清空数据
                          setSupplierNameData({});
                        }
                      }}
                      style={{ minWidth: 200 }}
                      maxTagCount="responsive"
                      allowClear
                      size="small"
                      options={[
                        { label: '供应商名称(最低价)', value: '供应商名称(最低价)' },
                        { label: '供应商名称(最近时间)', value: '供应商名称(最近时间)' },
                      ]}
                    />
                  )}
                  {inventoryType === '仓店' && (
                    <Select
                      placeholder={
                        <span style={{ color: !storeNameFilter ? '#ff4d4f' : 'inherit' }}>
                          请选择门店/仓名称（必选）
                        </span>
                      }
                      value={storeNameFilter || undefined}
                      onChange={(value) => {
                        // 只更新状态，不自动加载数据，需要点击搜索按钮才执行
                        const newStoreName = value || '';
                        setStoreNameFilter(newStoreName);
                      }}
                      style={{ minWidth: 150 }}
                      allowClear
                      size="small"
                      status={!storeNameFilter ? 'error' : undefined}
                      options={warehousePriorities.map(name => ({
                        label: name,
                        value: name,
                      }))}
                      loading={warehousePriorities.length === 0}
                    />
                  )}
                  {inventoryType === '城市' && (
                    <Select
                      placeholder={
                        <span style={{ color: !cityFilter ? '#ff4d4f' : 'inherit' }}>
                          请选择城市（必选）
                        </span>
                      }
                      value={cityFilter || undefined}
                      onChange={(value) => {
                        // 只更新状态，不自动加载数据，需要点击搜索按钮才执行
                        const newCity = value || '';
                        setCityFilter(newCity);
                        if (!newCity) {
                          // 如果清空了选择，清空供应商名称数据
                          setSupplierNameData({});
                        }
                      }}
                      style={{ minWidth: 150 }}
                      allowClear
                      size="small"
                      status={!cityFilter ? 'error' : undefined}
                      options={cities.map(city => ({
                        label: city,
                        value: city,
                      }))}
                      loading={cities.length === 0}
                    />
                  )}
                  <Segmented
                    options={['全部', '仓店', '城市']}
                    value={inventoryType}
                    onChange={(value) => handleInventoryTypeChange(value as '全部' | '仓店' | '城市')}
                    size="small"
                  />
                  <Popover
                    content={
                      <ColumnSettings
                        columns={getRightColumns()}
                        hiddenColumns={rightHiddenColumns}
                        columnOrder={rightColumnOrder}
                        onToggleVisibility={handleRightToggleVisibility}
                        onMoveColumn={handleRightMoveColumn}
                        onColumnOrderChange={handleRightColumnOrderChange}
                      />
                    }
                    title="列设置"
                    trigger="click"
                    open={rightColumnSettingsOpen}
                    onOpenChange={setRightColumnSettingsOpen}
                    placement="bottomRight"
                  >
                    <Button icon={<SettingOutlined />}>列设置</Button>
                  </Popover>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportData}
                    size="small"
                  >
                    导出数据
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={async () => {
                      // 重置库存汇总搜索条件：清空SKU搜索框、对比结果筛选、门店/仓名称、城市筛选框、供应商名称字段筛选
                      setInventorySkuSearch('');
                      setComparisonResultFilter([]);
                      setStoreNameFilter('');
                      setCityFilter('');
                      setSupplierNameFields([]);
                      setSupplierNameData({});
                      setRightCurrentPage(1);
                      // 重置搜索按钮标记，以便下次判断是否需要提示用户
                      hasClickedSearchRef.current = false;
                      // 清空 allLeftData（因为重置后没有筛选条件，不需要所有数据）
                      setAllLeftData([]);

                      // 根据重置后的状态查询数据
                      // 如果已经选择了供应商编码，重新加载数据
                      // 注意：使用清空后的值（空字符串），而不是之前的状态
                      if (selectedSupplierCodes.length > 0 && leftData.length > 0) {
                        // 使用清空后的城市和门店过滤条件（空字符串），重新加载数据
                        await loadRightData(leftData, selectedSupplierCodes, '', '');
                      } else {
                        // 如果没有供应商报价数据，清空库存汇总
                        setRightData([]);
                        setRightAllData([]);
                        setRightTotal(0);
                        setUpcToSkuMap({});
                      }
                    }}
                    loading={rightLoading}
                    size="small"
                  >
                    重置
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={async () => {
                      if (selectedSupplierCodes.length === 0) {
                        message.warning('请先选择至少一个供应商编码');
                        return;
                      }
                      const hide = message.loading({ content: '正在刷新数据...', key: 'refresh', duration: 0 });

                      try {
                        // 清除当前选择的供应商编码的缓存
                        clearCacheForSupplierCodes(selectedSupplierCodes);
                        console.log('[缓存] 已清除供应商编码的缓存:', selectedSupplierCodes);

                        // 强制刷新数据（跳过缓存）
                        if (comparisonResultFilter.length > 0 || inventorySkuSearch.trim()) {
                          // 如果有筛选条件，加载所有数据
                          setLeftLoading(true);
                          setRightLoading(true);
                          try {
                            const searchParams = buildSearchParams();
                            const allQuotationResult = await supplierQuotationApi.getAll({
                              page: 1,
                              limit: 10000,
                              ...searchParams,
                              supplierCodes: selectedSupplierCodes,
                            });
                            const allQuotationData = (allQuotationResult.data || []).filter(item =>
                              item.供应商编码 && selectedSupplierCodes.includes(item.供应商编码)
                            );
                            // 保存到缓存
                            setQuotationCache(selectedSupplierCodes, searchParams, allQuotationData);
                            setAllLeftData(allQuotationData);
                            setLeftData(allQuotationData.slice(0, leftPageSize));
                            setLeftTotal(allQuotationData.length);

                            if (allQuotationData.length > 0) {
                              // 强制刷新库存汇总数据（跳过缓存）
                              await loadRightData(allQuotationData, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                            }
                          } finally {
                            setLeftLoading(false);
                          }
                        } else {
                          // 如果没有筛选条件，正常加载数据（强制刷新）
                          await loadAllLeftData(selectedSupplierCodes, true, true); // 强制刷新
                          await loadLeftData(undefined, storeNameFilter, cityFilter, leftCurrentPage, leftPageSize);
                          if (leftData.length > 0) {
                            // 强制刷新库存汇总数据（跳过缓存）
                            await loadRightData(leftData, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                          }
                        }
                        hide();
                        message.success('数据刷新成功');
                      } catch (error) {
                        hide();
                        message.error('数据刷新失败');
                        console.error(error);
                      }
                    }}
                    disabled={selectedSupplierCodes.length === 0}
                    size="small"
                    title="清除缓存并重新加载数据"
                  >
                    刷新数据
                  </Button>
                </Space>
              </div>
            </Space>
          }
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden', marginBottom: 16 }}
          styles={{ body: { flex: 1, overflow: 'hidden', padding: 8, display: 'flex', flexDirection: 'column' } }}
        >
          <div ref={mergedTableContainerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Table
                columns={getFilteredMergedColumns()}
                dataSource={mergedData}
                rowKey={(record) => record.key}
                loading={leftLoading || rightLoading}
                scroll={{ x: 'max-content', y: mergedTableHeight }}
                pagination={false}
                onRow={(record) => {
                  const isSelected = selectedMergedRowKey === record.key;

                  return {
                    onClick: (e: React.MouseEvent) => {
                      // 检查点击的目标元素，如果是SKU列的Popover、输入框或包含data-sku-column属性的元素，不执行行点击逻辑
                      const target = e.target as HTMLElement;

                      // 方法1：检查TD单元格内部是否有data-sku-column属性的元素
                      let isSkuColumnClick = false;

                      // 如果target是TD，检查TD内部是否有data-sku-column属性的元素
                      if (target.tagName === 'TD' || target.closest('td')) {
                        const tdElement = target.tagName === 'TD' ? target : target.closest('td') as HTMLElement;
                        if (tdElement) {
                          // 检查TD内部是否有data-sku-column属性的元素
                          const skuElement = tdElement.querySelector('[data-sku-column="true"]');
                          if (skuElement) {
                            isSkuColumnClick = true;
                          } else {
                            // 检查TD的className是否包含SKU相关的标识（通过列索引或class判断）
                            // 由于SKU列是fixed列，通常会有特定的class，但更可靠的方法是检查内容
                            // 检查TD内部是否有Popover相关元素
                            if (tdElement.querySelector('.ant-popover') ||
                              tdElement.querySelector('.ant-popover-trigger') ||
                              tdElement.querySelector('[data-sku-column]')) {
                              isSkuColumnClick = true;
                            }
                          }
                        }
                      }

                      // 方法2：检查target及其父元素是否有data-sku-column属性
                      let currentElement: HTMLElement | null = target;
                      while (currentElement && currentElement !== e.currentTarget && !isSkuColumnClick) {
                        // 检查是否有data-sku-column属性
                        if (currentElement.getAttribute('data-sku-column') === 'true') {
                          isSkuColumnClick = true;
                          break;
                        }
                        // 检查是否是Popover相关元素
                        if (currentElement.closest('.ant-popover') ||
                          currentElement.closest('.ant-popover-content') ||
                          currentElement.closest('.ant-popover-inner') ||
                          currentElement.closest('.ant-popover-trigger')) {
                          isSkuColumnClick = true;
                          break;
                        }
                        // 检查是否是输入框
                        if (currentElement.closest('.ant-input') ||
                          currentElement.tagName === 'INPUT' ||
                          currentElement.tagName === 'TEXTAREA') {
                          isSkuColumnClick = true;
                          break;
                        }

                        currentElement = currentElement.parentElement;
                      }

                      if (isSkuColumnClick) {
                        // 如果是SKU列的点击，阻止行点击事件，让Popover正常显示
                        console.log('[SKU绑定] 行点击事件：检测到SKU列点击，阻止事件冒泡', {
                          target: target.tagName,
                          targetClass: target.className,
                          isTd: target.tagName === 'TD',
                        });
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }

                      console.log('[SKU绑定] 行点击事件：执行行点击逻辑', {
                        target: target.tagName,
                        targetClass: target.className,
                      });

                      setSelectedMergedRowKey(record.key);
                      if (record.quotation) {
                        handleLeftRowClick(record.quotation);
                      }
                    },
                    className: isSelected ? 'merged-row-selected' : undefined,
                    style: {
                      cursor: record.quotation ? 'pointer' : 'default',
                    },
                  };
                }}
                style={{ height: '100%' }}
              />
            </div>
            {/* 分页器放在表格外部，确保始终可见 */}
            <div style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
              <Pagination
                size="small"
                current={leftCurrentPage}
                pageSize={leftPageSize}
                total={matchedQuotationTotal}
                showSizeChanger
                showTotal={(total: number) => `共 ${total} 条（供应商报价数据）`}
                onChange={(page: number, size?: number) => {
                  const newPageSize = size || leftPageSize;
                  setLeftCurrentPage(page);
                  setRightCurrentPage(page); // 同步分页
                  if (size) {
                    setLeftPageSize(size);
                    setRightPageSize(size);
                  }
                  // 直接调用 loadLeftData 加载对应页的数据
                  loadLeftData(undefined, undefined, undefined, page, newPageSize);
                }}
                onShowSizeChange={(current: number, size: number) => {
                  setLeftPageSize(size);
                  setRightPageSize(size);
                  setLeftCurrentPage(1);
                  setRightCurrentPage(1);
                  // 直接调用 loadLeftData 加载第一页的数据
                  loadLeftData(undefined, undefined, undefined, 1, size);
                }}
                pageSizeOptions={['10', '20', '50', '100']}
                showQuickJumper
                showLessItems={false}
              />
            </div>
          </div>
        </Card>

        {/* 下栏 */}
        <div style={{ position: 'relative' }}>
          {/* 调整高度的拖拽线 */}
          <div
            ref={otherInfoResizeRef}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
              resizeStartYRef.current = e.clientY;
              resizeStartHeightRef.current = otherInfoHeight;
              document.addEventListener('mousemove', handleResize);
              document.addEventListener('mouseup', handleResizeEnd);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              cursor: 'row-resize',
              backgroundColor: isResizing ? '#1890ff' : '#d9d9d9',
              zIndex: 10,
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#1890ff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#d9d9d9';
              }
            }}
          />
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>其他信息</span>
                {orderChannel && otherInfoActiveMenu === 'sku-binding' && (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 16px',
                      borderRadius: '20px',
                      backgroundColor:
                        orderChannel.toLowerCase().includes('1688') ? '#FF6A00' :
                          orderChannel.includes('闪电仓') ? '#FFD100' :
                            '#1890ff',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      lineHeight: '1.5',
                    }}
                  >
                    {orderChannel}
                  </span>
                )}
              </div>
            }
            extra={
              otherInfoActiveMenu === 'sku-binding' ? (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveSkuBindings}
                  disabled={!selectedLeftRecord || bottomData.length === 0}
                >
                  保存
                </Button>
              ) : (
                <Space>
                  <Popover
                    content={
                      <ColumnSettings
                        columns={getAllProductInfoColumns()}
                        hiddenColumns={productInfoHiddenColumns}
                        columnOrder={productInfoColumnOrder}
                        onToggleVisibility={handleProductInfoToggleVisibility}
                        onMoveColumn={handleProductInfoMoveColumn}
                        onColumnOrderChange={handleProductInfoColumnOrderChange}
                      />
                    }
                    title="列设置"
                    trigger="click"
                    open={productInfoColumnSettingsOpen}
                    onOpenChange={setProductInfoColumnSettingsOpen}
                    placement="bottomRight"
                  >
                    <Button icon={<SettingOutlined />}>列设置</Button>
                  </Popover>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportProductInfo}
                    disabled={productInfoData.length === 0}
                  >
                    导出数据
                  </Button>
                </Space>
              )
            }
            style={{ height: otherInfoHeight, flexShrink: 0, overflow: 'hidden', marginTop: 4 }}
            styles={{ body: { overflow: 'hidden', padding: 0, height: 'calc(100% - 57px)' } }}
          >
            <Layout style={{ height: '100%' }}>
              <Layout.Sider
                width={120}
                style={{
                  background: '#fafafa',
                  borderRight: '1px solid #f0f0f0',
                }}
              >
                <div style={{ padding: '8px 0' }}>
                  <div
                    onClick={() => setOtherInfoActiveMenu('sku-binding')}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      backgroundColor: otherInfoActiveMenu === 'sku-binding' ? '#e6f7ff' : 'transparent',
                      borderLeft: otherInfoActiveMenu === 'sku-binding' ? '3px solid #1890ff' : '3px solid transparent',
                      color: otherInfoActiveMenu === 'sku-binding' ? '#1890ff' : '#666',
                      fontWeight: otherInfoActiveMenu === 'sku-binding' ? 500 : 400,
                    }}
                  >
                    SKU绑定信息
                  </div>
                  <div
                    onClick={() => setOtherInfoActiveMenu('product-info')}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      backgroundColor: otherInfoActiveMenu === 'product-info' ? '#e6f7ff' : 'transparent',
                      borderLeft: otherInfoActiveMenu === 'product-info' ? '3px solid #1890ff' : '3px solid transparent',
                      color: otherInfoActiveMenu === 'product-info' ? '#1890ff' : '#666',
                      fontWeight: otherInfoActiveMenu === 'product-info' ? 500 : 400,
                    }}
                  >
                    商品信息
                  </div>
                </div>
              </Layout.Sider>
              <Layout.Content style={{ padding: 16, overflow: 'hidden' }}>
                {otherInfoActiveMenu === 'sku-binding' ? (
                  selectedLeftRecord ? (
                    <div style={{ height: '100%', overflow: 'hidden' }}>
                      <Table
                        columns={[
                          {
                            title: '供应商编码',
                            dataIndex: '供应商编码',
                            key: '供应商编码',
                            width: 150,
                          },
                          {
                            title: '供应商商品编码',
                            dataIndex: '供应商商品编码',
                            key: '供应商商品编码',
                            width: 200,
                          },
                          {
                            title: 'SKU',
                            key: 'SKU',
                            width: 200,
                            render: (_: any, record: SupplierSkuBinding) => {
                              const uniqueKey = `${record.供应商编码}_${record.供应商商品编码}`;
                              return (
                                <Input
                                  value={editingSkus[uniqueKey] !== undefined ? editingSkus[uniqueKey] : (record.SKU || '')}
                                  onChange={(e) => {
                                    setEditingSkus({
                                      ...editingSkus,
                                      [uniqueKey]: e.target.value,
                                    });
                                  }}
                                  placeholder="请输入SKU"
                                  onBlur={(e) => {
                                    const value = e.target.value;
                                    setEditingSkus({
                                      ...editingSkus,
                                      [uniqueKey]: value,
                                    });
                                  }}
                                />
                              );
                            },
                          },
                          {
                            title: '数据更新时间',
                            dataIndex: '数据更新时间',
                            key: '数据更新时间',
                            width: 180,
                            render: (text: string | Date) => {
                              if (!text) return '-';
                              try {
                                const date = typeof text === 'string' ? new Date(text) : text;
                                const formatted = date.toLocaleString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                });
                                return formatted || String(text);
                              } catch {
                                return String(text);
                              }
                            },
                          },
                        ]}
                        dataSource={bottomData}
                        rowKey={(record) => `${record.供应商编码}_${record.供应商商品编码}`}
                        loading={bottomLoading}
                        pagination={false}
                        scroll={{ x: 'max-content', y: 200 }}
                      />
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                      请先选择左栏数据
                    </div>
                  )
                ) : (
                  <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <Table
                      columns={getFilteredProductInfoColumns()}
                      dataSource={productInfoData}
                      rowKey={(record, index) => `${record.供应商编码}_${index}`}
                      loading={productInfoLoading}
                      pagination={false}
                      scroll={{
                        x: 'max-content',
                        y: otherInfoHeight - 120 // 动态计算高度，减去Card头部和padding
                      }}
                    />
                  </div>
                )}
              </Layout.Content>
            </Layout>
          </Card>
        </div>

        {/* 手动绑定SKU模态框 */}
        <Modal
          title="手动绑定SKU"
          open={manualBindingModalOpen}
          onOk={async () => {
            if (!manualBindingSelectedQuotation) {
              message.warning('请选择供应商报价');
              return;
            }
            const skuValue = manualBindingSkuInput.trim();
            if (!skuValue) {
              message.warning('请输入SKU');
              return;
            }

            try {
              await supplierQuotationApi.updateSkuBinding({
                supplierCode: manualBindingSelectedQuotation.供应商编码!,
                supplierProductCode: manualBindingSelectedQuotation.供应商商品编码!,
                sku: skuValue,
              });
              message.success('保存成功');

              // 清除相关供应商编码的缓存
              if (manualBindingSelectedQuotation.供应商编码) {
                clearCacheForSupplierCodes([manualBindingSelectedQuotation.供应商编码]);
                console.log('[缓存] 已清除供应商编码的缓存:', manualBindingSelectedQuotation.供应商编码);
              }

              // 关闭Modal
              setManualBindingModalOpen(false);
              setManualBindingRecord(null);
              setManualBindingSkuInput('');
              setManualBindingSelectedQuotation(null);

              // 重新加载数据（强制刷新，跳过缓存）
              const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
              if (rightAllData.length > 0 && dataSource.length > 0) {
                await loadQuotationBindingFlags(rightAllData, dataSource);
                // 重新加载SKU绑定数据
                await loadSkuBindingMap(dataSource, upcToSkuMap);
                // 重新加载库存汇总数据以更新匹配（强制刷新，跳过缓存）
                if (selectedSupplierCodes.length > 0 && dataSource.length > 0) {
                  await loadRightData(dataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                }
              }
            } catch (error: any) {
              console.error('保存SKU绑定失败:', error);
              message.error(`保存失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
            }
          }}
          onCancel={() => {
            setManualBindingModalOpen(false);
            setManualBindingRecord(null);
            setManualBindingSkuInput('');
            setManualBindingSelectedQuotation(null);
          }}
          okText="保存"
          cancelText="取消"
          width={600}
        >
          {manualBindingRecord && (
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>UPC:</div>
                <div style={{ color: '#666' }}>{manualBindingRecord.upc}</div>
              </div>

              {manualBindingRecord.matchedQuotations.length > 0 ? (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>请选择供应商报价:</div>
                  <Select
                    style={{ width: '100%', marginBottom: 16 }}
                    value={manualBindingSelectedQuotation ? `${manualBindingSelectedQuotation.供应商编码}_${manualBindingSelectedQuotation.供应商商品编码}` : undefined}
                    onChange={(value) => {
                      const selected = manualBindingRecord!.matchedQuotations.find(
                        q => `${q.供应商编码}_${q.供应商商品编码}` === value
                      );
                      setManualBindingSelectedQuotation(selected || null);
                    }}
                    placeholder="请选择供应商报价"
                    showSearch
                    filterOption={(input, option) => {
                      const item = manualBindingRecord!.matchedQuotations.find(
                        q => `${q.供应商编码}_${q.供应商商品编码}` === option?.value
                      );
                      if (!item) return false;
                      const searchText = input.toLowerCase();
                      return (
                        (item.供应商编码 || '').toLowerCase().includes(searchText) ||
                        (item.供应商名称 || '').toLowerCase().includes(searchText) ||
                        (item.商品名称 || '').toLowerCase().includes(searchText) ||
                        (item.供应商商品编码 || '').toLowerCase().includes(searchText)
                      );
                    }}
                  >
                    {manualBindingRecord.matchedQuotations.map((q, index) => (
                      <Select.Option
                        key={`${q.供应商编码}_${q.供应商商品编码}_${index}`}
                        value={`${q.供应商编码}_${q.供应商商品编码}`}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {q.供应商名称 || q.供应商编码} - {q.商品名称 || q.供应商商品编码}
                          </div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            供应商编码: {q.供应商编码} | 商品编码: {q.供应商商品编码}
                          </div>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>

                  <div style={{ marginBottom: 8, fontWeight: 500 }}>请输入SKU:</div>
                  <Input
                    placeholder="请输入SKU"
                    value={manualBindingSkuInput}
                    onChange={(e) => setManualBindingSkuInput(e.target.value)}
                    onPressEnter={async () => {
                      if (!manualBindingSelectedQuotation) {
                        message.warning('请选择供应商报价');
                        return;
                      }
                      const skuValue = manualBindingSkuInput.trim();
                      if (!skuValue) {
                        message.warning('请输入SKU');
                        return;
                      }

                      try {
                        await supplierQuotationApi.updateSkuBinding({
                          supplierCode: manualBindingSelectedQuotation.供应商编码!,
                          supplierProductCode: manualBindingSelectedQuotation.供应商商品编码!,
                          sku: skuValue,
                        });
                        message.success('保存成功');

                        // 清除相关供应商编码的缓存
                        if (manualBindingSelectedQuotation.供应商编码) {
                          clearCacheForSupplierCodes([manualBindingSelectedQuotation.供应商编码]);
                        }

                        // 关闭Modal
                        setManualBindingModalOpen(false);
                        setManualBindingRecord(null);
                        setManualBindingSkuInput('');
                        setManualBindingSelectedQuotation(null);

                        // 重新加载数据
                        const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                        if (rightAllData.length > 0 && dataSource.length > 0) {
                          await loadQuotationBindingFlags(rightAllData, dataSource);
                          await loadSkuBindingMap(dataSource, upcToSkuMap);
                          if (selectedSupplierCodes.length > 0 && dataSource.length > 0) {
                            await loadRightData(dataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                          }
                        }
                      } catch (error: any) {
                        console.error('保存SKU绑定失败:', error);
                        message.error(`保存失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
                      }
                    }}
                  />
                </>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>
                  未找到匹配UPC为 {manualBindingRecord.upc} 的供应商报价数据
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    请先在左侧选择包含该UPC的供应商报价数据，然后再尝试绑定SKU
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* 导出数据模态框 */}
        <Modal
          title="导出数据"
          open={exportModalOpen}
          onOk={handleConfirmExport}
          onCancel={() => setExportModalOpen(false)}
          okText="导出"
          cancelText="取消"
          width={500}
        >
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>请选择要导出的对比结果（不选则导出全部）：</div>
            <Select
              mode="multiple"
              placeholder="选择对比结果"
              style={{ width: '100%' }}
              value={exportFilter}
              onChange={setExportFilter}
              options={comparisonResultOptions.map(opt => ({
                label: (
                  <Space>
                    <Tag color={opt.color}>{opt.label}</Tag>
                  </Space>
                ),
                value: opt.value,
              }))}
              allowClear
            />
          </div>
        </Modal>
      </>
      );
}

