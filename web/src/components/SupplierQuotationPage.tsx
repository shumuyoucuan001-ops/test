"use client";

import { InventorySummary, SupplierQuotation, supplierQuotationApi, SupplierSkuBinding } from '@/lib/api';
import { DownloadOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
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

  // 用于跟踪正在进行的 loadRightData 请求，避免竞态条件
  const loadRightDataRequestIdRef = useRef<number>(0);

  // 用于跟踪是否正在手动加载数据，避免 useEffect 重复触发
  const isLoadingManuallyRef = useRef<boolean>(false);

  // 右栏列设置相关状态
  const [rightHiddenColumns, setRightHiddenColumns] = useState<Set<string>>(new Set());
  const [rightColumnOrder, setRightColumnOrder] = useState<string[]>([]);
  const [rightColumnSettingsOpen, setRightColumnSettingsOpen] = useState(false);

  // 右栏搜索
  const [rightSearchText, setRightSearchText] = useState('');

  // 导出相关状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState<string[]>([]);

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
                      // 重新加载绑定标记和数据
                      const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                      if (rightAllData.length > 0 && dataSource.length > 0) {
                        await loadQuotationBindingFlags(rightAllData, dataSource);
                        // 重新加载左侧数据以更新计算后供货价格
                        await loadLeftData();
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
                        // 重新加载绑定标记和数据
                        const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                        if (rightAllData.length > 0 && dataSource.length > 0) {
                          await loadQuotationBindingFlags(rightAllData, dataSource);
                          // 重新加载左侧数据以更新计算后供货价格
                          await loadLeftData();
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
                <span style={{ cursor: 'pointer', color: '#000', display: 'inline-flex', alignItems: 'center' }}>
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
      render: (text: string, record: InventorySummary) => {
        const isEditing = text ? editingSkuQuotation === text : false;
        const currentSkuInput = text ? (skuBindingInput[text] || '') : '';

        // 找到匹配的供应商报价（通过UPC条码和SKU）
        let matchedQuotation: SupplierQuotation | null = null;
        let supplierCode: string | undefined = undefined;
        let supplierProductCode: string | undefined = undefined;

        if (text && upcToSkuMap) {
          // 通过SKU找到对应的UPC条码
          Object.keys(upcToSkuMap).forEach(upc => {
            if (upcToSkuMap[upc].includes(text)) {
              // 找到匹配的供应商报价（优先使用allLeftData，如果没有则使用leftData）
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

        // 检查是否有SKU绑定
        const bindingKey = supplierCode && supplierProductCode ? `${supplierCode}_${supplierProductCode}` : null;
        const boundSku = bindingKey ? skuBindingMap[bindingKey] : null;
        const hasBinding = text ? skuBindingFlags[text] : false;

        // 显示绑定的SKU，如果没有绑定则显示原SKU
        const displaySku = boundSku || text;

        // 如果没有找到匹配的供应商报价，不显示弹框
        if (!matchedQuotation || !supplierCode || !supplierProductCode) {
          // 即使没有匹配的供应商报价，也要检查是否有绑定并显示
          if (hasBinding && boundSku) {
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {boundSku}
                <Tag color="green" style={{ margin: 0 }}>绑</Tag>
              </span>
            );
          }
          return <span>{text || '-'}</span>;
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
                if (text) {
                  setSkuBindingInput({
                    ...skuBindingInput,
                    [text]: e.target.value,
                  });
                }
              }}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button
                size="small"
                danger
                onClick={async () => {
                  if (!text || !supplierCode || !supplierProductCode) {
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
                    // 清空本地输入
                    if (text) {
                      const updatedInput = { ...skuBindingInput };
                      updatedInput[text] = '';
                      setSkuBindingInput(updatedInput);
                    }
                    setEditingSkuQuotation(null);
                    // 重新加载数据
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
                    if (!text || !supplierCode || !supplierProductCode) {
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
                      setEditingSkuQuotation(null);
                      // 重新加载数据
                      const dataSource = allLeftData.length > 0 ? allLeftData : leftData;
                      if (rightAllData.length > 0 && dataSource.length > 0) {
                        await loadQuotationBindingFlags(rightAllData, dataSource);
                        // 重新加载SKU绑定数据
                        await loadSkuBindingMap(dataSource);
                        // 如果当前选中的是这条记录，重新加载下栏数据
                        if (selectedLeftRecord &&
                          selectedLeftRecord.供应商编码 === supplierCode &&
                          selectedLeftRecord.供应商商品编码 === supplierProductCode) {
                          await loadBottomData();
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

        return (
          <Popover
            content={skuBindingContent}
            title="手动绑定SKU"
            trigger="click"
            open={isEditing}
            onOpenChange={(open) => {
              if (open) {
                setEditingSkuQuotation(text || null);
                // 加载当前SKU绑定数据
                if (text && supplierCode && supplierProductCode) {
                  // 查询当前绑定的SKU
                  supplierQuotationApi.getSkuBindings({
                    supplierCode: supplierCode,
                    supplierProductCode: supplierProductCode,
                  }).then(result => {
                    if (result && result.length > 0 && result[0].SKU) {
                      setSkuBindingInput(prev => ({
                        ...prev,
                        [text]: result[0].SKU || '',
                      }));
                    } else {
                      setSkuBindingInput(prev => ({
                        ...prev,
                        [text]: '',
                      }));
                    }
                  }).catch(error => {
                    console.error('加载SKU绑定数据失败:', error);
                    setSkuBindingInput(prev => ({
                      ...prev,
                      [text]: '',
                    }));
                  });
                }
              } else {
                setEditingSkuQuotation(null);
              }
            }}
            placement="top"
          >
            <span style={{ cursor: 'pointer', color: '#000', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {displaySku || '-'}
              {hasBinding && (
                <Tag color="green" style={{ margin: 0 }}>绑</Tag>
              )}
            </span>
          </Popover>
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

  // 加载所有供应商报价数据（不分页，用于筛选）
  const loadAllLeftData = async (supplierCodesOverride?: string[]) => {
    // 使用传入的参数或当前状态
    const codesToUse = supplierCodesOverride || selectedSupplierCodes;

    // 如果没有选择供应商编码，不加载数据
    if (codesToUse.length === 0) {
      setAllLeftData([]);
      return;
    }

    try {
      // 获取所有数据，使用一个很大的 limit 值
      const searchParams = buildSearchParams();
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

      // 如果有筛选条件，需要加载所有数据用于筛选
      if (comparisonResultFilter.length > 0) {
        await loadAllLeftData(codesToUse);
      }

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
    cityFilterOverride?: string
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

      let result = await supplierQuotationApi.getInventorySummary({
        type: inventoryType,
        storeNames: storeNamesParam,
      });

      // 检查是否仍然是最新请求
      if (currentRequestId !== loadRightDataRequestIdRef.current) {
        setRightLoading(false);
        return;
      }

      // 如果有SKU搜索条件，在前端过滤
      if (inventorySkuSearch.trim()) {
        const searchSku = inventorySkuSearch.trim().toLowerCase();
        result = result.filter(item =>
          item.SKU && item.SKU.toLowerCase().includes(searchSku)
        );
      }

      // 检查是否仍然是最新请求
      if (currentRequestId !== loadRightDataRequestIdRef.current) {
        setRightLoading(false);
        return;
      }

      // 设置总数（在计算对比结果之前）
      setRightTotal(result.length);

      // 第一步：从供应商报价中提取所有UPC条码，批量获取对应的SKU编码
      const upcCodes = (quotationDataToUse || [])
        .map(q => q.最小销售规格UPC商品条码)
        .filter((upc): upc is string => !!upc && upc.trim() !== '');

      // UPC -> SKU编码数组的映射
      let upcToSkuMapLocal: Record<string, string[]> = {};

      if (upcCodes.length > 0) {
        try {
          upcToSkuMapLocal = await supplierQuotationApi.getSkuCodesByUpcCodes({
            upcCodes: [...new Set(upcCodes)], // 去重
          });

          // 检查是否仍然是最新请求
          if (currentRequestId !== loadRightDataRequestIdRef.current) {
            setRightLoading(false);
            return;
          }

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
      } else {
        // 检查是否仍然是最新请求
        if (currentRequestId !== loadRightDataRequestIdRef.current) {
          setRightLoading(false);
          return;
        }
        setUpcToSkuMap({});
      }

      // 第二步：批量加载报价比例数据（用于调整供货价格）
      // 为所有匹配的供应商报价加载比例数据
      const ratioPromises: Promise<{ sku: string; ratio: { supplierRatio?: number; qianniuhuaRatio?: number } }>[] = [];
      const skuToQuotationMap: Record<string, { supplierCode: string; upcCode: string }> = {};

      result.forEach(item => {
        if (item.SKU) {
          const matchedUpcCodes: string[] = [];
          Object.entries(upcToSkuMapLocal).forEach(([upc, skuCodes]) => {
            if (skuCodes.includes(item.SKU!)) {
              matchedUpcCodes.push(upc);
            }
          });

          const matchedQuotations = quotationDataToUse?.filter(quotation => {
            if (!quotation.最小销售规格UPC商品条码) return false;
            return matchedUpcCodes.includes(quotation.最小销售规格UPC商品条码);
          }) || [];

          if (matchedQuotations.length > 0) {
            const matchedQuotation = matchedQuotations[0];
            if (matchedQuotation.供应商编码 && matchedQuotation.最小销售规格UPC商品条码) {
              skuToQuotationMap[item.SKU] = {
                supplierCode: matchedQuotation.供应商编码,
                upcCode: matchedQuotation.最小销售规格UPC商品条码,
              };
              // 总是重新加载比例数据，确保使用最新的数据
              ratioPromises.push(
                supplierQuotationApi.getPriceRatios({
                  supplierCode: matchedQuotation.供应商编码,
                  upcCode: matchedQuotation.最小销售规格UPC商品条码,
                }).then(result => {
                  // 更新状态
                  if (result) {
                    setRatioData(prev => ({
                      ...prev,
                      [item.SKU!]: {
                        supplierRatio: result.报价比例_供应商商品,
                        qianniuhuaRatio: result.报价比例_牵牛花商品,
                      },
                    }));
                  } else {
                    setRatioData(prev => ({
                      ...prev,
                      [item.SKU!]: {
                        supplierRatio: undefined,
                        qianniuhuaRatio: undefined,
                      },
                    }));
                  }
                  // 返回比例数据供后续使用
                  return {
                    sku: item.SKU!,
                    ratio: result ? {
                      supplierRatio: result.报价比例_供应商商品,
                      qianniuhuaRatio: result.报价比例_牵牛花商品,
                    } : { supplierRatio: undefined, qianniuhuaRatio: undefined },
                  };
                }).catch(error => {
                  console.error('加载报价比例失败:', error);
                  setRatioData(prev => ({
                    ...prev,
                    [item.SKU!]: {
                      supplierRatio: undefined,
                      qianniuhuaRatio: undefined,
                    },
                  }));
                  return {
                    sku: item.SKU!,
                    ratio: { supplierRatio: undefined, qianniuhuaRatio: undefined },
                  };
                })
              );
            }
          }
        }
      });

      // 等待所有比例数据加载完成，并构建比例数据映射
      const loadedRatioData: Record<string, { supplierRatio?: number; qianniuhuaRatio?: number }> = {};
      if (ratioPromises.length > 0) {
        const ratioResults = await Promise.all(ratioPromises);
        ratioResults.forEach(({ sku, ratio }) => {
          loadedRatioData[sku] = ratio;
        });
      }

      // 第三步：计算对比结果：为每个库存汇总项找到匹配的供应商报价项
      // 现在使用SKU编码进行匹配
      const dataWithComparison = result.map(item => {
        // 如果没有供应商报价数据，直接返回库存汇总数据（不显示对比结果）
        if (!quotationDataToUse || quotationDataToUse.length === 0) {
          return item;
        }

        // 通过SKU编码匹配供应商报价
        // 1. 找到所有包含当前库存汇总SKU的UPC条码
        const matchedUpcCodes: string[] = [];
        Object.entries(upcToSkuMapLocal).forEach(([upc, skuCodes]) => {
          if (item.SKU && skuCodes.includes(item.SKU)) {
            matchedUpcCodes.push(upc);
          }
        });

        // 2. 通过匹配的UPC条码找到对应的供应商报价
        const matchedQuotations = quotationDataToUse.filter(quotation => {
          if (!quotation.最小销售规格UPC商品条码) return false;
          return matchedUpcCodes.includes(quotation.最小销售规格UPC商品条码);
        });

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

        // 根据类型选择对比逻辑
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

      // 保存所有数据（用于匹配）
      // 使用展开运算符创建新数组，确保引用变化，触发useEffect
      setRightAllData([...dataWithComparison]);

      // 查询供应商报价绑定标记（在设置rightAllData之后立即调用，确保初始加载时就能显示'转'字）
      // 使用upcToSkuMapLocal而不是状态中的upcToSkuMap，确保使用最新的映射
      if (dataWithComparison.length > 0 && quotationDataToUse && quotationDataToUse.length > 0) {
        await loadQuotationBindingFlags(dataWithComparison, quotationDataToUse, upcToSkuMapLocal);
        // 加载SKU绑定数据（使用upcToSkuMapLocal确保使用最新的映射）
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
              对比字段类型: undefined,
              差价: undefined,
            };
          } else {
            let comparePrice: number | undefined;
            let compareFieldType: string | undefined;

            if (inventoryType === '全部') {
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
              if (matchedInventory.最近采购价 !== undefined && matchedInventory.最近采购价 !== null) {
                comparePrice = matchedInventory.最近采购价;
                compareFieldType = '最近采购价';
              } else if (matchedInventory.成本单价 !== undefined && matchedInventory.成本单价 !== null) {
                comparePrice = matchedInventory.成本单价;
                compareFieldType = '成本单价';
              }
            }

            if (comparePrice === undefined || comparePrice === null) {
              matchedInventory = {
                ...matchedInventory,
                对比结果: '无采购价信息',
                对比字段类型: undefined,
                差价: undefined,
              };
            } else {
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

  // 当选择的供应商编码或搜索条件变化时，重新加载数据
  useEffect(() => {
    // 如果正在手动加载，跳过（避免重复调用）
    if (isLoadingManuallyRef.current) {
      return;
    }

    // 仓店维度必须选择门店/仓名称
    if (inventoryType === '仓店' && (!storeNameFilter || storeNameFilter.trim() === '')) {
      setLeftData([]);
      setLeftTotal(0);
      setRightData([]);
      setRightAllData([]);
      setRightTotal(0);
      setUpcToSkuMap({});
      return;
    }

    // 城市维度必须选择城市
    if (inventoryType === '城市' && (!cityFilter || cityFilter.trim() === '')) {
      setLeftData([]);
      setLeftTotal(0);
      setRightData([]);
      setRightAllData([]);
      setRightTotal(0);
      setUpcToSkuMap({});
      return;
    }

    if (selectedSupplierCodes.length > 0) {
      loadLeftData();
    } else {
      setLeftData([]);
      setLeftTotal(0);
      setRightData([]);
      setRightAllData([]);
      setRightTotal(0);
      setUpcToSkuMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftCurrentPage, leftPageSize, leftSearchText, supplierNameSearch, supplierCodeSearch, productNameSearch, selectedSupplierCodes, inventoryType, storeNameFilter, cityFilter]);

  // 当右侧分页或数据变化时，重新应用分页（不重新加载数据，只重新切片）
  // 注意：供应商名称查询逻辑已移到下面的 useEffect 中，避免重复查询

  // 移除自动搜索：当库存汇总SKU搜索条件变化时，不再自动重新过滤数据
  // 用户需要点击搜索按钮才会触发搜索

  // 当右侧分页或数据变化时，重新应用分页（不重新加载数据，只重新切片）
  useEffect(() => {
    // 只有在有数据且不在加载中时才重新切片
    if (rightAllData.length > 0 && !rightLoading) {
      const start = (rightCurrentPage - 1) * rightPageSize;
      const end = start + rightPageSize;
      const paginatedData = rightAllData.slice(start, end);
      setRightData(paginatedData);
    }
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

  // 当筛选条件变化时，加载所有数据并重置分页
  useEffect(() => {
    if (comparisonResultFilter.length > 0) {
      // 加载所有数据用于筛选（包含当前搜索条件）
      loadAllLeftData();
      setLeftCurrentPage(1); // 重置到第一页
      // 同时需要重新加载库存汇总数据，确保筛选基于所有数据
      if (selectedSupplierCodes.length > 0 && leftData.length > 0) {
        loadRightData(leftData, selectedSupplierCodes, storeNameFilter, cityFilter);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonResultFilter]);

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
  // 如果有筛选条件，使用所有数据；否则使用当前页数据
  const dataForAlignment = useMemo(() => {
    return comparisonResultFilter.length > 0 ? allLeftData : paginatedLeftData;
  }, [comparisonResultFilter.length > 0 ? allLeftData : paginatedLeftData, comparisonResultFilter.length]);

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

      // 如果匹配到了库存汇总，计算对比结果
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

  // 计算所有匹配的供应商报价数据（用于分页和显示）
  const matchedQuotations = useMemo(() => {
    const currentAlignedData = comparisonResultFilter.length > 0 ? filteredAlignedData : alignedData;
    // 只返回匹配到库存汇总的供应商报价数据
    return currentAlignedData
      .filter(item => item.inventory && Object.keys(item.inventory).length > 0)
      .map(item => item.quotation);
  }, [filteredAlignedData, alignedData, comparisonResultFilter.length]);

  // 计算所有供应商报价数据总数（用于分页）
  const matchedQuotationTotal = useMemo(() => {
    // 如果没有对比结果筛选，使用后端返回的总数（leftTotal）
    if (comparisonResultFilter.length === 0) {
      // 如果没有SKU搜索，直接使用 leftTotal（后端返回的总数）
      if (!inventorySkuSearch.trim()) {
        return leftTotal;
      }

      // 如果有SKU搜索，需要计算未匹配的库存汇总数量
      const searchSku = inventorySkuSearch.trim().toLowerCase();
      const matchedInventorySkus = new Set(
        alignedData
          .filter(item => item.inventory && Object.keys(item.inventory).length > 0)
          .map(item => item.inventory!.SKU?.toLowerCase())
          .filter(Boolean)
      );

      const unmatchedCount = rightAllData.filter(item => {
        const itemSku = item.SKU?.toLowerCase();
        return itemSku &&
          itemSku.includes(searchSku) &&
          !matchedInventorySkus.has(itemSku);
      }).length;

      return leftTotal + unmatchedCount;
    }

    // 如果有对比结果筛选，使用筛选后的数据数量
    if (inventorySkuSearch.trim()) {
      const searchSku = inventorySkuSearch.trim().toLowerCase();
      const allQuotationCount = filteredAlignedData.length;

      // 未匹配的库存汇总数量
      const matchedInventorySkus = new Set(
        filteredAlignedData
          .filter(item => item.inventory && Object.keys(item.inventory).length > 0)
          .map(item => item.inventory!.SKU?.toLowerCase())
          .filter(Boolean)
      );

      const unmatchedCount = rightAllData.filter(item => {
        const itemSku = item.SKU?.toLowerCase();
        return itemSku &&
          itemSku.includes(searchSku) &&
          !matchedInventorySkus.has(itemSku);
      }).length;

      return allQuotationCount + unmatchedCount;
    }

    // 如果有对比结果筛选但没有SKU搜索，返回筛选后的数据数量
    return filteredAlignedData.length;
  }, [leftTotal, inventorySkuSearch, rightAllData, alignedData, filteredAlignedData, comparisonResultFilter.length]);

  // 合并后的数据：将供应商报价和库存汇总数据合并，并标识数据来源
  // 注意：显示所有供应商报价数据，包括没有匹配库存汇总的数据
  // 如果用户搜索了SKU，也显示没有匹配供应商报价的库存汇总数据
  const mergedData = useMemo(() => {
    const result: Array<{
      key: string;
      dataType: 'quotation' | 'inventory';
      quotation?: SupplierQuotation;
      inventory?: InventorySummary;
      hasMatch: boolean;
    }> = [];

    const currentAlignedData = comparisonResultFilter.length > 0 ? filteredAlignedData : alignedData;

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

    // 如果用户搜索了SKU，还需要显示没有匹配供应商报价的库存汇总数据
    if (inventorySkuSearch.trim()) {
      const searchSku = inventorySkuSearch.trim().toLowerCase();
      const matchedInventorySkus = new Set(
        allQuotationData
          .filter(item => item.hasMatch)
          .map(item => item.inventory?.SKU?.toLowerCase())
          .filter(Boolean)
      );

      // 从 rightAllData 中找到未匹配的库存汇总数据
      // 注意：rightAllData 已经在 loadRightData 中进行了SKU过滤，所以这里只需要过滤未匹配的数据
      const unmatchedInventoryData = rightAllData
        .filter(item => {
          const itemSku = item.SKU?.toLowerCase();
          // 只包含未被匹配的数据（rightAllData已经经过了SKU过滤）
          return itemSku && !matchedInventorySkus.has(itemSku);
        })
        .map((item, index) => {
          // 使用SKU和索引确保key的唯一性（不使用Date.now()避免重新渲染问题）
          const uniqueKey = `inventory-only-${item.SKU || 'unknown'}-${index}`;
          return {
            key: uniqueKey,
            dataType: 'inventory' as const,
            quotation: undefined,
            inventory: {
              ...item,
              对比结果: '无匹配数据',
            },
            hasMatch: false,
          };
        });

      // 合并数据：先显示所有供应商报价数据，再显示未匹配的库存汇总数据
      // 注意：allQuotationData 已经基于当前页的数据（leftData），所以只需要对未匹配的库存汇总数据进行分页
      // 计算当前页应该显示的未匹配库存汇总数据
      const currentPageQuotationCount = allQuotationData.length;
      const remainingSpace = leftPageSize - currentPageQuotationCount;
      const paginatedUnmatchedInventory = remainingSpace > 0
        ? unmatchedInventoryData.slice(0, remainingSpace)
        : [];

      return [...allQuotationData, ...paginatedUnmatchedInventory];
    }

    // 如果没有SKU搜索，显示所有供应商报价数据（包括未匹配的）
    // 注意：allQuotationData 已经基于当前页的数据（leftData），所以不需要再次分页
    return allQuotationData;
  }, [filteredAlignedData, alignedData, comparisonResultFilter.length, leftCurrentPage, leftPageSize, inventorySkuSearch, rightAllData]);

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
            const renderedValue = col.render ? col.render(value, record.inventory, 0) : (value ?? '-');
            // 库存汇总数据使用黑色文字
            // 如果是对比结果列或SKU列，需要特殊处理
            if (col.key === '对比结果') {
              return renderedValue; // 对比结果列已经有Tag渲染，不需要再包裹
            }
            if (col.key === 'SKU') {
              return renderedValue; // SKU列已经有Popover和Tag渲染，不需要再包裹
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
                    onChange={async (values) => {
                      // 只保留在allSupplierCodes中存在的值
                      const validValues = values.filter(v => allSupplierCodes.includes(v));
                      // 如果过滤后有值被移除，提示用户
                      if (values.length > validValues.length) {
                        setSupplierCodeSearchValue('');
                        message.warning('只能选择下拉框中的供应商编码');
                      }

                      // 先标记为手动加载，避免 useEffect 重复触发
                      isLoadingManuallyRef.current = true;

                      // 选择后立即触发数据加载，直接传递新的值
                      if (validValues.length > 0) {
                        setLeftCurrentPage(1);
                        setRightCurrentPage(1);
                        // 直接传递新的值，不依赖状态更新
                        await loadLeftData(validValues, undefined, undefined, 1, leftPageSize);
                      } else {
                        // 如果没有选择，清空数据
                        setLeftData([]);
                        setLeftTotal(0);
                        setRightData([]);
                        setRightAllData([]);
                        setRightTotal(0);
                        setUpcToSkuMap({});
                        isLoadingManuallyRef.current = false;
                      }

                      // 延迟更新状态，确保数据加载完成后再更新
                      // 这样 useEffect 不会立即触发
                      setTimeout(() => {
                        setSelectedSupplierCodes(validValues);
                        // 在状态更新后再重置标志，给足够的时间让 useEffect 检查
                        setTimeout(() => {
                          isLoadingManuallyRef.current = false;
                        }, 300);
                      }, 100);
                    }}
                    onDeselect={async (value) => {
                      // 取消选择时，确保状态同步
                      const newValues = selectedSupplierCodes.filter(v => v !== value);

                      // 先标记为手动加载，避免 useEffect 重复触发
                      isLoadingManuallyRef.current = true;

                      // 如果还有选择的编码，重新加载数据，直接传递新的值
                      if (newValues.length > 0) {
                        setLeftCurrentPage(1);
                        setRightCurrentPage(1);
                        await loadLeftData(newValues, undefined, undefined, 1, leftPageSize);
                      } else {
                        // 如果没有选择，清空数据
                        setLeftData([]);
                        setLeftTotal(0);
                        setRightData([]);
                        setRightAllData([]);
                        setRightTotal(0);
                        setUpcToSkuMap({});
                        isLoadingManuallyRef.current = false;
                      }

                      // 延迟更新状态，确保数据加载完成后再更新
                      setTimeout(() => {
                        setSelectedSupplierCodes(newValues);
                        // 在状态更新后再重置标志
                        setTimeout(() => {
                          isLoadingManuallyRef.current = false;
                        }, 300);
                      }, 100);
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
                    onClick={() => {
                      if (selectedSupplierCodes.length === 0) {
                        message.warning('请至少选择一个供应商编码');
                        return;
                      }
                      setLeftCurrentPage(1);
                      setRightCurrentPage(1);
                      // 传递页码1，确保加载第一页数据
                      loadLeftData(undefined, undefined, undefined, 1, leftPageSize);
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
                      setComparisonResultFilter(values);
                      // 筛选时重置到第一页
                      setLeftCurrentPage(1);
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
                    onClick={() => {
                      if (selectedSupplierCodes.length === 0) {
                        message.warning('请至少选择一个供应商编码');
                        return;
                      }
                      // 如果有SKU搜索，重新加载库存汇总数据
                      if (inventorySkuSearch.trim()) {
                        loadRightData();
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
                      onChange={async (value) => {
                        const newFields = value ? [value] : [];
                        setSupplierNameFields(newFields);
                        // 如果选择了字段，查询当前页的数据
                        if (newFields.length > 0 && rightData.length > 0) {
                          await loadSupplierNames(rightData, newFields);
                        } else {
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
                      onChange={async (values) => {
                        const newFields = values || [];
                        setSupplierNameFields(newFields);
                        // 如果选择了字段，查询当前页的数据
                        if (newFields.length > 0 && rightData.length > 0) {
                          await loadSupplierNames(rightData, newFields);
                        } else {
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
                      onChange={async (value) => {
                        const newStoreName = value || '';

                        // 如果选择了门店/仓名称，重新加载数据
                        if (newStoreName) {
                          setLeftCurrentPage(1);
                          setRightCurrentPage(1);
                          // 使用最新的门店/仓名称值，直接传递参数，不依赖状态更新
                          await loadLeftData(selectedSupplierCodes, newStoreName, cityFilter, 1, leftPageSize);
                        } else {
                          // 如果清空了选择，清空所有数据
                          setStoreNameFilter('');
                          setLeftData([]);
                          setLeftTotal(0);
                          setRightData([]);
                          setRightAllData([]);
                          setRightTotal(0);
                          setUpcToSkuMap({});
                        }

                        // 延迟更新状态，确保数据加载完成后再更新
                        setTimeout(() => {
                          setStoreNameFilter(newStoreName);
                        }, 100);
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
                      onChange={async (value) => {
                        const newCity = value || '';

                        // 如果选择了城市，重新加载数据
                        if (newCity) {
                          setLeftCurrentPage(1);
                          setRightCurrentPage(1);
                          // 先更新状态，确保后续查询使用最新的城市值
                          setCityFilter(newCity);
                          // 使用最新的城市值，直接传递参数，不依赖状态更新
                          await loadLeftData(selectedSupplierCodes, storeNameFilter, newCity, 1, leftPageSize);
                          // 注意：loadLeftData 会触发 loadRightData，而 loadRightData 内部已经会自动查询供应商名称
                        } else {
                          // 如果清空了选择，清空所有数据
                          setCityFilter('');
                          setLeftData([]);
                          setLeftTotal(0);
                          setRightData([]);
                          setRightAllData([]);
                          setRightTotal(0);
                          setUpcToSkuMap({});
                          // 清空供应商名称数据
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
                    onClick: () => {
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

