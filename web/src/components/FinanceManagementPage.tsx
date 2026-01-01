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
  Table,
  Tag,
  Typography,
  Upload
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCallback, useEffect, useState } from 'react';
import { FinanceBill, financeManagementApi } from '../lib/api';
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
  const [batchItems, setBatchItems] = useState<FinanceBill[]>([]);
  const [invalidItems, setInvalidItems] = useState<Array<{ item: FinanceBill; reasons: string[] }>>([]);

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 加载账单列表
  const loadBills = async (
    page: number = currentPage,
    search?: string,
    transactionNumber?: string,
    qianniuhuaPurchaseNumber?: string,
    importExceptionRemark?: string,
    modifier?: string,
  ) => {
    try {
      setLoading(true);
      const result = await financeManagementApi.getAll({
        page,
        limit: pageSize,
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
        if (fullBill && fullBill.image) {
          setImageFileList([{
            uid: '-1',
            name: 'image.png',
            status: 'done',
            url: `data:image/png;base64,${fullBill.image}`,
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
        // 编辑时，如果图片没有变化，使用原有的base64
        const url = imageFileList[0].url;
        if (url.startsWith('data:image')) {
          imageBase64 = url.split(',')[1];
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
      if (error?.errorFields) return;
      // 提取后端返回的错误消息
      let errorMessage = '保存失败';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      message.error(errorMessage);
      console.error('保存失败:', error);
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

    const newItems: FinanceBill[] = [];
    const newInvalidItems: Array<{ item: FinanceBill; reasons: string[] }> = [];

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

        // 验证交易单号必填
        if (!parts[0] || parts[0].trim() === '') {
          reasons.push('交易单号为必填');
        }

        const item: FinanceBill = {
          transactionNumber: parts[0] || '',
          qianniuhuaPurchaseNumber: parts[1] && parts[1].trim() !== '' ? parts[1].trim() : undefined,
          importExceptionRemark: parts[2] && parts[2].trim() !== '' ? parts[2].trim() : undefined,
          image: undefined, // 图片列忽略，设为空值
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
    const newInvalidItems: Array<{ item: FinanceBill; reasons: string[] }> = [];

    const validItems = batchItems.filter(item => {
      if (!item.transactionNumber || item.transactionNumber.trim() === '') {
        newInvalidItems.push({ item, reasons: ['交易单号为必填'] });
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
      message.warning('请至少填写一条有效数据（交易单号为必填）');
      return;
    }

    try {
      const result = await financeManagementApi.batchCreate(validItems);
      message.success(`成功创建 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      if (result.errors && result.errors.length > 0) {
        message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
      }
      setBatchModalVisible(false);
      setBatchItems([]);
      setInvalidItems([]);
      refreshBills();
    } catch (e: any) {
      // 提取后端返回的错误消息
      let errorMessage = '批量创建失败';
      if (e?.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e?.response?.data?.error) {
        errorMessage = e.response.data.error;
      } else if (e?.message) {
        errorMessage = e.message;
      }
      message.error(errorMessage);
      console.error('批量创建失败:', e);
    }
  };

  // 查看图片
  const handleViewImage = async (bill: FinanceBill) => {
    if (bill.transactionNumber) {
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
                loadBills(1, undefined);
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
              loadBills(
                page,
                searchText || undefined,
                searchTransactionNumber || undefined,
                searchQianniuhuaPurchaseNumber || undefined,
                searchImportExceptionRemark || undefined,
                searchModifier || undefined,
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
      <Modal
        title="批量新增账单"
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
            提示：您可以从 Excel 中复制数据（包含交易单号、牵牛花采购单号、导入异常备注列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴）。注意：图片列会被忽略，设为空值。
          </div>
          <Input.TextArea
            placeholder="在此处粘贴 Excel 数据（Ctrl+V），每行一条记录，字段用制表符或逗号分隔&#10;格式：交易单号	牵牛花采购单号	导入异常备注&#10;示例：TN001	PO001	备注信息"
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
                  title: '交易单号',
                  dataIndex: 'transactionNumber',
                  key: 'transactionNumber',
                  render: (text: string) => (
                    <span style={{ color: !text ? 'red' : 'inherit' }}>
                      {text || '(必填)'}
                    </span>
                  ),
                },
                {
                  title: '牵牛花采购单号',
                  dataIndex: 'qianniuhuaPurchaseNumber',
                  key: 'qianniuhuaPurchaseNumber',
                  render: (v: any) => v || '-',
                },
                {
                  title: '导入异常备注',
                  dataIndex: 'importExceptionRemark',
                  key: 'importExceptionRemark',
                  render: (v: any) => v || '-',
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  render: (_: any, record: FinanceBill, index: number) => (
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
                  title: '交易单号',
                  key: 'transactionNumber',
                  render: (_: any, record: { item: FinanceBill; reasons: string[] }) => (
                    <span style={{ color: !record.item.transactionNumber ? 'red' : 'inherit' }}>
                      {record.item.transactionNumber || '(必填)'}
                    </span>
                  ),
                },
                {
                  title: '牵牛花采购单号',
                  key: 'qianniuhuaPurchaseNumber',
                  render: (_: any, record: { item: FinanceBill; reasons: string[] }) =>
                    record.item.qianniuhuaPurchaseNumber || '-'
                },
                {
                  title: '导入异常备注',
                  key: 'importExceptionRemark',
                  render: (_: any, record: { item: FinanceBill; reasons: string[] }) =>
                    record.item.importExceptionRemark || '-'
                },
                {
                  title: '失败原因',
                  key: 'reasons',
                  width: 300,
                  render: (_: any, record: { item: FinanceBill; reasons: string[] }) => (
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
                  render: (_: any, record: { item: FinanceBill; reasons: string[] }, index: number) => (
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

