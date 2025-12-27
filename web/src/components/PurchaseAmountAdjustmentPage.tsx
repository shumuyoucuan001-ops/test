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
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCallback, useEffect, useState } from 'react';
import { PurchaseAmountAdjustment, purchaseAmountAdjustmentApi } from '../lib/api';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { Search } = Input;
const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function PurchaseAmountAdjustmentPage() {
  const [adjustments, setAdjustments] = useState<PurchaseAmountAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  // 单独的搜索字段
  const [searchPurchaseOrderNumber, setSearchPurchaseOrderNumber] = useState('');
  const [searchAdjustmentAmount, setSearchAdjustmentAmount] = useState('');
  const [searchCreator, setSearchCreator] = useState('');
  const [searchFinanceReviewer, setSearchFinanceReviewer] = useState('');
  const [searchDataUpdateTime, setSearchDataUpdateTime] = useState('');

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<PurchaseAmountAdjustment | null>(null);
  const [form] = Form.useForm();
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // 批量新增模态框状态
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchItems, setBatchItems] = useState<PurchaseAmountAdjustment[]>([]);
  const [invalidItems, setInvalidItems] = useState<Array<{ item: PurchaseAmountAdjustment; reasons: string[] }>>([]);

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 加载调整记录列表
  const loadAdjustments = async (
    page: number = currentPage,
    search?: string,
    purchaseOrderNumber?: string,
    adjustmentAmount?: string,
    creator?: string,
    financeReviewer?: string,
    dataUpdateTime?: string,
  ) => {
    try {
      setLoading(true);
      const result = await purchaseAmountAdjustmentApi.getAll({
        page,
        limit: pageSize,
        search,
        purchaseOrderNumber,
        adjustmentAmount,
        creator,
        financeReviewer,
        dataUpdateTime,
      });
      setAdjustments(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载调整记录列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadAdjustments();
  }, []);

  // 从 localStorage 加载列显示偏好和顺序
  useEffect(() => {
    const savedHiddenColumns = localStorage.getItem('purchase_amount_adjustment_hidden_columns');
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    }

    const savedColumnOrder = localStorage.getItem('purchase_amount_adjustment_column_order');
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
    localStorage.setItem('purchase_amount_adjustment_hidden_columns', JSON.stringify(Array.from(hidden)));
  };

  // 保存列顺序到 localStorage
  const saveColumnOrder = (order: string[]) => {
    localStorage.setItem('purchase_amount_adjustment_column_order', JSON.stringify(order));
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
    loadAdjustments(
      1,
      searchText || undefined,
      searchPurchaseOrderNumber || undefined,
      searchAdjustmentAmount || undefined,
      searchCreator || undefined,
      searchFinanceReviewer || undefined,
      searchDataUpdateTime || undefined,
    );
  };

  // 使用当前搜索条件刷新数据
  const refreshAdjustments = () => {
    loadAdjustments(
      currentPage,
      searchText || undefined,
      searchPurchaseOrderNumber || undefined,
      searchAdjustmentAmount || undefined,
      searchCreator || undefined,
      searchFinanceReviewer || undefined,
      searchDataUpdateTime || undefined,
    );
  };

  // 打开新增模态框
  const handleAdd = () => {
    setEditingAdjustment(null);
    form.resetFields();
    setImageFileList([]);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = async (adjustment: PurchaseAmountAdjustment) => {
    setEditingAdjustment(adjustment);
    form.setFieldsValue({
      purchaseOrderNumber: adjustment.purchaseOrderNumber,
      adjustmentAmount: adjustment.adjustmentAmount,
      adjustmentReason: adjustment.adjustmentReason,
      financeReviewRemark: adjustment.financeReviewRemark,
      financeReviewStatus: adjustment.financeReviewStatus,
      financeReviewer: adjustment.financeReviewer,
    });

    // 如果有图片标识，异步加载图片
    if (adjustment.hasImage === 1 && adjustment.purchaseOrderNumber) {
      try {
        const fullAdjustment = await purchaseAmountAdjustmentApi.get(adjustment.purchaseOrderNumber);
        if (fullAdjustment && fullAdjustment.image) {
          setImageFileList([{
            uid: '-1',
            name: 'image.png',
            status: 'done',
            url: `data:image/png;base64,${fullAdjustment.image}`,
          }]);
          // 在表单中设置图片字段（用于判断是否清空）
          form.setFieldsValue({ image: fullAdjustment.image });
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

  // 保存调整记录
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 处理图片
      let imageBase64: string | undefined;
      if (imageFileList.length > 0 && imageFileList[0].originFileObj) {
        // 新上传的图片
        imageBase64 = await fileToBase64(imageFileList[0].originFileObj);
      } else if (imageFileList.length > 0 && imageFileList[0].url) {
        // 编辑时，如果图片没有变化，使用原有的base64
        const url = imageFileList[0].url;
        if (url.startsWith('data:image')) {
          imageBase64 = url.split(',')[1];
        }
      } else {
        // 图片被清空或没有图片
        // 检查表单中的image字段，如果存在且不是空字符串，说明原来有图片但被清空了
        const formImageValue = form.getFieldValue('image');
        if (formImageValue === '') {
          // 明确设置为空字符串，表示要清空数据库中的图片
          imageBase64 = '';
        } else if (editingAdjustment && editingAdjustment.hasImage === 1 && imageFileList.length === 0) {
          // 编辑时，原来有图片但现在清空了，使用空字符串来清空数据库中的值
          imageBase64 = '';
        } else {
          // 原来就没有图片，不设置image字段
          imageBase64 = undefined;
        }
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

      if (editingAdjustment && editingAdjustment.purchaseOrderNumber) {
        // 更新
        await purchaseAmountAdjustmentApi.update(
          editingAdjustment.purchaseOrderNumber,
          adjustmentData
        );
        message.success('更新成功');
      } else {
        // 新增
        await purchaseAmountAdjustmentApi.create(adjustmentData);
        message.success('创建成功');
      }

      setModalVisible(false);
      refreshAdjustments();
    } catch (error: any) {
      message.error(error.message || '保存失败');
      console.error(error);
    }
  };

  // 删除调整记录
  const handleDelete = async (purchaseOrderNumber: string) => {
    try {
      await purchaseAmountAdjustmentApi.delete(purchaseOrderNumber);
      message.success('删除成功');
      refreshAdjustments();
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
      const purchaseOrderNumbers = selectedRowKeys.map((key: React.Key) => String(key));
      const result = await purchaseAmountAdjustmentApi.batchDelete(purchaseOrderNumbers);
      message.success(`成功删除 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      setSelectedRowKeys([]);
      refreshAdjustments();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
      console.error(error);
    }
  };

  // 打开批量新增模态框
  const handleBatchAdd = () => {
    setBatchModalVisible(true);
    setBatchItems([]);
    setInvalidItems([]);
  };

  // 处理粘贴事件
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const lines = pastedText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      message.warning('粘贴的内容为空');
      return;
    }

    const newItems: PurchaseAmountAdjustment[] = [];
    const newInvalidItems: Array<{ item: PurchaseAmountAdjustment; reasons: string[] }> = [];

    for (const line of lines) {
      let parts: string[];
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim());
      } else if (line.includes(',')) {
        parts = line.split(',').map(p => p.trim());
      } else {
        parts = line.split(/\s{2,}/).map(p => p.trim());
      }

      if (parts.length >= 1 && parts[0]) {
        const reasons: string[] = [];

        // 验证采购单号必填
        if (!parts[0] || parts[0].trim() === '') {
          reasons.push('采购单号(牵牛花)为必填');
        }

        // 解析调整金额
        let adjustmentAmount: number | undefined;
        if (parts[1] && parts[1].trim() !== '') {
          const amount = Number(parts[1]);
          if (isNaN(amount)) {
            reasons.push(`调整金额格式无效: ${parts[1]}`);
          } else {
            adjustmentAmount = amount;
          }
        }

        const item: PurchaseAmountAdjustment = {
          purchaseOrderNumber: parts[0] || '',
          adjustmentAmount: adjustmentAmount,
          adjustmentReason: parts[2] && parts[2].trim() !== '' ? parts[2].trim() : undefined,
          image: undefined, // 图片列忽略，设为空值
          financeReviewRemark: parts[3] && parts[3].trim() !== '' ? parts[3].trim() : undefined,
          financeReviewStatus: parts[4] && parts[4].trim() !== '' ? parts[4].trim() : undefined,
          financeReviewer: parts[5] && parts[5].trim() !== '' ? parts[5].trim() : undefined,
        };

        if (reasons.length > 0) {
          newInvalidItems.push({ item, reasons });
        } else {
          newItems.push(item);
        }
      }
    }

    if (newItems.length > 0 || newInvalidItems.length > 0) {
      setBatchItems(prev => [...prev, ...newItems]);
      setInvalidItems(prev => [...prev, ...newInvalidItems]);
      if (newItems.length > 0 && newInvalidItems.length > 0) {
        message.warning(`已粘贴 ${newItems.length} 条有效数据，${newInvalidItems.length} 条数据验证失败，请查看下方验证失败列表`);
      } else if (newItems.length > 0) {
        message.success(`已粘贴 ${newItems.length} 条数据`);
      } else {
        message.error(`粘贴的 ${newInvalidItems.length} 条数据全部验证失败，请查看下方验证失败列表`);
      }
    } else {
      message.warning('未能解析出有效数据，请检查格式');
    }

    const target = e.target as HTMLTextAreaElement;
    if (target) {
      target.value = '';
    }
  }, [message]);

  // 批量新增保存
  const handleBatchSave = async () => {
    if (batchItems.length === 0 && invalidItems.length === 0) {
      message.warning('请先粘贴数据');
      return;
    }

    // 验证数据
    const newInvalidItems: Array<{ item: PurchaseAmountAdjustment; reasons: string[] }> = [];

    const validItems = batchItems.filter(item => {
      if (!item.purchaseOrderNumber || item.purchaseOrderNumber.trim() === '') {
        newInvalidItems.push({ item, reasons: ['采购单号(牵牛花)为必填'] });
        return false;
      }
      return true;
    });

    // 更新验证失败的数据列表
    if (newInvalidItems.length > 0) {
      setInvalidItems(prev => [...prev, ...newInvalidItems]);
      message.error(`有 ${newInvalidItems.length} 条数据验证失败，请查看下方验证失败列表`);
      return;
    }

    if (validItems.length === 0) {
      message.warning('请至少填写一条有效数据（采购单号(牵牛花)为必填）');
      return;
    }

    try {
      const result = await purchaseAmountAdjustmentApi.batchCreate(validItems);
      message.success(`成功创建 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      if (result.errors && result.errors.length > 0) {
        message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
      }
      setBatchModalVisible(false);
      setBatchItems([]);
      setInvalidItems([]);
      refreshAdjustments();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "批量创建失败");
      console.error(e);
    }
  };

  // 查看图片
  const handleViewImage = async (adjustment: PurchaseAmountAdjustment) => {
    if (adjustment.purchaseOrderNumber) {
      try {
        const fullAdjustment = await purchaseAmountAdjustmentApi.get(adjustment.purchaseOrderNumber);
        if (fullAdjustment && fullAdjustment.image) {
          setPreviewImage(`data:image/png;base64,${fullAdjustment.image}`);
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
      title: '采购单号(牵牛花)',
      dataIndex: 'purchaseOrderNumber',
      key: 'purchaseOrderNumber',
      width: 200,
      fixed: 'left' as const,
    },
    {
      title: '调整金额',
      dataIndex: 'adjustmentAmount',
      key: 'adjustmentAmount',
      width: 150,
      render: (amount: number) => amount !== null && amount !== undefined ? `¥${amount.toFixed(2)}` : '-',
    },
    {
      title: '异常调整原因备注',
      dataIndex: 'adjustmentReason',
      key: 'adjustmentReason',
      width: 250,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '图片',
      key: 'image',
      width: 120,
      render: (record: PurchaseAmountAdjustment) => (
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
      title: '财务审核意见备注',
      dataIndex: 'financeReviewRemark',
      key: 'financeReviewRemark',
      width: 250,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '财务审核状态',
      dataIndex: 'financeReviewStatus',
      key: 'financeReviewStatus',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '财务审核人',
      dataIndex: 'financeReviewer',
      key: 'financeReviewer',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '数据更新时间',
      dataIndex: 'dataUpdateTime',
      key: 'dataUpdateTime',
      width: 180,
      render: (text: string) => formatDateTime(text),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (record: PurchaseAmountAdjustment) => (
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
            onConfirm={() => handleDelete(record.purchaseOrderNumber)}
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
            <Title level={4} style={{ margin: 0 }}>采购单金额调整</Title>
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
                setSearchPurchaseOrderNumber('');
                setSearchAdjustmentAmount('');
                setSearchCreator('');
                setSearchFinanceReviewer('');
                setSearchDataUpdateTime('');
                setCurrentPage(1);
                loadAdjustments(1, undefined);
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
                placeholder="采购单号(牵牛花)"
                allowClear
                style={{ width: 180 }}
                value={searchPurchaseOrderNumber}
                onChange={(e) => setSearchPurchaseOrderNumber(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="调整金额"
                allowClear
                style={{ width: 180 }}
                value={searchAdjustmentAmount}
                onChange={(e) => setSearchAdjustmentAmount(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="创建人"
                allowClear
                style={{ width: 180 }}
                value={searchCreator}
                onChange={(e) => setSearchCreator(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="财务审核人"
                allowClear
                style={{ width: 180 }}
                value={searchFinanceReviewer}
                onChange={(e) => setSearchFinanceReviewer(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="数据更新时间"
                allowClear
                style={{ width: 180 }}
                value={searchDataUpdateTime}
                onChange={(e) => setSearchDataUpdateTime(e.target.value)}
                onPressEnter={handleSearchAll}
              />
            </Space>
          </Space>
        </div>
        <ResponsiveTable<PurchaseAmountAdjustment>
          columns={columns as any}
          dataSource={adjustments}
          rowKey="purchaseOrderNumber"
          loading={loading}
          isMobile={false}
          scroll={{ x: 2000 }}
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
              setPageSize(size || 20);
              loadAdjustments(
                page,
                searchText || undefined,
                searchPurchaseOrderNumber || undefined,
                searchAdjustmentAmount || undefined,
                searchCreator || undefined,
                searchFinanceReviewer || undefined,
                searchDataUpdateTime || undefined,
              );
            },
          }}
        />
      </Card>

      {/* 新增/编辑模态框 */}
      <Modal
        title={editingAdjustment ? '编辑调整记录' : '新增调整记录'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          setEditingAdjustment(null);
          form.resetFields();
          setImageFileList([]);
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
            label="采购单号(牵牛花)"
            name="purchaseOrderNumber"
            rules={[
              { required: true, message: '请输入采购单号' },
              { whitespace: true, message: '采购单号不能为空' }
            ]}
          >
            <Input placeholder="请输入采购单号" disabled={!!editingAdjustment} />
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

      {/* 批量新增模态框 */}
      <Modal
        title="批量新增调整记录"
        open={batchModalVisible}
        onOk={handleBatchSave}
        onCancel={() => {
          setBatchModalVisible(false);
          setBatchItems([]);
          setInvalidItems([]);
        }}
        okText="确定创建"
        cancelText="取消"
        width={900}
        destroyOnClose
      >
        <div style={{
          marginBottom: 16,
          padding: '16px',
          background: '#f5f5f5',
          borderRadius: '4px',
        }}>
          <div style={{
            marginBottom: 8,
            color: '#666',
            fontSize: 14,
          }}>
            提示：您可以从 Excel 中复制数据（包含采购单号(牵牛花)、调整金额、异常调整原因备注、财务审核意见备注、财务审核状态、财务审核人列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）。注意：图片列会被忽略，设为空值。
          </div>
          <Input.TextArea
            placeholder="在此处粘贴 Excel 数据（Ctrl+V），每行一条记录，字段用制表符或逗号分隔&#10;格式：采购单号(牵牛花)	调整金额	异常调整原因备注	财务审核意见备注	财务审核状态	财务审核人&#10;示例：PO001	100.00	备注	审核意见	已审核	张三"
            rows={4}
            onPaste={handlePaste}
            style={{
              fontFamily: 'monospace',
              fontSize: 14,
            }}
          />
        </div>

        {/* 有效数据预览表格 */}
        {batchItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#52c41a' }}>
              ✓ 有效数据 ({batchItems.length} 条)
            </div>
            <Table
              columns={[
                {
                  title: '采购单号(牵牛花)',
                  dataIndex: 'purchaseOrderNumber',
                  key: 'purchaseOrderNumber',
                  render: (text: string) => (
                    <span style={{ color: !text ? 'red' : 'inherit' }}>
                      {text || '(必填)'}
                    </span>
                  ),
                },
                {
                  title: '调整金额',
                  dataIndex: 'adjustmentAmount',
                  key: 'adjustmentAmount',
                  render: (v: any) => v !== null && v !== undefined ? `¥${Number(v).toFixed(2)}` : '-',
                },
                {
                  title: '异常调整原因备注',
                  dataIndex: 'adjustmentReason',
                  key: 'adjustmentReason',
                  render: (v: any) => v || '-',
                },
                {
                  title: '财务审核意见备注',
                  dataIndex: 'financeReviewRemark',
                  key: 'financeReviewRemark',
                  render: (v: any) => v || '-',
                },
                {
                  title: '财务审核状态',
                  dataIndex: 'financeReviewStatus',
                  key: 'financeReviewStatus',
                  render: (v: any) => v || '-',
                },
                {
                  title: '财务审核人',
                  dataIndex: 'financeReviewer',
                  key: 'financeReviewer',
                  render: (v: any) => v || '-',
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_: any, record: PurchaseAmountAdjustment, index: number) => (
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        setBatchItems(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      删除
                    </Button>
                  ),
                },
              ]}
              dataSource={batchItems.map((item, index) => ({ ...item, key: index }))}
              pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条记录` }}
              size="small"
            />
          </div>
        )}

        {/* 验证失败数据表格 */}
        {invalidItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#ff4d4f' }}>
              ✗ 验证失败数据 ({invalidItems.length} 条)
            </div>
            <Table
              columns={[
                {
                  title: '采购单号(牵牛花)',
                  key: 'purchaseOrderNumber',
                  render: (_: any, record: { item: PurchaseAmountAdjustment; reasons: string[] }) => (
                    <span style={{ color: !record.item.purchaseOrderNumber ? 'red' : 'inherit' }}>
                      {record.item.purchaseOrderNumber || '(必填)'}
                    </span>
                  ),
                },
                {
                  title: '调整金额',
                  key: 'adjustmentAmount',
                  render: (_: any, record: { item: PurchaseAmountAdjustment; reasons: string[] }) =>
                    record.item.adjustmentAmount !== null && record.item.adjustmentAmount !== undefined
                      ? `¥${Number(record.item.adjustmentAmount).toFixed(2)}` : '-'
                },
                {
                  title: '异常调整原因备注',
                  key: 'adjustmentReason',
                  render: (_: any, record: { item: PurchaseAmountAdjustment; reasons: string[] }) =>
                    record.item.adjustmentReason || '-'
                },
                {
                  title: '财务审核意见备注',
                  key: 'financeReviewRemark',
                  render: (_: any, record: { item: PurchaseAmountAdjustment; reasons: string[] }) =>
                    record.item.financeReviewRemark || '-'
                },
                {
                  title: '财务审核状态',
                  key: 'financeReviewStatus',
                  render: (_: any, record: { item: PurchaseAmountAdjustment; reasons: string[] }) =>
                    record.item.financeReviewStatus || '-'
                },
                {
                  title: '财务审核人',
                  key: 'financeReviewer',
                  render: (_: any, record: { item: PurchaseAmountAdjustment; reasons: string[] }) =>
                    record.item.financeReviewer || '-'
                },
                {
                  title: '失败原因',
                  key: 'reasons',
                  width: 300,
                  render: (_: any, record: { item: PurchaseAmountAdjustment; reasons: string[] }) => (
                    <div>
                      {record.reasons.map((reason, idx) => (
                        <Tag key={idx} color="error" style={{ marginBottom: 4, display: 'block' }}>
                          {reason}
                        </Tag>
                      ))}
                    </div>
                  ),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_: any, record: { item: PurchaseAmountAdjustment; reasons: string[] }, index: number) => (
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        setInvalidItems(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      删除
                    </Button>
                  ),
                },
              ]}
              dataSource={invalidItems.map((item, index) => ({ ...item, key: index }))}
              pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条记录` }}
              size="small"
              style={{
                backgroundColor: '#fff1f0',
              }}
            />
          </div>
        )}

        {/* 无数据提示 */}
        {batchItems.length === 0 && invalidItems.length === 0 && (
          <div style={{
            padding: 40,
            textAlign: 'center',
            color: '#999',
            fontSize: 14
          }}>
            暂无数据，请粘贴数据到上方输入框
          </div>
        )}
      </Modal>

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

