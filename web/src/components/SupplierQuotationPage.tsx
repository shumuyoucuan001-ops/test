"use client";

import { supplierQuotationApi, SupplierQuotation, InventorySummary, SupplierSkuBinding } from '@/lib/api';
import { ReloadOutlined, SearchOutlined, SettingOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Input,
  message,
  Popover,
  Row,
  Col,
  Space,
  Table,
  Tag,
  Segmented,
  Form,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useEffect, useState, useMemo } from 'react';
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

  // 下栏数据
  const [bottomData, setBottomData] = useState<SupplierSkuBinding[]>([]);
  const [bottomLoading, setBottomLoading] = useState(false);
  const [editingSkus, setEditingSkus] = useState<Record<string, string>>({});
  const [form] = Form.useForm();

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 默认显示的字段
  const defaultVisibleColumns = ['序号', '供应商编码', '商品名称', '商品规格', '供货价格'];

  // 初始化列设置
  useEffect(() => {
    const savedHidden = localStorage.getItem('supplier-quotation-hidden-columns');
    const savedOrder = localStorage.getItem('supplier-quotation-column-order');
    
    if (savedHidden) {
      try {
        const hidden = JSON.parse(savedHidden);
        setHiddenColumns(new Set(hidden));
      } catch (e) {
        console.error('Failed to parse hidden columns:', e);
      }
    } else {
      // 默认隐藏非默认显示的字段
      const allColumns = getAllLeftColumns().map(col => col.key as string).filter(Boolean);
      const hidden = allColumns.filter(key => !defaultVisibleColumns.includes(key));
      setHiddenColumns(new Set(hidden));
    }

    if (savedOrder) {
      try {
        setColumnOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error('Failed to parse column order:', e);
      }
    }
  }, []);

  // 保存列设置
  const saveColumnSettings = () => {
    localStorage.setItem('supplier-quotation-hidden-columns', JSON.stringify(Array.from(hiddenColumns)));
    localStorage.setItem('supplier-quotation-column-order', JSON.stringify(columnOrder));
  };

  // 切换列显示/隐藏
  const handleToggleVisibility = (columnKey: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(columnKey)) {
      newHidden.delete(columnKey);
    } else {
      newHidden.add(columnKey);
    }
    setHiddenColumns(newHidden);
    saveColumnSettings();
  };

  // 移动列
  const handleMoveColumn = (columnKey: string, direction: 'up' | 'down') => {
    const currentOrder = columnOrder.length > 0 ? columnOrder : getAllLeftColumns().map(col => col.key as string).filter(Boolean);
    const index = currentOrder.indexOf(columnKey);
    if (index === -1) return;

    const newOrder = [...currentOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setColumnOrder(newOrder);
    saveColumnSettings();
  };

  // 直接设置列顺序
  const handleColumnOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    saveColumnSettings();
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
        title: '单品或采购单位起订量',
        dataIndex: '单品或采购单位起订量',
        key: '单品或采购单位起订量',
        width: 150,
      },
      {
        title: '采购单位',
        dataIndex: '采购单位',
        key: '采购单位',
        width: 100,
      },
      {
        title: '采购单位换算数量',
        dataIndex: '采购单位换算数量',
        key: '采购单位换算数量',
        width: 150,
      },
      {
        title: '采购规格',
        dataIndex: '采购规格',
        key: '采购规格',
        width: 150,
      },
      {
        title: '整包中包供货价格',
        dataIndex: '整包中包供货价格',
        key: '整包中包供货价格',
        width: 150,
        render: (text: number) => text ? `¥${Number(text).toFixed(4)}` : '-',
      },
      {
        title: '商品供货链接',
        dataIndex: '商品供货链接',
        key: '商品供货链接',
        width: 200,
        ellipsis: true,
        render: (text: string) => text ? (
          <a href={text} target="_blank" rel="noopener noreferrer">
            {text}
          </a>
        ) : '-',
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
    const currentOrder = columnOrder.length > 0 ? columnOrder : allColumns.map(col => col.key as string).filter(Boolean);
    
    // 按顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter((col): col is ColumnType<SupplierQuotation> => col !== undefined);

    // 过滤隐藏的列
    return orderedColumns.filter(col => !hiddenColumns.has(col.key as string));
  };

  // 获取右栏列定义
  const getRightColumns = (): ColumnType<InventorySummary>[] => {
    return [
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
      {
        title: '对比结果',
        dataIndex: '对比结果',
        key: '对比结果',
        width: 120,
        render: (text: string) => {
          if (text === '价格优势') {
            return <Tag color="green">{text}</Tag>;
          } else if (text === '价格偏高') {
            return <Tag color="red">{text}</Tag>;
          }
          return text || '-';
        },
      },
    ];
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
    } catch (error) {
      message.error('加载供应商报价数据失败');
      console.error(error);
    } finally {
      setLeftLoading(false);
    }
  };

  // 加载右栏数据
  const loadRightData = async (upc?: string) => {
    setRightLoading(true);
    try {
      const result = await supplierQuotationApi.getInventorySummary({
        type: inventoryType,
        upc: upc,
      });
      
      // 计算对比结果
      const dataWithComparison = result.map(item => {
        if (selectedLeftRecord && selectedLeftRecord.供货价格 !== undefined && item.最近采购价 !== undefined) {
          const diff = item.最近采购价 - selectedLeftRecord.供货价格;
          // 最近采购价 - 供货价格 > 0 显示价格优势, < 0 显示价格偏高
          return {
            ...item,
            对比结果: diff > 0 ? '价格优势' : diff < 0 ? '价格偏高' : '价格相同',
          };
        }
        return item;
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
        setEditingSkus({ sku_0: '' });
      } else {
        setBottomData(result);
        // 初始化编辑状态
        const initialEditing: Record<string, string> = {};
        result.forEach((item, index) => {
          initialEditing[`sku_${index}`] = item.SKU || '';
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
      setEditingSkus({ sku_0: '' });
    } finally {
      setBottomLoading(false);
    }
  };

  // 左栏行点击
  const handleLeftRowClick = (record: SupplierQuotation) => {
    setSelectedLeftRecord(record);
    // 加载匹配的右栏数据
    if (record.最小销售规格UPC商品条码) {
      loadRightData(record.最小销售规格UPC商品条码);
    } else {
      loadRightData();
    }
    // 加载下栏数据
    loadBottomData();
  };

  // 右栏筛选变化
  const handleInventoryTypeChange = (value: '全部' | '仓店' | '城市') => {
    setInventoryType(value);
    if (selectedLeftRecord?.最小销售规格UPC商品条码) {
      loadRightData(selectedLeftRecord.最小销售规格UPC商品条码);
    } else {
      loadRightData();
    }
  };

  // 保存下栏SKU绑定
  const handleSaveSkuBindings = async () => {
    if (!selectedLeftRecord || !selectedLeftRecord.供应商编码 || !selectedLeftRecord.供应商商品编码) {
      message.warning('请先选择左栏数据');
      return;
    }

    try {
      // 获取所有编辑的SKU值
      const skuValues = Object.entries(editingSkus)
        .map(([key, sku]) => {
          const index = parseInt(key.replace('sku_', ''));
          return { index, sku: sku?.trim() || '' };
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

  // 右栏数据匹配逻辑
  const matchedRightData = useMemo(() => {
    if (!selectedLeftRecord || !selectedLeftRecord.最小销售规格UPC商品条码) {
      return rightData;
    }

    const upc = selectedLeftRecord.最小销售规格UPC商品条码;
    return rightData.filter(item => {
      if (!item.UPC) return false;
      return item.UPC.includes(upc);
    });
  }, [rightData, selectedLeftRecord]);

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 上栏：左右两栏 */}
      <Row gutter={16} style={{ flex: 1, minHeight: 0, marginBottom: 16 }}>
        {/* 左栏 */}
        <Col span={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            title="供应商报价"
            extra={
              <Space>
                <Popover
                  content={
                    <ColumnSettings
                      columns={getAllLeftColumns()}
                      hiddenColumns={hiddenColumns}
                      columnOrder={columnOrder}
                      onToggleVisibility={handleToggleVisibility}
                      onMoveColumn={handleMoveColumn}
                      onColumnOrderChange={handleColumnOrderChange}
                    />
                  }
                  title="列设置"
                  trigger="click"
                  open={columnSettingsOpen}
                  onOpenChange={setColumnSettingsOpen}
                  placement="bottomRight"
                >
                  <Button icon={<SettingOutlined />} />
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
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { flex: 1, overflow: 'hidden', padding: 16 } }}
          >
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
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
              />
            </Space>
            <Table
              columns={getFilteredLeftColumns()}
              dataSource={leftData}
              rowKey={(record) => `${record.序号 || record.供应商编码 || record.供应商商品编码 || Math.random()}`}
              loading={leftLoading}
              scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
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
            />
          </Card>
        </Col>

        {/* 右栏 */}
        <Col span={12} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            title="库存汇总"
            extra={
              <Space>
                <Segmented
                  options={['全部', '仓店', '城市']}
                  value={inventoryType}
                  onChange={(value) => handleInventoryTypeChange(value as '全部' | '仓店' | '城市')}
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    if (selectedLeftRecord?.最小销售规格UPC商品条码) {
                      loadRightData(selectedLeftRecord.最小销售规格UPC商品条码);
                    } else {
                      loadRightData();
                    }
                  }}
                  loading={rightLoading}
                >
                  刷新
                </Button>
              </Space>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { flex: 1, overflow: 'hidden', padding: 16 } }}
          >
            <Table
              columns={getRightColumns()}
              dataSource={matchedRightData}
              rowKey={(record) => `${record.SKU || record.商品名称 || Math.random()}`}
              loading={rightLoading}
              scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
              pagination={false}
            />
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
        style={{ height: 300 }}
      >
        {selectedLeftRecord ? (
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
                render: (_: any, record: SupplierSkuBinding, index: number) => (
                  <Input
                    value={editingSkus[`sku_${index}`] || record.SKU || ''}
                    onChange={(e) => {
                      setEditingSkus({
                        ...editingSkus,
                        [`sku_${index}`]: e.target.value,
                      });
                    }}
                    placeholder="请输入SKU"
                  />
                ),
              },
            ]}
            dataSource={bottomData}
            rowKey={(record) => `${record.供应商编码}_${record.供应商商品编码}_${record.SKU || Math.random()}`}
            loading={bottomLoading}
            pagination={false}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            请先选择左栏数据
          </div>
        )}
      </Card>
    </div>
  );
}

