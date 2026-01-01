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
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Popover,
  Select,
  Space,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useState } from 'react';
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
  // 单独的搜索字段
  const [search交易单号, setSearch交易单号] = useState('');
  const [search牵牛花采购单号, setSearch牵牛花采购单号] = useState('');
  const [search对账单号, setSearch对账单号] = useState('');
  const [search记录状态, setSearch记录状态] = useState<string[]>([]);

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 选择操作弹框相关状态（用于交易单号）
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FinanceReconciliationDifference | null>(null);

  // 采购单操作弹框相关状态（用于牵牛花采购单号）
  const [purchaseOrderActionModalVisible, setPurchaseOrderActionModalVisible] = useState(false);
  const [selectedPurchaseOrderRecord, setSelectedPurchaseOrderRecord] = useState<FinanceReconciliationDifference | null>(null);

  // 账单手动绑定采购单相关状态（FinanceManagement）
  const [financeBillModalVisible, setFinanceBillModalVisible] = useState(false);
  const [financeBillForm] = Form.useForm();
  const [financeBillImageFileList, setFinanceBillImageFileList] = useState<UploadFile[]>([]);
  const [financeBillPreviewImage, setFinanceBillPreviewImage] = useState<string | null>(null);
  const [financeBillPreviewVisible, setFinanceBillPreviewVisible] = useState(false);
  const [financeBillLoading, setFinanceBillLoading] = useState(false);

  // 采购单金额调整相关状态（用于牵牛花采购单号点击）
  const [purchaseAdjustmentModalVisible, setPurchaseAdjustmentModalVisible] = useState(false);
  const [purchaseAdjustmentForm] = Form.useForm();
  const [purchaseAdjustmentImageFileList, setPurchaseAdjustmentImageFileList] = useState<UploadFile[]>([]);
  const [purchaseAdjustmentLoading, setPurchaseAdjustmentLoading] = useState(false);

  // 非采购单流水记录相关状态
  const [nonPurchaseRecordModalVisible, setNonPurchaseRecordModalVisible] = useState(false);
  const [nonPurchaseRecordForm] = Form.useForm();
  const [nonPurchaseRecordLoading, setNonPurchaseRecordLoading] = useState(false);

  // 加载记录列表
  const loadRecords = async (
    page: number = currentPage,
    search?: string,
    交易单号?: string,
    牵牛花采购单号?: string,
    对账单号?: string,
    记录状态?: string[],
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
      if (交易单号 && 交易单号.trim()) {
        params.交易单号 = 交易单号.trim();
      }
      if (牵牛花采购单号 && 牵牛花采购单号.trim()) {
        params.牵牛花采购单号 = 牵牛花采购单号.trim();
      }
      if (对账单号 && 对账单号.trim()) {
        params.对账单号 = 对账单号.trim();
      }
      if (记录状态 && 记录状态.length > 0) {
        params.记录状态 = 记录状态;
      }
      const result = await financeReconciliationDifferenceApi.getAll(params);
      setRecords(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载记录列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadRecords();
  }, []);

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

  // 执行搜索（使用所有搜索条件）
  const handleSearchAll = () => {
    setCurrentPage(1);
    loadRecords(
      1,
      searchText?.trim() || undefined,
      search交易单号?.trim() || undefined,
      search牵牛花采购单号?.trim() || undefined,
      search对账单号?.trim() || undefined,
      search记录状态.length > 0 ? search记录状态 : undefined,
    );
  };

  // 使用当前搜索条件刷新数据
  const refreshRecords = () => {
    loadRecords(
      currentPage,
      searchText?.trim() || undefined,
      search交易单号?.trim() || undefined,
      search牵牛花采购单号?.trim() || undefined,
      search对账单号?.trim() || undefined,
      search记录状态.length > 0 ? search记录状态 : undefined,
    );
  };

  // 格式化金额
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-';
    return amount.toFixed(2);
  };

  // 处理交易单号点击
  const handleTransactionNumberClick = (record: FinanceReconciliationDifference) => {
    setSelectedRecord(record);
    setActionModalVisible(true);
  };

  // 处理牵牛花采购单号点击
  const handlePurchaseOrderNumberClick = (record: FinanceReconciliationDifference) => {
    setSelectedPurchaseOrderRecord(record);
    setPurchaseOrderActionModalVisible(true);
  };

  // 选择采购单金额调整（从牵牛花采购单号点击进入）
  const handleSelectPurchaseAmountAdjustment = () => {
    setPurchaseOrderActionModalVisible(false);
    if (selectedPurchaseOrderRecord) {
      // 打开采购单金额调整新增Modal，自动填充采购单号
      purchaseAdjustmentForm.resetFields();
      purchaseAdjustmentForm.setFieldsValue({
        purchaseOrderNumber: selectedPurchaseOrderRecord.牵牛花采购单号,
      });
      setPurchaseAdjustmentImageFileList([]);
      setPurchaseAdjustmentModalVisible(true);
    }
  };

  // 选择账单手动绑定采购单
  const handleSelectPurchaseAdjustment = () => {
    setActionModalVisible(false);
    if (selectedRecord) {
      // 打开账单手动绑定采购单新增Modal（FinanceManagement），自动填充交易单号和牵牛花采购单号
      financeBillForm.resetFields();
      financeBillForm.setFieldsValue({
        transactionNumber: selectedRecord.交易单号,
        qianniuhuaPurchaseNumber: selectedRecord.牵牛花采购单号,
      });
      setFinanceBillImageFileList([]);
      setFinanceBillModalVisible(true);
    }
  };

  // 选择非采购单流水记录
  const handleSelectNonPurchaseRecord = () => {
    setActionModalVisible(false);
    if (selectedRecord) {
      // 打开非采购单流水记录新增Modal，自动填充账单流水（交易单号）
      nonPurchaseRecordForm.resetFields();
      nonPurchaseRecordForm.setFieldsValue({
        账单流水: selectedRecord.交易单号,
      });
      setNonPurchaseRecordModalVisible(true);
    }
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
        financeReviewStatus: values.financeReviewStatus || undefined,
        financeReviewer: values.financeReviewer || undefined,
      };

      setPurchaseAdjustmentLoading(true);
      await purchaseAmountAdjustmentApi.create(adjustmentData);
      message.success('创建成功');
      setPurchaseAdjustmentModalVisible(false);
      purchaseAdjustmentForm.resetFields();
      setPurchaseAdjustmentImageFileList([]);
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '保存失败');
      console.error(error);
    } finally {
      setPurchaseAdjustmentLoading(false);
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

      setFinanceBillLoading(true);
      await financeManagementApi.create(billData);
      message.success('创建成功');
      setFinanceBillModalVisible(false);
      financeBillForm.resetFields();
      setFinanceBillImageFileList([]);
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '保存失败');
      console.error(error);
    } finally {
      setFinanceBillLoading(false);
    }
  };

  // 保存非采购单流水记录
  const handleSaveNonPurchaseRecord = async () => {
    try {
      const values = await nonPurchaseRecordForm.validateFields();

      const recordData: NonPurchaseBillRecord = {
        账单流水: values.账单流水,
        记账金额: values.记账金额 || undefined,
        账单类型: values.账单类型 || undefined,
        所属仓店: values.所属仓店 || undefined,
        账单流水备注: values.账单流水备注 || undefined,
        财务记账凭证号: values.财务记账凭证号 || undefined,
        财务审核状态: values.财务审核状态 || undefined,
        财务审核人: values.财务审核人 || undefined,
      };

      setNonPurchaseRecordLoading(true);
      await nonPurchaseBillRecordApi.create(recordData);
      message.success('创建成功');
      setNonPurchaseRecordModalVisible(false);
      nonPurchaseRecordForm.resetFields();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '保存失败');
      console.error(error);
    } finally {
      setNonPurchaseRecordLoading(false);
    }
  };

  // 表格列定义
  const allColumns = [
    {
      title: '对账单号',
      dataIndex: '对账单号',
      key: '对账单号',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '交易单号',
      dataIndex: '交易单号',
      key: '交易单号',
      width: 180,
      fixed: 'left' as const,
      render: (text: string, record: FinanceReconciliationDifference) => (
        <a
          onClick={() => handleTransactionNumberClick(record)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {text}
        </a>
      ),
    },
    {
      title: '牵牛花采购单号',
      dataIndex: '牵牛花采购单号',
      key: '牵牛花采购单号',
      width: 180,
      ellipsis: true,
      render: (text: string, record: FinanceReconciliationDifference) => (
        <a
          onClick={() => handlePurchaseOrderNumberClick(record)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {text}
        </a>
      ),
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
      title: '对账单收货状态',
      dataIndex: '对账单收货状态',
      key: '对账单收货状态',
      width: 140,
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
          <Space>
            {/* 综合搜索框 */}
            <Input
              placeholder="综合搜索（所有字段）"
              allowClear
              style={{ width: 220 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearchAll}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearchAll}
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
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                setSearch交易单号('');
                setSearch牵牛花采购单号('');
                setSearch对账单号('');
                setSearch记录状态([]);
                setCurrentPage(1);
                loadRecords(1, undefined);
              }}
            >
              重置
            </Button>
          </Space>
        }
      >
        {/* 搜索区域 */}
        <div style={{ marginBottom: 16, padding: '16px', backgroundColor: '#fafafa', borderRadius: 4 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>单独搜索</div>
            <Space wrap>
              <Input
                placeholder="交易单号"
                allowClear
                style={{ width: 180 }}
                value={search交易单号}
                onChange={(e) => setSearch交易单号(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="牵牛花采购单号"
                allowClear
                style={{ width: 180 }}
                value={search牵牛花采购单号}
                onChange={(e) => setSearch牵牛花采购单号(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="对账单号"
                allowClear
                style={{ width: 180 }}
                value={search对账单号}
                onChange={(e) => setSearch对账单号(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Select
                mode="multiple"
                placeholder="记录状态"
                allowClear
                style={{ width: 200 }}
                value={search记录状态}
                onChange={(value) => {
                  setSearch记录状态(value);
                  // 选择后自动触发搜索
                  setTimeout(() => {
                    setCurrentPage(1);
                    loadRecords(
                      1,
                      searchText?.trim() || undefined,
                      search交易单号?.trim() || undefined,
                      search牵牛花采购单号?.trim() || undefined,
                      search对账单号?.trim() || undefined,
                      value.length > 0 ? value : undefined,
                    );
                  }, 0);
                }}
              >
                {记录状态选项.map((状态) => (
                  <Select.Option key={状态} value={状态}>
                    {状态}
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </Space>
        </div>
        <ResponsiveTable<FinanceReconciliationDifference>
          columns={columns as any}
          dataSource={records}
          rowKey={(record) => `${record.交易单号}_${record.牵牛花采购单号}`}
          loading={loading}
          isMobile={false}
          scroll={{ x: 3000 }}
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
              loadRecords(
                page,
                searchText?.trim() || undefined,
                search交易单号?.trim() || undefined,
                search牵牛花采购单号?.trim() || undefined,
                search对账单号?.trim() || undefined,
                search记录状态.length > 0 ? search记录状态 : undefined,
              );
            },
          }}
        />
      </Card>

      {/* 选择操作弹框（用于交易单号） */}
      <Modal
        title="您需要对该交易单进行："
        open={actionModalVisible}
        onCancel={() => {
          setActionModalVisible(false);
          setSelectedRecord(null);
        }}
        footer={null}
        width={500}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            block
            size="large"
            onClick={handleSelectPurchaseAdjustment}
          >
            账单手动绑定采购单
          </Button>
          <Button
            type="primary"
            block
            size="large"
            onClick={handleSelectNonPurchaseRecord}
          >
            非采购单流水记录
          </Button>
        </Space>
      </Modal>

      {/* 选择操作弹框（用于牵牛花采购单号） */}
      <Modal
        title="您需要对该采购单进行："
        open={purchaseOrderActionModalVisible}
        onCancel={() => {
          setPurchaseOrderActionModalVisible(false);
          setSelectedPurchaseOrderRecord(null);
        }}
        footer={null}
        width={500}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            block
            size="large"
            onClick={handleSelectPurchaseAmountAdjustment}
          >
            采购单金额调整
          </Button>
        </Space>
      </Modal>

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
        confirmLoading={purchaseAdjustmentLoading}
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

          <Form.Item
            label="财务审核状态"
            name="financeReviewStatus"
          >
            <Input placeholder="请输入财务审核状态" maxLength={20} />
          </Form.Item>

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
        confirmLoading={financeBillLoading}
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
        }}
        width={800}
        okText="保存"
        cancelText="取消"
        confirmLoading={nonPurchaseRecordLoading}
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
            label="财务记账凭证号"
            name="财务记账凭证号"
          >
            <Input placeholder="请输入财务记账凭证号" />
          </Form.Item>

          <Form.Item
            label="财务审核状态"
            name="财务审核状态"
          >
            <Input placeholder="请输入财务审核状态" />
          </Form.Item>

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

