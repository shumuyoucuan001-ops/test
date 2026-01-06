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
  Tag,
  Typography,
  Upload
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCallback, useEffect, useState } from 'react';
import { aclApi, PurchaseAmountAdjustment, purchaseAmountAdjustmentApi } from '../lib/api';
import BatchAddModal, { FieldConfig } from './BatchAddModal';
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
  const [searchFinanceReviewStatus, setSearchFinanceReviewStatus] = useState<string>('');

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<PurchaseAmountAdjustment | null>(null);
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

  // 用户角色ID列表
  const [userRoleIds, setUserRoleIds] = useState<number[]>([]);

  // 加载调整记录列表
  const loadAdjustments = async (
    page: number = currentPage,
    search?: string,
    purchaseOrderNumber?: string,
    adjustmentAmount?: string,
    creator?: string,
    financeReviewer?: string,
    dataUpdateTime?: string,
    financeReviewStatus?: string,
    size?: number,
  ) => {
    try {
      setLoading(true);
      const currentSize = size ?? pageSize;
      const result = await purchaseAmountAdjustmentApi.getAll({
        page,
        limit: currentSize,
        search,
        purchaseOrderNumber,
        adjustmentAmount,
        creator,
        financeReviewer,
        dataUpdateTime,
        financeReviewStatus,
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

  // 加载用户角色
  useEffect(() => {
    const loadUserRoles = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (userId) {
          const roleIds = await aclApi.userAssignedRoleIds(Number(userId));
          setUserRoleIds(roleIds || []);
        }
      } catch (error) {
        console.error('加载用户角色失败:', error);
        setUserRoleIds([]);
      }
    };
    loadUserRoles();
  }, []);

  // 检查是否有审核权限（role_id为1,4,7）
  const hasReviewPermission = () => {
    return userRoleIds.some(roleId => [1, 4, 7].includes(roleId));
  };

  // 审核通过/取消审核
  const handleReview = async (adjustment: PurchaseAmountAdjustment) => {
    if (!hasReviewPermission()) {
      message.error('您没有审核权限');
      return;
    }

    try {
      const newStatus = adjustment.financeReviewStatus === '审核通过' ? '0' : '审核通过';
      await purchaseAmountAdjustmentApi.update(adjustment.purchaseOrderNumber, {
        financeReviewStatus: newStatus,
      });
      message.success(newStatus === '审核通过' ? '审核通过成功' : '取消审核成功');
      refreshAdjustments();
    } catch (error: any) {
      message.error(error.message || '操作失败');
      console.error(error);
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
      searchFinanceReviewStatus || undefined,
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
      searchFinanceReviewStatus || undefined,
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
      // 财务审核状态不允许编辑，不设置到表单中
      financeReviewer: adjustment.financeReviewer,
    });

    // 如果有图片标识，异步加载图片
    if (adjustment.hasImage === 1 && adjustment.purchaseOrderNumber) {
      try {
        const fullAdjustment = await purchaseAmountAdjustmentApi.get(adjustment.purchaseOrderNumber);
        if (fullAdjustment && fullAdjustment.image && typeof fullAdjustment.image === 'string') {
          // 如果已经是URL，直接使用；否则可能是base64（向后兼容）
          const imageUrl = fullAdjustment.image.startsWith('http')
            ? fullAdjustment.image
            : `data:image/png;base64,${fullAdjustment.image}`;
          setImageFileList([{
            uid: '-1',
            name: 'image.png',
            status: 'done',
            url: imageUrl,
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
        // 财务审核状态在新增时默认为"0"，编辑时不允许修改
        financeReviewStatus: editingAdjustment ? undefined : '0',
        financeReviewer: values.financeReviewer || undefined,
      };

      if (editingAdjustment && editingAdjustment.purchaseOrderNumber) {
        // 更新时，不传递财务审核状态（保持原值）
        delete adjustmentData.financeReviewStatus;
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
      message.error((editingAdjustment ? '更新' : '创建') + '失败: ' + errorMessage);
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

  const handleBatchAdd = () => {
    setBatchModalVisible(true);
  };

  // 批量新增字段配置
  const batchAddFields: FieldConfig<PurchaseAmountAdjustment>[] = [
    {
      key: 'purchaseOrderNumber' as keyof PurchaseAmountAdjustment,
      label: '采购单号(牵牛花)',
      excelHeaderName: ['采购单号(牵牛花)', '采购单号', '牵牛花采购单号'],
      required: true,
      index: 0,
    },
    {
      key: 'adjustmentAmount' as keyof PurchaseAmountAdjustment,
      label: '调整金额',
      excelHeaderName: '调整金额',
      required: false,
      index: 1,
      transform: (value: string) => {
        const num = Number(value);
        return isNaN(num) ? undefined : num;
      },
    },
    {
      key: 'adjustmentReason' as keyof PurchaseAmountAdjustment,
      label: '调整原因',
      excelHeaderName: '调整原因',
      required: false,
      index: 2,
    },
    {
      key: 'financeReviewRemark' as keyof PurchaseAmountAdjustment,
      label: '财务审核备注',
      excelHeaderName: '财务审核备注',
      required: false,
      index: 3,
    },
    {
      key: 'financeReviewer' as keyof PurchaseAmountAdjustment,
      label: '财务审核人',
      excelHeaderName: '财务审核人',
      required: false,
      index: 4,
    },
  ];

  // 创建数据项
  const createBatchItem = useCallback((parts: string[]): Partial<PurchaseAmountAdjustment> => {
    let adjustmentAmount: number | undefined;
    if (parts[1] && parts[1].trim() !== '') {
      const amount = Number(parts[1]);
      adjustmentAmount = isNaN(amount) ? undefined : amount;
    }

    return {
      purchaseOrderNumber: parts[0] || '',
      adjustmentAmount: adjustmentAmount,
      adjustmentReason: parts[2] && parts[2].trim() !== '' ? parts[2].trim() : undefined,
      image: undefined, // 图片列忽略，设为空值
      financeReviewRemark: parts[3] && parts[3].trim() !== '' ? parts[3].trim() : undefined,
      financeReviewStatus: undefined, // 财务审核状态不允许编辑，批量新增时默认为"0"（后端处理）
      financeReviewer: parts[4] && parts[4].trim() !== '' ? parts[4].trim() : undefined,
    };
  }, []);

  // 验证数据项
  const validateBatchItem = useCallback((item: Partial<PurchaseAmountAdjustment>): string[] => {
    const reasons: string[] = [];
    if (!item.purchaseOrderNumber || item.purchaseOrderNumber.trim() === '') {
      reasons.push('采购单号(牵牛花)为必填');
    }
    if (item.adjustmentAmount !== undefined && isNaN(Number(item.adjustmentAmount))) {
      reasons.push(`调整金额格式无效: ${item.adjustmentAmount}`);
    }
    return reasons;
  }, []);

  // 批量保存
  const handleBatchSave = useCallback(async (validItems: PurchaseAmountAdjustment[]) => {
    try {
      const result = await purchaseAmountAdjustmentApi.batchCreate(validItems);
      if (result.errors && result.errors.length > 0) {
        message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
      }
      message.success('采购单金额调整-批量新增数据已完成');
      refreshAdjustments();
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
  const handleViewImage = async (adjustment: PurchaseAmountAdjustment) => {
    if (adjustment.purchaseOrderNumber) {
      try {
        const fullAdjustment = await purchaseAmountAdjustmentApi.get(adjustment.purchaseOrderNumber);
        console.log('[PurchaseAmountAdjustmentPage] 查看图片 - fullAdjustment:', fullAdjustment);
        if (fullAdjustment && fullAdjustment.image && typeof fullAdjustment.image === 'string' && fullAdjustment.image.trim() !== '') {
          // 如果已经是URL，直接使用；否则可能是base64（向后兼容）
          const imageUrl = fullAdjustment.image.startsWith('http')
            ? fullAdjustment.image
            : `data:image/png;base64,${fullAdjustment.image}`;
          console.log('[PurchaseAmountAdjustmentPage] 设置预览图片URL:', imageUrl);
          setPreviewImage(imageUrl);
          setPreviewVisible(true);
        } else {
          console.log('[PurchaseAmountAdjustmentPage] 该记录没有图片或图片为空, fullAdjustment.image:', fullAdjustment?.image);
          message.info('该记录没有图片');
        }
      } catch (error) {
        console.error('[PurchaseAmountAdjustmentPage] 获取图片失败:', error);
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
      render: (text: string, record: PurchaseAmountAdjustment) => {
        if (text === '审核通过') {
          return <Tag color="blue">审核通过</Tag>;
        }
        return text || '-';
      },
    },
    {
      title: '审核操作',
      key: 'reviewAction',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: PurchaseAmountAdjustment) => {
        if (!hasReviewPermission()) {
          return '-';
        }
        const isApproved = record.financeReviewStatus === '审核通过';
        return (
          <Button
            type={isApproved ? 'default' : 'primary'}
            size="small"
            onClick={() => handleReview(record)}
          >
            {isApproved ? '取消审核' : '审核通过'}
          </Button>
        );
      },
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
                setSearchFinanceReviewStatus('');
                setCurrentPage(1);
                // 重置时传入空的搜索参数，确保立即查询默认数据
                loadAdjustments(1, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
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
              <Select
                placeholder="财务审核状态"
                allowClear
                style={{ width: 180 }}
                value={searchFinanceReviewStatus || undefined}
                onChange={(value) => {
                  setSearchFinanceReviewStatus(value || '');
                  // 选择后自动触发查询
                  setCurrentPage(1);
                  loadAdjustments(
                    1,
                    searchText || undefined,
                    searchPurchaseOrderNumber || undefined,
                    searchAdjustmentAmount || undefined,
                    searchCreator || undefined,
                    searchFinanceReviewer || undefined,
                    searchDataUpdateTime || undefined,
                    value || undefined,
                  );
                }}
                options={[
                  { label: '审核通过', value: '审核通过' },
                  { label: '0', value: '0' },
                ]}
              />
            </Space>
          </Space>
        </div>
        <ResponsiveTable<PurchaseAmountAdjustment>
          tableId="purchase-amount-adjustment"
          columns={columns as any}
          dataSource={adjustments}
          rowKey="purchaseOrderNumber"
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
                loadAdjustments(
                  page,
                  searchText || undefined,
                  searchPurchaseOrderNumber || undefined,
                  searchAdjustmentAmount || undefined,
                  searchCreator || undefined,
                  searchFinanceReviewer || undefined,
                  searchDataUpdateTime || undefined,
                  searchFinanceReviewStatus || undefined,
                  size,
                );
              } else {
                loadAdjustments(
                  page,
                  searchText || undefined,
                  searchPurchaseOrderNumber || undefined,
                  searchAdjustmentAmount || undefined,
                  searchCreator || undefined,
                  searchFinanceReviewer || undefined,
                  searchDataUpdateTime || undefined,
                  searchFinanceReviewStatus || undefined,
                );
              }
            },
            onShowSizeChange: (current, size) => {
              setCurrentPage(1);
              setPageSize(size);
              // 切换分页大小时，立即加载数据，传入新的size
              loadAdjustments(
                1,
                searchText || undefined,
                searchPurchaseOrderNumber || undefined,
                searchAdjustmentAmount || undefined,
                searchCreator || undefined,
                searchFinanceReviewer || undefined,
                searchDataUpdateTime || undefined,
                searchFinanceReviewStatus || undefined,
                size,
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

          {/* 财务审核状态不允许编辑，新增时默认为"0" */}

          <Form.Item
            label="财务审核人"
            name="financeReviewer"
          >
            <Input placeholder="请输入财务审核人" maxLength={20} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量新增模态框 */}
      <BatchAddModal<PurchaseAmountAdjustment>
        open={batchModalVisible}
        title="批量新增调整记录"
        hint="您可以从 Excel 中复制数据（包含采购单号(牵牛花)、调整金额、异常调整原因备注、财务审核意见备注、财务审核人列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件。注意：图片列和财务审核状态列会被忽略，财务审核状态默认为'0'。"
        fields={batchAddFields}
        formatHint="格式：采购单号(牵牛花)	调整金额	异常调整原因备注	财务审核意见备注	财务审核人"
        example="PO001	100.00	备注	审核意见	张三"
        onCancel={() => setBatchModalVisible(false)}
        onSave={handleBatchSave}
        createItem={createBatchItem}
        validateItem={validateBatchItem}
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
        {previewImage && typeof previewImage === 'string' && previewImage.trim() !== '' ? (
          <Image
            src={previewImage}
            alt="预览"
            style={{ width: '100%' }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJY6mQwsHuxsSDqUoZDUlYNJ2OA4MRJgV0Qy1XDw8CwyE6BYsWAw48gxq4UZgUXw8L8YODxKkEmxQ4DA/4UhFjaWA/YNwHZGMUYWh4MbOcO8CAx6ERsEe4AFmEpAwM/4HAtOSQYgcg/YdMRg8B4B4AKd0vQFiMCh4BoH8H0G4F0DqQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <span style={{ color: '#999' }}>图片加载失败或图片不存在</span>
          </div>
        )}
      </Modal>
    </div>
  );
}

