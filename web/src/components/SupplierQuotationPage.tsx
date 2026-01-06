"use client";

import { InventorySummary, SupplierQuotation, supplierQuotationApi, SupplierSkuBinding } from '@/lib/api';
import { DownloadOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Popover,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
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
  const [leftPageSize, setLeftPageSize] = useState(20);
  const [leftSearchText, setLeftSearchText] = useState('');
  const [selectedSupplierCodes, setSelectedSupplierCodes] = useState<string[]>([]); // 选中的供应商编码列表
  const [allSupplierCodes, setAllSupplierCodes] = useState<string[]>([]); // 所有供应商编码列表
  const [supplierCodeSearchValue, setSupplierCodeSearchValue] = useState(''); // 供应商编码搜索框的输入值

  // 右栏数据
  const [rightData, setRightData] = useState<InventorySummary[]>([]);
  const [rightLoading, setRightLoading] = useState(false);
  const [inventoryType, setInventoryType] = useState<'全部' | '仓店' | '城市'>('全部');
  const [selectedLeftRecord, setSelectedLeftRecord] = useState<SupplierQuotation | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1); // 记录选中的行索引
  const [rightCurrentPage, setRightCurrentPage] = useState(1);
  const [rightPageSize, setRightPageSize] = useState(20);
  const [comparisonResultFilter, setComparisonResultFilter] = useState<string[]>([]); // 对比结果筛选
  const [storeNameFilter, setStoreNameFilter] = useState<string[]>([]); // 门店/仓名称筛选（仅仓店维度）
  const [warehousePriorities, setWarehousePriorities] = useState<string[]>([]); // 仓库优先级列表

  // 下栏数据
  const [bottomData, setBottomData] = useState<SupplierSkuBinding[]>([]);
  const [bottomLoading, setBottomLoading] = useState(false);
  const [editingSkus, setEditingSkus] = useState<Record<string, string>>({});
  const [form] = Form.useForm();

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

  // 右栏列设置相关状态
  const [rightHiddenColumns, setRightHiddenColumns] = useState<Set<string>>(new Set());
  const [rightColumnOrder, setRightColumnOrder] = useState<string[]>([]);
  const [rightColumnSettingsOpen, setRightColumnSettingsOpen] = useState(false);

  // 右栏搜索
  const [rightSearchText, setRightSearchText] = useState('');

  // 导出相关状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState<string[]>([]);

  // 左栏默认显示的字段（按顺序）
  const defaultVisibleColumns = ['序号', '供应商名称', '供应商编码', '商品名称', '商品规格', '供货价格'];

  // 右栏默认显示的字段（全部类型）：SKU, 最低采购价, SKU商品标签, 对比结果
  const defaultRightVisibleColumns = ['SKU', '最低采购价', 'SKU商品标签', '对比结果'];

  // 右栏默认显示的字段（仓店/城市类型）：SKU, 最近采购价, SKU商品标签, 对比结果
  const defaultRightVisibleColumnsStoreCity = ['SKU', '最近采购价', 'SKU商品标签', '对比结果'];

  // 初始化左栏列设置
  useEffect(() => {
    const savedHidden = localStorage.getItem('supplier-quotation-left-hidden-columns');
    const savedOrder = localStorage.getItem('supplier-quotation-left-column-order');

    if (savedHidden) {
      try {
        const hidden = JSON.parse(savedHidden);
        setLeftHiddenColumns(new Set(hidden));
      } catch (e) {
        console.error('Failed to parse hidden columns:', e);
        // 如果解析失败，使用默认设置
        const allColumns = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
        const hidden = allColumns.filter(key => !defaultVisibleColumns.includes(key));
        setLeftHiddenColumns(new Set(hidden));
      }
    } else {
      // 默认隐藏非默认显示的字段
      const allColumns = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
      const hidden = allColumns.filter(key => !defaultVisibleColumns.includes(key));
      setLeftHiddenColumns(new Set(hidden));
    }

    if (savedOrder) {
      try {
        const order = JSON.parse(savedOrder);
        // 验证保存的列顺序是否包含所有列
        const allColumnKeys = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
        const validOrder = order.filter((key: string) => allColumnKeys.includes(key));
        // 添加缺失的列到末尾
        const missingKeys = allColumnKeys.filter(key => !validOrder.includes(key));
        setLeftColumnOrder([...validOrder, ...missingKeys]);
      } catch (e) {
        console.error('Failed to parse column order:', e);
        // 如果解析失败，使用默认顺序
        const allColumns = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
        setLeftColumnOrder(allColumns);
      }
    } else {
      // 如果没有保存的列顺序，使用默认顺序（按照 defaultVisibleColumns 的顺序，然后添加其他列）
      const allColumns = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
      // 先添加默认显示的列（按顺序）
      const defaultOrder = defaultVisibleColumns.filter(key => allColumns.includes(key));
      // 然后添加其他列
      const otherColumns = allColumns.filter(key => !defaultVisibleColumns.includes(key));
      setLeftColumnOrder([...defaultOrder, ...otherColumns]);
    }
  }, []);

  // 初始化右栏列设置（只在组件首次加载时执行，不依赖 inventoryType）
  useEffect(() => {
    const savedHidden = localStorage.getItem('supplier-quotation-right-hidden-columns');
    const savedOrder = localStorage.getItem('supplier-quotation-right-column-order');

    if (savedHidden) {
      try {
        const hidden = JSON.parse(savedHidden);
        setRightHiddenColumns(new Set(hidden));
      } catch (e) {
        console.error('Failed to parse hidden columns:', e);
        // 如果解析失败，使用默认设置
        const allColumns = getRightColumns().map(col => col.key as string).filter(Boolean);
        const defaultVisible = inventoryType === '全部'
          ? defaultRightVisibleColumns
          : defaultRightVisibleColumnsStoreCity;
        const hidden = allColumns.filter(key => !defaultVisible.includes(key));
        setRightHiddenColumns(new Set(hidden));
      }
    } else {
      // 默认隐藏非默认显示的字段
      const allColumns = getRightColumns().map(col => col.key as string).filter(Boolean);
      const defaultVisible = inventoryType === '全部'
        ? defaultRightVisibleColumns
        : defaultRightVisibleColumnsStoreCity;
      const hidden = allColumns.filter(key => !defaultVisible.includes(key));
      setRightHiddenColumns(new Set(hidden));
    }

    if (savedOrder) {
      try {
        const order = JSON.parse(savedOrder);
        // 验证保存的列顺序是否包含所有列
        const allColumnKeys = getRightColumns().map(col => col.key as string).filter(Boolean);
        const validOrder = order.filter((key: string) => allColumnKeys.includes(key));
        // 添加缺失的列到末尾
        const missingKeys = allColumnKeys.filter(key => !validOrder.includes(key));
        setRightColumnOrder([...validOrder, ...missingKeys]);
      } catch (e) {
        console.error('Failed to parse column order:', e);
        // 如果解析失败，使用默认顺序
        const allColumns = getRightColumns().map(col => col.key as string).filter(Boolean);
        setRightColumnOrder(allColumns);
      }
    } else {
      // 如果没有保存的列顺序，使用默认顺序（按照默认可见列的顺序，然后添加其他列）
      const allColumns = getRightColumns().map(col => col.key as string).filter(Boolean);
      const defaultVisible = inventoryType === '全部'
        ? defaultRightVisibleColumns
        : defaultRightVisibleColumnsStoreCity;
      // 先添加默认显示的列（按顺序）
      const defaultOrder = defaultVisible.filter(key => allColumns.includes(key));
      // 然后添加其他列
      const otherColumns = allColumns.filter(key => !defaultVisible.includes(key));
      setRightColumnOrder([...defaultOrder, ...otherColumns]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件首次加载时执行，不依赖 inventoryType

  // 当 inventoryType 改变时，同步列顺序（移除不存在的列，添加新出现的列）
  useEffect(() => {
    // 只有在已经有保存的列顺序时才需要同步
    if (rightColumnOrder.length > 0) {
      const allColumnKeys = getRightColumns().map(col => col.key as string).filter(Boolean);
      // 过滤掉不存在的列，保留存在的列的顺序
      const validOrder = rightColumnOrder.filter(key => allColumnKeys.includes(key));
      // 添加新出现的列到末尾
      const missingKeys = allColumnKeys.filter(key => !validOrder.includes(key));
      if (missingKeys.length > 0 || validOrder.length !== rightColumnOrder.length) {
        setRightColumnOrder([...validOrder, ...missingKeys]);
        // 保存更新后的列顺序
        localStorage.setItem('supplier-quotation-right-column-order', JSON.stringify([...validOrder, ...missingKeys]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]); // 当 inventoryType 改变时，同步列顺序

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
        render: (text: number) => text ? `¥${Number(text).toFixed(4)}` : '-',
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
    ];
  };

  // 获取过滤后的左栏列
  const getFilteredLeftColumns = (): ColumnType<SupplierQuotation>[] => {
    const allColumns = getAllLeftColumns();
    const currentOrder = leftColumnOrder.length > 0 ? leftColumnOrder : allColumns.map(col => col.key as string).filter(Boolean);

    // 按顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter((col): col is ColumnType<SupplierQuotation> => col !== undefined);

    // 过滤隐藏的列
    return orderedColumns.filter(col => !leftHiddenColumns.has(col.key as string));
  };

  // 获取过滤后的右栏列
  const getFilteredRightColumns = (): ColumnType<InventorySummary>[] => {
    const allColumns = getRightColumns();
    const currentOrder = rightColumnOrder.length > 0 ? rightColumnOrder : allColumns.map(col => col.key as string).filter(Boolean);

    // 按顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter((col): col is ColumnType<InventorySummary> => col !== undefined);

    // 过滤隐藏的列
    return orderedColumns.filter(col => !rightHiddenColumns.has(col.key as string));
  };

  // 获取右栏列定义（按默认显示顺序：SKU、最低采购价/最近采购价、SKU商品标签、对比结果，然后是其他列）
  const getRightColumns = (): ColumnType<InventorySummary>[] => {
    const columns: ColumnType<InventorySummary>[] = [
      {
        title: 'SKU',
        dataIndex: 'SKU',
        key: 'SKU',
        width: 120,
        fixed: 'left' as const,
      },
    ];

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

    // 对比结果列 - 固定在右侧
    columns.push({
      title: '对比结果',
      dataIndex: '对比结果',
      key: '对比结果',
      width: 120,
      fixed: 'right' as const,
      render: (text: string) => {
        if (text === '价格优势') {
          return <Tag color="green">{text}</Tag>;
        } else if (text === '价格偏高') {
          return <Tag color="red">{text}</Tag>;
        } else if (text === '无供货价信息') {
          return <Tag color="orange">{text}</Tag>;
        } else if (text === '无采购价信息') {
          return <Tag color="orange">{text}</Tag>;
        }
        return text || '-';
      },
    });

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
        title: '覆盖门店数',
        dataIndex: '覆盖门店数',
        key: '覆盖门店数',
        width: 120,
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
      }
    );

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

  // 加载所有供应商报价数据（不分页，用于筛选）
  const loadAllLeftData = async () => {
    // 如果没有选择供应商编码，不加载数据
    if (selectedSupplierCodes.length === 0) {
      setAllLeftData([]);
      return;
    }

    try {
      // 获取所有数据，使用一个很大的 limit 值
      const result = await supplierQuotationApi.getAll({
        page: 1,
        limit: 10000, // 设置一个足够大的值以获取所有数据
        search: leftSearchText || undefined,
        supplierCodes: selectedSupplierCodes,
      });
      setAllLeftData(result.data || []);
    } catch (error) {
      console.error('加载所有供应商报价数据失败:', error);
    }
  };

  // 加载左栏数据
  const loadLeftData = async () => {
    // 如果没有选择供应商编码，不加载数据
    if (selectedSupplierCodes.length === 0) {
      setLeftData([]);
      setLeftTotal(0);
      setRightData([]);
      setLeftLoading(false);
      return;
    }

    setLeftLoading(true);
    try {
      const result = await supplierQuotationApi.getAll({
        page: leftCurrentPage,
        limit: leftPageSize,
        search: leftSearchText || undefined,
        supplierCodes: selectedSupplierCodes,
      });
      setLeftData(result.data || []);
      setLeftTotal(result.total || 0);

      // 如果有筛选条件，需要加载所有数据用于筛选
      if (comparisonResultFilter.length > 0) {
        await loadAllLeftData();
      }

      // 加载完供应商报价数据后，自动加载库存汇总数据
      if (result.data && result.data.length > 0) {
        loadRightData();
      } else {
        // 如果没有数据，清空库存汇总
        setRightData([]);
      }
    } catch (error) {
      message.error('加载供应商报价数据失败');
      console.error(error);
    } finally {
      setLeftLoading(false);
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

  // 加载右栏数据
  const loadRightData = async () => {
    setRightLoading(true);
    try {
      // 获取所有库存汇总数据（不传upc参数，获取全部）
      // 如果是仓店维度且有门店筛选，传递storeNames参数
      const result = await supplierQuotationApi.getInventorySummary({
        type: inventoryType,
        storeNames: inventoryType === '仓店' && storeNameFilter.length > 0 ? storeNameFilter : undefined,
      });

      // 计算对比结果：为每个库存汇总项找到匹配的供应商报价项
      const dataWithComparison = result.map(item => {
        // 找到所有匹配的供应商报价项（UPC包含最小销售规格UPC商品条码）
        const matchedQuotations = leftData.filter(quotation => {
          if (!quotation.最小销售规格UPC商品条码 || !item.UPC) return false;
          return item.UPC.includes(quotation.最小销售规格UPC商品条码);
        });

        // 如果没有匹配的供应商报价，不显示对比结果
        if (matchedQuotations.length === 0) {
          return item;
        }

        // 使用第一个匹配的供应商报价进行对比（如果有多个，取第一个）
        const matchedQuotation = matchedQuotations[0];
        const supplierPrice = matchedQuotation.供货价格;

        // 如果供货价格为空，显示'无供货价信息'
        if (supplierPrice === undefined || supplierPrice === null) {
          return {
            ...item,
            对比结果: '无供货价信息',
          };
        }

        // 根据类型选择对比逻辑
        let comparePrice: number | undefined;

        if (inventoryType === '全部') {
          // 全部：优先比最低采购价，为空则比最近采购价，还为空则比成本单价
          if (item.最低采购价 !== undefined && item.最低采购价 !== null) {
            comparePrice = item.最低采购价;
          } else if (item.最近采购价 !== undefined && item.最近采购价 !== null) {
            comparePrice = item.最近采购价;
          } else if (item.成本单价 !== undefined && item.成本单价 !== null) {
            comparePrice = item.成本单价;
          }
        } else {
          // 仓店/城市：优先比最近采购价，为空则比成本单价
          if (item.最近采购价 !== undefined && item.最近采购价 !== null) {
            comparePrice = item.最近采购价;
          } else if (item.成本单价 !== undefined && item.成本单价 !== null) {
            comparePrice = item.成本单价;
          }
        }

        // 如果所有采购价都为空，显示'无采购价信息'
        if (comparePrice === undefined || comparePrice === null) {
          return {
            ...item,
            对比结果: '无采购价信息',
          };
        }

        // 供货价格 < 采购价，显示'价格优势'（供应商报价更便宜）
        const diff = comparePrice - supplierPrice;
        return {
          ...item,
          对比结果: diff > 0 ? '价格优势' : diff < 0 ? '价格偏高' : '价格相同',
        };
      });

      setRightData(dataWithComparison);
    } catch (error) {
      message.error('加载库存汇总数据失败');
      console.error(error);
    } finally {
      setRightLoading(false);
    }
  };

  // 加载下栏数据
  const loadBottomData = async () => {
    if (!selectedLeftRecord || !selectedLeftRecord.供应商编码 || !selectedLeftRecord.供应商商品编码) {
      setBottomData([]);
      setEditingSkus({});
      return;
    }

    setBottomLoading(true);
    try {
      const result = await supplierQuotationApi.getSkuBindings({
        supplierCode: selectedLeftRecord.供应商编码,
        supplierProductCode: selectedLeftRecord.供应商商品编码,
      });

      // 如果没有数据,创建一个空记录用于编辑
      if (!result || result.length === 0) {
        setBottomData([{
          供应商编码: selectedLeftRecord.供应商编码,
          供应商商品编码: selectedLeftRecord.供应商商品编码,
          SKU: '',
        }]);
        // 使用稳定的唯一标识符作为key
        const uniqueKey = `${selectedLeftRecord.供应商编码}_${selectedLeftRecord.供应商商品编码}`;
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
        供应商编码: selectedLeftRecord.供应商编码,
        供应商商品编码: selectedLeftRecord.供应商商品编码,
        SKU: '',
      }]);
      // 使用稳定的唯一标识符作为key
      const uniqueKey = `${selectedLeftRecord.供应商编码}_${selectedLeftRecord.供应商商品编码}`;
      setEditingSkus({ [uniqueKey]: '' });
    } finally {
      setBottomLoading(false);
    }
  };

  // 左栏行点击
  const handleLeftRowClick = (record: SupplierQuotation, event?: React.MouseEvent) => {
    setSelectedLeftRecord(record);

    // 找到被点击行在 paginatedLeftData 中的索引
    const rowIndex = paginatedLeftData.findIndex(
      item => item.序号 === record.序号 ||
        (item.供应商编码 === record.供应商编码 && item.供应商商品编码 === record.供应商商品编码)
    );
    setSelectedRowIndex(rowIndex);

    // 注意：库存汇总数据已经基于所有供应商报价数据自动显示，不需要重新加载
    // 只需要加载下栏数据
    loadBottomData();
  };

  // 右栏筛选变化
  const handleInventoryTypeChange = (value: '全部' | '仓店' | '城市') => {
    setInventoryType(value);
    // 如果切换到仓店维度，加载仓库优先级列表
    if (value === '仓店' && warehousePriorities.length === 0) {
      loadWarehousePriorities();
    }
    // 如果不是仓店维度，清空门店筛选
    if (value !== '仓店') {
      setStoreNameFilter([]);
    }
    // 直接加载库存汇总数据，基于所有供应商报价数据
    loadRightData();
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

      // 获取所有供应商报价数据（用于导出）
      let allQuotations: SupplierQuotation[] = [];
      if (comparisonResultFilter.length > 0) {
        // 如果已经有筛选条件，使用 allLeftData
        allQuotations = allLeftData;
      } else {
        // 否则需要加载所有数据
        const result = await supplierQuotationApi.getAll({
          page: 1,
          limit: 10000,
          search: leftSearchText || undefined,
        });
        allQuotations = result.data || [];
      }

      // 获取所有库存汇总数据
      const inventoryResult = await supplierQuotationApi.getInventorySummary({
        type: inventoryType,
      });

      // 创建对齐的数据结构
      const exportAlignedData = allQuotations.map((quotation) => {
        // 找到匹配的库存汇总
        let matchedInventory: InventorySummary | null = null;

        if (quotation.最小销售规格UPC商品条码) {
          matchedInventory = inventoryResult.find(item => {
            if (!item.UPC) return false;
            return item.UPC.includes(quotation.最小销售规格UPC商品条码!);
          }) || null;
        }

        // 计算对比结果（与 alignedData 相同的逻辑）
        if (matchedInventory) {
          const supplierPrice = quotation.供货价格;

          if (supplierPrice === undefined || supplierPrice === null) {
            matchedInventory = {
              ...matchedInventory,
              对比结果: '无供货价信息',
            };
          } else {
            let comparePrice: number | undefined;

            if (inventoryType === '全部') {
              if (matchedInventory.最低采购价 !== undefined && matchedInventory.最低采购价 !== null) {
                comparePrice = matchedInventory.最低采购价;
              } else if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
                comparePrice = matchedInventory.最近采购价;
              } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
                comparePrice = matchedInventory.成本单价;
              }
            } else {
              if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
                comparePrice = matchedInventory.最近采购价;
              } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
                comparePrice = matchedInventory.成本单价;
              }
            }

            if (comparePrice === undefined || comparePrice === null) {
              matchedInventory = {
                ...matchedInventory,
                对比结果: '无采购价信息',
              };
            } else {
              const diff = comparePrice - supplierPrice;
              matchedInventory = {
                ...matchedInventory,
                对比结果: diff > 0 ? '价格优势' : diff < 0 ? '价格偏高' : '价格相同',
              };
            }
          }
        } else {
          // 无匹配数据
          matchedInventory = {
            SKU: '',
            商品名称: '',
            规格: '',
            覆盖门店数: 0,
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

      // 根据筛选条件过滤数据
      let filteredData = exportAlignedData;
      if (exportFilter.length > 0) {
        filteredData = exportAlignedData.filter(item => {
          const result = item.inventory?.对比结果 || '无匹配数据';
          return exportFilter.includes(result);
        });
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
          const value = item.inventory ? ((item.inventory as any)[key]) : '';
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

  // 当选择的供应商编码或搜索条件变化时，重新加载数据
  useEffect(() => {
    if (selectedSupplierCodes.length > 0) {
      loadLeftData();
    } else {
      setLeftData([]);
      setLeftTotal(0);
      setRightData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftCurrentPage, leftPageSize, leftSearchText, selectedSupplierCodes]);

  // 当库存类型变化时，重新加载库存汇总数据
  useEffect(() => {
    if (leftData && leftData.length > 0) {
      loadRightData();
    } else {
      // 如果没有供应商报价数据，清空库存汇总
      setRightData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType, storeNameFilter]);

  // 初始化加载仓库优先级列表（如果当前是仓店维度）
  useEffect(() => {
    if (inventoryType === '仓店') {
      loadWarehousePriorities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]);

  // 当筛选条件变化时，加载所有数据并重置分页
  useEffect(() => {
    if (comparisonResultFilter.length > 0) {
      loadAllLeftData();
      setLeftCurrentPage(1); // 重置到第一页
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonResultFilter]);

  // 数据加载完成后重新计算表格高度
  useEffect(() => {
    const timer = setTimeout(() => {
      if (leftTableContainerRef.current) {
        const containerHeight = leftTableContainerRef.current.clientHeight;
        const calculatedHeight = containerHeight - 57 - 32 - 64;
        setLeftTableHeight(Math.max(300, calculatedHeight));
      }
      if (rightTableContainerRef.current) {
        const containerHeight = rightTableContainerRef.current.clientHeight;
        const calculatedHeight = containerHeight - 57 - 32 - 64;
        setRightTableHeight(Math.max(300, calculatedHeight));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [leftData, rightData, leftLoading, rightLoading]);

  // 改进的同步滚动：使用 requestAnimationFrame 确保更平滑和准确
  useEffect(() => {
    const leftTable = leftTableContainerRef.current?.querySelector('.ant-table-body');
    const rightTable = rightTableContainerRef.current?.querySelector('.ant-table-body');

    if (!leftTable || !rightTable) return;

    let rafId: number | null = null;

    const handleLeftScroll = () => {
      if (!isScrolling.current) {
        isScrolling.current = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          (rightTable as HTMLElement).scrollTop = (leftTable as HTMLElement).scrollTop;
          setTimeout(() => {
            isScrolling.current = false;
          }, 16);
        });
      }
    };

    const handleRightScroll = () => {
      if (!isScrolling.current) {
        isScrolling.current = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          (leftTable as HTMLElement).scrollTop = (rightTable as HTMLElement).scrollTop;
          setTimeout(() => {
            isScrolling.current = false;
          }, 16);
        });
      }
    };

    leftTable.addEventListener('scroll', handleLeftScroll, { passive: true });
    rightTable.addEventListener('scroll', handleRightScroll, { passive: true });

    return () => {
      leftTable.removeEventListener('scroll', handleLeftScroll);
      rightTable.removeEventListener('scroll', handleRightScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [leftData, rightData]);

  // 计算表格高度
  useEffect(() => {
    const updateTableHeights = () => {
      // 使用setTimeout确保DOM已渲染
      setTimeout(() => {
        if (leftTableContainerRef.current) {
          const containerHeight = leftTableContainerRef.current.clientHeight;
          // 减去Card header (约57px) 和 padding (32px) 和 pagination (约64px)
          const calculatedHeight = containerHeight - 57 - 32 - 64;
          setLeftTableHeight(Math.max(300, calculatedHeight));
        }
        if (rightTableContainerRef.current) {
          const containerHeight = rightTableContainerRef.current.clientHeight;
          const calculatedHeight = containerHeight - 57 - 32 - 64;
          setRightTableHeight(Math.max(300, calculatedHeight));
        }
      }, 100);
    };

    updateTableHeights();

    // 使用ResizeObserver监听容器大小变化
    const leftObserver = leftTableContainerRef.current
      ? new ResizeObserver(updateTableHeights)
      : null;
    const rightObserver = rightTableContainerRef.current
      ? new ResizeObserver(updateTableHeights)
      : null;

    if (leftObserver && leftTableContainerRef.current) {
      leftObserver.observe(leftTableContainerRef.current);
    }
    if (rightObserver && rightTableContainerRef.current) {
      rightObserver.observe(rightTableContainerRef.current);
    }

    window.addEventListener('resize', updateTableHeights);

    return () => {
      window.removeEventListener('resize', updateTableHeights);
      if (leftObserver) leftObserver.disconnect();
      if (rightObserver) rightObserver.disconnect();
    };
  }, []);

  // 获取当前页的供应商报价数据
  // 注意：leftData 已经是 API 返回的当前页数据，不需要再次切片
  const paginatedLeftData = useMemo(() => {
    return leftData;
  }, [leftData]);

  // 根据是否有筛选条件决定使用哪些数据
  // 如果有筛选条件，使用所有数据；否则使用当前页数据
  const dataForAlignment = useMemo(() => {
    return comparisonResultFilter.length > 0 ? allLeftData : paginatedLeftData;
  }, [comparisonResultFilter.length > 0 ? allLeftData : paginatedLeftData, comparisonResultFilter.length]);

  // 创建对齐的数据结构：以供应商报价为主，为每条报价找到匹配的库存汇总
  const alignedData = useMemo(() => {
    // 为每条供应商报价找到匹配的库存汇总
    return dataForAlignment.map((quotation) => {
      // 找到匹配的库存汇总（UPC包含最小销售规格UPC商品条码）
      let matchedInventory: InventorySummary | null = null;

      if (quotation.最小销售规格UPC商品条码) {
        matchedInventory = rightData.find(item => {
          if (!item.UPC) return false;
          return item.UPC.includes(quotation.最小销售规格UPC商品条码!);
        }) || null;
      }

      // 如果匹配到了库存汇总，计算对比结果
      if (matchedInventory) {
        const supplierPrice = quotation.供货价格;

        // 如果供货价格为空，显示'无供货价信息'
        if (supplierPrice === undefined || supplierPrice === null) {
          matchedInventory = {
            ...matchedInventory,
            对比结果: '无供货价信息',
          };
        } else {
          // 根据类型选择对比逻辑
          let comparePrice: number | undefined;

          if (inventoryType === '全部') {
            // 全部：优先比最低采购价，为空则比最近采购价，还为空则比成本单价
            if (matchedInventory.最低采购价 !== undefined && matchedInventory.最低采购价 !== null) {
              comparePrice = matchedInventory.最低采购价;
            } else if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
              comparePrice = matchedInventory.最近采购价;
            } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
              comparePrice = matchedInventory.成本单价;
            }
          } else {
            // 仓店/城市：优先比最近采购价，为空则比成本单价
            if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
              comparePrice = matchedInventory.最近采购价;
            } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
              comparePrice = matchedInventory.成本单价;
            }
          }

          // 如果所有采购价都为空，显示'无采购价信息'
          if (comparePrice === undefined || comparePrice === null) {
            matchedInventory = {
              ...matchedInventory,
              对比结果: '无采购价信息',
            };
          } else {
            // 供货价格 < 采购价，显示'价格优势'（供应商报价更便宜）
            const diff = comparePrice - supplierPrice;
            matchedInventory = {
              ...matchedInventory,
              对比结果: diff > 0 ? '价格优势' : diff < 0 ? '价格偏高' : '价格相同',
            };
          }
        }
      }

      return {
        quotation,
        inventory: matchedInventory,
      };
    });
  }, [dataForAlignment, rightData, inventoryType]);

  // 对比结果的所有可能值
  const comparisonResultOptions = [
    { label: '价格优势', value: '价格优势', color: 'green' },
    { label: '价格偏高', value: '价格偏高', color: 'red' },
    { label: '价格相同', value: '价格相同', color: 'default' },
    { label: '无供货价信息', value: '无供货价信息', color: 'orange' },
    { label: '无采购价信息', value: '无采购价信息', color: 'orange' },
    { label: '无匹配数据', value: '无匹配数据', color: 'default' },
  ];

  // 应用对比结果筛选后的对齐数据
  const filteredAlignedData = useMemo(() => {
    if (comparisonResultFilter.length === 0) {
      return alignedData;
    }

    return alignedData.filter((item, index) => {
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
  }, [alignedData, comparisonResultFilter]);

  // 右栏对齐的数据（与左栏行数一致，没有匹配的用null占位），并应用对比结果筛选
  const alignedRightData = useMemo(() => {
    return filteredAlignedData.map(item => item.inventory || ({} as InventorySummary));
  }, [filteredAlignedData]);

  // 左栏筛选后的数据（与右栏对齐），并应用分页
  const filteredLeftData = useMemo(() => {
    const allFiltered = filteredAlignedData.map(item => item.quotation);
    // 如果有筛选条件，需要分页显示
    if (comparisonResultFilter.length > 0) {
      const start = (leftCurrentPage - 1) * leftPageSize;
      const end = start + leftPageSize;
      return allFiltered.slice(start, end);
    }
    return allFiltered;
  }, [filteredAlignedData, comparisonResultFilter.length, leftCurrentPage, leftPageSize]);

  // 右栏筛选后的数据（与左栏对齐），并应用分页
  const filteredRightData = useMemo(() => {
    const allFiltered = filteredAlignedData.map(item => item.inventory || ({} as InventorySummary));
    // 如果有筛选条件，需要分页显示
    if (comparisonResultFilter.length > 0) {
      const start = (leftCurrentPage - 1) * leftPageSize;
      const end = start + leftPageSize;
      return allFiltered.slice(start, end);
    }
    return allFiltered;
  }, [filteredAlignedData, comparisonResultFilter.length, leftCurrentPage, leftPageSize]);

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          /* 确保高亮样式优先级高于 hover 样式 */
          .ant-table-tbody > tr.supplier-quotation-selected-with-match:hover > td,
          .ant-table-tbody > tr.supplier-quotation-selected-with-match > td {
            background-color: #bae7ff !important;
          }
          .ant-table-tbody > tr.supplier-quotation-selected-no-match:hover > td,
          .ant-table-tbody > tr.supplier-quotation-selected-no-match > td {
            background-color: #fff7e6 !important;
          }
          .ant-table-tbody > tr.supplier-quotation-selected-with-match:hover,
          .ant-table-tbody > tr.supplier-quotation-selected-no-match:hover {
            background-color: transparent !important;
          }
        `
      }} />
      <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 上栏：左右两栏 */}
        <Row gutter={16} style={{ flex: 1, minHeight: 0, marginBottom: 16, overflow: 'hidden' }}>
          {/* 左栏 */}
          <Col span={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
            <Card
              title="供应商报价"
              extra={
                <Space>
                  <Select
                    mode="tags"
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
                      // 只允许从下拉框选择的值（过滤掉手动输入的不存在的值）
                      const validValues = values.filter(v => allSupplierCodes.includes(v));
                      setSelectedSupplierCodes(validValues);
                      // 如果用户输入了不存在的值，清空搜索值并提示
                      if (values.length > validValues.length) {
                        setSupplierCodeSearchValue('');
                        message.warning('只能选择下拉框中的供应商编码');
                      }
                    }}
                    onSelect={(value) => {
                      setSupplierCodeSearchValue(''); // 选择后清空搜索值
                    }}
                    placeholder="选择供应商编码（可输入筛选）"
                    style={{ width: 300 }}
                    allowClear
                    showSearch
                    maxTagCount="responsive"
                    dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
                    filterOption={false} // 禁用默认过滤，使用自定义过滤
                    notFoundContent={supplierCodeSearchValue ? '未找到匹配的供应商编码' : '请输入供应商编码进行筛选'}
                  />
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={() => {
                      if (selectedSupplierCodes.length === 0) {
                        message.warning('请至少选择一个供应商编码');
                        return;
                      }
                      setLeftCurrentPage(1);
                      loadLeftData();
                    }}
                    disabled={selectedSupplierCodes.length === 0}
                  >
                    搜索
                  </Button>
                  <Search
                    placeholder="搜索商品名称、商品规格、供应商商品编码"
                    value={leftSearchText}
                    onChange={(e) => setLeftSearchText(e.target.value)}
                    onSearch={() => {
                      setLeftCurrentPage(1);
                      loadLeftData();
                    }}
                    allowClear
                    enterButton={<SearchOutlined />}
                    style={{ width: 300 }}
                  />
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
                    <Button icon={<SettingOutlined />}>列设置</Button>
                  </Popover>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={loadLeftData}
                    loading={leftLoading}
                  >
                    重置
                  </Button>
                </Space>
              }
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}
              styles={{ body: { flex: 1, overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column' } }}
            >
              <div ref={leftTableContainerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Table
                  columns={getFilteredLeftColumns()}
                  dataSource={comparisonResultFilter.length > 0 ? filteredLeftData : paginatedLeftData}
                  rowKey={(record, index) => `${record.序号 || record.供应商编码 || record.供应商商品编码 || index}`}
                  loading={leftLoading}
                  scroll={{ x: 'max-content', y: leftTableHeight }}
                  pagination={{
                    current: leftCurrentPage,
                    pageSize: leftPageSize,
                    total: leftTotal,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                    onChange: (page, size) => {
                      setLeftCurrentPage(page);
                      if (size) setLeftPageSize(size);
                    },
                    onShowSizeChange: (current, size) => {
                      setLeftPageSize(size);
                      setLeftCurrentPage(1);
                    },
                  }}
                  onRow={(record, index) => {
                    const rowIndex = index ?? -1;
                    // 判断当前行是否被选中：使用严格的匹配条件
                    let isSelected = false;
                    if (selectedLeftRecord) {
                      // 如果都有序号，优先使用序号匹配
                      if (selectedLeftRecord.序号 && record.序号) {
                        isSelected = selectedLeftRecord.序号 === record.序号;
                      } else {
                        // 否则使用供应商编码和供应商商品编码的组合匹配（必须所有字段都存在且匹配）
                        isSelected = !!(
                          selectedLeftRecord.供应商编码 &&
                          record.供应商编码 &&
                          selectedLeftRecord.供应商商品编码 &&
                          record.供应商商品编码 &&
                          selectedLeftRecord.供应商编码 === record.供应商编码 &&
                          selectedLeftRecord.供应商商品编码 === record.供应商商品编码
                        );
                      }
                    }

                    // 使用筛选后的数据或原始数据来判断匹配
                    const currentAlignedData = comparisonResultFilter.length > 0 ? filteredAlignedData : alignedData;
                    const currentLeftData = comparisonResultFilter.length > 0 ? filteredLeftData : paginatedLeftData;

                    // 找到当前记录在对齐数据中的索引
                    const dataIndex = currentAlignedData.findIndex(item =>
                      item.quotation.序号 === record.序号 ||
                      (item.quotation.供应商编码 === record.供应商编码 &&
                        item.quotation.供应商商品编码 === record.供应商商品编码)
                    );

                    const hasMatch = dataIndex >= 0 && currentAlignedData[dataIndex]?.inventory !== null &&
                      Object.keys(currentAlignedData[dataIndex]?.inventory || {}).length > 0;

                    return {
                      onClick: (e) => handleLeftRowClick(record, e),
                      className: isSelected
                        ? (hasMatch ? 'supplier-quotation-selected-with-match' : 'supplier-quotation-selected-no-match')
                        : undefined,
                      style: {
                        cursor: 'pointer',
                        backgroundColor: isSelected
                          ? (hasMatch ? '#bae7ff' : '#fff7e6') // 有匹配用蓝色，无匹配用黄色
                          : undefined,
                        borderLeft: isSelected ? '4px solid #1890ff' : undefined,
                        fontWeight: isSelected ? 'bold' : 'normal',
                      },
                    };
                  }}
                  style={{ flex: 1, overflow: 'hidden' }}
                />
              </div>
            </Card>
          </Col>

          {/* 右栏 */}
          <Col span={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
            <Card
              title="库存汇总"
              extra={
                <Space>
                  <Select
                    mode="multiple"
                    placeholder="筛选对比结果"
                    value={comparisonResultFilter}
                    onChange={setComparisonResultFilter}
                    style={{ minWidth: 200 }}
                    maxTagCount="responsive"
                    allowClear
                    options={comparisonResultOptions.map(opt => ({
                      label: (
                        <Space>
                          <Tag color={opt.color}>{opt.label}</Tag>
                        </Space>
                      ),
                      value: opt.value,
                    }))}
                  />
                  {inventoryType === '仓店' && (
                    <Select
                      mode="multiple"
                      placeholder="筛选门店/仓名称"
                      value={storeNameFilter}
                      onChange={(values) => {
                        setStoreNameFilter(values);
                        // 延迟加载，避免频繁请求
                        setTimeout(() => {
                          loadRightData();
                        }, 300);
                      }}
                      style={{ minWidth: 200 }}
                      maxTagCount="responsive"
                      allowClear
                      options={warehousePriorities.map(name => ({
                        label: name,
                        value: name,
                      }))}
                      loading={warehousePriorities.length === 0}
                    />
                  )}
                  <Segmented
                    options={['全部', '仓店', '城市']}
                    value={inventoryType}
                    onChange={(value) => handleInventoryTypeChange(value as '全部' | '仓店' | '城市')}
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
                  >
                    导出数据
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      loadRightData();
                    }}
                    loading={rightLoading}
                  >
                    重置
                  </Button>
                </Space>
              }
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}
              styles={{ body: { flex: 1, overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column' } }}
            >
              <div ref={rightTableContainerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Table
                  columns={getFilteredRightColumns()}
                  dataSource={comparisonResultFilter.length > 0 ? filteredRightData : alignedRightData}
                  rowKey={(record, index) => `${record.SKU || record.商品名称 || index || Math.random()}`}
                  loading={rightLoading}
                  scroll={{ x: 'max-content', y: rightTableHeight }}
                  pagination={false}
                  onRow={(record, index) => {
                    const rowIndex = index ?? -1;
                    // 使用筛选后的数据
                    const currentAlignedData = comparisonResultFilter.length > 0 ? filteredAlignedData : alignedData;
                    const currentLeftData = comparisonResultFilter.length > 0 ? filteredLeftData : paginatedLeftData;

                    // 由于右栏数据与左栏数据是对齐的，直接使用相同的索引
                    // 找到对应的左栏数据
                    const leftRecord = rowIndex >= 0 && rowIndex < currentLeftData.length
                      ? currentLeftData[rowIndex]
                      : null;

                    // 检查当前行是否被选中（通过对应的左栏数据判断，使用严格的匹配条件）
                    let isSelected = false;
                    if (selectedLeftRecord && leftRecord) {
                      // 如果都有序号，优先使用序号匹配
                      if (selectedLeftRecord.序号 && leftRecord.序号) {
                        isSelected = selectedLeftRecord.序号 === leftRecord.序号;
                      } else {
                        // 否则使用供应商编码和供应商商品编码的组合匹配（必须所有字段都存在且匹配）
                        isSelected = !!(
                          selectedLeftRecord.供应商编码 &&
                          leftRecord.供应商编码 &&
                          selectedLeftRecord.供应商商品编码 &&
                          leftRecord.供应商商品编码 &&
                          selectedLeftRecord.供应商编码 === leftRecord.供应商编码 &&
                          selectedLeftRecord.供应商商品编码 === leftRecord.供应商商品编码
                        );
                      }
                    }

                    // 找到对应的对齐数据项
                    const alignedItem = rowIndex >= 0 && rowIndex < currentAlignedData.length
                      ? currentAlignedData[rowIndex]
                      : null;

                    const hasMatch = alignedItem && alignedItem.inventory !== null &&
                      Object.keys(alignedItem.inventory || {}).length > 0;

                    return {
                      className: isSelected
                        ? (hasMatch ? 'supplier-quotation-selected-with-match' : 'supplier-quotation-selected-no-match')
                        : undefined,
                      style: {
                        backgroundColor: isSelected
                          ? (hasMatch ? '#bae7ff' : '#fff7e6') // 有匹配用蓝色，无匹配用黄色
                          : undefined,
                        borderLeft: isSelected ? '4px solid #1890ff' : undefined,
                        fontWeight: isSelected ? 'bold' : 'normal',
                      },
                    };
                  }}
                  style={{ flex: 1, overflow: 'hidden' }}
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* 下栏 */}
        <Card
          title="SKU绑定信息"
          extra={
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveSkuBindings}
              disabled={!selectedLeftRecord || bottomData.length === 0}
            >
              保存
            </Button>
          }
          style={{ height: 300, flexShrink: 0, overflow: 'hidden' }}
          styles={{ body: { overflow: 'hidden', padding: 16 } }}
        >
          {selectedLeftRecord ? (
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
                      // 使用稳定的唯一标识符作为key，而不是index
                      const uniqueKey = `${record.供应商编码}_${record.供应商商品编码}`;
                      // 使用受控组件，但不使用key属性，避免重新创建组件
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
                            // 确保失焦时也保存值
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
                ]}
                dataSource={bottomData}
                rowKey={(record) => {
                  // 使用稳定的唯一标识符，避免重新创建行导致输入框失去焦点
                  return `${record.供应商编码}_${record.供应商商品编码}`;
                }}
                loading={bottomLoading}
                pagination={false}
                scroll={{ x: 'max-content', y: 200 }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              请先选择左栏数据
            </div>
          )}
        </Card>
      </div>

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

