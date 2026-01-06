"use client";

import { formatDateTime } from '@/lib/dateUtils';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Image,
  Input,
  message,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Typography,
  Upload
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCallback, useEffect, useState } from 'react';
import { FinanceBill, financeManagementApi, purchaseOrderInfoApi, transactionRecordApi } from '../lib/api';
import BatchAddModal, { FieldConfig } from './BatchAddModal';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { Search } = Input;
const { Title } = Typography;
const { TextArea } = Input;

export default function FinanceManagementPage() {
  const [bills, setBills] = useState<FinanceBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  // 单独的搜索字段
  const [searchTransactionNumber, setSearchTransactionNumber] = useState('');
  const [searchQianniuhuaPurchaseNumber, setSearchQianniuhuaPurchaseNumber] = useState('');
  const [searchImportExceptionRemark, setSearchImportExceptionRemark] = useState('');
  const [searchModifier, setSearchModifier] = useState('');

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<FinanceBill | null>(null);
  const [form] = Form.useForm();
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // 批量新增模态框状态
  const [batchModalVisible, setBatchModalVisible] = useState(false);

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 校验相关状态
  const [transactionNumberValidation, setTransactionNumberValidation] = useState<{
    loading: boolean;
    result: { 支付渠道?: string; 收支金额?: number } | null;
    error: string | null;
  }>({ loading: false, result: null, error: null });
  const [purchaseOrderNumberValidation, setPurchaseOrderNumberValidation] = useState<{
    loading: boolean;
    result: { '门店/仓'?: string; 采购金额?: number } | null;
    error: string | null;
  }>({ loading: false, result: null, error: null });

  // 加载账单列表
  const loadBills = async (
    page: number = currentPage,
    search?: string,
    transactionNumber?: string,
    qianniuhuaPurchaseNumber?: string,
    importExceptionRemark?: string,
    modifier?: string,
    size?: number,
  ) => {
    try {
      setLoading(true);
      const currentSize = size ?? pageSize;
      const result = await financeManagementApi.getAll({
        page,
        limit: currentSize,
        search,
        transactionNumber,
        qianniuhuaPurchaseNumber,
        importExceptionRemark,
        modifier,
      });
      setBills(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载账单列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadBills();
  }, []);

  // 从 localStorage 加载列显示偏好和顺序
  useEffect(() => {
    const savedHiddenColumns = localStorage.getItem('finance_management_hidden_columns');
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    }

    const savedColumnOrder = localStorage.getItem('finance_management_column_order');
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
    localStorage.setItem('finance_management_hidden_columns', JSON.stringify(Array.from(hidden)));
  };

  // 保存列顺序到 localStorage
  const saveColumnOrder = (order: string[]) => {
    localStorage.setItem('finance_management_column_order', JSON.stringify(order));
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

  // 执行搜索（使用所有搜索条件）
  const handleSearchAll = () => {
    setCurrentPage(1);
    loadBills(
      1,
      searchText || undefined,
      searchTransactionNumber || undefined,
      searchQianniuhuaPurchaseNumber || undefined,
      searchImportExceptionRemark || undefined,
      searchModifier || undefined,
    );
  };

  // 使用当前搜索条件刷新数据
  const refreshBills = () => {
    loadBills(
      currentPage,
      searchText || undefined,
      searchTransactionNumber || undefined,
      searchQianniuhuaPurchaseNumber || undefined,
      searchImportExceptionRemark || undefined,
      searchModifier || undefined,
    );
  };

  // 打开新增模态框
  const handleAdd = () => {
    setEditingBill(null);
    form.resetFields();
    setImageFileList([]);
    setTransactionNumberValidation({ loading: false, result: null, error: null });
    setPurchaseOrderNumberValidation({ loading: false, result: null, error: null });
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = async (bill: FinanceBill) => {
    setEditingBill(bill);
    form.setFieldsValue({
      transactionNumber: bill.transactionNumber,
      qianniuhuaPurchaseNumber: bill.qianniuhuaPurchaseNumber,
      importExceptionRemark: bill.importExceptionRemark,
    });

    // 如果有图片标识，异步加载图片
    if (bill.hasImage === 1 && bill.transactionNumber) {
      try {
        const fullBill = await financeManagementApi.get(bill.transactionNumber, bill.qianniuhuaPurchaseNumber);
        if (fullBill && fullBill.image && typeof fullBill.image === 'string') {
          setImageFileList([{
            uid: '-1',
            name: 'image.png',
            status: 'done',
            url: fullBill.image.startsWith('http')
              ? fullBill.image
              : `data:image/png;base64,${fullBill.image}`,
          }]);
          // 在表单中设置图片字段（用于判断是否清空）
          form.setFieldsValue({ image: fullBill.image });
        } else {
          setImageFileList([]);
          form.setFieldsValue({ image: undefined });
        }
      } catch (error) {
        console.error('加载图片失败:', error);
        setImageFileList([]);
        form.setFieldsValue({ image: undefined });
      }
    } else {
      setImageFileList([]);
      form.setFieldsValue({ image: undefined });
    }

    setModalVisible(true);
  };

  // 图片上传前处理
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

  // 图片变化处理
  const handleImageChange = (info: any) => {
    setImageFileList(info.fileList);
  };

  // 将文件转换为base64
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

  // 校验交易单号
  const validateTransactionNumber = async (transactionNumber: string) => {
    if (!transactionNumber || !transactionNumber.trim()) {
      setTransactionNumberValidation({ loading: false, result: null, error: null });
      return;
    }

    setTransactionNumberValidation({ loading: true, result: null, error: null });
    try {
      const result = await transactionRecordApi.getByTransactionBillNumber(transactionNumber.trim());
      if (result.data && result.data.length > 0) {
        const record = result.data[0];
        setTransactionNumberValidation({
          loading: false,
          result: {
            支付渠道: record.支付渠道,
            收支金额: record.收支金额,
          },
          error: null,
        });
      } else {
        setTransactionNumberValidation({
          loading: false,
          result: null,
          error: '该交易单号在数据库中不存在,请核对是否输入有误(仅提示)',
        });
      }
    } catch (error: any) {
      setTransactionNumberValidation({
        loading: false,
        result: null,
        error: '该交易单号在数据库中不存在,请核对是否输入有误(仅提示)',
      });
    }
  };

  // 校验采购单号
  const validatePurchaseOrderNumber = async (purchaseOrderNumber: string) => {
    if (!purchaseOrderNumber || !purchaseOrderNumber.trim()) {
      setPurchaseOrderNumberValidation({ loading: false, result: null, error: null });
      return;
    }

    setPurchaseOrderNumberValidation({ loading: true, result: null, error: null });
    try {
      const result = await purchaseOrderInfoApi.getByPurchaseOrderNumber(purchaseOrderNumber.trim());
      if (result.data && result.data.length > 0) {
        const record = result.data[0];
        setPurchaseOrderNumberValidation({
          loading: false,
          result: {
            '门店/仓': record['门店/仓'],
            采购金额: record.采购金额,
          },
          error: null,
        });
      } else {
        setPurchaseOrderNumberValidation({
          loading: false,
          result: null,
          error: '该采购单号在数据库中不存在,请核对是否输入有误(仅提示)',
        });
      }
    } catch (error: any) {
      setPurchaseOrderNumberValidation({
        loading: false,
        result: null,
        error: '该采购单号在数据库中不存在,请核对是否输入有误(仅提示)',
      });
    }
  };

  // 保存账单
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 处理图片
      let imageBase64: string | undefined;
      if (imageFileList.length > 0 && imageFileList[0].originFileObj) {
        // 新上传的图片
        imageBase64 = await fileToBase64(imageFileList[0].originFileObj);
      } else if (imageFileList.length > 0 && imageFileList[0].url) {
        // 编辑时，如果图片没有变化，使用原有的值
        const url = imageFileList[0].url;
        if (url.startsWith('data:image')) {
          // base64格式，提取base64部分
          imageBase64 = url.split(',')[1];
        } else if (url.startsWith('http')) {
          // OSS URL，直接使用URL
          imageBase64 = url;
        }
      } else {
        // 图片被清空或没有图片
        // 检查表单中的image字段，如果存在且是空字符串，说明原来有图片但被清空了
        const formImageValue = form.getFieldValue('image');
        if (formImageValue === '') {
          // 明确设置为空字符串，表示要清空数据库中的图片
          imageBase64 = '';
        } else if (editingBill && editingBill.hasImage === 1 && imageFileList.length === 0) {
          // 编辑时，原来有图片但现在清空了，使用空字符串来清空数据库中的值
          imageBase64 = '';
        } else {
          // 原来就没有图片，不设置image字段
          imageBase64 = undefined;
        }
      }

      const billData: FinanceBill = {
        transactionNumber: values.transactionNumber,
        qianniuhuaPurchaseNumber: values.qianniuhuaPurchaseNumber || undefined,
        importExceptionRemark: values.importExceptionRemark || undefined,
        image: imageBase64,
      };

      if (editingBill && editingBill.transactionNumber) {
        // 更新
        await financeManagementApi.update(
          editingBill.transactionNumber,
          editingBill.qianniuhuaPurchaseNumber,
          billData
        );
        message.success('更新成功');
      } else {
        // 新增
        await financeManagementApi.create(billData);
        message.success('创建成功');
      }

      setModalVisible(false);
      refreshBills();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      // 提取后端返回的错误消息
      let errorMessage = '未知错误';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      message.error((editingBill ? '更新' : '创建') + '失败: ' + errorMessage);
    }
  };

  // 删除账单
  const handleDelete = async (transactionNumber: string, qianniuhuaPurchaseNumber?: string) => {
    try {
      await financeManagementApi.delete(transactionNumber, qianniuhuaPurchaseNumber);
      message.success('删除成功');
      refreshBills();
    } catch (error: any) {
      message.error(error.message || '删除失败');
      console.error(error);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }

    try {
      // selectedRowKeys 是 rowKey 的数组，格式为 "交易单号_牵牛花采购单号"
      // 需要解析这些值来获取交易单号和牵牛花采购单号
      const billsToDelete = selectedRowKeys.map((key: React.Key) => {
        const keyStr = String(key);
        const parts = keyStr.split('_');
        return {
          transactionNumber: parts[0],
          qianniuhuaPurchaseNumber: parts[1] || undefined
        };
      });

      const result = await financeManagementApi.batchDelete(billsToDelete);
      message.success(`成功删除 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      setSelectedRowKeys([]);
      refreshBills();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
      console.error(error);
    }
  };

  // 打开批量新增模态框
  const handleBatchAdd = () => {
    setBatchModalVisible(true);
  };

  // 批量新增字段配置
  const batchAddFields: FieldConfig<FinanceBill>[] = [
    {
      key: 'transactionNumber' as keyof FinanceBill,
      label: '交易单号',
      excelHeaderName: '交易单号',
      required: true,
      index: 0,
    },
    {
      key: 'qianniuhuaPurchaseNumber' as keyof FinanceBill,
      label: '牵牛花采购单号',
      excelHeaderName: '牵牛花采购单号',
      required: false,
      index: 1,
    },
    {
      key: 'importExceptionRemark' as keyof FinanceBill,
      label: '导入异常备注',
      excelHeaderName: '导入异常备注',
      required: false,
      index: 2,
    },
  ];

  // 创建数据项
  const createBatchItem = useCallback((parts: string[]): Partial<FinanceBill> => {
    return {
      transactionNumber: parts[0] || '',
      qianniuhuaPurchaseNumber: parts[1] && parts[1].trim() !== '' ? parts[1].trim() : undefined,
      importExceptionRemark: parts[2] && parts[2].trim() !== '' ? parts[2].trim() : undefined,
      image: undefined, // 图片列忽略，设为空值
    };
  }, []);

  // 批量保存
  const handleBatchSave = useCallback(async (validItems: FinanceBill[]) => {
    try {
      const result = await financeManagementApi.batchCreate(validItems);
      if (result.errors && result.errors.length > 0) {
        message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
      }
      message.success('账单手动绑定采购单-批量新增数据已完成');
      refreshBills();
    } catch (e: any) {
      let errorMessage = '未知错误';
      if (e?.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e?.message) {
        errorMessage = e.message;
      }
      message.error('批量创建失败: ' + errorMessage);
    }
  }, []);

  // 查看图片
  const handleViewImage = async (bill: FinanceBill) => {
    if (bill.transactionNumber) {
      try {
        const fullBill = await financeManagementApi.get(bill.transactionNumber, bill.qianniuhuaPurchaseNumber);
        if (fullBill && fullBill.image && typeof fullBill.image === 'string') {
          const imageUrl = fullBill.image.startsWith('http')
            ? fullBill.image
            : `data:image/png;base64,${fullBill.image}`;
          setPreviewImage(imageUrl);
          setPreviewVisible(true);
        } else {
          message.info('该记录没有图片');
        }
      } catch (error) {
        message.error('获取图片失败');
      }
    }
  };

  // 表格列定义
  const allColumns = [
    {
      title: '交易单号',
      dataIndex: 'transactionNumber',
      key: 'transactionNumber',
      width: 150,
      fixed: 'left' as const,
    },
    {
      title: '牵牛花采购单号',
      dataIndex: 'qianniuhuaPurchaseNumber',
      key: 'qianniuhuaPurchaseNumber',
      width: 180,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '导入异常备注',
      dataIndex: 'importExceptionRemark',
      key: 'importExceptionRemark',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '图片',
      key: 'image',
      width: 120,
      render: (record: FinanceBill) => (
        record.hasImage === 1 ? (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewImage(record)}
          >
            查看图片
          </Button>
        ) : '-'
      ),
    },
    {
      title: '修改人',
      dataIndex: 'modifier',
      key: 'modifier',
      width: 120,
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
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (record: FinanceBill) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.transactionNumber, record.qianniuhuaPurchaseNumber)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 根据列设置过滤和排序列
  const getFilteredColumns = () => {
    const currentOrder = columnOrder.length > 0
      ? columnOrder
      : allColumns.map(col => col.key as string).filter(Boolean);

    // 确保操作列在顺序中
    if (!currentOrder.includes('action')) {
      currentOrder.push('action');
    }

    // 按照保存的顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter(Boolean) as typeof allColumns;

    // 过滤隐藏的列，但始终显示操作列
    return orderedColumns.filter(col => {
      const colKey = col.key as string;
      // 操作列始终显示
      if (colKey === 'action') {
        return true;
      }
      return !hiddenColumns.has(colKey);
    });
  };

  const columns = getFilteredColumns();

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
  };

  return (
    <div style={{ padding: 0 }}>
      {/* 主要内容 */}
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>账单手动绑定采购单</Title>
          </Space>
        }
        extra={
          <Space>
            {/* 综合搜索框 */}
            <Input
              placeholder="综合搜索（所有字段，除图片）"
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
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={handleBatchAdd}
            >
              批量新增
            </Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                >
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                setSearchTransactionNumber('');
                setSearchQianniuhuaPurchaseNumber('');
                setSearchImportExceptionRemark('');
                setSearchModifier('');
                setCurrentPage(1);
                // 重置时传入空的搜索参数，确保立即查询默认数据
                loadBills(1, undefined, undefined, undefined, undefined, undefined);
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
                value={searchTransactionNumber}
                onChange={(e) => setSearchTransactionNumber(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="牵牛花采购单号"
                allowClear
                style={{ width: 180 }}
                value={searchQianniuhuaPurchaseNumber}
                onChange={(e) => setSearchQianniuhuaPurchaseNumber(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="导入异常备注"
                allowClear
                style={{ width: 180 }}
                value={searchImportExceptionRemark}
                onChange={(e) => setSearchImportExceptionRemark(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="修改人"
                allowClear
                style={{ width: 180 }}
                value={searchModifier}
                onChange={(e) => setSearchModifier(e.target.value)}
                onPressEnter={handleSearchAll}
              />
            </Space>
          </Space>
        </div>
        <ResponsiveTable<FinanceBill>
          tableId="finance-management"
          columns={columns as any}
          dataSource={bills}
          rowKey={(record) => `${record.transactionNumber}_${record.qianniuhuaPurchaseNumber || ''}`}
          loading={loading}
          isMobile={false}
          scroll={{ x: 2000, y: 600 }}
          rowSelection={rowSelection}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              if (size && size !== pageSize) {
                setPageSize(size);
                // 切换分页大小时，立即加载数据，传入新的size
                loadBills(
                  page,
                  searchText || undefined,
                  searchTransactionNumber || undefined,
                  searchQianniuhuaPurchaseNumber || undefined,
                  searchImportExceptionRemark || undefined,
                  searchModifier || undefined,
                  size,
                );
              } else {
                loadBills(
                  page,
                  searchText || undefined,
                  searchTransactionNumber || undefined,
                  searchQianniuhuaPurchaseNumber || undefined,
                  searchImportExceptionRemark || undefined,
                  searchModifier || undefined,
                );
              }
            },
            onShowSizeChange: (current, size) => {
              setCurrentPage(1);
              setPageSize(size);
              // 切换分页大小时，立即加载数据，传入新的size
              loadBills(
                1,
                searchText || undefined,
                searchTransactionNumber || undefined,
                searchQianniuhuaPurchaseNumber || undefined,
                searchImportExceptionRemark || undefined,
                searchModifier || undefined,
                size,
              );
            },
          }}
        />
      </Card>


      {/* 新增/编辑模态框 */}
      <Modal
        title={editingBill ? '编辑账单' : '新增账单'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          setEditingBill(null);
          form.resetFields();
          setImageFileList([]);
          setTransactionNumberValidation({ loading: false, result: null, error: null });
          setPurchaseOrderNumberValidation({ loading: false, result: null, error: null });
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="交易单号"
            name="transactionNumber"
            rules={[
              { required: true, message: '请输入交易单号' },
              { whitespace: true, message: '交易单号不能为空' }
            ]}
            help={
              transactionNumberValidation.loading ? (
                <span style={{ color: '#1890ff' }}>校验中...</span>
              ) : transactionNumberValidation.error ? (
                <span style={{ color: '#ff4d4f' }}>{transactionNumberValidation.error}</span>
              ) : transactionNumberValidation.result ? (
                <span style={{ color: '#52c41a' }}>
                  支付渠道: {transactionNumberValidation.result.支付渠道 || '-'},
                  收支金额: {transactionNumberValidation.result.收支金额 !== undefined ? Number(transactionNumberValidation.result.收支金额).toFixed(2) : '-'}
                </span>
              ) : null
            }
          >
            <Input
              placeholder="请输入交易单号"
              disabled={!!editingBill}
              onBlur={(e) => {
                const value = e.target.value;
                if (value && value.trim()) {
                  validateTransactionNumber(value);
                } else {
                  setTransactionNumberValidation({ loading: false, result: null, error: null });
                }
              }}
            />
          </Form.Item>

          <Form.Item
            label="牵牛花采购单号"
            name="qianniuhuaPurchaseNumber"
            help={
              purchaseOrderNumberValidation.loading ? (
                <span style={{ color: '#1890ff' }}>校验中...</span>
              ) : purchaseOrderNumberValidation.error ? (
                <span style={{ color: '#ff4d4f' }}>{purchaseOrderNumberValidation.error}</span>
              ) : purchaseOrderNumberValidation.result ? (
                <span style={{ color: '#52c41a' }}>
                  门店/仓: {purchaseOrderNumberValidation.result['门店/仓'] || '-'},
                  采购金额: {purchaseOrderNumberValidation.result.采购金额 !== undefined ? Number(purchaseOrderNumberValidation.result.采购金额).toFixed(2) : '-'}
                </span>
              ) : null
            }
          >
            <Input
              placeholder="请输入牵牛花采购单号"
              onBlur={(e) => {
                const value = e.target.value;
                if (value && value.trim()) {
                  validatePurchaseOrderNumber(value);
                } else {
                  setPurchaseOrderNumberValidation({ loading: false, result: null, error: null });
                }
              }}
            />
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
                fileList={imageFileList}
                beforeUpload={beforeUpload}
                onChange={handleImageChange}
                onRemove={() => {
                  setImageFileList([]);
                  // 使用空字符串，确保提交时会带上该字段，从而真正清空数据库中的值
                  form.setFieldValue('image', '');
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
                    // 使用空字符串，确保提交时会带上该字段，从而真正清空数据库中的值
                    form.setFieldValue('image', '');
                  }}
                >
                  清空图片
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量新增模态框 */}
      <BatchAddModal<FinanceBill>
        open={batchModalVisible}
        title="批量新增账单"
        hint="您可以从 Excel 中复制数据（包含交易单号、牵牛花采购单号、导入异常备注列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件。注意：图片列会被忽略，设为空值。"
        fields={batchAddFields}
        formatHint="格式：交易单号	牵牛花采购单号	导入异常备注"
        example="TN001	PO001	备注信息"
        onCancel={() => setBatchModalVisible(false)}
        onSave={handleBatchSave}
        createItem={createBatchItem}
      />

      {/* 图片预览 */}
      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => {
          setPreviewVisible(false);
          setPreviewImage(null);
        }}
        width={800}
        centered
      >
        {previewImage && (
          <Image
            src={previewImage}
            alt="预览"
            style={{ width: '100%' }}
          />
        )}
      </Modal>
    </div>
  );
}

