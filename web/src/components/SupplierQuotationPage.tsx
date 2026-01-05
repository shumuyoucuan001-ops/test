"use client";

import { InventorySummary, SupplierQuotation, supplierQuotationApi, SupplierSkuBinding } from '@/lib/api';
import { ReloadOutlined, SaveOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Popover,
  Row,
  Segmented,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useEffect, useMemo, useRef, useState } from 'react';
import ColumnSettings from './ColumnSettings';

const { Search } = Input;

export default function SupplierQuotationPage() {
  // 左栏数据
  const [leftData, setLeftData] = useState<SupplierQuotation[]>([]);
  const [leftLoading, setLeftLoading] = useState(false);
  const [leftTotal, setLeftTotal] = useState(0);
  const [leftCurrentPage, setLeftCurrentPage] = useState(1);
  const [leftPageSize, setLeftPageSize] = useState(20);
  const [leftSearchText, setLeftSearchText] = useState('');

  // 右栏数据
  const [rightData, setRightData] = useState<InventorySummary[]>([]);
  const [rightLoading, setRightLoading] = useState(false);
  const [inventoryType, setInventoryType] = useState<'全部' | '仓店' | '城市'>('全部');
  const [selectedLeftRecord, setSelectedLeftRecord] = useState<SupplierQuotation | null>(null);
  const [rightCurrentPage, setRightCurrentPage] = useState(1);
  const [rightPageSize, setRightPageSize] = useState(20);

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

  // 左栏默认显示的字段
  const defaultVisibleColumns = ['序号', '供应商编码', '商品名称', '商品规格', '供货价格'];

  // 右栏默认显示的字段（全部类型）
  const defaultRightVisibleColumns = ['SKU', '商品名称', '规格', '覆盖门店数', '总部零售价', '最近采购价', '最低采购价', '成本单价', '对比结果'];

  // 右栏默认显示的字段（仓店/城市类型）
  const defaultRightVisibleColumnsStoreCity = ['SKU', '商品名称', '规格', '覆盖门店数', '总部零售价', '最近采购价', '成本单价', '对比结果'];

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
      }
    } else {
      // 默认隐藏非默认显示的字段
      const allColumns = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
      const hidden = allColumns.filter(key => !defaultVisibleColumns.includes(key));
      setLeftHiddenColumns(new Set(hidden));
    }

    if (savedOrder) {
      try {
        setLeftColumnOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error('Failed to parse column order:', e);
      }
    }
  }, []);

  // 初始化右栏列设置
  useEffect(() => {
    const savedHidden = localStorage.getItem('supplier-quotation-right-hidden-columns');
    const savedOrder = localStorage.getItem('supplier-quotation-right-column-order');

    if (savedHidden) {
      try {
        const hidden = JSON.parse(savedHidden);
        setRightHiddenColumns(new Set(hidden));
      } catch (e) {
        console.error('Failed to parse hidden columns:', e);
      }
    } else {
      // 默认隐藏非默认显示的字段
      const allColumns = getRightColumns().map(col => col.key as string).filter(Boolean);
      const defaultVisible = inventoryType === '全部'
        ? ['SKU', '商品名称', '规格', '覆盖门店数', '总部零售价', '最近采购价', '最低采购价', '成本单价', '对比结果']
        : ['SKU', '商品名称', '规格', '覆盖门店数', '总部零售价', '最近采购价', '成本单价', '对比结果'];
      const hidden = allColumns.filter(key => !defaultVisible.includes(key));
      setRightHiddenColumns(new Set(hidden));
    }

    if (savedOrder) {
      try {
        setRightColumnOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error('Failed to parse column order:', e);
      }
    }
  }, [inventoryType]);

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

  // 获取左栏所有列定义
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

  // 获取右栏列定义
  const getRightColumns = (): ColumnType<InventorySummary>[] => {
    const columns: ColumnType<InventorySummary>[] = [
      {
        title: 'SKU',
        dataIndex: 'SKU',
        key: 'SKU',
        width: 120,
        fixed: 'left' as const,
      },
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
        title: '最近采购价',
        dataIndex: '最近采购价',
        key: '最近采购价',
        width: 120,
        render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
      },
    ];

    // 全部类型时显示最低采购价
    if (inventoryType === '全部') {
      columns.push({
        title: '最低采购价',
        dataIndex: '最低采购价',
        key: '最低采购价',
        width: 120,
        render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
      });
    }

    // 所有类型都显示成本单价
    columns.push({
      title: '成本单价',
      dataIndex: '成本单价',
      key: '成本单价',
      width: 120,
      render: (text: number) => text ? `¥${Number(text).toFixed(2)}` : '-',
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

    return columns;
  };

  // 加载左栏数据
  const loadLeftData = async () => {
    setLeftLoading(true);
    try {
      const result = await supplierQuotationApi.getAll({
        page: leftCurrentPage,
        limit: leftPageSize,
        search: leftSearchText || undefined,
      });
      setLeftData(result.data || []);
      setLeftTotal(result.total || 0);

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

  // 加载右栏数据
  const loadRightData = async () => {
    setRightLoading(true);
    try {
      // 获取所有库存汇总数据（不传upc参数，获取全部）
      const result = await supplierQuotationApi.getInventorySummary({
        type: inventoryType,
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
  const handleLeftRowClick = (record: SupplierQuotation) => {
    setSelectedLeftRecord(record);
    // 注意：库存汇总数据已经基于所有供应商报价数据自动显示，不需要重新加载
    // 只需要加载下栏数据
    loadBottomData();
  };

  // 右栏筛选变化
  const handleInventoryTypeChange = (value: '全部' | '仓店' | '城市') => {
    setInventoryType(value);
    // 直接加载库存汇总数据，基于所有供应商报价数据
    loadRightData();
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

  // 初始化加载
  useEffect(() => {
    loadLeftData();
  }, [leftCurrentPage, leftPageSize, leftSearchText]);

  // 当库存类型变化时，重新加载库存汇总数据
  useEffect(() => {
    if (leftData && leftData.length > 0) {
      loadRightData();
    } else {
      // 如果没有供应商报价数据，清空库存汇总
      setRightData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryType]);

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

  // 同步滚动：监听左表格滚动
  useEffect(() => {
    const leftTable = leftTableContainerRef.current?.querySelector('.ant-table-body');
    const rightTable = rightTableContainerRef.current?.querySelector('.ant-table-body');

    if (!leftTable || !rightTable) return;

    const handleLeftScroll = (e: Event) => {
      if (!isScrolling.current) {
        isScrolling.current = true;
        (rightTable as HTMLElement).scrollTop = (e.target as HTMLElement).scrollTop;
        setTimeout(() => {
          isScrolling.current = false;
        }, 50);
      }
    };

    leftTable.addEventListener('scroll', handleLeftScroll);
    return () => {
      leftTable.removeEventListener('scroll', handleLeftScroll);
    };
  }, [leftData, rightData]);

  // 同步滚动：监听右表格滚动
  useEffect(() => {
    const leftTable = leftTableContainerRef.current?.querySelector('.ant-table-body');
    const rightTable = rightTableContainerRef.current?.querySelector('.ant-table-body');

    if (!leftTable || !rightTable) return;

    const handleRightScroll = (e: Event) => {
      if (!isScrolling.current) {
        isScrolling.current = true;
        (leftTable as HTMLElement).scrollTop = (e.target as HTMLElement).scrollTop;
        setTimeout(() => {
          isScrolling.current = false;
        }, 50);
      }
    };

    rightTable.addEventListener('scroll', handleRightScroll);
    return () => {
      rightTable.removeEventListener('scroll', handleRightScroll);
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
  const paginatedLeftData = useMemo(() => {
    const start = (leftCurrentPage - 1) * leftPageSize;
    const end = start + leftPageSize;
    return leftData.slice(start, end);
  }, [leftData, leftCurrentPage, leftPageSize]);

  // 创建对齐的数据结构：以供应商报价为主，为每条报价找到匹配的库存汇总
  const alignedData = useMemo(() => {
    // 为每条供应商报价找到匹配的库存汇总
    return paginatedLeftData.map((quotation) => {
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
  }, [paginatedLeftData, rightData, inventoryType]);

  // 右栏对齐的数据（与左栏行数一致，没有匹配的用null占位）
  const alignedRightData = useMemo(() => {
    return alignedData.map(item => item.inventory || ({} as InventorySummary));
  }, [alignedData]);

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 上栏：左右两栏 */}
      <Row gutter={16} style={{ flex: 1, minHeight: 0, marginBottom: 16, overflow: 'hidden' }}>
        {/* 左栏 */}
        <Col span={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
          <Card
            title="供应商报价"
            extra={
              <Space>
                <Search
                  placeholder="搜索供应商编码、商品名称、商品规格、供应商商品编码"
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
                  刷新
                </Button>
              </Space>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}
            styles={{ body: { flex: 1, overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column' } }}
          >
            <div ref={leftTableContainerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table
                columns={getFilteredLeftColumns()}
                dataSource={paginatedLeftData}
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
                onRow={(record) => ({
                  onClick: () => handleLeftRowClick(record),
                  style: {
                    cursor: 'pointer',
                    backgroundColor: selectedLeftRecord?.序号 === record.序号 ? '#e6f7ff' : undefined,
                  },
                })}
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
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    loadRightData();
                  }}
                  loading={rightLoading}
                >
                  刷新
                </Button>
              </Space>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}
            styles={{ body: { flex: 1, overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column' } }}
          >
            <div ref={rightTableContainerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table
                columns={getFilteredRightColumns()}
                dataSource={alignedRightData}
                rowKey={(record, index) => `${record.SKU || record.商品名称 || index || Math.random()}`}
                loading={rightLoading}
                scroll={{ x: 'max-content', y: rightTableHeight }}
                pagination={false}
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
                    return (
                      <Input
                        key={uniqueKey}
                        value={editingSkus[uniqueKey] !== undefined ? editingSkus[uniqueKey] : (record.SKU || '')}
                        onChange={(e) => {
                          setEditingSkus({
                            ...editingSkus,
                            [uniqueKey]: e.target.value,
                          });
                        }}
                        placeholder="请输入SKU"
                      />
                    );
                  },
                },
              ]}
              dataSource={bottomData}
              rowKey={(record) => `${record.供应商编码}_${record.供应商商品编码}_${record.SKU || Math.random()}`}
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
  );
}

