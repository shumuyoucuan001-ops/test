"use client";

import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';
import { InventorySummary, SupplierQuotation, supplierQuotationApi, SupplierSkuBinding } from '@/lib/api';
import { DeleteOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import BatchAddModal, { FieldConfig } from './BatchAddModal';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { Search } = Input;

// 页面唯一标识符
const PAGE_KEY = 'supplier-quotation';

export default function SupplierQuotationPage() {
  // 使用 App.useApp() 获取 message API（支持动态主题）
  const { message: messageApi } = App.useApp();

  // 定义默认状态
  const defaultState = {
    leftCurrentPage: 1,
    leftPageSize: 10,
    supplierNameSearch: '',
    supplierCodeSearch: '',
    productNameSearch: '',
    upcCodeSearch: '',
    selectedSupplierCodes: [] as string[],
    inventorySkuSearch: '',
    inventoryType: '全部' as '全部' | '仓店' | '城市',
    rightCurrentPage: 1,
    rightPageSize: 10,
    comparisonResultFilter: [] as string[],
    storeNameFilter: '',
    cityFilter: '',
    otherInfoActiveMenu: 'product-info' as 'sku-binding' | 'product-info',
  };

  // 恢复保存的状态
  const restoredState = usePageStateRestore(PAGE_KEY, defaultState);

  // 左栏数据
  const [leftData, setLeftData] = useState<SupplierQuotation[]>([]);
  const [allLeftData, setAllLeftData] = useState<SupplierQuotation[]>([]); // 所有供应商报价数据（用于筛选）
  const [leftLoading, setLeftLoading] = useState(false);
  const [leftTotal, setLeftTotal] = useState(0);
  const [leftCurrentPage, setLeftCurrentPage] = useState(restoredState?.leftCurrentPage ?? defaultState.leftCurrentPage);
  const [leftPageSize, setLeftPageSize] = useState(restoredState?.leftPageSize ?? defaultState.leftPageSize);
  const [leftSearchText, setLeftSearchText] = useState(''); // 保留用于兼容，后续可移除
  // 拆分为多个独立的搜索框
  const [supplierNameSearch, setSupplierNameSearch] = useState(restoredState?.supplierNameSearch ?? defaultState.supplierNameSearch); // 供应商名称搜索
  const [supplierCodeSearch, setSupplierCodeSearch] = useState(restoredState?.supplierCodeSearch ?? defaultState.supplierCodeSearch); // 供应商编码搜索
  const [productNameSearch, setProductNameSearch] = useState(restoredState?.productNameSearch ?? defaultState.productNameSearch); // 商品名称搜索
  const [upcCodeSearch, setUpcCodeSearch] = useState(restoredState?.upcCodeSearch ?? defaultState.upcCodeSearch); // 最小销售规格UPC商品条码搜索

  const [selectedSupplierCodes, setSelectedSupplierCodes] = useState<string[]>(restoredState?.selectedSupplierCodes ?? defaultState.selectedSupplierCodes); // 选中的供应商编码列表
  const [allSupplierCodes, setAllSupplierCodes] = useState<string[]>([]); // 所有供应商编码列表
  const [supplierCodeSearchValue, setSupplierCodeSearchValue] = useState(''); // 供应商编码选择框的搜索输入值

  // 库存汇总搜索
  const [inventorySkuSearch, setInventorySkuSearch] = useState(restoredState?.inventorySkuSearch ?? defaultState.inventorySkuSearch); // SKU搜索

  // 右栏数据
  const [rightData, setRightData] = useState<InventorySummary[]>([]); // 所有库存汇总数据（未分页）
  const [rightAllData, setRightAllData] = useState<InventorySummary[]>([]); // 所有库存汇总数据（用于匹配）
  const [rightLoading, setRightLoading] = useState(false);
  const [inventoryType, setInventoryType] = useState<'全部' | '仓店' | '城市'>(restoredState?.inventoryType ?? defaultState.inventoryType);
  const [selectedLeftRecord, setSelectedLeftRecord] = useState<SupplierQuotation | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1); // 记录选中的行索引
  const [rightCurrentPage, setRightCurrentPage] = useState(restoredState?.rightCurrentPage ?? defaultState.rightCurrentPage);
  const [rightPageSize, setRightPageSize] = useState(restoredState?.rightPageSize ?? defaultState.rightPageSize);
  const [rightTotal, setRightTotal] = useState(0); // 库存汇总总数
  const [comparisonResultFilter, setComparisonResultFilter] = useState<string[]>(restoredState?.comparisonResultFilter ?? defaultState.comparisonResultFilter); // 对比结果筛选
  const [priceTypeFilter, setPriceTypeFilter] = useState<'最低采购价' | '最近采购价' | '成本单价' | undefined>(undefined); // 采购价类型筛选（单选）
  const [storeNameFilter, setStoreNameFilter] = useState<string>(restoredState?.storeNameFilter ?? defaultState.storeNameFilter); // 门店/仓名称筛选（仅仓店维度，单选）
  const [cityFilter, setCityFilter] = useState<string>(restoredState?.cityFilter ?? defaultState.cityFilter); // 城市筛选（仅城市维度，单选）
  const [warehousePriorities, setWarehousePriorities] = useState<string[]>([]); // 仓库优先级列表
  const [cities, setCities] = useState<string[]>([]); // 城市列表
  const [upcToSkuMap, setUpcToSkuMap] = useState<Record<string, string[]>>({}); // UPC条码到SKU编码的映射
  const [supplierBindingSkuMap, setSupplierBindingSkuMap] = useState<Record<string, string>>({}); // 从供应商编码手动绑定sku表查询到的SKU映射（key为"供应商编码_供应商商品编码"，value为SKU）
  const [supplierNameFields, setSupplierNameFields] = useState<string[]>([]); // 需要查询的供应商名称字段（默认空数组）
  const [supplierNameData, setSupplierNameData] = useState<Record<string, string>>({}); // 存储查询到的供应商名称数据
  const [supplierStoreRelationMap, setSupplierStoreRelationMap] = useState<Record<string, number | string | any>>({}); // 存储供应商-门店关系映射（key为供应商编码，value为关系数量或"是/否"或包含详细信息的对象）
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
  const [editingRatios, setEditingRatios] = useState<Record<string, { supplierRatio?: number; qianniuhuaRatio?: number }>>({}); // 存储下栏报价比例编辑数据（key为"供应商编码_供应商商品编码"）
  const [supplierProductRemarks, setSupplierProductRemarks] = useState<Record<string, string>>({}); // 存储供应商商品供应信息备注（key为"供应商编码_供应商商品编码"）
  const [editingRemarks, setEditingRemarks] = useState<Record<string, string>>({}); // 存储正在编辑的备注（key为"供应商编码_供应商商品编码"）
  const [editingRemarkKeys, setEditingRemarkKeys] = useState<Set<string>>(new Set()); // 存储正在编辑的备注key（用于显示保存按钮）
  const [internalSkuRemarks, setInternalSkuRemarks] = useState<Record<string, string>>({}); // 存储内部sku备注（key为SKU）
  const [editingInternalSkuRemarks, setEditingInternalSkuRemarks] = useState<Record<string, string>>({}); // 存储正在编辑的内部sku备注（key为SKU）
  const [editingInternalSkuRemarkKeys, setEditingInternalSkuRemarkKeys] = useState<Set<string>>(new Set()); // 存储正在编辑的内部sku备注key（用于显示保存按钮）
  const [emptySkuInputs, setEmptySkuInputs] = useState<Record<string, string>>({}); // 存储SKU为空时的输入框值（key为唯一标识符）
  const [editingEmptySkuKeys, setEditingEmptySkuKeys] = useState<Set<string>>(new Set()); // 存储正在编辑的SKU输入框key（用于显示保存按钮）
  const [orderChannel, setOrderChannel] = useState<string | null>(null); // 采购下单渠道
  const [form] = Form.useForm();

  // 其他信息容器相关状态
  const [otherInfoActiveMenu, setOtherInfoActiveMenu] = useState<'sku-binding' | 'product-info'>(restoredState?.otherInfoActiveMenu ?? defaultState.otherInfoActiveMenu); // 默认显示商品信息
  const [productInfoData, setProductInfoData] = useState<any[]>([]); // 商品信息数据
  const [productInfoLoading, setProductInfoLoading] = useState(false); // 商品信息加载状态
  const [productInfoHiddenColumns, setProductInfoHiddenColumns] = useState<Set<string>>(new Set()); // 商品信息隐藏列
  const [productInfoColumnOrder, setProductInfoColumnOrder] = useState<string[]>([]); // 商品信息列顺序
  const [productInfoColumnSettingsOpen, setProductInfoColumnSettingsOpen] = useState(false); // 商品信息列设置弹窗
  // 上下分栏高度比例（默认上2/3，下1/3）
  const [topPanelHeight, setTopPanelHeight] = useState<number>(66.67); // 百分比
  const [isResizing, setIsResizing] = useState(false); // 是否正在调整高度

  // 左栏列设置相关状态
  const [leftHiddenColumns, setLeftHiddenColumns] = useState<Set<string>>(new Set());
  const [leftColumnOrder, setLeftColumnOrder] = useState<string[]>([]);
  const [leftLockedColumns, setLeftLockedColumns] = useState<Set<string>>(new Set());

  // 表格容器ref，用于计算滚动高度和同步滚动
  const leftTableContainerRef = useRef<HTMLDivElement>(null);
  const rightTableContainerRef = useRef<HTMLDivElement>(null);
  const [leftTableHeight, setLeftTableHeight] = useState<number>(400);
  const [rightTableHeight, setRightTableHeight] = useState<number>(400);
  const isScrolling = useRef(false);
  const [leftColumnSettingsOpen, setLeftColumnSettingsOpen] = useState(false);


  // 用于跟踪正在进行的 loadRightData 请求，避免竞态条件
  const loadRightDataRequestIdRef = useRef<number>(0);

  // 用于跟踪是否正在手动加载数据，避免 useEffect 重复触发
  const isLoadingManuallyRef = useRef<boolean>(false);

  // 用于跟踪用户是否已经点击过搜索按钮（用于判断是否需要提示用户）
  const hasClickedSearchRef = useRef<boolean>(false);

  // 保存状态（自动保存，防抖 300ms）
  usePageStateSave(PAGE_KEY, {
    leftCurrentPage,
    leftPageSize,
    supplierNameSearch,
    supplierCodeSearch,
    productNameSearch,
    upcCodeSearch,
    selectedSupplierCodes,
    inventorySkuSearch,
    inventoryType,
    rightCurrentPage,
    rightPageSize,
    comparisonResultFilter,
    storeNameFilter,
    cityFilter,
    otherInfoActiveMenu,
  });

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
  const [rightLockedColumns, setRightLockedColumns] = useState<Set<string>>(new Set());
  const [rightColumnSettingsOpen, setRightColumnSettingsOpen] = useState(false);

  // 右栏搜索
  const [rightSearchText, setRightSearchText] = useState('');

  // 导出相关状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState<string[]>([]);

  // 批量新增相关状态
  const [batchModalVisible, setBatchModalVisible] = useState(false);

  // 匹配数据相关状态
  const [shouldMatchData, setShouldMatchData] = useState(false); // 是否需要匹配数据
  const [isMatchingData, setIsMatchingData] = useState(false); // 是否正在匹配数据
  const [matchedSkuSearch, setMatchedSkuSearch] = useState(''); // 搜索时匹配到的SKU（用于右栏显示）

  // 手动绑定SKU Modal相关状态
  const [manualBindingModalOpen, setManualBindingModalOpen] = useState(false);
  const [manualBindingRecord, setManualBindingRecord] = useState<{
    supplierCode: string;
    upcCode: string;
  } | null>(null);
  const [manualBindingSkuInput, setManualBindingSkuInput] = useState('');

  // 合并表格相关状态
  const [selectedMergedRowKey, setSelectedMergedRowKey] = useState<string | null>(null); // 选中的合并表格行key
  const mergedTableContainerRef = useRef<HTMLDivElement>(null);
  const [mergedTableHeight, setMergedTableHeight] = useState<number>(400);

  // 左栏默认显示的字段（按顺序）
  const defaultVisibleColumns = ['序号', '供应商名称', '供应商编码', '商品名称', '商品规格', '供货价格'];

  // 右栏默认显示的字段（全部类型）：SKU, 成本单价, 最低采购价, 最近采购价, 对比字段类型, 差价, 安差价加率, 供应商SKU备注, 内部sku备注, 对比结果
  const defaultRightVisibleColumns = ['SKU', '成本单价', '最低采购价', '最近采购价', '对比字段类型', '差价', '安差价加率', '供应商SKU备注', '内部sku备注', '对比结果'];

  // 右栏默认显示的字段（仓店/城市类型）：SKU, 成本单价, 最近采购价, 对比字段类型, 差价, 安差价加率, 供应商SKU备注, 内部sku备注, 对比结果
  const defaultRightVisibleColumnsStoreCity = ['SKU', '成本单价', '最近采购价', '对比字段类型', '差价', '安差价加率', '供应商SKU备注', '内部sku备注', '对比结果'];

  // 初始化左栏列设置（优先使用用户保存的设置）
  useEffect(() => {
    // 优先加载用户保存的隐藏列设置
    const savedHidden = localStorage.getItem('supplier-quotation-left-hidden-columns');
    if (savedHidden) {
      try {
        const parsed = JSON.parse(savedHidden);
        setLeftHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
        // 如果解析失败，设置为空Set
        setLeftHiddenColumns(new Set());
      }
    } else {
      // 如果没有保存的设置，设置为空Set（所有列默认显示）
      setLeftHiddenColumns(new Set());
    }

    // 优先加载用户保存的列顺序
    const savedOrder = localStorage.getItem('supplier-quotation-left-column-order');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        // 验证保存的列顺序是否包含所有列，如果不包含，补充缺失的列
        const allColumnKeys = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
        const validOrder = parsed.filter((key: string) => allColumnKeys.includes(key));
        const missingKeys = allColumnKeys.filter(key => !validOrder.includes(key));
        // 将缺失的列添加到末尾
        const finalOrder = [...validOrder, ...missingKeys];
        setLeftColumnOrder(finalOrder);
        // 如果顺序有变化，立即保存
        if (finalOrder.join(',') !== parsed.join(',')) {
          localStorage.setItem('supplier-quotation-left-column-order', JSON.stringify(finalOrder));
        }
      } catch (error) {
        console.error('加载列顺序失败:', error);
      }
    }

    // 加载锁定列设置
    const savedLocked = localStorage.getItem('supplier-quotation-left-locked-columns');
    if (savedLocked) {
      try {
        const parsed = JSON.parse(savedLocked);
        setLeftLockedColumns(new Set(parsed));
      } catch (error) {
        console.error('加载锁定列设置失败:', error);
        setLeftLockedColumns(new Set());
      }
    } else {
      setLeftLockedColumns(new Set());
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

  // 初始化右栏列设置（优先使用用户保存的设置）
  useEffect(() => {
    // 优先加载用户保存的隐藏列设置
    const savedHidden = localStorage.getItem('supplier-quotation-right-hidden-columns');
    if (savedHidden) {
      try {
        const parsed = JSON.parse(savedHidden) as string[];
        const hiddenSet = new Set<string>(parsed);
        setRightHiddenColumns(hiddenSet);
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
        // 如果解析失败，设置默认隐藏"供应商-门店关系"列
        setRightHiddenColumns(new Set<string>(['供应商-门店关系']));
      }
    } else {
      // 如果没有保存的设置，默认隐藏"供应商-门店关系"列
      setRightHiddenColumns(new Set<string>(['供应商-门店关系']));
    }

    // 优先加载用户保存的列顺序
    const savedOrder = localStorage.getItem('supplier-quotation-right-column-order');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        // 验证保存的列顺序是否包含所有列，如果不包含，补充缺失的列
        const allColumnKeys = getAllRightColumns().map(col => col.key as string).filter(Boolean);
        const validOrder = parsed.filter((key: string) => allColumnKeys.includes(key));
        const missingKeys = allColumnKeys.filter(key => !validOrder.includes(key));
        // 将缺失的列添加到末尾
        const finalOrder = [...validOrder, ...missingKeys];
        setRightColumnOrder(finalOrder);
        // 如果顺序有变化，立即保存
        if (finalOrder.join(',') !== parsed.join(',')) {
          localStorage.setItem('supplier-quotation-right-column-order', JSON.stringify(finalOrder));
        }
      } catch (error) {
        console.error('加载列顺序失败:', error);
      }
    }

    // 加载锁定列设置
    const savedLocked = localStorage.getItem('supplier-quotation-right-locked-columns');
    if (savedLocked) {
      try {
        const parsed = JSON.parse(savedLocked);
        setRightLockedColumns(new Set(parsed));
      } catch (error) {
        console.error('加载锁定列设置失败:', error);
        // 如果解析失败，默认锁定原本固定锁定的列（供应商SKU备注、内部sku备注、对比结果）
        setRightLockedColumns(new Set(['供应商SKU备注', '内部sku备注', '对比结果']));
      }
    } else {
      // 如果没有保存的设置，默认锁定原本固定锁定的列（供应商SKU备注、内部sku备注、对比结果）
      setRightLockedColumns(new Set(['供应商SKU备注', '内部sku备注', '对比结果']));
    }
  }, []);

  // 如果列顺序为空，初始化默认顺序（仅在首次加载且没有保存的设置时）
  useEffect(() => {
    if (rightColumnOrder.length === 0) {
      const savedOrder = localStorage.getItem('supplier-quotation-right-column-order');
      if (!savedOrder) {
        // 首次加载，保存默认顺序
        // 按照要求的顺序：SKU 商品名称 SKU商品标签 规格 总部零售价 成本单价 最低采购价 最近采购价 对比字段类型 差价 供应商SKU备注 内部sku备注 对比结果
        const allColumns = getAllRightColumns().map(col => col.key as string).filter(Boolean);

        // 定义完整的列顺序（包括隐藏的列）
        const fullColumnOrder = [
          // 根据维度添加城市或门店/仓库名称（如果存在）
          ...(inventoryType === '城市' ? ['城市'] : []),
          ...(inventoryType === '仓店' ? ['门店/仓库名称'] : []),
          // 主要列顺序
          'SKU',
          '商品名称',
          'SKU商品标签',
          '规格',
          '总部零售价',
          '成本单价',
          ...(inventoryType === '全部' ? ['最低采购价', '最近采购价'] : ['最近采购价']),
          '对比字段类型',
          '差价',
          '供应商-门店关系', // 供应商-门店关系列（默认隐藏）
          // 供应商名称列（根据维度动态添加，默认隐藏）
          ...(inventoryType === '仓店' ? ['供应商名称'] : []),
          ...(inventoryType === '城市' || inventoryType === '全部' ? ['供应商名称(最低价)', '供应商名称(最近时间)'] : []),
          // 固定列（确保这些列在最后，且顺序固定）
          '供应商SKU备注',
          '内部sku备注',
          '对比结果',
        ].filter(key => allColumns.includes(key));

        // 过滤出实际存在的列
        const order = fullColumnOrder.filter(key => allColumns.includes(key));
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
      const allColumnKeys = getAllRightColumns().map(col => col.key as string).filter(Boolean);
      // 过滤掉不存在的列，保留存在的列的顺序（完全保持用户保存的顺序）
      const validOrder = rightColumnOrder.filter(key => allColumnKeys.includes(key));
      // 添加新出现的列到末尾（排除供应商SKU备注列、内部sku备注列和对比结果列）
      const missingKeys = allColumnKeys.filter(key => !validOrder.includes(key) && key !== '对比结果' && key !== '供应商SKU备注' && key !== '内部sku备注');
      // 确保供应商SKU备注列、内部sku备注列和对比结果列的顺序：供应商SKU备注列在内部sku备注列之前，内部sku备注列在对比结果列之前，对比结果列在最后
      let finalOrder: string[];
      const hasRemark = validOrder.includes('供应商SKU备注');
      const hasInternalRemark = validOrder.includes('内部sku备注');
      const hasComparison = validOrder.includes('对比结果');

      // 先移除供应商SKU备注列、内部sku备注列和对比结果列
      const orderWithoutFixed = validOrder.filter(key => key !== '供应商SKU备注' && key !== '内部sku备注' && key !== '对比结果');

      // 添加缺失的列
      finalOrder = [...orderWithoutFixed, ...missingKeys];

      // 最后添加供应商SKU备注列、内部sku备注列和对比结果列（供应商SKU备注列在内部sku备注列之前，内部sku备注列在对比结果列之前）
      if (hasRemark || allColumnKeys.includes('供应商SKU备注')) {
        finalOrder.push('供应商SKU备注');
      }
      if (hasInternalRemark || allColumnKeys.includes('内部sku备注')) {
        finalOrder.push('内部sku备注');
      }
      if (hasComparison || allColumnKeys.includes('对比结果')) {
        finalOrder.push('对比结果');
      }
      // 只有在顺序确实有变化时才更新（避免不必要的更新）
      if (finalOrder.join(',') !== rightColumnOrder.join(',')) {
        setRightColumnOrder(finalOrder);
        // 保存用户的最后一次选择（包括inventoryType改变时的调整）
        saveRightColumnSettings();
      }
    } else {
      // 如果列顺序为空，重新初始化（按照要求的顺序）
      const allColumnKeys = getAllRightColumns().map(col => col.key as string).filter(Boolean);

      // 定义完整的列顺序（包括隐藏的列）
      const fullColumnOrder = [
        // 根据维度添加城市或门店/仓库名称（如果存在）
        ...(inventoryType === '城市' ? ['城市'] : []),
        ...(inventoryType === '仓店' ? ['门店/仓库名称'] : []),
        // 主要列顺序
        'SKU',
        '商品名称',
        'SKU商品标签',
        '规格',
        '总部零售价',
        '成本单价',
        ...(inventoryType === '全部' ? ['最低采购价', '最近采购价'] : ['最近采购价']),
        '对比字段类型',
        '差价',
        '供应商-门店关系', // 供应商-门店关系列（默认隐藏）
        // 供应商名称列（根据维度动态添加，默认隐藏）
        ...(inventoryType === '仓店' ? ['供应商名称'] : []),
        ...(inventoryType === '城市' || inventoryType === '全部' ? ['供应商名称(最低价)', '供应商名称(最近时间)'] : []),
        // 固定列
        '供应商SKU备注',
        '内部sku备注',
        '对比结果',
      ].filter(key => allColumnKeys.includes(key));

      // 过滤出实际存在的列
      const order = fullColumnOrder.filter(key => allColumnKeys.includes(key));
      if (order.length > 0 && order.join(',') !== rightColumnOrder.join(',')) {
        setRightColumnOrder(order);
      }
    }

    // 同步隐藏列设置：移除不存在的列，保留用户的隐藏设置
    if (rightHiddenColumns.size > 0) {
      const allColumnKeys = getAllRightColumns().map(col => col.key as string).filter(Boolean);
      const validHidden = Array.from(rightHiddenColumns).filter(key => allColumnKeys.includes(key));
      if (validHidden.length !== rightHiddenColumns.size) {
        setRightHiddenColumns(new Set(validHidden));
        // 保存用户的最后一次选择（包括inventoryType改变时的调整）
        saveRightColumnSettings();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]); // 当 inventoryType 改变时，只过滤不存在的列，不自动保存

  // 保存左栏列设置
  const saveLeftColumnSettings = () => {
    localStorage.setItem('supplier-quotation-left-hidden-columns', JSON.stringify(Array.from(leftHiddenColumns)));
    localStorage.setItem('supplier-quotation-left-column-order', JSON.stringify(leftColumnOrder));
    localStorage.setItem('supplier-quotation-left-locked-columns', JSON.stringify(Array.from(leftLockedColumns)));
  };

  // 保存右栏列设置
  const saveRightColumnSettings = () => {
    localStorage.setItem('supplier-quotation-right-hidden-columns', JSON.stringify(Array.from(rightHiddenColumns)));
    localStorage.setItem('supplier-quotation-right-column-order', JSON.stringify(rightColumnOrder));
    localStorage.setItem('supplier-quotation-right-locked-columns', JSON.stringify(Array.from(rightLockedColumns)));
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
  // 允许供应商名称相关列、供应商SKU备注、内部sku备注、对比结果调整显示/隐藏
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

  // 左栏切换锁定状态
  const handleLeftToggleLock = (columnKey: string) => {
    const newLocked = new Set(leftLockedColumns);
    if (newLocked.has(columnKey)) {
      newLocked.delete(columnKey);
    } else {
      newLocked.add(columnKey);
    }
    setLeftLockedColumns(newLocked);
    saveLeftColumnSettings();
  };

  // 右栏切换锁定状态
  const handleRightToggleLock = (columnKey: string) => {
    const newLocked = new Set(rightLockedColumns);
    if (newLocked.has(columnKey)) {
      newLocked.delete(columnKey);
    } else {
      newLocked.add(columnKey);
    }
    setRightLockedColumns(newLocked);
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
  // 如果列被锁定，禁止调整顺序
  const handleRightMoveColumn = (columnKey: string, direction: 'up' | 'down') => {
    // 如果列被锁定，不允许调整顺序
    if (rightLockedColumns.has(columnKey)) {
      return;
    }

    const currentOrder = rightColumnOrder.length > 0 ? rightColumnOrder : getAllRightColumns().map(col => col.key as string).filter(Boolean);
    const index = currentOrder.indexOf(columnKey);
    if (index === -1) return;

    // 检查移动方向是否会被锁定列阻挡
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const targetColumnKey = currentOrder[targetIndex];
    if (rightLockedColumns.has(targetColumnKey)) {
      return; // 不能移动到锁定列的位置
    }

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
  // 锁定列可以被被动挤开，但保持在新顺序中的相对位置
  const handleRightColumnOrderChange = (newOrder: string[]) => {
    // 锁定列应该保持在新顺序中的位置，不需要移除和重新添加
    // 只需要确保所有列都在顺序中（包括可能缺失的列）
    const allColumnKeys = getAllRightColumns().map(col => col.key as string).filter(Boolean);
    const missingKeys = allColumnKeys.filter(key => !newOrder.includes(key));

    // 如果新顺序中缺少某些列，在末尾添加
    let finalOrder: string[];
    if (missingKeys.length > 0) {
      finalOrder = [...newOrder, ...missingKeys];
    } else {
      finalOrder = newOrder;
    }

    setRightColumnOrder(finalOrder);
    // 立即保存用户的选择
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
      messageApi.warning('没有数据可导出');
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
      messageApi.success(`成功导出 ${productInfoData.length} 条数据`);
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
                      messageApi.success('清空成功');

                      // 清除相关供应商编码的缓存，因为报价比例会影响计算后供货价格
                      if (record.供应商编码) {
                        clearCacheForSupplierCodes([record.供应商编码]);
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
                      messageApi.error(`清空失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
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
                        messageApi.error('两框中必须有一边为1');
                        return;
                      }

                      if (!record.供应商编码 || !record.最小销售规格UPC商品条码) {
                        messageApi.error('未找到匹配的供应商报价数据');
                        return;
                      }

                      try {
                        await supplierQuotationApi.updatePriceRatios({
                          supplierCode: record.供应商编码,
                          upcCode: record.最小销售规格UPC商品条码,
                          supplierRatio: supplierRatio || 1,
                          qianniuhuaRatio: qianniuhuaRatio || 1,
                        });
                        messageApi.success('保存成功');

                        // 清除相关供应商编码的缓存，因为报价比例会影响计算后供货价格
                        if (record.供应商编码) {
                          clearCacheForSupplierCodes([record.供应商编码]);
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
                        messageApi.error(`保存失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
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

    // 获取隐藏列（优先使用状态中的值，如果状态为空则从 localStorage 读取）
    // 这样可以确保在状态初始化完成前也能正确读取保存的设置
    let hiddenSet: Set<string>;
    if (leftHiddenColumns.size > 0) {
      // 如果状态中有值，使用状态中的值
      hiddenSet = leftHiddenColumns;
    } else {
      // 如果状态为空，从 localStorage 读取（用于在状态初始化完成前）
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
    const allColumns = getRightColumns(alignedData, filteredAlignedData);

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
          // 如果没有SKU商品标签列，添加到供应商SKU备注列之前（供应商SKU备注列在内部sku备注列之前，内部sku备注列在对比结果列之前）
          const remarkIndex = currentOrder.indexOf('供应商SKU备注');
          if (remarkIndex >= 0) {
            currentOrder.splice(remarkIndex, 0, key);
          } else {
            // 如果没有供应商SKU备注列，添加到内部sku备注列之前
            const internalRemarkIndex = currentOrder.indexOf('内部sku备注');
            if (internalRemarkIndex >= 0) {
              currentOrder.splice(internalRemarkIndex, 0, key);
            } else {
              // 如果没有内部sku备注列，添加到对比结果列之前
              const comparisonIndex = currentOrder.indexOf('对比结果');
              if (comparisonIndex >= 0) {
                currentOrder.splice(comparisonIndex, 0, key);
              } else {
                currentOrder.push(key);
              }
            }
          }
        }
      }
    });

    // 确保安差价加率列在顺序中（如果allColumns中有安差价加率列）
    if (allColumnKeys.includes('安差价加率') && !currentOrder.includes('安差价加率')) {
      // 如果安差价加率列不在顺序中，添加到差价列之后
      const diffIndex = currentOrder.indexOf('差价');
      if (diffIndex >= 0) {
        currentOrder.splice(diffIndex + 1, 0, '安差价加率');
      } else {
        // 如果没有差价列，添加到对比字段类型列之后
        const comparisonFieldTypeIndex = currentOrder.indexOf('对比字段类型');
        if (comparisonFieldTypeIndex >= 0) {
          currentOrder.splice(comparisonFieldTypeIndex + 1, 0, '安差价加率');
        } else {
          // 如果都没有，添加到供应商-门店关系列之前
          const relationIndex = currentOrder.indexOf('供应商-门店关系');
          if (relationIndex >= 0) {
            currentOrder.splice(relationIndex, 0, '安差价加率');
          } else {
            currentOrder.push('安差价加率');
          }
        }
      }
    }

    // 确保供应商-门店关系列在顺序中（如果allColumns中有供应商-门店关系列）
    if (allColumnKeys.includes('供应商-门店关系') && !currentOrder.includes('供应商-门店关系')) {
      // 如果供应商-门店关系列不在顺序中，添加到安差价加率列之后（如果存在），否则添加到差价列之后
      const priceDiffRateIndex = currentOrder.indexOf('安差价加率');
      const diffIndex = currentOrder.indexOf('差价');
      if (priceDiffRateIndex >= 0) {
        currentOrder.splice(priceDiffRateIndex + 1, 0, '供应商-门店关系');
      } else if (diffIndex >= 0) {
        currentOrder.splice(diffIndex + 1, 0, '供应商-门店关系');
      } else {
        // 如果没有差价列，添加到对比字段类型列之后
        const comparisonFieldTypeIndex = currentOrder.indexOf('对比字段类型');
        if (comparisonFieldTypeIndex >= 0) {
          currentOrder.splice(comparisonFieldTypeIndex + 1, 0, '供应商-门店关系');
        } else {
          // 如果都没有，添加到供应商SKU备注列之前
          const remarkIndex = currentOrder.indexOf('供应商SKU备注');
          if (remarkIndex >= 0) {
            currentOrder.splice(remarkIndex, 0, '供应商-门店关系');
          } else {
            // 如果没有供应商SKU备注列，添加到内部sku备注列之前
            const internalRemarkIndex = currentOrder.indexOf('内部sku备注');
            if (internalRemarkIndex >= 0) {
              currentOrder.splice(internalRemarkIndex, 0, '供应商-门店关系');
            } else {
              // 如果没有内部sku备注列，添加到对比结果列之前
              const comparisonIndex = currentOrder.indexOf('对比结果');
              if (comparisonIndex >= 0) {
                currentOrder.splice(comparisonIndex, 0, '供应商-门店关系');
              } else {
                currentOrder.push('供应商-门店关系');
              }
            }
          }
        }
      }
    }

    // 确保供应商SKU备注列在顺序中（如果allColumns中有供应商SKU备注列）
    if (allColumnKeys.includes('供应商SKU备注') && !currentOrder.includes('供应商SKU备注')) {
      // 如果供应商SKU备注列不在顺序中，添加到内部sku备注列之前（如果内部sku备注列存在），否则添加到对比结果列之前
      const internalRemarkIndex = currentOrder.indexOf('内部sku备注');
      const comparisonIndex = currentOrder.indexOf('对比结果');
      if (internalRemarkIndex >= 0) {
        currentOrder.splice(internalRemarkIndex, 0, '供应商SKU备注');
      } else if (comparisonIndex >= 0) {
        currentOrder.splice(comparisonIndex, 0, '供应商SKU备注');
      } else {
        currentOrder.push('供应商SKU备注');
      }
    }

    // 确保内部sku备注列在顺序中（如果allColumns中有内部sku备注列）
    if (allColumnKeys.includes('内部sku备注') && !currentOrder.includes('内部sku备注')) {
      // 如果内部sku备注列不在顺序中，添加到对比结果列之前
      const comparisonIndex = currentOrder.indexOf('对比结果');
      if (comparisonIndex >= 0) {
        currentOrder.splice(comparisonIndex, 0, '内部sku备注');
      } else {
        currentOrder.push('内部sku备注');
      }
    }

    // 按顺序排列
    let orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter((col): col is ColumnType<InventorySummary> => col !== undefined);

    // 确保"安差价加率"列在列顺序中（如果allColumns中有但currentOrder中没有）
    const priceDiffRateCol = allColumns.find(col => col.key === '安差价加率');
    if (priceDiffRateCol && !orderedColumns.find(col => col.key === '安差价加率')) {
      // 如果列存在但不在顺序中，添加到差价列之后
      const diffIndex = orderedColumns.findIndex(col => col.key === '差价');
      if (diffIndex >= 0) {
        orderedColumns.splice(diffIndex + 1, 0, priceDiffRateCol);
      } else {
        // 如果没有差价列，添加到对比字段类型列之后
        const comparisonFieldTypeIndex = orderedColumns.findIndex(col => col.key === '对比字段类型');
        if (comparisonFieldTypeIndex >= 0) {
          orderedColumns.splice(comparisonFieldTypeIndex + 1, 0, priceDiffRateCol);
        } else {
          // 如果都没有，添加到末尾（在供应商-门店关系、供应商SKU备注、内部sku备注和对比结果之前）
          orderedColumns.push(priceDiffRateCol);
        }
      }
    }

    // 确保"供应商-门店关系"列在列顺序中（如果allColumns中有但currentOrder中没有）
    const supplierStoreRelationCol = allColumns.find(col => col.key === '供应商-门店关系');
    if (supplierStoreRelationCol && !orderedColumns.find(col => col.key === '供应商-门店关系')) {
      // 如果列存在但不在顺序中，添加到安差价加率列之后（如果存在），否则添加到差价列之后
      const priceDiffRateIndex = orderedColumns.findIndex(col => col.key === '安差价加率');
      const diffIndex = orderedColumns.findIndex(col => col.key === '差价');
      if (priceDiffRateIndex >= 0) {
        orderedColumns.splice(priceDiffRateIndex + 1, 0, supplierStoreRelationCol);
      } else if (diffIndex >= 0) {
        orderedColumns.splice(diffIndex + 1, 0, supplierStoreRelationCol);
      } else {
        // 如果没有差价列和安差价加率列，添加到对比字段类型列之后
        const comparisonFieldTypeIndex = orderedColumns.findIndex(col => col.key === '对比字段类型');
        if (comparisonFieldTypeIndex >= 0) {
          orderedColumns.splice(comparisonFieldTypeIndex + 1, 0, supplierStoreRelationCol);
        } else {
          // 如果都没有，添加到末尾（在供应商SKU备注、内部sku备注和对比结果之前）
          orderedColumns.push(supplierStoreRelationCol);
        }
      }
    }

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

    // 过滤隐藏的列
    // 允许供应商名称相关列、供应商SKU备注、内部sku备注、对比结果调整显示/隐藏
    orderedColumns = orderedColumns.filter(col => {
      const key = col.key as string;
      // 所有列都可以通过隐藏列表控制显示/隐藏
      // 如果列在隐藏列表中，则隐藏；否则显示
      return !hiddenSet.has(key);
    });

    // 根据上锁状态，将上锁的列固定到最右侧
    // 先分离上锁列和未上锁列
    const lockedColumns: ColumnType<InventorySummary>[] = [];
    const unlockedColumns: ColumnType<InventorySummary>[] = [];

    orderedColumns.forEach(col => {
      const key = col.key as string;
      if (rightLockedColumns.has(key)) {
        lockedColumns.push(col);
      } else {
        unlockedColumns.push(col);
      }
    });

    // 确保上锁的列有fixed: 'right'属性
    lockedColumns.forEach(col => {
      col.fixed = 'right' as const;
    });

    // 确保原本固定的三列（供应商SKU备注、内部sku备注、对比结果）如果没上锁，就不固定
    const defaultFixedColumns = ['供应商SKU备注', '内部sku备注', '对比结果'];
    unlockedColumns.forEach(col => {
      const key = col.key as string;
      if (defaultFixedColumns.includes(key) && col.fixed === 'right') {
        // 如果这些列没上锁，移除fixed属性
        delete col.fixed;
      }
    });

    // 合并：未上锁列在前，上锁列在后（固定在最右侧）
    const finalColumns = [...unlockedColumns, ...lockedColumns];

    return finalColumns;
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

  // 获取右栏所有列定义（用于列设置，不依赖数据）
  const getAllRightColumns = (): ColumnType<InventorySummary>[] => {
    const columns: ColumnType<InventorySummary>[] = [];

    // 根据维度添加城市或门店/仓库名称列
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
      render: () => '-', // 占位渲染
    });

    // 商品名称列
    columns.push({
      title: '商品名称',
      dataIndex: '商品名称',
      key: '商品名称',
      width: 200,
      ellipsis: true,
    });

    // SKU商品标签列
    columns.push({
      title: 'SKU商品标签',
      dataIndex: 'SKU商品标签',
      key: 'SKU商品标签',
      width: 150,
      ellipsis: true,
    });

    // 规格列
    columns.push({
      title: '规格',
      dataIndex: '规格',
      key: '规格',
      width: 150,
      ellipsis: true,
    });

    // 总部零售价列
    columns.push({
      title: '总部零售价',
      dataIndex: '总部零售价',
      key: '总部零售价',
      width: 120,
      render: () => '-',
    });

    // 成本单价列
    columns.push({
      title: '成本单价',
      dataIndex: '成本单价',
      key: '成本单价',
      width: 120,
      render: () => '-',
    });

    // 根据维度动态显示列
    if (inventoryType === '全部') {
      columns.push({
        title: '最低采购价',
        dataIndex: '最低采购价',
        key: '最低采购价',
        width: 120,
        render: () => '-',
      });
      columns.push({
        title: '最近采购价',
        dataIndex: '最近采购价',
        key: '最近采购价',
        width: 120,
        render: () => '-',
      });
    } else {
      columns.push({
        title: '最近采购价',
        dataIndex: '最近采购价',
        key: '最近采购价',
        width: 120,
        render: () => '-',
      });
    }

    // 对比字段类型列
    columns.push({
      title: '对比字段类型',
      dataIndex: '对比字段类型',
      key: '对比字段类型',
      width: 120,
      render: () => '-',
    });

    // 差价列
    columns.push({
      title: '差价',
      dataIndex: '差价',
      key: '差价',
      width: 120,
      render: () => '-',
    });

    // 安差价加率列
    columns.push({
      title: '安差价加率',
      dataIndex: '安差价加率',
      key: '安差价加率',
      width: 120,
      render: () => '-',
    });

    // 供应商-门店关系列
    columns.push({
      title: '供应商-门店关系',
      dataIndex: '供应商-门店关系',
      key: '供应商-门店关系',
      width: 150,
      render: () => '-',
    });

    // 供应商名称列（根据维度动态添加）
    if (inventoryType === '仓店') {
      columns.push({
        title: '供应商名称',
        dataIndex: '供应商名称',
        key: '供应商名称',
        width: 150,
        ellipsis: true,
        render: () => '-',
      });
    } else if (inventoryType === '城市' || inventoryType === '全部') {
      columns.push({
        title: '供应商名称(最低价)',
        dataIndex: '供应商名称(最低价)',
        key: '供应商名称(最低价)',
        width: 180,
        ellipsis: true,
        render: () => '-',
      });
      columns.push({
        title: '供应商名称(最近时间)',
        dataIndex: '供应商名称(最近时间)',
        key: '供应商名称(最近时间)',
        width: 180,
        ellipsis: true,
        render: () => '-',
      });
    }

    // 供应商SKU备注列
    columns.push({
      title: '供应商SKU备注',
      dataIndex: '供应商SKU备注',
      key: '供应商SKU备注',
      width: 200,
      render: () => '-',
    });

    // 内部sku备注列
    columns.push({
      title: '内部sku备注',
      dataIndex: '内部sku备注',
      key: '内部sku备注',
      width: 200,
      render: () => '-',
    });

    // 对比结果列
    columns.push({
      title: '对比结果',
      dataIndex: '对比结果',
      key: '对比结果',
      width: 120,
      render: () => '-',
    });

    return columns;
  };

  // 获取右栏列定义（按默认显示顺序：城市/门店/仓库名称（根据维度）、SKU、最低采购价/最近采购价、SKU商品标签、对比结果，然后是其他列）
  const getRightColumns = (alignedDataForRemark?: any[], filteredAlignedDataForRemark?: any[]): ColumnType<InventorySummary>[] => {
    // 使用全局的alignedData和filteredAlignedData（如果参数未提供）
    const currentAlignedData = alignedDataForRemark !== undefined ? alignedDataForRemark : (typeof alignedData !== 'undefined' ? alignedData : []);
    const currentFilteredAlignedData = filteredAlignedDataForRemark !== undefined ? filteredAlignedDataForRemark : (typeof filteredAlignedData !== 'undefined' ? filteredAlignedData : []);
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

    // SKU列（固定左侧）
    columns.push({
      title: 'SKU',
      dataIndex: 'SKU',
      key: 'SKU',
      width: 120,
      fixed: 'left' as const,
      render: (text: string, record: InventorySummary, index?: number) => {
        // 首先输出基本信息，确认render函数被调用
        console.log(`[SKU列Render函数] 行索引: ${index}, UPC: ${record.UPC}, text参数:`, text, 'record.SKU:', record.SKU, 'record完整数据:', record);

        // ========== 多种SKU为空的判断方式 ==========
        // 方法1：通过text参数判断
        const textStr = text === null || text === undefined ? '' : String(text);
        const textTrimmed = textStr.trim();
        const isEmptyByText1 = textStr === '-' || textTrimmed === '';
        const isEmptyByText2 = !text || text === null || text === undefined || text === '';
        const isEmptyByText3 = textTrimmed === '-' || textTrimmed === '';

        // 方法2：通过record.SKU字段判断
        const recordSku = record.SKU;
        const recordSkuStr = recordSku === null || recordSku === undefined ? '' : String(recordSku);
        const recordSkuTrimmed = recordSkuStr.trim();
        const isEmptyByRecord1 = !recordSku || recordSku === null || recordSku === undefined || recordSku === '';
        const isEmptyByRecord2 = recordSkuStr === '-' || recordSkuTrimmed === '';
        const isEmptyByRecord3 = recordSkuTrimmed === '-' || recordSkuTrimmed === '';

        // 方法3：通过record['SKU']字段判断
        const recordSkuBracket = (record as any)['SKU'];
        const recordSkuBracketStr = recordSkuBracket === null || recordSkuBracket === undefined ? '' : String(recordSkuBracket);
        const recordSkuBracketTrimmed = recordSkuBracketStr.trim();
        const isEmptyByRecordBracket1 = !recordSkuBracket || recordSkuBracket === null || recordSkuBracket === undefined || recordSkuBracket === '';
        const isEmptyByRecordBracket2 = recordSkuBracketStr === '-' || recordSkuBracketTrimmed === '';

        // 方法4：综合判断（text和record.SKU都为空）
        const isEmptyByBoth = (isEmptyByText1 || isEmptyByText2 || isEmptyByText3) &&
          (isEmptyByRecord1 || isEmptyByRecord2 || isEmptyByRecord3);

        // 方法5：通过UPC映射判断（如果UPC存在但SKU为空）
        const hasUpc = record.UPC && String(record.UPC).trim() !== '';
        const isEmptyByUpcMapping = hasUpc && (isEmptyByText1 || isEmptyByRecord1);

        // 输出详细日志
        console.log(`[SKU判断] 行索引: ${index}, UPC: ${record.UPC}`, {
          text: { value: text, type: typeof text, isEmpty1: isEmptyByText1, isEmpty2: isEmptyByText2, isEmpty3: isEmptyByText3 },
          recordSku: { value: recordSku, type: typeof recordSku, isEmpty1: isEmptyByRecord1, isEmpty2: isEmptyByRecord2, isEmpty3: isEmptyByRecord3 },
          recordSkuBracket: { value: recordSkuBracket, type: typeof recordSkuBracket, isEmpty1: isEmptyByRecordBracket1, isEmpty2: isEmptyByRecordBracket2 },
          isEmptyByBoth,
          isEmptyByUpcMapping,
          hasUpc,
        });

        // ========== 根据日志选择判断方式 ==========
        // 请查看控制台日志，根据实际情况选择以下判断方式之一：
        // 选项1: isEmptyByText1 - 仅通过text参数判断（text === '-' || text.trim() === ''）
        // 选项2: isEmptyByText2 - 仅通过text参数判断（!text || text === null || text === undefined || text === ''）
        // 选项3: isEmptyByText3 - 仅通过text参数判断（text.trim() === '-' || text.trim() === ''）
        // 选项4: isEmptyByRecord1 - 仅通过record.SKU判断（!recordSku || recordSku === null || recordSku === undefined || recordSku === ''）
        // 选项5: isEmptyByRecord2 - 仅通过record.SKU判断（recordSkuStr === '-' || recordSkuTrimmed === ''）
        // 选项6: isEmptyByRecord3 - 仅通过record.SKU判断（recordSkuTrimmed === '-' || recordSkuTrimmed === ''）
        // 选项7: isEmptyByBoth - text和record.SKU都为空
        // 选项8: isEmptyByUpcMapping - UPC存在但SKU为空
        // 当前使用：text为空 或 record.SKU为空 或 两者都为空（可以根据日志调整）
        const isSkuEmpty = isEmptyByText1 || isEmptyByRecord1 || isEmptyByBoth;

        // 处理SKU值：可能是"-"、undefined、null或空字符串
        // 注意：text可能是undefined、null、空字符串或"-"
        // 如果当前搜索是通过手动绑定SKU，优先显示搜索的SKU
        const skuText = matchedSkuSearch && matchedSkuSearch.trim()
          ? matchedSkuSearch.trim()
          : (isSkuEmpty ? '-' : (textTrimmed || recordSkuTrimmed || '-'));

        // 使用唯一标识符作为key：如果有SKU则用SKU，否则用UPC，如果都没有则用索引+UPC组合
        // 确保uniqueKey稳定，即使SKU为"-"也能正确工作
        const skuValue = !isSkuEmpty ? skuText : null;
        const upcValue = record.UPC && String(record.UPC).trim() !== '' ? String(record.UPC).trim() : null;
        const uniqueKey = skuValue || upcValue || `row-${index || 0}-${upcValue || ''}`;
        const isEditing = editingSkuQuotation === uniqueKey;
        const currentSkuInput = skuBindingInput[uniqueKey] || '';


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

                break; // 找到第一个匹配的就退出
              }
            }

          }
        }


        // 检查是否有SKU绑定
        const bindingKey = supplierCode && supplierProductCode ? `${supplierCode}_${supplierProductCode}` : null;
        const boundSku = bindingKey ? skuBindingMap[bindingKey] : null;
        // 检查SKU是否来自供应商编码手动绑定sku表
        const supplierBindingSku = bindingKey ? supplierBindingSkuMap[bindingKey] : null;
        const isFromSupplierBinding = supplierBindingSku && skuText && skuText === supplierBindingSku;
        // 如果有绑定SKU，直接显示"绑"标签；否则检查原SKU是否在绑定标记中，或者是否来自供应商编码手动绑定sku表
        const hasBinding = boundSku ? true : (isFromSupplierBinding ? true : (skuText && !isSkuEmpty ? (skuBindingFlags[skuText] || false) : false));

        // 调试日志：检查boundSku的计算
        console.log(`[SKU绑定检查] 行索引: ${index}, UPC: ${record.UPC}`, {
          supplierCode,
          supplierProductCode,
          bindingKey,
          boundSku,
          supplierBindingSku,
          skuBindingMap: bindingKey ? skuBindingMap[bindingKey] : 'no bindingKey',
          supplierBindingSkuMap: bindingKey ? supplierBindingSkuMap[bindingKey] : 'no bindingKey',
          hasBinding,
        });

        // 显示绑定的SKU，如果没有绑定则显示原SKU
        const displaySku = boundSku || skuText || '-';

        // 优先检查：如果SKU为空（null/undefined/空字符串/只包含空格/"-"），直接显示绑定SKU按钮
        // 或者，如果通过UPC无法在upcToSkuMap中找到对应的SKU，也应该显示绑定SKU按钮

        // 检查通过UPC是否能在upcToSkuMap中找到对应的SKU
        let hasUpcToSkuMapping = false;
        if (record.UPC) {
          const upcStr = record.UPC ? String(record.UPC).trim() : '';
          const upcArray = upcStr !== '' ? upcStr.split(',').map(u => u.trim()).filter(u => u !== '') : [];
          // 如果upcToSkuMap存在且有数据，检查是否有任何一个UPC在upcToSkuMap中有映射
          // 如果upcToSkuMap为空或不存在，说明还没有加载UPC到SKU的映射，应该显示绑定按钮
          if (upcToSkuMap && Object.keys(upcToSkuMap).length > 0) {
            hasUpcToSkuMapping = upcArray.some(upc => {
              const skuCodesFromUpc = upcToSkuMap[upc];
              return skuCodesFromUpc && Array.isArray(skuCodesFromUpc) && skuCodesFromUpc.length > 0;
            });
          } else {
            // upcToSkuMap为空或不存在，说明还没有加载映射，应该显示绑定按钮
            hasUpcToSkuMapping = false;
          }
        }


        // 如果SKU为空，或者通过UPC无法找到对应的SKU，显示输入框
        // 但是，如果有boundSku（手动绑定的SKU），不应该显示输入框，而应该显示绑定的SKU
        // 如果skuText不为空且不是"-"，说明已经匹配到了SKU，也不应该显示输入框

        // 输出判断日志
        console.log(`[SKU输入框判断] 行索引: ${index}, UPC: ${record.UPC}`, {
          isSkuEmpty,
          boundSku,
          skuText,
          matchedQuotation: matchedQuotation ? {
            供应商编码: matchedQuotation.供应商编码,
            供应商商品编码: matchedQuotation.供应商商品编码,
            最小销售规格UPC商品条码: matchedQuotation.最小销售规格UPC商品条码,
          } : null,
          shouldShowInput: isSkuEmpty && !boundSku,
          condition1_isSkuEmpty: isSkuEmpty,
          condition2_notBoundSku: !boundSku,
          conditionResult: isSkuEmpty && !boundSku,
          // 检查数据源
          allLeftDataLength: allLeftData.length,
          leftDataLength: leftData.length,
          upcArray: record.UPC ? String(record.UPC).trim().split(',').map(u => u.trim()).filter(u => u !== '') : [],
        });

        // 关键判断：即使boundSku存在，如果SKU为空，也应该显示输入框（允许重新输入）
        // 修改判断逻辑：只要SKU为空就显示输入框，不管是否有boundSku
        const shouldShowInputBox = isSkuEmpty; // 简化判断：只要SKU为空就显示输入框

        console.log(`[SKU输入框最终判断] 行索引: ${index}`, {
          shouldShowInputBox,
          isSkuEmpty,
          boundSku,
          reason: shouldShowInputBox ? 'SKU为空，应该显示输入框' : 'SKU不为空，不显示输入框',
        });

        if (shouldShowInputBox) {
          // 获取UPC（如果有的话）
          const upcStr = record.UPC ? String(record.UPC).trim() : '';
          const upcArray = upcStr !== '' ? upcStr.split(',').map(u => u.trim()).filter(u => u !== '') : [];
          const upcToUse = upcArray.length > 0 ? upcArray[0] : '';

          // 尝试通过UPC找到匹配的供应商报价（用于绑定）
          // 优先使用已经匹配到的matchedQuotation，如果没有则重新查找
          let quotationForBinding: SupplierQuotation | null = matchedQuotation;

          if (!quotationForBinding && upcArray.length > 0) {
            const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
            // 遍历所有UPC值，找到第一个匹配的供应商报价
            for (const recordUpc of upcArray) {
              const quotation = dataSource.find(q => {
                if (!q.最小销售规格UPC商品条码) return false;
                const qUpc = String(q.最小销售规格UPC商品条码).trim();
                return qUpc === recordUpc;
              });
              if (quotation && quotation.供应商编码 && quotation.最小销售规格UPC商品条码) {
                quotationForBinding = quotation;
                break;
              }
            }
          }

          // 如果找到了匹配的供应商报价，显示输入框（参考供应商SKU备注的输入框样式）
          console.log(`[SKU输入框显示] 行索引: ${index}`, {
            quotationForBinding: quotationForBinding ? {
              供应商编码: quotationForBinding.供应商编码,
              供应商商品编码: quotationForBinding.供应商商品编码,
              最小销售规格UPC商品条码: quotationForBinding.最小销售规格UPC商品条码,
            } : null,
            willShowInput: quotationForBinding && quotationForBinding.供应商编码 && quotationForBinding.最小销售规格UPC商品条码,
            // 详细检查条件
            hasQuotation: !!quotationForBinding,
            hasSupplierCode: quotationForBinding ? !!quotationForBinding.供应商编码 : false,
            hasUpcCode: quotationForBinding ? !!quotationForBinding.最小销售规格UPC商品条码 : false,
            // 检查数据源
            dataSourceLength: (allLeftData.length > 0 ? allLeftData : leftData).length,
            upcArrayLength: upcArray.length,
            matchedQuotationInfo: matchedQuotation ? {
              供应商编码: matchedQuotation.供应商编码,
              最小销售规格UPC商品条码: matchedQuotation.最小销售规格UPC商品条码,
            } : null,
          });

          // 修改条件：即使没有找到quotationForBinding，只要有UPC也应该显示输入框
          // 但需要供应商编码和UPC才能保存，所以如果没有找到匹配的供应商报价，可以显示输入框但提示用户
          const canShowInput = quotationForBinding && quotationForBinding.供应商编码 && quotationForBinding.最小销售规格UPC商品条码;

          console.log(`[SKU输入框渲染判断] 行索引: ${index}`, {
            canShowInput,
            quotationForBinding: !!quotationForBinding,
            hasSupplierCode: quotationForBinding ? !!quotationForBinding.供应商编码 : false,
            hasUpcCode: quotationForBinding ? !!quotationForBinding.最小销售规格UPC商品条码 : false,
            willRenderInput: canShowInput,
          });

          if (canShowInput && quotationForBinding) {
            const emptySkuKey = uniqueKey;
            // 从supplierBindingSkuMap中获取已保存的SKU值（如果存在）
            const bindingKeyForInput = `${quotationForBinding.供应商编码}_${quotationForBinding.最小销售规格UPC商品条码}`;
            const savedSkuFromBinding = supplierBindingSkuMap[bindingKeyForInput] || '';
            // 原始值：优先使用已保存的值
            const originalSkuValue = savedSkuFromBinding || '';
            // 使用与供应商SKU备注完全相同的逻辑：如果emptySkuInputs中有这个key，则使用它，否则使用原始值
            const skuValue = emptySkuInputs[emptySkuKey] !== undefined
              ? emptySkuInputs[emptySkuKey]
              : originalSkuValue;
            // 判断是否有变化：比较当前值和原始值（与供应商SKU备注的逻辑完全一致）
            const hasChanged = skuValue !== originalSkuValue;

            const handleSave = async () => {
              const value = skuValue.trim();
              if (quotationForBinding!.供应商编码 && quotationForBinding!.最小销售规格UPC商品条码) {
                try {
                  await supplierQuotationApi.updateSkuBinding({
                    supplierCode: quotationForBinding!.供应商编码,
                    upcCode: String(quotationForBinding!.最小销售规格UPC商品条码).trim(),
                    sku: value,
                  });
                  // 移除编辑状态（保存后，新的值会从supplierBindingSkuMap中读取）
                  const newEditingKeys = new Set(editingEmptySkuKeys);
                  newEditingKeys.delete(emptySkuKey);
                  setEditingEmptySkuKeys(newEditingKeys);
                  // 清空输入框状态，让输入框从supplierBindingSkuMap中读取最新值
                  const updatedInputs = { ...emptySkuInputs };
                  delete updatedInputs[emptySkuKey];
                  setEmptySkuInputs(updatedInputs);
                  messageApi.success('SKU保存成功');

                  // 清除相关供应商编码的缓存，因为SKU绑定会影响匹配
                  if (quotationForBinding!.供应商编码) {
                    clearCacheForSupplierCodes([quotationForBinding!.供应商编码]);
                  }

                  // 重新加载数据（强制刷新，跳过缓存）
                  const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                  if (rightAllData.length > 0 && dataSource.length > 0) {
                    await loadQuotationBindingFlags(rightAllData, dataSource);
                    // 重新加载SKU绑定数据
                    await loadSkuBindingMap(dataSource, upcToSkuMap);
                    // 重新加载供应商编码手动绑定sku映射
                    await loadSupplierBindingSkuMap(dataSource);
                    // 重新加载库存汇总数据以更新匹配（强制刷新，跳过缓存）
                    if (selectedSupplierCodes.length > 0 && dataSource.length > 0) {
                      await loadRightData(dataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                    }
                  }
                } catch (error) {
                  console.error('保存SKU失败:', error);
                  messageApi.error('保存SKU失败');
                }
              }
            };

            const handleCancel = () => {
              // 恢复原始值（与供应商SKU备注的逻辑一致）
              setEmptySkuInputs({
                ...emptySkuInputs,
                [emptySkuKey]: originalSkuValue,
              });
              // 移除编辑状态
              const newEditingKeys = new Set(editingEmptySkuKeys);
              newEditingKeys.delete(emptySkuKey);
              setEditingEmptySkuKeys(newEditingKeys);
            };

            const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const newValue = e.target.value;
              // 总是更新输入框的值（与供应商SKU备注的逻辑一致）
              setEmptySkuInputs({
                ...emptySkuInputs,
                [emptySkuKey]: newValue,
              });
              // 如果值发生变化，标记为正在编辑（这样hasChanged会变为true，按钮会显示）
              if (newValue !== originalSkuValue) {
                const newEditingKeys = new Set(editingEmptySkuKeys);
                newEditingKeys.add(emptySkuKey);
                setEditingEmptySkuKeys(newEditingKeys);
              } else {
                // 如果值恢复为原始值，移除编辑状态并清除输入框状态
                const newEditingKeys = new Set(editingEmptySkuKeys);
                newEditingKeys.delete(emptySkuKey);
                setEditingEmptySkuKeys(newEditingKeys);
                // 清除输入框状态，让输入框从原始值读取（这样hasChanged会变为false，按钮会隐藏）
                const updatedInputs = { ...emptySkuInputs };
                delete updatedInputs[emptySkuKey];
                setEmptySkuInputs(updatedInputs);
              }
            };

            return (
              <div
                data-sku-column="true"
                onClick={(e) => {
                  // 阻止事件冒泡，避免触发行点击事件
                  e.stopPropagation();
                }}
                style={{ width: '100%' }}
              >
                <Input
                  value={skuValue}
                  onChange={handleChange}
                  placeholder="无匹配数据,可输入绑定"
                  style={{ width: '100%', marginBottom: hasChanged ? 4 : 0 }}
                />
                {hasChanged && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      type="primary"
                      size="small"
                      icon={<SaveOutlined />}
                      onClick={handleSave}
                      style={{ height: '16px', fontSize: '11px', padding: '0 8px', lineHeight: '16px' }}
                    >
                      保存
                    </Button>
                    <Button
                      size="small"
                      onClick={handleCancel}
                      style={{ height: '16px', fontSize: '11px', padding: '0 8px', lineHeight: '16px' }}
                    >
                      取消
                    </Button>
                  </div>
                )}
              </div>
            );
          }

          // 如果没有找到匹配的供应商报价，显示普通文本
          console.log(`[SKU输入框-未找到供应商报价] 行索引: ${index}, UPC: ${record.UPC}, skuText: ${skuText}, quotationForBinding:`, quotationForBinding);
          return <span>{skuText || '-'}</span>;
        }

        // 如果仍然没有找到匹配的供应商报价，检查是否可以显示绑定SKU按钮
        console.log(`[SKU列-继续处理] 行索引: ${index}, UPC: ${record.UPC}, matchedQuotation:`, !!matchedQuotation, 'supplierCode:', supplierCode, 'supplierProductCode:', supplierProductCode, 'isSkuEmpty:', isSkuEmpty, 'boundSku:', boundSku);
        if (!matchedQuotation || !supplierCode || !supplierProductCode) {
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
                    // 需要获取UPC（从matchedQuotation获取）
                    const upcCode = matchedQuotation?.最小销售规格UPC商品条码 ? String(matchedQuotation.最小销售规格UPC商品条码).trim() : '';
                    if (!upcCode) {
                      message.warning('未找到UPC信息');
                      return;
                    }
                    await supplierQuotationApi.updateSkuBinding({
                      supplierCode: supplierCode,
                      upcCode: upcCode,
                      sku: '',
                    });
                    messageApi.success('清空成功');

                    // 清除相关供应商编码的缓存，因为SKU绑定会影响匹配
                    if (supplierCode) {
                      clearCacheForSupplierCodes([supplierCode]);
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
                    messageApi.error(`清空失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
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
                      messageApi.warning('请输入SKU');
                      return;
                    }

                    try {
                      // 需要获取UPC（从matchedQuotation获取）
                      const upcCode = matchedQuotation?.最小销售规格UPC商品条码 ? String(matchedQuotation.最小销售规格UPC商品条码).trim() : '';
                      if (!upcCode) {
                        messageApi.warning('未找到UPC信息');
                        return;
                      }
                      await supplierQuotationApi.updateSkuBinding({
                        supplierCode: supplierCode,
                        upcCode: upcCode,
                        sku: skuValue,
                      });
                      messageApi.success('保存成功');

                      // 清除相关供应商编码的缓存，因为SKU绑定会影响匹配
                      if (supplierCode) {
                        clearCacheForSupplierCodes([supplierCode]);
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
                      messageApi.error(`保存失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
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
                  // 如果点击时还没有设置editingSkuQuotation，立即设置
                  if (editingSkuQuotation !== uniqueKey) {
                    setEditingSkuQuotation(uniqueKey);
                  }
                }}
              >
                {displaySku || '-'}
                {(hasBinding || boundSku) && (
                  <Tag color="green" style={{ margin: 0 }}>绑</Tag>
                )}
              </span>
            </Popover>
          </div>
        );
      },
    });

    // 按照要求的顺序添加列：SKU 商品名称 SKU商品标签 规格 总部零售价 成本单价 最低采购价 最近采购价 对比字段类型 差价 供应商SKU备注 对比结果

    // 商品名称列
    columns.push({
      title: '商品名称',
      dataIndex: '商品名称',
      key: '商品名称',
      width: 200,
      ellipsis: true,
    });

    // SKU商品标签列
    columns.push({
      title: 'SKU商品标签',
      dataIndex: 'SKU商品标签',
      key: 'SKU商品标签',
      width: 150,
      ellipsis: true,
    });

    // 规格列
    columns.push({
      title: '规格',
      dataIndex: '规格',
      key: '规格',
      width: 150,
      ellipsis: true,
    });

    // 总部零售价列
    columns.push({
      title: '总部零售价',
      dataIndex: '总部零售价',
      key: '总部零售价',
      width: 120,
      render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
    });

    // 成本单价列
    columns.push({
      title: '成本单价',
      dataIndex: '成本单价',
      key: '成本单价',
      width: 120,
      render: (text: number) => (text !== undefined && text !== null) ? `¥${Number(text).toFixed(2)}` : '-',
    });

    // 根据维度动态显示列：全部显示最低采购价和最近采购价，仓店/城市显示最近采购价
    if (inventoryType === '全部') {
      columns.push({
        title: '最低采购价',
        dataIndex: '最低采购价',
        key: '最低采购价',
        width: 120,
        render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
      });
      columns.push({
        title: '最近采购价',
        dataIndex: '最近采购价',
        key: '最近采购价',
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

    // 对比字段类型列
    columns.push({
      title: '对比字段类型',
      dataIndex: '对比字段类型',
      key: '对比字段类型',
      width: 120,
      render: (text: string) => text || '-',
    });

    // 差价列
    columns.push({
      title: '差价',
      dataIndex: '差价',
      key: '差价',
      width: 120,
      render: (text: number) => {
        if (text === undefined || text === null) return '-';
        const sign = text >= 0 ? '+' : '';
        return `${sign}¥${Number(text).toFixed(2)}`;
      },
    });

    // 安差价加率列
    columns.push({
      title: '安差价加率',
      dataIndex: '安差价加率',
      key: '安差价加率',
      width: 120,
      render: (text: number, record: InventorySummary) => {
        if (text === undefined || text === null) return '-';
        const sign = text >= 0 ? '+' : '';
        return `${sign}${(Number(text) * 100).toFixed(2)}%`;
      },
    });

    // 供应商-门店关系列（默认隐藏）
    columns.push({
      title: '供应商-门店关系',
      dataIndex: '供应商-门店关系',
      key: '供应商-门店关系',
      width: 200,
      render: (text: number, record: InventorySummary, index: number) => {
        if (text === undefined || text === null) return '-';

        // 在 getMergedColumns 中，record 实际上是 mergedData 的 record，包含 quotation 和 inventory
        // 但在这里，record 是 InventorySummary，我们需要通过其他方式获取供应商编码
        // 由于 render 函数在 getMergedColumns 中会被重新定义，我们在这里返回一个标记值
        // 实际的格式化逻辑将在 getMergedColumns 中处理
        return text;
      },
    });

    // 供应商名称列（根据维度不同显示不同列，默认隐藏）
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

    // 供应商SKU备注列 - 根据上锁状态决定是否固定（在getFilteredRightColumns中处理）
    columns.push({
      title: '供应商SKU备注',
      dataIndex: '供应商SKU备注',
      key: '供应商SKU备注',
      width: 200,
      render: (_: any, record: InventorySummary) => {
        // 通过SKU从alignedData中找到匹配的供应商报价
        // 注意：这里需要使用当前的alignedData或filteredAlignedData
        const dataToSearch = (comparisonResultFilter.length > 0 || inventorySkuSearch.trim()
          ? currentFilteredAlignedData
          : currentAlignedData) || [];

        const matchedItem = dataToSearch.find((item: any) => {
          return item.inventory && item.inventory.SKU === record.SKU;
        });

        if (!matchedItem || !matchedItem.quotation) {
          return '-';
        }

        const quotation = matchedItem.quotation as SupplierQuotation;
        if (!quotation.供应商编码) {
          return '-';
        }

        // 获取SKU：优先使用手动绑定的SKU，如果没有则使用库存汇总里匹配出来的SKU
        const bindingKey = quotation.供应商编码 && quotation.供应商商品编码
          ? `${quotation.供应商编码}_${quotation.供应商商品编码}`
          : null;
        const boundSku = bindingKey ? skuBindingMap[bindingKey] : null;
        const skuToUse = boundSku || record.SKU || '';

        if (!skuToUse) {
          return '-';
        }

        const remarkKey = `${quotation.供应商编码}_${skuToUse}`;
        const originalRemark = supplierProductRemarks[remarkKey] || '';
        const remark = editingRemarks[remarkKey] !== undefined
          ? editingRemarks[remarkKey]
          : originalRemark;
        const hasChanged = remark !== originalRemark;

        const handleSave = async () => {
          const value = remark.trim();
          if (quotation.供应商编码 && skuToUse) {
            try {
              await supplierQuotationApi.saveSupplierProductRemark({
                supplierCode: quotation.供应商编码,
                sku: skuToUse,
                remark: value,
              });
              // 更新本地状态
              setSupplierProductRemarks({
                ...supplierProductRemarks,
                [remarkKey]: value,
              });
              setEditingRemarks({
                ...editingRemarks,
                [remarkKey]: value,
              });
              // 移除编辑状态
              const newEditingKeys = new Set(editingRemarkKeys);
              newEditingKeys.delete(remarkKey);
              setEditingRemarkKeys(newEditingKeys);
              message.success('供应商SKU备注保存成功');
            } catch (error) {
              console.error('保存供应商SKU备注失败:', error);
              message.error('保存供应商SKU备注失败');
            }
          }
        };

        const handleCancel = () => {
          // 恢复原始值
          setEditingRemarks({
            ...editingRemarks,
            [remarkKey]: originalRemark,
          });
          // 移除编辑状态
          const newEditingKeys = new Set(editingRemarkKeys);
          newEditingKeys.delete(remarkKey);
          setEditingRemarkKeys(newEditingKeys);
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const newValue = e.target.value;
          // 限制100字
          if (newValue.length > 100) {
            return;
          }
          setEditingRemarks({
            ...editingRemarks,
            [remarkKey]: newValue,
          });
          // 如果值发生变化，标记为正在编辑
          if (newValue !== originalRemark) {
            const newEditingKeys = new Set(editingRemarkKeys);
            newEditingKeys.add(remarkKey);
            setEditingRemarkKeys(newEditingKeys);
          } else {
            // 如果值恢复为原始值，移除编辑状态
            const newEditingKeys = new Set(editingRemarkKeys);
            newEditingKeys.delete(remarkKey);
            setEditingRemarkKeys(newEditingKeys);
          }
        };

        const remainingChars = 100 - remark.length;

        return (
          <div style={{ width: '100%' }}>
            <Input
              value={remark}
              onChange={handleChange}
              placeholder="请输入供应商SKU备注"
              maxLength={100}
              style={{ width: '100%', marginBottom: hasChanged ? 4 : 0 }}
              suffix={<span style={{ fontSize: '12px', color: remainingChars < 20 ? '#ff4d4f' : '#999' }}>{remainingChars}</span>}
            />
            {hasChanged && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  style={{ height: '16px', fontSize: '11px', padding: '0 8px', lineHeight: '16px' }}
                >
                  保存
                </Button>
                <Button
                  size="small"
                  onClick={handleCancel}
                  style={{ height: '16px', fontSize: '11px', padding: '0 8px', lineHeight: '16px' }}
                >
                  取消
                </Button>
              </div>
            )}
          </div>
        );
      },
    });

    // 内部sku备注列 - 根据上锁状态决定是否固定（在getFilteredRightColumns中处理）
    columns.push({
      title: '内部sku备注',
      dataIndex: '内部sku备注',
      key: '内部sku备注',
      width: 200,
      render: (_: any, record: InventorySummary) => {
        // 通过SKU从alignedData中找到匹配的供应商报价
        // 注意：这里需要使用当前的alignedData或filteredAlignedData
        const dataToSearch = (comparisonResultFilter.length > 0 || inventorySkuSearch.trim()
          ? currentFilteredAlignedData
          : currentAlignedData) || [];

        const matchedItem = dataToSearch.find((item: any) => {
          return item.inventory && item.inventory.SKU === record.SKU;
        });

        let skuToUse = '';

        if (!matchedItem || !matchedItem.quotation) {
          // 如果没有匹配的供应商报价，直接使用库存汇总的SKU
          skuToUse = record.SKU || '';
        } else {
          const quotation = matchedItem.quotation as SupplierQuotation;
          if (!quotation.供应商编码) {
            // 如果没有供应商编码，直接使用库存汇总的SKU
            skuToUse = record.SKU || '';
          } else {
            // 获取SKU：优先使用手动绑定的SKU，如果没有则使用库存汇总里匹配出来的SKU
            // 一定要是数据行显示的SKU，如果显示的是手动绑定的SKU就用手动绑定的去匹配
            const bindingKey = quotation.供应商编码 && quotation.供应商商品编码
              ? `${quotation.供应商编码}_${quotation.供应商商品编码}`
              : null;
            const boundSku = bindingKey ? skuBindingMap[bindingKey] : null;
            skuToUse = boundSku || record.SKU || '';
          }
        }

        if (!skuToUse) {
          return '-';
        }

        const originalRemark = internalSkuRemarks[skuToUse] || '';
        const remark = editingInternalSkuRemarks[skuToUse] !== undefined
          ? editingInternalSkuRemarks[skuToUse]
          : originalRemark;
        const hasChanged = remark !== originalRemark;

        const handleSave = async () => {
          const value = remark.trim();
          if (skuToUse) {
            try {
              await supplierQuotationApi.saveInternalSkuRemark({
                sku: skuToUse,
                remark: value,
              });
              // 更新本地状态
              setInternalSkuRemarks({
                ...internalSkuRemarks,
                [skuToUse]: value,
              });
              setEditingInternalSkuRemarks({
                ...editingInternalSkuRemarks,
                [skuToUse]: value,
              });
              // 移除编辑状态
              const newEditingKeys = new Set(editingInternalSkuRemarkKeys);
              newEditingKeys.delete(skuToUse);
              setEditingInternalSkuRemarkKeys(newEditingKeys);
              messageApi.success('内部sku备注保存成功');
            } catch (error) {
              console.error('保存内部sku备注失败:', error);
              messageApi.error('保存内部sku备注失败');
            }
          }
        };

        const handleCancel = () => {
          // 恢复原始值
          setEditingInternalSkuRemarks({
            ...editingInternalSkuRemarks,
            [skuToUse]: originalRemark,
          });
          // 移除编辑状态
          const newEditingKeys = new Set(editingInternalSkuRemarkKeys);
          newEditingKeys.delete(skuToUse);
          setEditingInternalSkuRemarkKeys(newEditingKeys);
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const newValue = e.target.value;
          // 限制100字
          if (newValue.length > 100) {
            return;
          }
          setEditingInternalSkuRemarks({
            ...editingInternalSkuRemarks,
            [skuToUse]: newValue,
          });
          // 如果值发生变化，标记为正在编辑
          if (newValue !== originalRemark) {
            const newEditingKeys = new Set(editingInternalSkuRemarkKeys);
            newEditingKeys.add(skuToUse);
            setEditingInternalSkuRemarkKeys(newEditingKeys);
          } else {
            // 如果值恢复为原始值，移除编辑状态
            const newEditingKeys = new Set(editingInternalSkuRemarkKeys);
            newEditingKeys.delete(skuToUse);
            setEditingInternalSkuRemarkKeys(newEditingKeys);
          }
        };

        const remainingChars = 100 - remark.length;

        return (
          <div style={{ width: '100%' }}>
            <Input
              value={remark}
              onChange={handleChange}
              placeholder="请输入内部sku备注"
              maxLength={100}
              style={{ width: '100%', marginBottom: hasChanged ? 4 : 0 }}
              suffix={<span style={{ fontSize: '12px', color: remainingChars < 20 ? '#ff4d4f' : '#999' }}>{remainingChars}</span>}
            />
            {hasChanged && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  style={{ height: '16px', fontSize: '11px', padding: '0 8px', lineHeight: '16px' }}
                >
                  保存
                </Button>
                <Button
                  size="small"
                  onClick={handleCancel}
                  style={{ height: '16px', fontSize: '11px', padding: '0 8px', lineHeight: '16px' }}
                >
                  取消
                </Button>
              </div>
            )}
          </div>
        );
      },
    });

    // 对比结果列 - 根据上锁状态决定是否固定（在getFilteredRightColumns中处理）
    // 使用与筛选框一致的渲染方式
    columns.push({
      title: '对比结果',
      dataIndex: '对比结果',
      key: '对比结果',
      width: 120,
      render: (text: string, record: InventorySummary) => {
        // 如果对比结果为"无匹配数据"，显示绑定SKU按钮
        if (text === '无匹配数据') {
          // 获取UPC
          const upcStr = record.UPC ? String(record.UPC).trim() : '';
          const upcArray = upcStr !== '' ? upcStr.split(',').map(u => u.trim()).filter(u => u !== '') : [];


          if (upcArray.length > 0) {
            // 尝试通过UPC找到供应商报价（用于绑定）
            const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
            let quotationForBinding: SupplierQuotation | null = null;


            // 遍历所有UPC值，找到第一个匹配的供应商报价
            for (const recordUpc of upcArray) {
              const quotation = dataSource.find(q => {
                if (!q.最小销售规格UPC商品条码) return false;
                const qUpc = String(q.最小销售规格UPC商品条码).trim();
                return qUpc === recordUpc;
              });

              if (quotation && quotation.供应商编码 && quotation.供应商商品编码) {
                quotationForBinding = quotation;
                break;
              }
            }

            // 如果找到了供应商报价，显示绑定SKU按钮
            if (quotationForBinding && quotationForBinding.供应商编码 && quotationForBinding.供应商商品编码) {
              const upcToUse = quotationForBinding.最小销售规格UPC商品条码 ? String(quotationForBinding.最小销售规格UPC商品条码).trim() : upcArray[0];


              return (
                <div
                  onClick={(e) => {
                    // 阻止事件冒泡，避免触发行点击事件
                    e.stopPropagation();
                    // 打开手动绑定SKU Modal，直接使用供应商报价的供应商编码和UPC
                    const upcCode = quotationForBinding.最小销售规格UPC商品条码 ? String(quotationForBinding.最小销售规格UPC商品条码).trim() : upcToUse;
                    setManualBindingRecord({
                      supplierCode: quotationForBinding.供应商编码!,
                      upcCode: upcCode,
                    });
                    setManualBindingSkuInput('');
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
          }

          // 如果没有找到供应商报价，显示"无匹配数据"标签
          const option = comparisonResultOptions.find(opt => opt.value === text);
          if (option) {
            return <Tag color={option.color}>{text}</Tag>;
          }
          return text || '-';
        }

        // 其他对比结果，正常显示标签
        const option = comparisonResultOptions.find(opt => opt.value === text);
        if (option) {
          return <Tag color={option.color}>{text}</Tag>;
        }
        return text || '-';
      },
    });

    // 确保供应商SKU备注列、内部sku备注列和对比结果列都在columns中
    // 检查供应商SKU备注列是否存在
    const hasRemarkCol = columns.some(col => col.key === '供应商SKU备注');
    const hasInternalRemarkCol = columns.some(col => col.key === '内部sku备注');
    const hasComparisonCol = columns.some(col => col.key === '对比结果');

    if (!hasRemarkCol) {
      console.warn('[备注列] 备注列未找到，重新添加');
    }
    if (!hasComparisonCol) {
      console.warn('[对比结果列] 对比结果列未找到，重新添加');
    }

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

    // 检查是否有搜索条件
    const searchParams = buildSearchParams();
    const hasSearchConditions =
      searchParams.supplierName ||
      searchParams.supplierCode ||
      searchParams.productName ||
      searchParams.upcCode ||
      comparisonResultFilter.length > 0 ||
      inventorySkuSearch.trim();

    // 如果没有选择供应商编码且没有搜索条件，不加载数据
    if (codesToUse.length === 0 && !hasSearchConditions) {
      setAllLeftData([]);
      return;
    }

    try {
      const searchParams = buildSearchParams();

      // 如果使用缓存且不强制刷新，先从缓存读取
      if (useCache && !forceRefresh) {
        const cachedData = getQuotationFromCache(codesToUse, searchParams);
        if (cachedData) {
          setAllLeftData(cachedData);
          return;
        }
      }

      // 缓存未命中或强制刷新，从API加载
      const result = await supplierQuotationApi.getAll({
        page: 1,
        limit: 10000, // 设置一个足够大的值以获取所有数据
        ...searchParams,
        supplierCodes: codesToUse.length > 0 ? codesToUse : undefined,
      });

      // 如果选择了供应商编码，验证返回的数据是否匹配选择的供应商编码
      let filteredData = result.data || [];
      if (codesToUse.length > 0) {
        filteredData = filteredData.filter(item =>
          item.供应商编码 && codesToUse.includes(item.供应商编码)
        );
      }

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

      // 加载供应商编码手动绑定sku表的SKU映射
      await loadSupplierBindingSkuMap(filteredData);
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

      // 检查是否有搜索条件
      const searchParams = buildSearchParams();
      const hasSearchConditions =
        searchParams.supplierName ||
        searchParams.supplierCode ||
        searchParams.productName ||
        searchParams.upcCode ||
        comparisonResultFilter.length > 0 ||
        inventorySkuSearch.trim();

      // 如果没有选择供应商编码且没有搜索条件，不加载数据
      if (codesToUse.length === 0 && !hasSearchConditions) {
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

      const result = await supplierQuotationApi.getAll({
        page: pageToUse,
        limit: pageSizeToUse,
        ...searchParams,
        supplierCodes: codesToUse.length > 0 ? codesToUse : undefined,
      });

      // 如果选择了供应商编码，验证返回的数据是否匹配选择的供应商编码
      let filteredData = result.data || [];
      if (codesToUse.length > 0) {
        filteredData = filteredData.filter(item =>
          item.供应商编码 && codesToUse.includes(item.供应商编码)
        );
      }

      // 如果选择了供应商编码且过滤后的数据数量不一致，记录警告并提示用户
      if (codesToUse.length > 0 && filteredData.length !== (result.data || []).length) {
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
          messageApi.error(`API返回了错误的供应商编码数据。选择的: ${codesToUse.join(', ')}, 返回的: ${unexpectedCodes.join(', ')}。数据已过滤。`);
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

      // 加载供应商编码手动绑定sku表的SKU映射
      await loadSupplierBindingSkuMap(filteredData);

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
      messageApi.error('加载供应商报价数据失败');
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

  // 加载供应商编码手动绑定sku表的SKU映射（用于SKU未匹配时的回退查询）
  const loadSupplierBindingSkuMap = async (quotationData: SupplierQuotation[]) => {
    if (!quotationData || quotationData.length === 0) {
      setSupplierBindingSkuMap({});
      return;
    }

    try {
      // 收集所有唯一的供应商编码和供应商商品编码组合
      const items = quotationData
        .filter(quotation => quotation.供应商编码 && quotation.供应商商品编码)
        .map(quotation => ({
          supplierCode: quotation.供应商编码!,
          supplierProductCode: quotation.供应商商品编码!,
        }));

      if (items.length === 0) {
        setSupplierBindingSkuMap({});
        return;
      }

      // 批量查询SKU绑定数据
      const bindingMap = await supplierQuotationApi.getSkuBindingsBatch({ items });
      setSupplierBindingSkuMap(bindingMap);
    } catch (error) {
      console.error('加载供应商编码手动绑定sku映射失败:', error);
      setSupplierBindingSkuMap({});
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
        messageApi.error('查询超时，数据量较大，请减少查询范围或稍后重试');
      } else {
        messageApi.error(`加载供应商名称失败: ${errorMsg}`);
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
    forceRefresh: boolean = false, // 是否强制刷新（跳过缓存）
    shouldMatchData: boolean = false // 是否需要执行完整的匹配逻辑（如果为false，只匹配当前页的SKU和供应商-门店关系）
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
      // 检查是否需要匹配数据
      // 只有在以下情况才需要匹配：
      // 1. shouldMatchData为true（点击了"刷新数据"按钮）
      // 2. comparisonResultFilter.length > 0（筛选对比结果）
      // 3. 如果筛选对比结果有值，需要先匹配所有数据才能筛选
      const needMatch = shouldMatchData || comparisonResultFilter.length > 0;

      // 检查是否有任何筛选条件
      // 筛选条件包括：搜索SKU、筛选对比结果、采购价类型、选择供应商名称字段、选择门店仓/名称、选择城市
      const hasAnyFilter =
        inventorySkuSearch.trim() !== '' ||
        comparisonResultFilter.length > 0 ||
        priceTypeFilter !== undefined ||
        supplierNameFields.length > 0 ||
        (inventoryType === '仓店' && storeNameToUse && storeNameToUse.trim() !== '') ||
        (inventoryType === '城市' && cityToUse && cityToUse.trim() !== '');

      // 即使不需要完整匹配且没有筛选条件，也需要加载库存汇总数据以匹配当前页的SKU和供应商-门店关系
      // 只有在没有任何供应商报价数据时才不加载
      if (!needMatch && !hasAnyFilter && (!quotationDataToUse || quotationDataToUse.length === 0)) {
        setRightAllData([]);
        setRightData([]);
        setRightTotal(0);
        setRightLoading(false);
        return;
      }

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

            messageApi.warning('获取SKU编码失败，将使用原有匹配方式');
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
      // 如果shouldMatchData为false，只匹配当前页的数据；如果为true，匹配所有数据
      let skuBindingMapLocal: Record<string, string> = {}; // key为"供应商编码_供应商商品编码"，value为绑定的SKU
      const quotationsForSkuBinding = shouldMatchData
        ? (quotationDataToUse || []) // 如果需要完整匹配，使用所有报价数据
        : leftData.slice(0, leftPageSize); // 如果不需要完整匹配，只使用当前页的数据

      if (quotationsForSkuBinding && quotationsForSkuBinding.length > 0) {
        try {
          // 收集所有唯一的供应商编码和供应商商品编码组合
          const quotationKeys = new Set<string>();
          quotationsForSkuBinding.forEach(quotation => {
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

      // 第三步：查询供应商-门店关系数据
      // 如果shouldMatchData为false，只匹配当前页的数据；如果为true，匹配所有数据
      // 从供应商报价数据中提取所有唯一的供应商编码
      let supplierStoreRelationMapLocal: Record<string, number | string> = {};
      const supplierCodesFromQuotations = new Set<string>();
      // 根据shouldMatchData决定使用哪些报价数据
      const quotationsForRelation = shouldMatchData
        ? (quotationDataToUse || []) // 如果需要完整匹配，使用所有报价数据
        : leftData.slice(0, leftPageSize); // 如果不需要完整匹配，只使用当前页的数据

      if (quotationsForRelation && quotationsForRelation.length > 0) {
        quotationsForRelation.forEach(quotation => {
          if (quotation.供应商编码) {
            supplierCodesFromQuotations.add(quotation.供应商编码);
          }
        });
      }
      // 如果从报价数据中提取到了供应商编码，使用这些编码；否则使用 codesToUse
      const supplierCodesToQuery = supplierCodesFromQuotations.size > 0
        ? Array.from(supplierCodesFromQuotations)
        : (codesToUse && codesToUse.length > 0 ? codesToUse : []);

      if (supplierCodesToQuery.length > 0) {
        try {
          // 从库存汇总数据和供应商报价数据中提取供应商编码和SKU的映射
          // 用于查询默认供货关系
          const skuSupplierMap: Array<{ supplierCode: string; sku: string }> = [];
          const skuSupplierSet = new Set<string>(); // 用于去重

          if (quotationsForRelation && quotationsForRelation.length > 0 && result && result.length > 0) {
            // 遍历库存汇总数据，找到匹配的供应商报价
            result.forEach(item => {
              if (!item.SKU) return;

              // 通过UPC找到匹配的供应商报价
              const matchedUpcCodes: string[] = [];
              Object.entries(upcToSkuMapLocal).forEach(([upc, skuCodes]) => {
                if (item.SKU && skuCodes.includes(item.SKU)) {
                  matchedUpcCodes.push(upc);
                }
              });

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

              // 找到匹配的供应商报价
              const matchedQuotations = quotationsForRelation.filter(quotation => {
                if (!quotation.最小销售规格UPC商品条码) return false;
                return matchedUpcCodes.includes(quotation.最小销售规格UPC商品条码);
              });

              matchedQuotations.forEach(quotation => {
                if (quotation.供应商编码) {
                  // 如果SKU是手动绑定的，就必须用手动绑定的SKU
                  const bindingKey = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
                  const boundSku = skuBindingMapLocal[bindingKey];
                  const originalSku = item.SKU;

                  // 如果SKU是手动绑定的，就必须用手动绑定的SKU
                  // 只有当绑定记录不存在时，才使用原始SKU
                  let skuToUse: string | null = null;
                  if (bindingKey in skuBindingMapLocal) {
                    // 存在绑定记录，必须使用绑定的SKU（即使为空）
                    const boundSkuValue = skuBindingMapLocal[bindingKey];
                    skuToUse = boundSkuValue !== undefined ? boundSkuValue : null;
                    if (boundSkuValue && boundSkuValue.trim() && boundSkuValue !== originalSku) {
                      console.log(`[供应商-门店关系] 使用绑定SKU - 供应商编码: ${quotation.供应商编码}, 原始SKU: ${originalSku}, 绑定SKU: ${boundSkuValue}`);
                    } else if (!boundSkuValue || !boundSkuValue.trim()) {
                      console.log(`[供应商-门店关系] 绑定SKU为空或无效 - 供应商编码: ${quotation.供应商编码}, 原始SKU: ${originalSku}, 绑定SKU: ${boundSkuValue || '(空)'}`);
                    }
                  } else {
                    // 不存在绑定记录，使用原始SKU
                    skuToUse = originalSku || null;
                  }

                  if (skuToUse && skuToUse.trim()) {
                    const key = `${quotation.供应商编码}_${skuToUse}`;
                    if (!skuSupplierSet.has(key)) {
                      skuSupplierSet.add(key);
                      skuSupplierMap.push({
                        supplierCode: quotation.供应商编码,
                        sku: skuToUse,
                      });
                    }
                  }
                }
              });
            });
          }

          // 仓店维度需要传递门店名称，城市维度需要传递城市名称
          const requestData: {
            supplierCodes: string[];
            type: '全部' | '仓店' | '城市';
            storeName?: string;
            city?: string;
            skuSupplierMap?: Array<{ supplierCode: string; sku: string }>;
          } = {
            supplierCodes: supplierCodesToQuery,
            type: inventoryType,
          };

          if (inventoryType === '仓店' && storeNameToUse) {
            requestData.storeName = storeNameToUse;
          }

          if (inventoryType === '城市' && cityToUse) {
            requestData.city = cityToUse;
          }

          if (skuSupplierMap.length > 0) {
            requestData.skuSupplierMap = skuSupplierMap;
            // 调试日志：记录SKU-供应商映射详情（前5条）
            const sampleMap = skuSupplierMap.slice(0, 5);
            console.log('[供应商-门店关系] SKU-供应商映射示例（前5条）:', sampleMap);
            console.log('[供应商-门店关系] SKU-供应商映射总数:', skuSupplierMap.length);
          }

          console.log('[供应商-门店关系] 开始查询，供应商编码数量:', supplierCodesToQuery.length, '维度:', inventoryType, '门店名称:', requestData.storeName || '无', '城市:', requestData.city || '无', 'SKU-供应商映射数量:', skuSupplierMap.length);
          supplierStoreRelationMapLocal = await supplierQuotationApi.getSupplierStoreRelations(requestData);
          console.log('[供应商-门店关系] 查询完成，返回数据:', supplierStoreRelationMapLocal);

          // 调试日志：检查返回数据中的skuStats
          Object.keys(supplierStoreRelationMapLocal).forEach(supplierCode => {
            const relationData = supplierStoreRelationMapLocal[supplierCode];
            if (typeof relationData === 'object' && relationData !== null && 'skuStats' in relationData) {
              console.log(`[供应商-门店关系] 供应商编码 ${supplierCode} 的skuStats:`, (relationData as any).skuStats);
            }
          });
          setSupplierStoreRelationMap(supplierStoreRelationMapLocal);
        } catch (error) {
          console.error('查询供应商-门店关系失败:', error);
          // 不抛出错误，避免影响主流程
        }
      } else {
        console.log('[供应商-门店关系] 没有供应商编码，跳过查询');
      }

      // 第四步：加载供应商商品供应信息备注数据（使用SKU）
      // 注意：这里先不加载，因为需要等到第五步计算对比结果后，才能知道每个供应商报价匹配到的SKU
      // 备注数据将在计算对比结果后，根据匹配到的SKU批量加载

      // 第五步：计算对比结果：为每个库存汇总项找到匹配的供应商报价项
      // 注意：报价比例数据不再在这里批量加载，而是在用户需要时按需加载（比如点击编辑报价比例时）
      // 这样可以避免在有大量数据时（如21265条）创建大量并发请求导致超时和性能问题
      // 计算对比结果时直接使用供应商报价数据中的"计算后供货价格"，这个价格已经在后端计算好了
      // 现在使用SKU编码进行匹配，并考虑SKU绑定
      // 如果shouldMatchData为false，只匹配当前页的数据；如果为true，匹配所有数据
      const quotationsForComparison = shouldMatchData
        ? (quotationDataToUse || []) // 如果需要完整匹配，使用所有报价数据
        : leftData.slice(0, leftPageSize); // 如果不需要完整匹配，只使用当前页的数据

      const dataWithComparison = result.map(item => {
        // 如果没有供应商报价数据，直接返回库存汇总数据（不显示对比结果）
        if (!quotationsForComparison || quotationsForComparison.length === 0) {
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
        let matchedQuotations = quotationsForComparison.filter(quotation => {
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

        // 如果没有匹配的供应商报价，设置对比结果为"无匹配数据"
        if (matchedQuotations.length === 0) {
          return {
            ...item,
            对比结果: '无匹配数据',
          };
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
            安差价加率: undefined,
          };
        }

        // 根据选择的采购价类型或默认逻辑选择对比价格
        let comparePrice: number | undefined;
        let compareFieldType: string | undefined;

        // 如果用户选择了采购价类型，直接使用选择的类型
        if (priceTypeFilter) {
          if (priceTypeFilter === '最低采购价') {
            comparePrice = item.最低采购价 !== undefined && item.最低采购价 !== null ? item.最低采购价 : undefined;
            compareFieldType = '最低采购价';
          } else if (priceTypeFilter === '最近采购价') {
            comparePrice = item.最近采购价 !== undefined && item.最近采购价 !== null ? item.最近采购价 : undefined;
            compareFieldType = '最近采购价';
          } else if (priceTypeFilter === '成本单价') {
            comparePrice = item.成本单价 !== undefined && item.成本单价 !== null ? item.成本单价 : undefined;
            compareFieldType = '成本单价';
          }
        } else {
          // 如果没有选择采购价类型，使用原来的逻辑
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

        // 供货价格 - 采购价，显示'价格优势'（供应商报价更便宜）
        const diff = supplierPrice - comparePrice;
        // 计算安差价加率：差价/最低采购价（最近采购价/成本单价），差价为负时该值也为负，需要换算成百分比
        const priceDiffRate = comparePrice !== undefined && comparePrice !== null && comparePrice !== 0
          ? diff / comparePrice
          : undefined;
        const resultItem = {
          ...item,
          对比结果: diff < 0 ? '价格优势' : diff > 0 ? '价格偏高' : '价格相同',
          对比字段类型: compareFieldType,
          差价: diff,
          安差价加率: priceDiffRate,
        };

        // 添加供应商-门店关系数据
        if (matchedQuotation.供应商编码 && supplierStoreRelationMapLocal[matchedQuotation.供应商编码] !== undefined) {
          const relationData = supplierStoreRelationMapLocal[matchedQuotation.供应商编码];
          // 如果返回的是对象，提取 relationValue；否则直接使用原值
          if (typeof relationData === 'object' && relationData !== null && 'relationValue' in relationData) {
            resultItem['供应商-门店关系'] = (relationData as any).relationValue;
            // 保存完整的数据结构，供后续显示使用
            (resultItem as any)['供应商-门店关系数据'] = relationData;
          } else {
            resultItem['供应商-门店关系'] = relationData;
          }
        }

        return resultItem;
      });

      // 检查是否仍然是最新请求
      if (currentRequestId !== loadRightDataRequestIdRef.current) {
        setRightLoading(false);
        return;
      }

      // 批量加载供应商商品供应信息备注数据（使用SKU）
      let supplierProductRemarksLocal: Record<string, string> = {};
      if (dataWithComparison.length > 0 && quotationDataToUse && quotationDataToUse.length > 0) {
        try {
          // 收集所有唯一的供应商编码和SKU组合（用于匹配备注）
          // SKU优先使用手动绑定的SKU，如果没有则使用库存汇总里匹配出来的SKU
          const remarkItemsMap = new Map<string, { supplierCode: string; sku: string }>();

          dataWithComparison.forEach(item => {
            // 找到匹配的供应商报价
            if (quotationDataToUse && item.SKU) {
              // 通过SKU找到匹配的供应商报价
              const matchedQuotation = quotationDataToUse.find(q => {
                if (!q.最小销售规格UPC商品条码 || !item.SKU) return false;
                const skuCodes = upcToSkuMapLocal[q.最小销售规格UPC商品条码] || [];
                return skuCodes.includes(item.SKU);
              });

              if (matchedQuotation && matchedQuotation.供应商编码) {
                // 获取SKU：优先使用手动绑定的SKU，如果没有则使用库存汇总里匹配出来的SKU
                const bindingKey = `${matchedQuotation.供应商编码}_${matchedQuotation.供应商商品编码}`;
                const boundSku = skuBindingMapLocal[bindingKey];
                const skuToUse = boundSku || item.SKU;

                if (skuToUse) {
                  const remarkKey = `${matchedQuotation.供应商编码}_${skuToUse}`;
                  if (!remarkItemsMap.has(remarkKey)) {
                    remarkItemsMap.set(remarkKey, {
                      supplierCode: matchedQuotation.供应商编码,
                      sku: skuToUse,
                    });
                  }
                }
              }
            }
          });

          if (remarkItemsMap.size > 0) {
            // 批量查询备注数据
            const remarkItems = Array.from(remarkItemsMap.values());
            const remarksResult = await supplierQuotationApi.getSupplierProductRemarks({
              items: remarkItems,
            });

            // 将结果映射回"供应商编码_SKU"格式
            if (remarksResult) {
              supplierProductRemarksLocal = remarksResult;
            }
          }
        } catch (error) {
          console.error('批量加载供应商商品供应信息备注失败:', error);
        }
      }
      // 更新状态
      setSupplierProductRemarks(supplierProductRemarksLocal);

      // 批量加载内部sku备注数据
      let internalSkuRemarksLocal: Record<string, string> = {};
      if (dataWithComparison.length > 0) {
        try {
          // 收集所有需要查询的SKU（包括手动绑定的SKU和库存汇总的SKU）
          // 一定要是数据行显示的SKU，如果显示的是手动绑定的SKU就用手动绑定的去匹配
          const skusToQuery = new Set<string>();

          dataWithComparison.forEach(item => {
            if (item.SKU) {
              // 如果有匹配的供应商报价，检查是否有手动绑定的SKU
              if (quotationDataToUse && quotationDataToUse.length > 0) {
                // 通过SKU找到匹配的供应商报价
                const matchedQuotation = quotationDataToUse.find(q => {
                  if (!q.最小销售规格UPC商品条码 || !item.SKU) return false;
                  const skuCodes = upcToSkuMapLocal[q.最小销售规格UPC商品条码] || [];
                  return skuCodes.includes(item.SKU);
                });

                if (matchedQuotation && matchedQuotation.供应商编码 && matchedQuotation.供应商商品编码) {
                  // 获取SKU：优先使用手动绑定的SKU，如果没有则使用库存汇总里匹配出来的SKU
                  const bindingKey = `${matchedQuotation.供应商编码}_${matchedQuotation.供应商商品编码}`;
                  const boundSku = skuBindingMapLocal[bindingKey];
                  const skuToUse = boundSku || item.SKU;
                  if (skuToUse) {
                    skusToQuery.add(skuToUse);
                  }
                } else {
                  // 如果没有匹配的供应商报价，直接使用库存汇总的SKU
                  skusToQuery.add(item.SKU);
                }
              } else {
                // 如果没有供应商报价数据，直接使用库存汇总的SKU
                skusToQuery.add(item.SKU);
              }
            }
          });

          if (skusToQuery.size > 0) {
            // 批量查询内部sku备注
            const skusArray = Array.from(skusToQuery);
            const internalRemarksResult = await supplierQuotationApi.getInternalSkuRemarks({
              skus: skusArray,
            });

            if (internalRemarksResult) {
              internalSkuRemarksLocal = internalRemarksResult;
            }
          }
        } catch (error) {
          console.error('批量加载内部sku备注失败:', error);
        }
      }

      setInternalSkuRemarks(internalSkuRemarksLocal);

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
      messageApi.error('加载库存汇总数据失败');
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
      // 并行加载SKU绑定数据、采购下单渠道和报价比例数据
      const [result, channel, ratioResult] = await Promise.all([
        supplierQuotationApi.getSkuBindings({
          supplierCode: targetRecord.供应商编码,
          supplierProductCode: targetRecord.供应商商品编码,
        }),
        supplierQuotationApi.getSupplierOrderChannel(targetRecord.供应商编码).catch(() => null),
        targetRecord.最小销售规格UPC商品条码
          ? supplierQuotationApi.getPriceRatios({
            supplierCode: targetRecord.供应商编码,
            upcCode: targetRecord.最小销售规格UPC商品条码,
          }).catch(() => null)
          : Promise.resolve(null),
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

        // 初始化报价比例编辑状态
        if (ratioResult) {
          setEditingRatios({
            [uniqueKey]: {
              supplierRatio: ratioResult.报价比例_供应商商品,
              qianniuhuaRatio: ratioResult.报价比例_牵牛花商品,
            },
          });
        } else {
          setEditingRatios({ [uniqueKey]: {} });
        }

        // 加载备注数据（使用SKU，优先使用手动绑定的SKU，如果没有则使用空字符串，因为这是新记录）
        try {
          // 对于新记录，SKU为空，不加载备注
          // 备注会在用户输入SKU后通过SKU来匹配
        } catch (error) {
          console.error('加载备注失败:', error);
        }
      } else {
        setBottomData(result);
        // 初始化编辑状态，使用稳定的唯一标识符作为key
        const initialEditing: Record<string, string> = {};
        const initialRatios: Record<string, { supplierRatio?: number; qianniuhuaRatio?: number }> = {};
        result.forEach((item) => {
          const uniqueKey = `${item.供应商编码}_${item.供应商商品编码}`;
          initialEditing[uniqueKey] = item.SKU || '';

          // 如果有报价比例数据，使用它；否则使用空对象
          if (ratioResult) {
            initialRatios[uniqueKey] = {
              supplierRatio: ratioResult.报价比例_供应商商品,
              qianniuhuaRatio: ratioResult.报价比例_牵牛花商品,
            };
          } else {
            initialRatios[uniqueKey] = {};
          }
        });
        setEditingSkus(initialEditing);
        setEditingRatios(initialRatios);

        // 加载备注数据（使用SKU）
        try {
          const remarkItems = result
            .filter(item => item.供应商编码 && item.SKU) // 只加载有SKU的记录
            .map(item => ({
              supplierCode: item.供应商编码!,
              sku: item.SKU!,
            }));

          if (remarkItems.length > 0) {
            const remarkResult = await supplierQuotationApi.getSupplierProductRemarks({
              items: remarkItems,
            });
            if (remarkResult) {
              // 将结果映射回uniqueKey格式（用于下栏容器显示）
              const remarksByUniqueKey: Record<string, string> = {};
              result.forEach(item => {
                if (item.供应商编码 && item.SKU) {
                  const uniqueKey = `${item.供应商编码}_${item.供应商商品编码}`;
                  const remarkKey = `${item.供应商编码}_${item.SKU}`;
                  if (remarkResult[remarkKey]) {
                    remarksByUniqueKey[remarkKey] = remarkResult[remarkKey];
                  }
                }
              });
              setSupplierProductRemarks({
                ...supplierProductRemarks,
                ...remarksByUniqueKey,
              });
            }
          }
        } catch (error) {
          console.error('加载备注失败:', error);
        }
      }
    } catch (error) {
      messageApi.error('加载SKU绑定数据失败');
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
      setEditingRatios({ [uniqueKey]: {} });
      setOrderChannel(null);
    } finally {
      setBottomLoading(false);
    }
  };

  // 加载商品信息数据（只查询选中供应商报价行匹配到的SKU）
  const loadProductInfoData = async () => {
    // 只查询选中供应商报价行匹配到的SKU
    if (!selectedLeftRecord || !selectedLeftRecord.最小销售规格UPC商品条码) {
      setProductInfoData([]);
      return;
    }

    // 检查是否有手动绑定的SKU
    let skusToQuery: string[] = [];
    const bindingKey = selectedLeftRecord.供应商编码 && selectedLeftRecord.供应商商品编码
      ? `${selectedLeftRecord.供应商编码}_${selectedLeftRecord.供应商商品编码}`
      : null;
    const boundSku = bindingKey ? skuBindingMap[bindingKey] : null;

    if (boundSku) {
      // 如果使用手动绑定的SKU，直接使用绑定的SKU去查询
      skusToQuery = [boundSku];
    } else {
      // 如果没有手动绑定的SKU，使用原来的逻辑：通过UPC条码获取对应的SKU编码列表
      const skuCodes = upcToSkuMap[selectedLeftRecord.最小销售规格UPC商品条码] || [];

      // 从rightAllData中找到匹配的库存汇总记录的SKU
      const matchedSkus = skuCodes.filter(sku => {
        return rightAllData.some(item => item.SKU === sku);
      });

      if (matchedSkus.length === 0) {
        setProductInfoData([]);
        return;
      }

      skusToQuery = matchedSkus;
    }

    setProductInfoLoading(true);
    try {
      // 对每个匹配的SKU查询商品供货关系，然后合并结果
      const allResults = await Promise.all(
        skusToQuery.map(async (sku) => {
          try {
            const result = await supplierQuotationApi.getProductSupplyRelations(sku);
            return result || [];
          } catch (error) {
            console.error(`[商品信息] SKU ${sku} 查询失败:`, error);
            return [];
          }
        })
      );

      // 合并所有结果
      const mergedResults = allResults.flat();

      // 按供应商编码去重（使用Map保留第一条记录）
      const supplierCodeMap = new Map<string, any>();
      mergedResults.forEach(item => {
        const supplierCode = item['供应商编码'];
        if (supplierCode && !supplierCodeMap.has(supplierCode)) {
          supplierCodeMap.set(supplierCode, item);
        }
      });

      const finalData = Array.from(supplierCodeMap.values());
      setProductInfoData(finalData);
    } catch (error) {
      messageApi.error('加载商品信息失败');
      console.error('[商品信息] 加载失败:', error);
      setProductInfoData([]);
    } finally {
      setProductInfoLoading(false);
    }
  };

  // 监听菜单切换和选中行变化，当切换到商品信息时加载数据
  useEffect(() => {
    if (otherInfoActiveMenu === 'product-info' && selectedLeftRecord && rightData.length > 0 && rightAllData.length > 0) {
      loadProductInfoData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherInfoActiveMenu, selectedLeftRecord, rightData, rightAllData, skuBindingMap, upcToSkuMap]);

  // 左栏行点击
  const handleLeftRowClick = (record: SupplierQuotation, event?: React.MouseEvent) => {
    // 检查是否是相同的记录
    const isSameRecord = selectedLeftRecord &&
      selectedLeftRecord.供应商编码 === record.供应商编码 &&
      selectedLeftRecord.供应商商品编码 === record.供应商商品编码;

    setSelectedLeftRecord(record);
    // 清空之前的采购下单渠道，等待新数据加载
    setOrderChannel(null);

    // 只有在选择不同记录时才重置为默认菜单，相同记录保持当前菜单状态
    if (!isSameRecord) {
      setOtherInfoActiveMenu('product-info');
    }

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

      // 1. 根据用户筛选的供应商编码实时获取供应商报价数据（不使用缓存）
      let allQuotations: SupplierQuotation[] = [];
      if (selectedSupplierCodes.length === 0) {
        message.warning('请先选择至少一个供应商编码');
        message.destroy('export');
        return;
      }

      // 实时查询供应商报价数据（不使用缓存）
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

      if (allQuotations.length === 0) {
        messageApi.warning('没有找到符合条件的供应商报价数据');
        message.destroy('export');
        return;
      }

      // 2. 根据仓店/城市维度实时获取库存汇总数据（不使用缓存）
      let storeNamesParam: string[] | undefined;
      if (inventoryType === '仓店' && storeNameFilter && storeNameFilter.trim()) {
        // 仓店维度：只导出选中的门店/仓名称的数据
        storeNamesParam = [storeNameFilter.trim()];
      } else if (inventoryType === '城市' && cityFilter && cityFilter.trim()) {
        // 城市维度：只导出选中的城市的数据
        storeNamesParam = [cityFilter.trim()];
      }
      // 全部维度：不需要过滤，导出所有数据

      // 实时获取库存汇总数据（根据维度筛选）
      const inventoryResult = await supplierQuotationApi.getInventorySummary({
        type: inventoryType,
        storeNames: storeNamesParam,
      });

      // 3. 实时获取UPC到SKU的映射（用于匹配）
      const upcCodes = allQuotations
        .map(q => q.最小销售规格UPC商品条码)
        .filter((upc): upc is string => !!upc && upc.trim() !== '');

      let upcToSkuMapForExport: Record<string, string[]> = {};
      if (upcCodes.length > 0) {
        upcToSkuMapForExport = await supplierQuotationApi.getSkuCodesByUpcCodes({
          upcCodes: [...new Set(upcCodes)], // 去重
        });
      }

      // 4. 加载SKU绑定数据（用于匹配时优先使用绑定的SKU）
      let skuBindingMapForExport: Record<string, string> = {}; // key为"供应商编码_供应商商品编码"，value为绑定的SKU
      try {
        // 收集所有唯一的供应商编码和供应商商品编码组合
        const quotationKeys = new Set<string>();
        allQuotations.forEach(quotation => {
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
              const bindingResult = await supplierQuotationApi.getSkuBindings({
                supplierCode: supplierCode,
                supplierProductCode: supplierProductCode,
              });
              if (bindingResult && bindingResult.length > 0 && bindingResult[0].SKU) {
                skuBindingMapForExport[key] = bindingResult[0].SKU;
              }
            } catch (error) {
              console.error(`导出时查询SKU绑定失败 [${key}]:`, error);
            }
          });
          await Promise.all(batchPromises);
        }
      } catch (error) {
        console.error('导出时批量加载SKU绑定数据失败:', error);
      }

      // 5. 创建对齐的数据结构（与 alignedData 相同的逻辑，优先使用绑定的SKU）
      const exportAlignedData = allQuotations.map((quotation) => {
        // 找到匹配的库存汇总（优先使用绑定的SKU，如果没有绑定SKU，则使用UPC到SKU的映射）
        let matchedInventory: InventorySummary | null = null;

        // 检查是否有绑定的SKU
        const bindingKey = quotation.供应商编码 && quotation.供应商商品编码
          ? `${quotation.供应商编码}_${quotation.供应商商品编码}`
          : null;
        const boundSku = bindingKey ? skuBindingMapForExport[bindingKey] : null;

        if (boundSku) {
          // 如果有绑定SKU，优先使用绑定SKU匹配库存汇总
          matchedInventory = inventoryResult.find(item => {
            if (!item.SKU || item.SKU !== boundSku) return false;

            // 根据维度应用筛选条件（与查询逻辑一致）
            // 仓店维度：需要匹配门店/仓名称（如果storeNamesParam有值）
            if (inventoryType === '仓店' && storeNamesParam && storeNamesParam.length > 0) {
              return item['门店/仓库名称'] === storeNamesParam[0];
            }

            // 城市维度：需要匹配城市（如果storeNamesParam有值，实际是城市名称）
            if (inventoryType === '城市' && storeNamesParam && storeNamesParam.length > 0) {
              return item.城市 === storeNamesParam[0];
            }

            // 全部维度：不需要额外筛选条件
            return true;
          }) || null;
        }

        // 如果没有绑定SKU或通过绑定SKU没有找到匹配，使用UPC到SKU的映射
        if (!matchedInventory && quotation.最小销售规格UPC商品条码) {
          // 通过UPC条码获取对应的SKU编码列表
          const skuCodes = upcToSkuMapForExport[quotation.最小销售规格UPC商品条码] || [];

          // 通过SKU编码匹配库存汇总
          if (skuCodes.length > 0) {
            matchedInventory = inventoryResult.find(item => {
              if (!item.SKU) return false;
              if (!skuCodes.includes(item.SKU)) return false;

              // 根据维度应用筛选条件（与查询逻辑一致）
              // 仓店维度：需要匹配门店/仓名称（如果storeNamesParam有值）
              if (inventoryType === '仓店' && storeNamesParam && storeNamesParam.length > 0) {
                return item['门店/仓库名称'] === storeNamesParam[0];
              }

              // 城市维度：需要匹配城市（如果storeNamesParam有值，实际是城市名称）
              if (inventoryType === '城市' && storeNamesParam && storeNamesParam.length > 0) {
                return item.城市 === storeNamesParam[0];
              }

              // 全部维度：不需要额外筛选条件
              return true;
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
              安差价加率: undefined,
            };
          } else {
            // 根据选择的采购价类型或默认逻辑选择对比价格
            let comparePrice: number | undefined;
            let compareFieldType: string | undefined;

            // 如果用户选择了采购价类型，直接使用选择的类型
            if (priceTypeFilter) {
              if (priceTypeFilter === '最低采购价') {
                comparePrice = matchedInventory.最低采购价 !== undefined && matchedInventory.最低采购价 !== null ? matchedInventory.最低采购价 : undefined;
                compareFieldType = '最低采购价';
              } else if (priceTypeFilter === '最近采购价') {
                comparePrice = matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null ? matchedInventory.最近采购价 : undefined;
                compareFieldType = '最近采购价';
              } else if (priceTypeFilter === '成本单价') {
                comparePrice = matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null ? matchedInventory.成本单价 : undefined;
                compareFieldType = '成本单价';
              }
            } else {
              // 如果没有选择采购价类型，使用原来的逻辑
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
            }

            // 如果所有采购价都为空，显示'无采购价信息'
            if (comparePrice === undefined || comparePrice === null) {
              matchedInventory = {
                ...matchedInventory,
                对比结果: '无采购价信息',
                对比字段类型: undefined,
                差价: undefined,
                安差价加率: undefined,
              };
            } else {
              // 供货价格 - 采购价，显示'价格优势'（供应商报价更便宜）
              const diff = supplierPrice - comparePrice;
              // 计算安差价加率：差价/最低采购价（最近采购价/成本单价），差价为负时该值也为负，需要换算成百分比
              const priceDiffRate = comparePrice !== undefined && comparePrice !== null && comparePrice !== 0
                ? diff / comparePrice
                : undefined;
              matchedInventory = {
                ...matchedInventory,
                对比结果: diff < 0 ? '价格优势' : diff > 0 ? '价格偏高' : '价格相同',
                对比字段类型: compareFieldType,
                差价: diff,
                安差价加率: priceDiffRate,
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
        messageApi.warning('没有找到符合条件的导出数据');
        message.destroy('export');
        return;
      }

      // 获取可见的列
      const leftColumns = getFilteredLeftColumns();
      const rightColumns = getFilteredRightColumns();

      // 需要排除的字段（导出时不包含这些字段）
      const excludedFields = ['最低采购价', '最近采购价', '成本单价', '差价', '总部零售价', '安差价加率'];

      // 构建表头：供应商报价字段 + 分隔列 + 库存汇总字段（排除指定字段）
      const headers: string[] = [];
      leftColumns.forEach(col => {
        headers.push(col.title as string);
      });
      // 添加分隔列
      headers.push('分隔列');
      rightColumns.forEach(col => {
        const key = col.dataIndex as string;
        // 排除指定字段
        if (!excludedFields.includes(key)) {
          headers.push(col.title as string);
        }
      });

      // 构建数据行
      const rows = filteredData.map(item => {
        const row: any[] = [];

        // 供应商报价字段
        leftColumns.forEach(col => {
          const key = col.dataIndex as string;
          let value = (item.quotation as any)[key];

          // 对于供货价格列，优先使用计算后供货价格，如果为NULL则使用原供货价格
          if (key === '供货价格') {
            const quotation = item.quotation as SupplierQuotation;
            value = quotation.计算后供货价格 !== undefined && quotation.计算后供货价格 !== null
              ? quotation.计算后供货价格
              : quotation.供货价格;
          }

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

        // 库存汇总字段（排除指定字段）
        rightColumns.forEach(col => {
          const key = col.dataIndex as string;

          // 排除指定字段
          if (excludedFields.includes(key)) {
            return;
          }

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
            if (key === '对比结果') {
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
      messageApi.success(`成功导出 ${filteredData.length} 条数据`);
    } catch (error: any) {
      message.destroy('export');
      console.error('导出失败:', error);
      message.error(`导出失败: ${error?.message || '未知错误'}`);
    }
  };

  // 保存下栏SKU绑定和报价比例
  const handleSaveSkuBindings = async () => {
    console.log('[保存下栏] ========== 开始执行handleSaveSkuBindings ==========');
    console.log('[保存下栏] selectedLeftRecord:', selectedLeftRecord);

    if (!selectedLeftRecord || !selectedLeftRecord.供应商编码 || !selectedLeftRecord.供应商商品编码) {
      console.log('[保存下栏] ❌ 验证失败：未选择左栏数据');
      messageApi.warning('请先选择供应商报价数据');
      return;
    }

    console.log('[保存下栏] ✅ 验证通过：已选择左栏数据');

    try {
      const uniqueKey = `${selectedLeftRecord.供应商编码}_${selectedLeftRecord.供应商商品编码}`;
      console.log('[保存下栏] uniqueKey:', uniqueKey);
      const promises: Promise<any>[] = [];

      // 保存SKU绑定（包括设置为空的情况）
      const skuEntries = Object.entries(editingSkus);
      console.log('[保存下栏] editingSkus:', editingSkus);
      console.log('[保存下栏] skuEntries数量:', skuEntries.length);

      const skuValues = skuEntries
        .map(([key, sku]) => {
          // key格式为: 供应商编码_供应商商品编码
          const skuValue = sku?.trim() || '';
          return { key, sku: skuValue, isEmpty: skuValue === '' };
        });
      console.log('[保存下栏] skuValues:', skuValues);

      // 处理SKU绑定：包括非空和空值（空值表示将SKU字段设置为NULL）
      // 需要获取UPC（从selectedLeftRecord获取）
      const upcCode = selectedLeftRecord.最小销售规格UPC商品条码 ? String(selectedLeftRecord.最小销售规格UPC商品条码).trim() : '';
      console.log('[保存下栏] upcCode:', upcCode);

      if (!upcCode) {
        console.log('[保存下栏] ❌ 验证失败：未找到UPC信息');
        messageApi.warning('未找到UPC信息，无法保存SKU绑定');
        return;
      }

      console.log('[保存下栏] ✅ UPC验证通过，开始处理SKU绑定');
      for (const { sku, isEmpty } of skuValues) {
        console.log('[保存下栏] 添加SKU绑定promise:', { sku, isEmpty, supplierCode: selectedLeftRecord.供应商编码, upcCode });
        // SKU为空或非空都调用updateSkuBinding，后端会处理（空值会将SKU字段设置为NULL，不删除记录）
        promises.push(
          supplierQuotationApi.updateSkuBinding({
            supplierCode: selectedLeftRecord.供应商编码!,
            upcCode: upcCode,
            sku: isEmpty ? '' : sku, // 空字符串表示将SKU字段设置为NULL
          })
        );
      }

      // 保存报价比例（如果有UPC条码）
      if (selectedLeftRecord.最小销售规格UPC商品条码) {
        console.log('[保存下栏] 检查报价比例，editingRatios:', editingRatios);
        const ratio = editingRatios[uniqueKey];
        console.log('[保存下栏] ratio for uniqueKey:', ratio);
        // 如果editingRatios中存在这个key，说明用户进行了编辑（包括设置为空）
        if (ratio !== undefined) {
          const supplierRatio = ratio.supplierRatio;
          const qianniuhuaRatio = ratio.qianniuhuaRatio;
          console.log('[保存下栏] 报价比例值:', { supplierRatio, qianniuhuaRatio });

          // 如果两个比例都为空，清空报价比例
          if ((supplierRatio === undefined || supplierRatio === null) &&
            (qianniuhuaRatio === undefined || qianniuhuaRatio === null)) {
            console.log('[保存下栏] 添加清空报价比例promise');
            promises.push(
              supplierQuotationApi.clearPriceRatios({
                supplierCode: selectedLeftRecord.供应商编码!,
                upcCode: selectedLeftRecord.最小销售规格UPC商品条码,
              })
            );
          } else {
            // 验证：至少有一边为1
            if ((supplierRatio !== 1 && qianniuhuaRatio !== 1) ||
              (supplierRatio === undefined && qianniuhuaRatio === undefined) ||
              (supplierRatio === undefined && qianniuhuaRatio !== 1) ||
              (qianniuhuaRatio === undefined && supplierRatio !== 1)) {
              console.log('[保存下栏] ❌ 验证失败：至少一边为1');
              messageApi.error('至少一边为1');
              return;
            }
            console.log('[保存下栏] 添加更新报价比例promise');
            promises.push(
              supplierQuotationApi.updatePriceRatios({
                supplierCode: selectedLeftRecord.供应商编码!,
                upcCode: selectedLeftRecord.最小销售规格UPC商品条码,
                supplierRatio: supplierRatio || 1,
                qianniuhuaRatio: qianniuhuaRatio || 1,
              })
            );
          }
        }
      }

      console.log('[保存下栏] promises数组长度:', promises.length);
      console.log('[保存下栏] skuEntries长度:', skuEntries.length);
      console.log('[保存下栏] 最小销售规格UPC商品条码:', selectedLeftRecord.最小销售规格UPC商品条码);

      // 如果没有需要保存的数据，但可能有删除操作（SKU设置为空或报价比例设置为空）
      // 这种情况下也需要刷新数据
      if (promises.length === 0 && skuEntries.length === 0 && !selectedLeftRecord.最小销售规格UPC商品条码) {
        console.log('[保存下栏] ❌ 验证失败：没有需要保存的数据');
        messageApi.warning('没有需要保存的数据');
        return;
      }

      console.log('[保存下栏] ✅ 所有验证通过，开始执行Promise.all');
      console.log('[保存下栏] 准备执行的promises:', promises.length);
      await Promise.all(promises);
      console.log('[保存下栏] ✅ Promise.all执行完成');
      console.log('[保存下栏] 准备显示成功提示');
      messageApi.success('保存成功');
      console.log('[保存下栏] ✅ 成功提示已显示');

      // 清除相关供应商编码的缓存，因为报价比例会影响计算后供货价格
      if (selectedLeftRecord.供应商编码) {
        console.log('[保存下栏] 清除缓存，供应商编码:', selectedLeftRecord.供应商编码);
        clearCacheForSupplierCodes([selectedLeftRecord.供应商编码]);
      }

      // 重新加载数据以更新计算后供货价格
      // 先强制刷新加载所有数据
      console.log('[保存下栏] 开始重新加载数据');
      await loadAllLeftData([selectedLeftRecord.供应商编码], true, true);
      console.log('[保存下栏] ✅ loadAllLeftData完成');
      // 等待状态更新，然后重新加载当前页数据
      await loadLeftData();
      console.log('[保存下栏] ✅ loadLeftData完成');
      // 获取刷新后的数据
      const refreshedDataSource = allLeftData.length > 0 ? allLeftData : leftData;
      if (rightAllData.length > 0 && refreshedDataSource.length > 0) {
        await loadQuotationBindingFlags(rightAllData, refreshedDataSource);
        console.log('[保存下栏] ✅ loadQuotationBindingFlags完成');
        // 如果库存汇总数据存在，也需要刷新（因为对比结果可能受影响，强制刷新，跳过缓存）
        if (selectedSupplierCodes.length > 0 && refreshedDataSource.length > 0) {
          await loadRightData(refreshedDataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
          console.log('[保存下栏] ✅ loadRightData完成');
        }
      }

      // 重新加载下栏数据
      console.log('[保存下栏] 开始重新加载下栏数据');
      loadBottomData();
      console.log('[保存下栏] ========== 所有操作完成 ==========');
    } catch (error) {
      console.error('[保存下栏] ❌ 发生错误:', error);
      messageApi.error('保存失败');
      console.error(error);
    }
  };

  // 使用 ref 标记是否已经初始加载
  const hasInitialLoadRef = useRef(false);

  // 初始化加载供应商编码列表
  useEffect(() => {
    const initLoad = async () => {
      await loadAllSupplierCodes();
      // 如果恢复了状态且selectedSupplierCodes不为空，自动执行查询
      if (restoredState && restoredState.selectedSupplierCodes && restoredState.selectedSupplierCodes.length > 0) {
        // 延迟执行，确保loadAllSupplierCodes完成后再执行查询
        setTimeout(() => {
          isLoadingManuallyRef.current = true;
          // 使用restoredState中的值，确保使用恢复的状态
          loadLeftData(
            restoredState.selectedSupplierCodes,
            restoredState.storeNameFilter,
            restoredState.cityFilter,
            restoredState.leftCurrentPage,
            restoredState.leftPageSize
          );
          // 重置标志，允许后续的自动加载
          setTimeout(() => {
            isLoadingManuallyRef.current = false;
          }, 500);
        }, 300);
      }
    };
    initLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // 减去分页器高度（约64px）、padding（32px）和滚动条高度（约12px）
        const calculatedHeight = containerHeight - 96 - 12;
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
          // 减去分页器高度（约64px）、padding（32px）和滚动条高度（约12px）
          const calculatedHeight = containerHeight - 96 - 12;
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
        const quotationUpc = String(quotation.最小销售规格UPC商品条码).trim();

        // 1. 通过UPC条码获取对应的SKU编码列表
        let skuCodes = upcToSkuMap[quotationUpc] || [];

        // 2. 如果SKU列没有匹配到数据，检查供应商编码手动绑定sku表
        if (skuCodes.length === 0 && quotation.供应商编码 && quotation.供应商商品编码) {
          const bindingKey = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
          const bindingSku = supplierBindingSkuMap[bindingKey];
          if (bindingSku) {
            // 如果找到绑定的SKU，使用该SKU
            skuCodes = [bindingSku];
          }
        }

        // 3. 通过SKU编码匹配库存汇总
        if (skuCodes.length > 0) {
          const foundItem = rightAllData.find(item => {
            if (!item.SKU) return false;
            return skuCodes.includes(item.SKU);
          });
          if (foundItem) {
            // 创建新对象，保留所有字段（包括供应商-门店关系）
            matchedInventory = { ...foundItem };
          } else {
            matchedInventory = null;
          }
        }

        // 4. 如果通过SKU编码没有匹配到，尝试通过UPC直接匹配库存汇总数据
        // 这样可以处理UPC无法在upcToSkuMap中找到对应SKU的情况
        // 注意：即使UPC无法在upcToSkuMap中找到对应SKU，也应该尝试通过UPC直接匹配库存汇总数据
        // 这样可以在表格中显示库存汇总数据，并在SKU列显示"绑定SKU"按钮
        if (!matchedInventory && rightAllData.length > 0) {
          const foundItem = rightAllData.find(item => {
            if (!item.UPC) return false;
            const itemUpc = String(item.UPC).trim();
            // 处理UPC字段可能包含多个值（用逗号分隔）的情况
            const itemUpcArray = itemUpc.split(',').map(u => u.trim()).filter(u => u !== '');
            return itemUpcArray.includes(quotationUpc);
          });
          if (foundItem) {
            // 创建新对象，保留所有字段（包括供应商-门店关系）
            matchedInventory = { ...foundItem };
            // 如果通过UPC匹配到了库存汇总数据，但UPC无法在upcToSkuMap中找到对应SKU
            // 设置对比结果为"无匹配数据"，这样可以在对比结果列显示"绑定SKU"按钮
            if (skuCodes.length === 0) {
              matchedInventory = {
                ...matchedInventory,
                对比结果: '无匹配数据',
              };
            }
          } else {
            matchedInventory = null;
          }
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
          // 根据选择的采购价类型或默认逻辑选择对比价格
          let comparePrice: number | undefined;
          let compareFieldType: string | undefined;

          // 如果用户选择了采购价类型，直接使用选择的类型
          if (priceTypeFilter) {
            if (priceTypeFilter === '最低采购价') {
              comparePrice = matchedInventory.最低采购价 !== undefined && matchedInventory.最低采购价 !== null ? matchedInventory.最低采购价 : undefined;
              compareFieldType = '最低采购价';
            } else if (priceTypeFilter === '最近采购价') {
              comparePrice = matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null ? matchedInventory.最近采购价 : undefined;
              compareFieldType = '最近采购价';
            } else if (priceTypeFilter === '成本单价') {
              comparePrice = matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null ? matchedInventory.成本单价 : undefined;
              compareFieldType = '成本单价';
            }
          } else {
            // 如果没有选择采购价类型，使用原来的逻辑
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
            // 供货价格 - 采购价，显示'价格优势'（供应商报价更便宜）
            const diff = supplierPrice - comparePrice;
            // 计算安差价加率：差价/最低采购价（最近采购价/成本单价），差价为负时该值也为负，需要换算成百分比
            const priceDiffRate = comparePrice !== undefined && comparePrice !== null && comparePrice !== 0
              ? diff / comparePrice
              : undefined;
            matchedInventory = {
              ...matchedInventory,
              对比结果: diff < 0 ? '价格优势' : diff > 0 ? '价格偏高' : '价格相同',
              对比字段类型: compareFieldType,
              差价: diff,
              安差价加率: priceDiffRate,
            };
          }
        }

        // 添加供应商-门店关系数据
        if (quotation.供应商编码 && supplierStoreRelationMap[quotation.供应商编码] !== undefined) {
          const relationData = supplierStoreRelationMap[quotation.供应商编码];
          // 如果返回的是对象，提取 relationValue；否则直接使用原值
          if (typeof relationData === 'object' && relationData !== null && 'relationValue' in relationData) {
            matchedInventory = {
              ...matchedInventory,
              '供应商-门店关系': (relationData as any).relationValue,
            } as any;
            (matchedInventory as any)['供应商-门店关系数据'] = relationData;
          } else {
            matchedInventory = {
              ...matchedInventory,
              '供应商-门店关系': relationData,
            };
          }
        }
      }

      return {
        quotation,
        inventory: matchedInventory,
      };
    });
  }, [dataForAlignment, rightAllData, inventoryType, upcToSkuMap, supplierBindingSkuMap, ratioData, priceTypeFilter, supplierStoreRelationMap]);

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
        const quotation = item.quotation;

        // 检查是否有手动绑定的SKU
        let bindingSku: string | undefined;
        if (quotation?.供应商编码 && quotation?.供应商商品编码) {
          const bindingKey = `${quotation.供应商编码}_${quotation.供应商商品编码}`;
          bindingSku = supplierBindingSkuMap[bindingKey];
        }

        // 如果存在手动绑定的SKU，使用绑定的SKU进行匹配
        if (bindingSku && bindingSku.trim()) {
          const bindingSkuLower = String(bindingSku).trim().toLowerCase();
          const matches = bindingSkuLower.includes(searchSku);
          return matches;
        }

        // 如果没有匹配的库存汇总数据，在SKU搜索时应该排除（排除没匹配上的供应商报价）
        if (!inventory || Object.keys(inventory).length === 0 || !inventory.SKU) {
          // 但是如果搜索的SKU与matchedSkuSearch匹配，说明这是通过搜索手动绑定SKU找到的数据，应该保留
          if (matchedSkuSearch && matchedSkuSearch.trim()) {
            const matchedSkuLower = String(matchedSkuSearch).trim().toLowerCase();
            const matches = matchedSkuLower.includes(searchSku);
            return matches;
          }
          return false;
        }

        // SKU LIKE匹配（不区分大小写）：SKU包含搜索值
        const sku = String(inventory.SKU).toLowerCase();
        const matches = sku.includes(searchSku);
        return matches;
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
  }, [alignedData, comparisonResultFilter, inventorySkuSearch, matchedSkuSearch, supplierBindingSkuMap]);

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
    // 但是，未匹配的库存汇总数据（SKU为空）需要显示，以便用户可以绑定SKU
    // 如果有筛选条件（SKU搜索或对比结果筛选），allQuotationData 已经基于 filteredAlignedData（完整筛选后的数据）
    // 需要基于 allQuotationData 进行分页
    // 如果没有筛选条件，allQuotationData 基于 alignedData（当前页数据），不需要再次分页

    // 添加未匹配的库存汇总数据（SKU为空的数据）
    // 这些数据需要显示，以便用户可以绑定SKU
    const unmatchedInventoryData: Array<{
      key: string;
      dataType: 'inventory';
      quotation?: undefined;
      inventory: InventorySummary;
      hasMatch: false;
    }> = [];

    // 从rightAllData中找出未匹配的库存汇总数据（SKU为空或"-"的数据）

    let skuEmptyCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    rightAllData.forEach((item, index) => {
      // 检查SKU是否为空
      const skuValue = item.SKU;
      // 更严格的判断：null、undefined、空字符串、只包含空格、"-"
      const skuStr = skuValue === null || skuValue === undefined ? '' : String(skuValue);
      const isSkuEmpty = skuStr === '' || skuStr.trim() === '' || skuStr === '-';

      // 如果SKU为空，且该数据没有在alignedData中匹配到供应商报价，则添加到未匹配列表
      if (isSkuEmpty) {
        skuEmptyCount++;

        // 检查是否已经在alignedData中匹配到
        const isMatched = currentAlignedData.some(alignedItem => {
          if (!alignedItem.inventory || Object.keys(alignedItem.inventory).length === 0) return false;
          // 通过UPC匹配（因为SKU为空，只能通过UPC匹配）
          if (item.UPC && alignedItem.inventory.UPC) {
            const itemUpc = String(item.UPC).trim();
            const alignedUpc = String(alignedItem.inventory.UPC).trim();
            return itemUpc === alignedUpc;
          }
          return false;
        });

        if (isMatched) {
          matchedCount++;
        } else {
          unmatchedCount++;
          // 如果没有匹配到，添加到未匹配列表
          unmatchedInventoryData.push({
            key: `inventory-unmatched-${index}-${item.UPC || ''}`,
            dataType: 'inventory' as const,
            inventory: item,
            hasMatch: false,
          });
        }
      }
    });

    // 合并所有数据：供应商报价数据 + 未匹配的库存汇总数据
    const allMergedData = [...allQuotationData, ...unmatchedInventoryData];

    if (hasFilter) {
      // 如果有筛选条件，需要基于完整筛选后的数据进行分页
      const start = (leftCurrentPage - 1) * leftPageSize;
      const end = start + leftPageSize;
      return allMergedData.slice(start, end);
    }

    // 如果没有筛选条件，allMergedData 已经是当前页数据，直接返回
    return allMergedData;
  }, [filteredAlignedData, alignedData, comparisonResultFilter.length, inventorySkuSearch, leftCurrentPage, leftPageSize, rightAllData]);

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
          // 特殊处理：如果只有供应商报价数据，没有匹配到库存汇总数据，需要创建一个空的inventory对象以便SKU列可以显示输入框
          if (!record.inventory && record.quotation && record.dataType === 'quotation') {
            // 为未匹配的供应商报价数据创建一个空的inventory对象，包含UPC信息
            record.inventory = {
              UPC: record.quotation.最小销售规格UPC商品条码 || '',
              SKU: '-', // SKU为空，应该显示输入框
            } as InventorySummary;
          }

          if (record.inventory) {
            const value = (record.inventory as any)[col.dataIndex as string];

            // 特殊处理"供应商-门店关系"列
            if (col.key === '供应商-门店关系') {
              if (value === undefined || value === null) return '-';

              // 获取供应商编码（从 quotation 中）
              const supplierCode = record.quotation?.供应商编码;
              if (!supplierCode) return String(value);

              // 获取完整的关系数据（包含默认供货关系统计）
              const relationData = (record.inventory as any)?.['供应商-门店关系数据'];

              // 获取SKU：如果存在手动绑定的SKU，必须使用绑定的SKU
              const originalSku = (record.inventory as InventorySummary)?.SKU;
              let sku = originalSku;
              let skuToDisplay = originalSku; // 用于显示的SKU
              let hasBinding = false;
              if (record.quotation?.供应商编码 && record.quotation?.供应商商品编码) {
                const bindingKey = `${record.quotation.供应商编码}_${record.quotation.供应商商品编码}`;
                const boundSku = supplierBindingSkuMap[bindingKey];
                console.log(`[供应商-门店关系显示] 供应商编码: ${supplierCode}, bindingKey: ${bindingKey}, 原始SKU: ${originalSku}, 绑定SKU: ${boundSku || '无'}, supplierBindingSkuMap keys:`, Object.keys(supplierBindingSkuMap).slice(0, 5));
                // 如果存在绑定记录（即使值为空），必须使用绑定的SKU
                if (bindingKey in supplierBindingSkuMap) {
                  hasBinding = true;
                  if (boundSku && boundSku.trim()) {
                    sku = boundSku; // 使用绑定SKU查找统计数据
                    skuToDisplay = boundSku; // 显示时也使用绑定SKU
                    console.log(`[供应商-门店关系显示] 使用绑定SKU: ${boundSku} 查找统计数据`);
                  } else {
                    // 绑定SKU为空，使用空字符串
                    sku = '';
                    skuToDisplay = '';
                    console.log(`[供应商-门店关系显示] 绑定SKU为空: ${boundSku || '(空)'}`);
                  }
                }
              }

              // 调试日志：检查relationData和skuStoreCount
              console.log(`[供应商-门店关系显示] 供应商编码: ${supplierCode}, SKU: ${sku}, hasBinding: ${hasBinding}, relationData存在:`, !!relationData);
              if (relationData) {
                const relationDataAny = relationData as any;
                console.log(`[供应商-门店关系显示] relationData.skuStoreCount存在:`, !!relationDataAny.skuStoreCount);
                if (relationDataAny.skuStoreCount && sku) {
                  console.log(`[供应商-门店关系显示] skuStoreCount keys:`, Object.keys(relationDataAny.skuStoreCount));
                  console.log(`[供应商-门店关系显示] 查找SKU ${sku} 的统计数据:`, relationDataAny.skuStoreCount[sku]);
                }
              }

              // 定义特殊颜色
              const highlightColor = '#FF6A00';

              // 根据维度显示不同的文本格式，特殊字段使用高亮颜色
              if (inventoryType === '全部') {
                // 如果存在手动绑定的SKU，使用绑定SKU去skuStoreCount中查找数据
                let displayValue = value;
                if (hasBinding && relationData) {
                  const relationDataAny = relationData as any;
                  if (sku && relationDataAny?.skuStoreCount && relationDataAny.skuStoreCount[sku] !== undefined) {
                    displayValue = relationDataAny.skuStoreCount[sku];
                    console.log(`[供应商-门店关系显示] 使用绑定SKU ${sku} 的门店数量: ${displayValue}`);
                  } else {
                    // 绑定SKU在商品供货关系表中查不到数据，显示0
                    displayValue = 0;
                    console.log(`[供应商-门店关系显示] 绑定SKU ${sku} 在商品供货关系表中查不到数据，显示0`);
                  }
                }

                // 直接显示数量
                return (
                  <span>{displayValue}</span>
                );
              } else if (inventoryType === '城市') {
                // 获取城市信息（从 inventory 中）
                const city = (record.inventory as InventorySummary)?.城市 || '';

                // 如果存在手动绑定的SKU，使用绑定SKU去skuStoreCount中查找数据
                let displayValue = value;
                if (hasBinding && relationData) {
                  const relationDataAny = relationData as any;
                  if (sku && relationDataAny?.skuStoreCount && relationDataAny.skuStoreCount[sku] !== undefined) {
                    displayValue = relationDataAny.skuStoreCount[sku];
                    console.log(`[供应商-门店关系显示] 城市维度 - 使用绑定SKU ${sku} 的门店数量: ${displayValue}`);
                  } else {
                    // 绑定SKU在商品供货关系表中查不到数据，显示0
                    displayValue = 0;
                    console.log(`[供应商-门店关系显示] 城市维度 - 绑定SKU ${sku} 在商品供货关系表中查不到数据，显示0`);
                  }
                }

                // 直接显示数量
                return (
                  <span>{displayValue}</span>
                );
              } else if (inventoryType === '仓店') {
                // 获取门店/仓库名称（从 inventory 中）
                const storeName = (record.inventory as InventorySummary)?.['门店/仓库名称'] || '';

                // 获取供应商编码在该门店的默认关系（从relationValue获取，可能是"是"/"否"字符串）
                const relationDataAny = relationData as any;
                // const supplierRelationValue = relationDataAny?.relationValue;
                // const isSupplierDefault = supplierRelationValue === '是' || supplierRelationValue === true;

                // 如果有SKU和状态数据，显示详细信息（使用绑定SKU查找，如果找不到则尝试原始SKU）
                let storeStatus = null;
                if (sku && relationDataAny?.skuStoreStatus?.[sku] !== undefined) {
                  storeStatus = relationDataAny.skuStoreStatus[sku];
                } else if (originalSku && originalSku !== sku && relationDataAny?.skuStoreStatus?.[originalSku] !== undefined) {
                  // 如果绑定SKU找不到，尝试使用原始SKU
                  storeStatus = relationDataAny.skuStoreStatus[originalSku];
                  skuToDisplay = originalSku;
                }

                // 直接显示"是"或"不是"
                // 匹配逻辑：如果匹配到数据（hasRecord为true），显示"是"，否则显示"不是"
                let displayText = '不是';
                if (storeStatus !== null && storeStatus.hasRecord) {
                  displayText = '是';
                }

                return (
                  <span>{displayText}</span>
                );
              }
              return String(value);
            }

            // 对于SKU列，确保即使value为空也能正确传递给render函数
            // 如果value为null/undefined/空字符串，传递"-"给render函数，这样render函数能正确判断isSkuEmpty
            const valueToRender = col.key === 'SKU' ? (value === null || value === undefined || value === '' ? '-' : value) : value;

            // 调试日志：检查SKU列的值
            if (col.key === 'SKU') {
              console.log(`[响应式表格-SKU列] 行索引: 0, 原始value:`, value, 'valueToRender:', valueToRender, 'record:', record);
            }
            // 对于对比结果列，确保即使value为空也能正确传递给render函数（可能是undefined）
            const valueToRenderForComparison = col.key === '对比结果' ? (value ?? '无匹配数据') : valueToRender;

            // 调试日志：检查SKU列的render函数调用
            if (col.key === 'SKU') {
              console.log(`[getMergedColumns-SKU列] 准备调用render函数, valueToRenderForComparison:`, valueToRenderForComparison, 'record.inventory:', record.inventory, 'col.render存在:', !!col.render);
            }

            const renderedValue = col.render ? col.render(valueToRenderForComparison, record.inventory, 0) : (value ?? '-');

            // 调试日志：检查SKU列的render函数返回值
            if (col.key === 'SKU') {
              console.log(`[getMergedColumns-SKU列] render函数返回值:`, renderedValue, '类型:', typeof renderedValue, '是否为React元素:', renderedValue && typeof renderedValue === 'object' && 'type' in renderedValue);
            }
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
    <React.Fragment>
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
          
          /* 确保横向滚动条始终显示在容器底部 */
          #merged-table-scroll-container {
            overflow-x: scroll !important;
            overflow-y: hidden !important;
            /* 确保滚动条始终可见，即使内容未超出 */
            scrollbar-gutter: stable;
            /* 强制显示滚动条（IE/Edge） */
            -ms-overflow-style: scrollbar;
            /* 确保滚动条区域可见 */
            padding-bottom: 0 !important;
          }
          
          /* 为滚动条预留空间，确保滚动条在容器内且始终显示 */
          #merged-table-scroll-container::-webkit-scrollbar {
            height: 12px !important;
            width: 12px !important;
            background-color: #f5f5f5 !important;
            display: block !important;
            -webkit-appearance: none !important;
            appearance: none !important;
            /* 确保滚动条在容器底部 */
            position: relative;
          }
          
          #merged-table-scroll-container::-webkit-scrollbar-track {
            background-color: #f5f5f5 !important;
            border-radius: 0;
            display: block !important;
            -webkit-appearance: none !important;
            appearance: none !important;
            /* 确保轨道在容器底部 */
            margin-top: auto;
            width: 100% !important;
          }
          
          #merged-table-scroll-container::-webkit-scrollbar-thumb {
            background-color: #888 !important;
            border-radius: 6px !important;
            min-height: 12px !important;
            min-width: 40px !important;
            display: block !important;
            -webkit-appearance: none !important;
            appearance: none !important;
            /* 确保滑块始终可见，即使内容未超出容器 */
            opacity: 1 !important;
            visibility: visible !important;
            width: auto !important;
            height: 12px !important;
            /* 确保滑块有足够的对比度 */
            border: 1px solid #666 !important;
          }
          
          #merged-table-scroll-container::-webkit-scrollbar-thumb:hover {
            background-color: #555 !important;
            border-color: #444 !important;
          }
          
          #merged-table-scroll-container::-webkit-scrollbar-thumb:active {
            background-color: #333 !important;
          }
          
          /* 确保滚动条在内容未超出时也显示 */
          #merged-table-scroll-container::-webkit-scrollbar:horizontal {
            display: block !important;
            height: 12px !important;
          }
          
          /* Firefox滚动条样式 - 始终显示 */
          #merged-table-scroll-container {
            scrollbar-width: thin;
            scrollbar-color: #888 #f5f5f5;
          }
          
          /* 确保表格内容可以横向滚动 */
          #merged-table-scroll-container .ant-table-wrapper {
            width: 100%;
            min-width: 100%;
            max-width: 100%;
            overflow: visible;
          }
          
          #merged-table-scroll-container .ant-table {
            min-width: 100%;
          }
          
          /* 确保表格内容可以横向滚动，但不影响外层容器的滚动条 */
          #merged-table-scroll-container .ant-table-body {
            overflow-x: visible !important;
            overflow-y: auto !important;
          }
          
          /* 确保表格内容区域可以超出容器宽度，触发横向滚动 */
          #merged-table-scroll-container .ant-table-content {
            overflow-x: visible !important;
          }
          
          /* 确保滚动条区域在容器底部，不超出容器范围 */
          #merged-table-scroll-container .ant-table-body-outer {
            padding-bottom: 0 !important;
          }
          
          /* 确保表格容器高度计算时考虑滚动条 */
          #merged-table-scroll-container .ant-table {
            margin-bottom: 0 !important;
          }
        `
      }} />
      <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
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
                        messageApi.warning('只能选择下拉框中的供应商编码');
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
                    styles={{ popup: { root: { maxHeight: 300, overflow: 'auto' } } }}
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
                      // 标记用户已点击过搜索按钮
                      hasClickedSearchRef.current = true;
                      setLeftCurrentPage(1);
                      setRightCurrentPage(1);

                      // 如果有对比结果筛选，需要先匹配所有数据
                      if (comparisonResultFilter.length > 0) {
                        // 设置需要匹配数据
                        setShouldMatchData(true);
                      }

                      // 如果有对比结果筛选或SKU搜索，需要加载所有供应商报价数据和所有库存汇总数据用于筛选
                      if (comparisonResultFilter.length > 0 || inventorySkuSearch.trim()) {
                        // 设置加载状态
                        setLeftLoading(true);
                        setRightLoading(true);

                        try {
                          // 先直接获取所有供应商报价数据（包含搜索条件），支持缓存
                          const searchParams = buildSearchParams();
                          let allQuotationData: SupplierQuotation[] = [];

                          // 如果选择了供应商编码，使用选择的编码；否则搜索全部数据
                          const codesToUse = selectedSupplierCodes.length > 0 ? selectedSupplierCodes : undefined;

                          if (codesToUse && codesToUse.length > 0) {
                            // 尝试从缓存读取
                            const cachedData = getQuotationFromCache(codesToUse, searchParams);
                            if (cachedData) {
                              allQuotationData = cachedData;
                              setAllLeftData(cachedData);
                            } else {
                              // 缓存未命中，从API加载
                              const allQuotationResult = await supplierQuotationApi.getAll({
                                page: 1,
                                limit: 10000,
                                ...searchParams,
                                supplierCodes: codesToUse,
                              });
                              allQuotationData = (allQuotationResult.data || []).filter(item =>
                                item.供应商编码 && codesToUse.includes(item.供应商编码)
                              );
                              // 保存到缓存
                              setQuotationCache(codesToUse, searchParams, allQuotationData);
                              // 更新 allLeftData 状态（先设置，确保 dataForAlignment 能使用）
                              setAllLeftData(allQuotationData);
                            }
                          } else {
                            // 没有选择供应商编码，搜索全部数据
                            const allQuotationResult = await supplierQuotationApi.getAll({
                              page: 1,
                              limit: 10000,
                              ...searchParams,
                            });
                            allQuotationData = allQuotationResult.data || [];
                            setAllLeftData(allQuotationData);
                          }

                          // 同时更新 leftData 和 leftTotal（用于分页器显示）
                          setLeftData(allQuotationData.slice(0, leftPageSize));
                          setLeftTotal(allQuotationData.length);

                          if (allQuotationData.length > 0) {
                            // 加载所有库存汇总数据（不进行SKU过滤），筛选逻辑会在前端基于所有数据执行
                            // 注意：即使有SKU搜索，也要先加载所有数据，计算对比结果，然后再在 filteredAlignedData 中进行SKU过滤和筛选对比结果过滤
                            await loadRightData(allQuotationData, codesToUse || [], storeNameFilter, cityFilter, true);
                          } else {
                            // 如果没有数据，清空库存汇总
                            setRightData([]);
                            setRightAllData([]);
                            setRightTotal(0);
                            setUpcToSkuMap({});
                            setRightLoading(false);
                          }
                        } catch (error) {
                          messageApi.error('加载数据失败');
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
                          await loadRightData(leftData, selectedSupplierCodes.length > 0 ? selectedSupplierCodes : [], storeNameFilter, cityFilter, true);
                        }
                        // 如果选择了供应商名称字段，查询供应商名称
                        if (supplierNameFields.length > 0 && rightData.length > 0) {
                          await loadSupplierNames(rightData, supplierNameFields);
                        }
                        // 清空 allLeftData（因为没有筛选条件，不需要所有数据）
                        setAllLeftData([]);
                      }
                    }}
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
                        lockedColumns={leftLockedColumns}
                        onToggleLock={handleLeftToggleLock}
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
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setBatchModalVisible(true)}
                    size="small"
                  >
                    批量新增
                  </Button>
                </Space>
              </div>
              {/* 库存汇总搜索区域 */}
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500, color: '#52c41a', fontSize: '13px' }}>
                  库存汇总
                  <span style={{ marginLeft: 8, fontSize: '12px', color: '#999', fontWeight: 'normal' }}>
                    (进行下方任意筛选后即可匹配库存汇总数据)
                  </span>
                </div>
                <Space wrap size="small">
                  <Search
                    placeholder="搜索SKU"
                    value={inventorySkuSearch}
                    onChange={(e) => setInventorySkuSearch(e.target.value)}
                    onSearch={async (value) => {
                      // 使用新的搜索逻辑
                      if (!value || !value.trim()) {
                        messageApi.warning('请输入SKU进行搜索');
                        return;
                      }

                      try {
                        setRightLoading(true);
                        // 同步设置 inventorySkuSearch 状态，确保 mergedData 能正确计算
                        setInventorySkuSearch(value.trim());
                        const result = await supplierQuotationApi.searchBySku(value.trim());

                        if (result && result.data && result.data.length > 0) {
                          // 设置搜索标记，确保 dataForAlignment 能正确使用 allLeftData
                          hasClickedSearchRef.current = true;
                          // 设置左栏数据
                          setLeftData(result.data);
                          setAllLeftData(result.data);
                          setLeftTotal(result.data.length);
                          setLeftCurrentPage(1);

                          // 提取供应商编码列表
                          const supplierCodes = [...new Set(result.data.map(item => item.供应商编码).filter((code): code is string => Boolean(code)))];
                          setSelectedSupplierCodes(supplierCodes);

                          // 保存匹配到的SKU，用于右栏显示（无论是否匹配，都先设置）
                          if (result.matchedSku) {
                            setMatchedSkuSearch(result.matchedSku);
                          } else {
                            setMatchedSkuSearch('');
                          }

                          // 如果有供应商编码，需要加载对应的库存汇总数据（无论是否有匹配的SKU）
                          if (supplierCodes.length > 0) {
                            // 使用匹配到的SKU去加载库存汇总数据
                            // 对于手动绑定的SKU搜索，需要执行完整匹配（shouldMatchData: true）
                            await loadRightData(result.data, supplierCodes, storeNameFilter, cityFilter, true, false, true);
                            messageApi.success(`找到 ${result.data.length} 条供应商报价数据`);
                          } else {
                            // 即使没有供应商编码，也应该显示数据（如果找到了供应商报价数据）
                            if (result.data.length > 0) {
                              messageApi.success(`找到 ${result.data.length} 条供应商报价数据`);
                            }
                          }
                        } else {
                          messageApi.warning('未查询到数据');
                          setLeftData([]);
                          setAllLeftData([]);
                          setLeftTotal(0);
                          setRightData([]);
                          setRightAllData([]);
                          setRightTotal(0);
                          setMatchedSkuSearch('');
                        }
                      } catch (error: any) {
                        console.error(`[搜索SKU] 搜索失败:`, error);
                        messageApi.error('搜索失败: ' + (error?.message || '未知错误'));
                      } finally {
                        setRightLoading(false);
                      }
                    }}
                    allowClear
                    style={{ width: 150 }}
                    size="small"
                    enterButton
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
                  <Select
                    placeholder="采购价类型"
                    value={priceTypeFilter}
                    onChange={(value) => {
                      // 只更新状态，不自动筛选，需要点击搜索按钮才执行
                      setPriceTypeFilter(value);
                    }}
                    style={{ minWidth: 150 }}
                    allowClear
                    size="small"
                    options={[
                      ...(inventoryType === '全部' ? [{ label: '最低采购价', value: '最低采购价' }] : []),
                      { label: '最近采购价', value: '最近采购价' },
                      { label: '成本单价', value: '成本单价' },
                    ]}
                  />
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
                        columns={getAllRightColumns()}
                        hiddenColumns={rightHiddenColumns}
                        columnOrder={rightColumnOrder}
                        onToggleVisibility={handleRightToggleVisibility}
                        onMoveColumn={handleRightMoveColumn}
                        onColumnOrderChange={handleRightColumnOrderChange}
                        lockedColumns={rightLockedColumns}
                        onToggleLock={handleRightToggleLock}
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
                        messageApi.warning('请先选择至少一个供应商编码');
                        return;
                      }
                      const hide = message.loading({ content: '正在刷新数据...', key: 'refresh', duration: 0 });

                      try {
                        // 清除当前选择的供应商编码的缓存
                        clearCacheForSupplierCodes(selectedSupplierCodes);

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
                              // 强制刷新库存汇总数据（跳过缓存），并执行完整匹配
                              await loadRightData(allQuotationData, selectedSupplierCodes, storeNameFilter, cityFilter, true, true, true);
                            }
                          } finally {
                            setLeftLoading(false);
                          }
                        } else {
                          // 如果没有筛选条件，正常加载数据（强制刷新）
                          await loadAllLeftData(selectedSupplierCodes, true, true); // 强制刷新
                          await loadLeftData(undefined, storeNameFilter, cityFilter, leftCurrentPage, leftPageSize);
                          if (leftData.length > 0) {
                            // 强制刷新库存汇总数据（跳过缓存），并执行完整匹配
                            await loadRightData(leftData, selectedSupplierCodes, storeNameFilter, cityFilter, true, true, true);
                          }
                        }
                        hide();
                        messageApi.success('数据刷新成功');
                      } catch (error) {
                        hide();
                        messageApi.error('数据刷新失败');
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
          style={{ flex: `0 0 ${topPanelHeight}%`, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', boxSizing: 'border-box' }}
          styles={{ body: { flex: 1, overflow: 'hidden', padding: 8, display: 'flex', flexDirection: 'column' } }}
        >
          <div ref={mergedTableContainerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div
              id="merged-table-scroll-container"
              style={{
                flex: 1,
                overflowX: 'scroll',
                overflowY: 'hidden',
                minWidth: 0,
                position: 'relative',
                // 确保滚动条始终显示在容器底部
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <ResponsiveTable
                tableId="supplier-quotation-merged"
                columns={getFilteredMergedColumns()}
                dataSource={mergedData}
                rowKey={(record) => record.key}
                loading={leftLoading || rightLoading}
                scroll={{ x: 'max-content', y: mergedTableHeight }}
                pagination={false}
                isMobile={false}
                resizable={true}
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
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }

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

        {/* 分割线 */}
        <div
          style={{
            height: '4px',
            backgroundColor: isResizing ? '#1890ff' : '#d9d9d9',
            cursor: 'ns-resize',
            position: 'relative',
            flexShrink: 0,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
            const startY = e.clientY;
            const startTopHeight = topPanelHeight;
            const containerHeight = e.currentTarget.parentElement?.clientHeight || 600;

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaY = moveEvent.clientY - startY;
              const deltaPercent = (deltaY / containerHeight) * 100;
              // 限制在5%-95%之间，确保两个容器都有最小高度
              const newTopHeight = Math.max(5, Math.min(95, startTopHeight + deltaPercent));
              setTopPanelHeight(newTopHeight);
            };

            const handleMouseUp = () => {
              setIsResizing(false);
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
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

        {/* 下栏 */}
        <div style={{ flex: `1 1 ${100 - topPanelHeight}%`, minHeight: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>其他信息</span>
                {orderChannel && (
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
              <Space>
                {/* 清空绑定SKU按钮 - 在所有菜单中都显示 */}
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (!selectedLeftRecord) {
                      messageApi.warning('请先选择一条数据行');
                      return;
                    }

                    const supplierCode = selectedLeftRecord.供应商编码;
                    const upcCode = selectedLeftRecord.最小销售规格UPC商品条码;

                    if (!supplierCode || !upcCode) {
                      messageApi.warning('缺少供应商编码或UPC条码信息');
                      return;
                    }

                    try {
                      // 先查询是否有绑定数据
                      const bindings = await supplierQuotationApi.getSkuBindings({
                        supplierCode: supplierCode,
                        supplierProductCode: String(upcCode).trim(),
                      });

                      // 检查是否有绑定数据（SKU不为空）
                      const hasBinding = bindings && bindings.length > 0 && bindings[0].SKU && bindings[0].SKU.trim() !== '';

                      if (!hasBinding) {
                        messageApi.warning('无绑定数据');
                        return;
                      }

                      // 如果有绑定数据，清空SKU
                      await supplierQuotationApi.updateSkuBinding({
                        supplierCode: supplierCode,
                        upcCode: String(upcCode).trim(),
                        sku: '', // 传入空字符串清空SKU
                      });

                      messageApi.success('清空成功');

                      // 清除相关供应商编码的缓存
                      clearCacheForSupplierCodes([supplierCode]);

                      // 重新加载数据
                      const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                      if (rightAllData.length > 0 && dataSource.length > 0) {
                        await loadQuotationBindingFlags(rightAllData, dataSource);
                        await loadSkuBindingMap(dataSource, upcToSkuMap);
                        await loadSupplierBindingSkuMap(dataSource);
                        // 重新加载下栏数据
                        await loadBottomData();
                        // 重新加载库存汇总数据
                        if (selectedSupplierCodes.length > 0 && dataSource.length > 0) {
                          await loadRightData(dataSource, selectedSupplierCodes, storeNameFilter, cityFilter, true, true);
                        }
                      }
                    } catch (error: any) {
                      messageApi.error(`清空失败: ${error?.response?.data?.message || error?.message || '未知错误'}`);
                    }
                  }}
                  disabled={!selectedLeftRecord}
                  style={{
                    transition: 'all 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedLeftRecord) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 77, 79, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  清空绑定SKU
                </Button>
                {otherInfoActiveMenu === 'sku-binding' ? (
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={(e) => {
                      console.log('[保存按钮] ========== 点击保存按钮 ==========');
                      console.log('[保存按钮] selectedLeftRecord:', selectedLeftRecord);
                      console.log('[保存按钮] bottomData.length:', bottomData.length);
                      console.log('[保存按钮] disabled状态:', !selectedLeftRecord || bottomData.length === 0);
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('[保存按钮] 调用handleSaveSkuBindings');
                      handleSaveSkuBindings();
                    }}
                    disabled={!selectedLeftRecord || bottomData.length === 0}
                  >
                    保存
                  </Button>
                ) : (
                  <>
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
                  </>
                )}
              </Space>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
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
                            title: '报价比例_供应商商品',
                            key: '报价比例_供应商商品',
                            width: 180,
                            render: (_: any, record: SupplierSkuBinding) => {
                              const uniqueKey = `${record.供应商编码}_${record.供应商商品编码}`;
                              const ratio = editingRatios[uniqueKey];
                              const supplierRatio = ratio?.supplierRatio;
                              return (
                                <InputNumber
                                  value={supplierRatio}
                                  onChange={(value) => {
                                    const newRatio = value || undefined;
                                    const currentQianniuhuaRatio = ratio?.qianniuhuaRatio;

                                    // 验证：至少有一边为1
                                    if (newRatio !== undefined && currentQianniuhuaRatio !== undefined) {
                                      if (newRatio !== 1 && currentQianniuhuaRatio !== 1) {
                                        messageApi.warning('至少一边为1');
                                        return;
                                      }
                                    }

                                    setEditingRatios({
                                      ...editingRatios,
                                      [uniqueKey]: {
                                        ...ratio,
                                        supplierRatio: newRatio,
                                      },
                                    });
                                  }}
                                  placeholder="请输入报价比例"
                                  min={0}
                                  precision={0}
                                  style={{ width: '100%' }}
                                />
                              );
                            },
                          },
                          {
                            title: '报价比例_牵牛花商品',
                            key: '报价比例_牵牛花商品',
                            width: 180,
                            render: (_: any, record: SupplierSkuBinding) => {
                              const uniqueKey = `${record.供应商编码}_${record.供应商商品编码}`;
                              const ratio = editingRatios[uniqueKey];
                              const qianniuhuaRatio = ratio?.qianniuhuaRatio;
                              return (
                                <InputNumber
                                  value={qianniuhuaRatio}
                                  onChange={(value) => {
                                    const newRatio = value || undefined;
                                    const currentSupplierRatio = ratio?.supplierRatio;

                                    // 验证：至少有一边为1
                                    if (newRatio !== undefined && currentSupplierRatio !== undefined) {
                                      if (newRatio !== 1 && currentSupplierRatio !== 1) {
                                        messageApi.warning('至少一边为1');
                                        return;
                                      }
                                    }

                                    setEditingRatios({
                                      ...editingRatios,
                                      [uniqueKey]: {
                                        ...ratio,
                                        qianniuhuaRatio: newRatio,
                                      },
                                    });
                                  }}
                                  placeholder="请输入报价比例"
                                  min={0}
                                  precision={0}
                                  style={{ width: '100%' }}
                                />
                              );
                            },
                          },
                          {
                            title: '计算后供货价格',
                            key: '计算后供货价格',
                            width: 180,
                            render: (_: any, record: SupplierSkuBinding) => {
                              const uniqueKey = `${record.供应商编码}_${record.供应商商品编码}`;
                              const ratio = editingRatios[uniqueKey];
                              const supplierRatio = ratio?.supplierRatio;
                              const qianniuhuaRatio = ratio?.qianniuhuaRatio;

                              // 获取供货价格（从selectedLeftRecord获取）
                              const quotation = selectedLeftRecord;
                              const originalPrice = quotation?.供货价格;

                              // 计算后供货价格 = 供货价格 / 报价比例_供应商商品 * 报价比例_牵牛花商品
                              let calculatedPrice: number | undefined;
                              if (originalPrice !== undefined && originalPrice !== null) {
                                // 确保originalPrice是数字类型
                                const price = typeof originalPrice === 'number' ? originalPrice : Number(originalPrice);
                                if (!isNaN(price)) {
                                  if (supplierRatio && supplierRatio > 0 && qianniuhuaRatio && qianniuhuaRatio > 0) {
                                    calculatedPrice = price / supplierRatio * qianniuhuaRatio;
                                  } else {
                                    calculatedPrice = price;
                                  }
                                }
                              }

                              return (
                                <span>
                                  {calculatedPrice !== undefined && calculatedPrice !== null && !isNaN(calculatedPrice)
                                    ? `¥${calculatedPrice.toFixed(4)}`
                                    : '-'}
                                </span>
                              );
                            },
                          },
                          {
                            title: '供应商SKU备注',
                            key: '供应商SKU备注',
                            width: 200,
                            render: (_: any, record: SupplierSkuBinding) => {
                              const uniqueKey = `${record.供应商编码}_${record.供应商商品编码}`;
                              // 获取SKU：使用record.SKU（这是SKU绑定信息表中的SKU字段）
                              const skuToUse = record.SKU || '';

                              // 使用"供应商编码_SKU"作为备注的key
                              const remarkKey = record.供应商编码 && skuToUse
                                ? `${record.供应商编码}_${skuToUse}`
                                : uniqueKey; // 如果没有SKU，暂时使用uniqueKey

                              const remark = editingRemarks[remarkKey] !== undefined
                                ? editingRemarks[remarkKey]
                                : (supplierProductRemarks[remarkKey] || '');

                              const remainingChars = 100 - remark.length;

                              return (
                                <Input
                                  value={remark}
                                  onChange={(e) => {
                                    const newValue = e.target.value;
                                    // 限制100字
                                    if (newValue.length > 100) {
                                      return;
                                    }
                                    setEditingRemarks({
                                      ...editingRemarks,
                                      [remarkKey]: newValue,
                                    });
                                  }}
                                  onBlur={async (e) => {
                                    const value = e.target.value.trim();
                                    // 只有当有SKU时才能保存备注
                                    if (record.供应商编码 && skuToUse) {
                                      try {
                                        await supplierQuotationApi.saveSupplierProductRemark({
                                          supplierCode: record.供应商编码,
                                          sku: skuToUse,
                                          remark: value,
                                        });
                                        // 更新本地状态
                                        setSupplierProductRemarks({
                                          ...supplierProductRemarks,
                                          [remarkKey]: value,
                                        });
                                        setEditingRemarks({
                                          ...editingRemarks,
                                          [remarkKey]: value,
                                        });
                                        messageApi.success('供应商SKU备注保存成功');
                                      } catch (error) {
                                        console.error('保存供应商SKU备注失败:', error);
                                        messageApi.error('保存供应商SKU备注失败');
                                      }
                                    } else if (!skuToUse) {
                                      messageApi.warning('请先输入SKU才能保存备注');
                                    }
                                  }}
                                  placeholder="请输入供应商SKU备注"
                                  maxLength={100}
                                  style={{ width: '100%' }}
                                  suffix={<span style={{ fontSize: '12px', color: remainingChars < 20 ? '#ff4d4f' : '#999' }}>{remainingChars}</span>}
                                />
                              );
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
                    <ResponsiveTable
                      tableId="supplier-quotation-product-info"
                      columns={getFilteredProductInfoColumns()}
                      dataSource={productInfoData}
                      rowKey={(record) => `${record.供应商编码}_${record.供货关系编码 || record.SKU编码 || Math.random()}`}
                      isMobile={false}
                      resizable={true}
                      loading={productInfoLoading}
                      pagination={false}
                      scroll={{
                        x: 'max-content',
                        y: 300 // 固定高度，表格会自动适应容器
                      }}
                    />
                  </div>
                )}
              </Layout.Content>
            </Layout>
          </Card>
        </div>
      </div>

      {/* 手动绑定SKU模态框 */}
      <Modal
        title="手动绑定SKU"
        open={manualBindingModalOpen}
        onOk={async () => {
          if (!manualBindingRecord) {
            message.warning('缺少供应商报价信息');
            return;
          }
          const skuValue = manualBindingSkuInput.trim();
          if (!skuValue) {
            message.warning('请输入SKU');
            return;
          }

          try {
            await supplierQuotationApi.updateSkuBinding({
              supplierCode: manualBindingRecord.supplierCode,
              upcCode: manualBindingRecord.upcCode,
              sku: skuValue,
            });
            message.success('保存成功');

            // 清除相关供应商编码的缓存
            clearCacheForSupplierCodes([manualBindingRecord.supplierCode]);

            // 关闭Modal
            setManualBindingModalOpen(false);
            setManualBindingRecord(null);
            setManualBindingSkuInput('');

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
        }}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        {manualBindingRecord && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>供应商编码:</div>
              <div style={{ color: '#666' }}>{manualBindingRecord.supplierCode}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>最小销售规格UPC商品条码:</div>
              <div style={{ color: '#666' }}>{manualBindingRecord.upcCode}</div>
            </div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>请输入SKU:</div>
            <Input
              value={manualBindingSkuInput}
              onChange={(e) => setManualBindingSkuInput(e.target.value)}
              placeholder="请输入SKU"
              style={{ width: '100%' }}
            />
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

      {/* 批量新增模态框 */}
      <BatchAddModal<SupplierQuotation>
        open={batchModalVisible}
        title="批量新增供应商报价"
        hint="您可以从 Excel 中复制数据（包含序号、供应商编码、商品名称、商品规格、最小销售单位、商品型号、供应商商品编码、最小销售规格UPC商品条码、中包或整件销售规格条码、供货价格、供应商商品备注列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件。"
        fields={useMemo<FieldConfig<SupplierQuotation>[]>(() => ([
          { key: '序号', label: '序号', excelHeaderName: '序号', required: false, index: 0, transform: (v) => v ? Number(v) : null },
          { key: '供应商编码', label: '供应商编码', excelHeaderName: '供应商编码', required: true, index: 1 },
          { key: '商品名称', label: '商品名称', excelHeaderName: '商品名称', required: false, index: 2 },
          { key: '商品规格', label: '商品规格', excelHeaderName: '商品规格', required: false, index: 3 },
          { key: '最小销售单位', label: '最小销售单位', excelHeaderName: '最小销售单位', required: false, index: 4 },
          { key: '商品型号', label: '商品型号', excelHeaderName: '商品型号', required: false, index: 5 },
          { key: '供应商商品编码', label: '供应商商品编码', excelHeaderName: '供应商商品编码', required: true, index: 6 },
          { key: '最小销售规格UPC商品条码', label: '最小销售规格UPC商品条码', excelHeaderName: '最小销售规格UPC商品条码', required: false, index: 7 },
          { key: '中包或整件销售规格条码', label: '中包或整件销售规格条码', excelHeaderName: '中包或整件销售规格条码', required: false, index: 8 },
          { key: '供货价格', label: '供货价格', excelHeaderName: '供货价格', required: false, index: 9, transform: (v) => v ? Number(v) : null },
          { key: '供应商商品备注', label: '供应商商品备注', excelHeaderName: '供应商商品备注', required: false, index: 10 },
        ]), [])}
        formatHint="格式：序号	供应商编码	商品名称	商品规格	最小销售单位	商品型号	供应商商品编码	最小销售规格UPC商品条码	中包或整件销售规格条码	供货价格	供应商商品备注"
        example="1	SUP001	商品A	规格A	个	型号A	PROD001	UPC001	UPC002	10.5	备注信息"
        onCancel={() => setBatchModalVisible(false)}
        onSave={useCallback(async (validItems: SupplierQuotation[]) => {
          try {
            // 转换数据格式，确保必填字段存在
            const itemsToCreate = validItems.map(item => ({
              序号: item.序号,
              供应商编码: item.供应商编码 || '',
              商品名称: item.商品名称,
              商品规格: item.商品规格,
              最小销售单位: item.最小销售单位,
              商品型号: item.商品型号,
              供应商商品编码: item.供应商商品编码 || '',
              最小销售规格UPC商品条码: item.最小销售规格UPC商品条码,
              中包或整件销售规格条码: item.中包或整件销售规格条码,
              供货价格: item.供货价格,
              供应商商品备注: item.供应商商品备注,
            }));
            const result = await supplierQuotationApi.batchCreate({ items: itemsToCreate });
            if (result.success > 0) {
              messageApi.success(`批量新增成功 ${result.success} 条${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
            }
            if (result.failed > 0 && result.errors.length > 0) {
              // 多条错误用回车分隔
              const errorMessages = result.errors.join('\n');
              messageApi.warning(`有 ${result.failed} 条数据失败：\n${errorMessages}`);
            }
            // 重新加载数据
            await loadLeftData(undefined, storeNameFilter, cityFilter, leftCurrentPage, leftPageSize);
          } catch (e: any) {
            messageApi.error('批量新增失败: ' + (e?.message || '未知错误'));
          }
        }, [storeNameFilter, cityFilter, leftCurrentPage, leftPageSize])}
        createItem={useCallback((parts: string[]) => {
          return {
            '序号': parts[0] ? Number(parts[0]) : null,
            '供应商编码': parts[1] || '',
            '商品名称': parts[2] || null,
            '商品规格': parts[3] || null,
            '最小销售单位': parts[4] || null,
            '商品型号': parts[5] || null,
            '供应商商品编码': parts[6] || '',
            '最小销售规格UPC商品条码': parts[7] || null,
            '中包或整件销售规格条码': parts[8] || null,
            '供货价格': parts[9] ? Number(parts[9]) : null,
            '供应商商品备注': parts[10] || null,
          } as Partial<SupplierQuotation>;
        }, [])}
      />
    </React.Fragment>
  );
}

