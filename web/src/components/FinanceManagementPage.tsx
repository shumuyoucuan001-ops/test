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
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Row,
  Space,
  Tag,
  Typography,
  message,
  Upload,
  Image,
  Checkbox,
} from 'antd';
import { useEffect, useState } from 'react';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';
import { financeManagementApi, FinanceBill } from '../lib/api';
import type { UploadFile } from 'antd/es/upload/interface';

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

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<FinanceBill | null>(null);
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

  // 加载账单列表
  const loadBills = async (page: number = currentPage, search?: string) => {
    try {
      setLoading(true);
      const result = await financeManagementApi.getAll({
        page,
        limit: pageSize,
        search,
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

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchText(value);
    setCurrentPage(1);
    loadBills(1, value);
  };

  // 打开新增模态框
  const handleAdd = () => {
    setEditingBill(null);
    form.resetFields();
    setImageFileList([]);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (bill: FinanceBill) => {
    setEditingBill(bill);
    form.setFieldsValue({
      transactionNumber: bill.transactionNumber,
      qianniuhuaPurchaseNumber: bill.qianniuhuaPurchaseNumber,
      importExceptionRemark: bill.importExceptionRemark,
    });
    // 如果有图片，设置预览
    if (bill.image) {
      setImageFileList([{
        uid: '-1',
        name: 'image.png',
        status: 'done',
        url: `data:image/png;base64,${bill.image}`,
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

  // 保存账单
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
      loadBills();
    } catch (error: any) {
      message.error(error.message || '保存失败');
      console.error(error);
    }
  };

  // 删除账单
  const handleDelete = async (transactionNumber: string, qianniuhuaPurchaseNumber?: string) => {
    try {
      await financeManagementApi.delete(transactionNumber, qianniuhuaPurchaseNumber);
      message.success('删除成功');
      loadBills();
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
      loadBills();
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
      const transactionNumbers = values.transactionNumbers
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      if (transactionNumbers.length === 0) {
        message.error('请输入至少一个交易单号');
        return;
      }

      // 处理图片
      let imageBase64: string | undefined;
      if (batchImageFileList.length > 0 && batchImageFileList[0].originFileObj) {
        imageBase64 = await fileToBase64(batchImageFileList[0].originFileObj);
      }

      const bills: FinanceBill[] = transactionNumbers.map((tn: string) => ({
        transactionNumber: tn,
        qianniuhuaPurchaseNumber: values.qianniuhuaPurchaseNumber || undefined,
        importExceptionRemark: values.importExceptionRemark || undefined,
        image: imageBase64,
      }));

      const result = await financeManagementApi.batchCreate(bills);
      message.success(`成功创建 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      if (result.errors.length > 0) {
        message.warning(result.errors.join('; '));
      }
      setBatchModalVisible(false);
      loadBills();
    } catch (error: any) {
      message.error(error.message || '批量创建失败');
      console.error(error);
    }
  };

  // 查看图片
  const handleViewImage = async (bill: FinanceBill) => {
    if (!bill.image && bill.transactionNumber) {
      // 如果没有图片，尝试从服务器获取
      try {
        const fullBill = await financeManagementApi.get(bill.transactionNumber, bill.qianniuhuaPurchaseNumber);
        if (fullBill && fullBill.image) {
          setPreviewImage(`data:image/png;base64,${fullBill.image}`);
          setPreviewVisible(true);
        } else {
          message.info('该记录没有图片');
        }
      } catch (error) {
        message.error('获取图片失败');
      }
    } else if (bill.image) {
      setPreviewImage(`data:image/png;base64,${bill.image}`);
      setPreviewVisible(true);
    } else {
      message.info('该记录没有图片');
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
      width: 100,
      render: (record: FinanceBill) => (
        record.image || record.transactionNumber ? (
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
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
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
            <Title level={4} style={{ margin: 0 }}>账单手动绑定采购单</Title>
          </Space>
        }
        extra={
          <Space>
            <Search
              placeholder="搜索交易单号或牵牛花采购单号"
              allowClear
              style={{ width: 250 }}
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
                loadBills();
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <ResponsiveTable<FinanceBill>
          columns={columns as any}
          dataSource={bills}
          rowKey={(record) => `${record.transactionNumber}_${record.qianniuhuaPurchaseNumber || ''}`}
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
              loadBills(page, searchText);
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
          >
            <Input placeholder="请输入交易单号" disabled={!!editingBill} />
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
          >
            <Upload
              listType="picture-card"
              fileList={imageFileList}
              beforeUpload={beforeUpload}
              onChange={handleImageChange}
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
        </Form>
      </Modal>

      {/* 批量新增模态框 */}
      <Modal
        title="批量新增账单"
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
            label="交易单号（每行一个）"
            name="transactionNumbers"
            rules={[
              { required: true, message: '请输入交易单号' },
            ]}
          >
            <TextArea
              rows={10}
              placeholder="请输入交易单号，每行一个"
            />
          </Form.Item>

          <Form.Item
            label="牵牛花采购单号（可选，将应用到所有记录）"
            name="qianniuhuaPurchaseNumber"
          >
            <Input placeholder="请输入牵牛花采购单号" />
          </Form.Item>

          <Form.Item
            label="导入异常备注（可选，将应用到所有记录）"
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

