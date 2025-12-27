"use client";

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  UploadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Typography,
  message,
  Upload,
  Image,
  Select,
} from 'antd';
import { useEffect, useState } from 'react';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';
import { purchaseAmountAdjustmentApi, PurchaseAmountAdjustment } from '../lib/api';
import type { UploadFile } from 'antd/es/upload/interface';

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

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<PurchaseAmountAdjustment | null>(null);
  const [form] = Form.useForm();
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // 批量新增模态框状态
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchImageFileList, setBatchImageFileList] = useState<UploadFile[]>([]);

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 加载调整记录列表
  const loadAdjustments = async (page: number = currentPage, search?: string) => {
    try {
      setLoading(true);
      const result = await purchaseAmountAdjustmentApi.getAll({
        page,
        limit: pageSize,
        search,
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

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchText(value);
    setCurrentPage(1);
    loadAdjustments(1, value);
  };

  // 打开新增模态框
  const handleAdd = () => {
    setEditingAdjustment(null);
    form.resetFields();
    setImageFileList([]);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (adjustment: PurchaseAmountAdjustment) => {
    setEditingAdjustment(adjustment);
    form.setFieldsValue({
      purchaseOrderNumber: adjustment.purchaseOrderNumber,
      adjustmentAmount: adjustment.adjustmentAmount,
      adjustmentReason: adjustment.adjustmentReason,
      financeReviewRemark: adjustment.financeReviewRemark,
      financeReviewStatus: adjustment.financeReviewStatus,
      financeReviewer: adjustment.financeReviewer,
    });
    // 如果有图片，设置预览
    if (adjustment.image) {
      setImageFileList([{
        uid: '-1',
        name: 'image.png',
        status: 'done',
        url: `data:image/png;base64,${adjustment.image}`,
      }]);
    } else {
      setImageFileList([]);
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
        imageBase64 = await fileToBase64(imageFileList[0].originFileObj);
      } else if (imageFileList.length > 0 && imageFileList[0].url) {
        // 编辑时，如果图片没有变化，使用原有的base64
        const url = imageFileList[0].url;
        if (url.startsWith('data:image')) {
          imageBase64 = url.split(',')[1];
        }
      } else if (editingAdjustment && editingAdjustment.image && imageFileList.length === 0) {
        // 编辑时，如果原来有图片但现在清空了，使用空字符串来清空数据库中的值
        imageBase64 = '';
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
      loadAdjustments();
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
      loadAdjustments();
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
      loadAdjustments();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
      console.error(error);
    }
  };

  // 打开批量新增模态框
  const handleBatchAdd = () => {
    batchForm.resetFields();
    setBatchImageFileList([]);
    setBatchModalVisible(true);
  };

  // 批量新增保存
  const handleBatchSave = async () => {
    try {
      const values = await batchForm.validateFields();
      const purchaseOrderNumbers = values.purchaseOrderNumbers
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      if (purchaseOrderNumbers.length === 0) {
        message.error('请输入至少一个采购单号');
        return;
      }

      // 处理图片
      let imageBase64: string | undefined;
      if (batchImageFileList.length > 0 && batchImageFileList[0].originFileObj) {
        imageBase64 = await fileToBase64(batchImageFileList[0].originFileObj);
      }

      const adjustments: PurchaseAmountAdjustment[] = purchaseOrderNumbers.map((pn: string) => ({
        purchaseOrderNumber: pn,
        adjustmentAmount: values.adjustmentAmount,
        adjustmentReason: values.adjustmentReason || undefined,
        image: imageBase64,
        financeReviewRemark: values.financeReviewRemark || undefined,
        financeReviewStatus: values.financeReviewStatus || undefined,
        financeReviewer: values.financeReviewer || undefined,
      }));

      const result = await purchaseAmountAdjustmentApi.batchCreate(adjustments);
      message.success(`成功创建 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      if (result.errors.length > 0) {
        message.warning(result.errors.join('; '));
      }
      setBatchModalVisible(false);
      loadAdjustments();
    } catch (error: any) {
      message.error(error.message || '批量创建失败');
      console.error(error);
    }
  };

  // 查看图片
  const handleViewImage = async (adjustment: PurchaseAmountAdjustment) => {
    if (!adjustment.image && adjustment.purchaseOrderNumber) {
      // 如果没有图片，尝试从服务器获取
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
    } else if (adjustment.image) {
      setPreviewImage(`data:image/png;base64,${adjustment.image}`);
      setPreviewVisible(true);
    } else {
      message.info('该记录没有图片');
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
      width: 100,
      render: (record: PurchaseAmountAdjustment) => (
        record.image ? (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewImage(record)}
          >
            查看
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
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
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

    // 按照保存的顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter(Boolean) as typeof allColumns;

    // 过滤隐藏的列
    return orderedColumns.filter(col => !hiddenColumns.has(col.key as string));
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
            <Search
              placeholder="搜索采购单号、异常调整原因备注或财务审核意见备注"
              allowClear
              style={{ width: 300 }}
              onSearch={handleSearch}
            />
            <Popover
              content={
                <ColumnSettings
                  columns={allColumns}
                  hiddenColumns={hiddenColumns}
                  columnOrder={columnOrder}
                  onToggleVisibility={handleToggleColumnVisibility}
                  onMoveColumn={() => {}}
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
                loadAdjustments();
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
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
              loadAdjustments(page, searchText);
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
          >
            <Upload
              listType="picture-card"
              fileList={imageFileList}
              beforeUpload={beforeUpload}
              onChange={handleImageChange}
              onRemove={() => {
                setImageFileList([]);
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
          batchForm.resetFields();
          setBatchImageFileList([]);
        }}
        width={800}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={batchForm}
          layout="vertical"
        >
          <Form.Item
            label="采购单号（每行一个）"
            name="purchaseOrderNumbers"
            rules={[
              { required: true, message: '请输入采购单号' },
            ]}
          >
            <TextArea
              rows={10}
              placeholder="请输入采购单号，每行一个"
            />
          </Form.Item>

          <Form.Item
            label="调整金额（可选，将应用到所有记录）"
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
            label="异常调整原因备注（可选，将应用到所有记录）"
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
            label="图片（可选，将应用到所有记录）"
            help="支持上传图片，大小不超过10MB"
          >
            <Upload
              listType="picture-card"
              fileList={batchImageFileList}
              beforeUpload={beforeUpload}
              onChange={(info) => setBatchImageFileList(info.fileList)}
              maxCount={1}
            >
              {batchImageFileList.length < 1 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传图片</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <Form.Item
            label="财务审核意见备注（可选，将应用到所有记录）"
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
            label="财务审核状态（可选，将应用到所有记录）"
            name="financeReviewStatus"
          >
            <Input placeholder="请输入财务审核状态" maxLength={20} />
          </Form.Item>

          <Form.Item
            label="财务审核人（可选，将应用到所有记录）"
            name="financeReviewer"
          >
            <Input placeholder="请输入财务审核人" maxLength={20} />
          </Form.Item>
        </Form>
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

