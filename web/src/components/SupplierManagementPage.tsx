"use client";

import { formatDateTime } from '@/lib/dateUtils';
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Row,
  Space,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message
} from 'antd';
import { useEffect, useState } from 'react';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { Title } = Typography;
const { TextArea } = Input;

// 接口定义
interface SupplierBasicInfo {
  supplierCode: string;
  supplierName: string;
  deliveryDays: number;
  officeAddress: string;
  contactPerson: string;
  contactPhone: string;
}

interface SupplierFullInfo extends SupplierBasicInfo {
  minOrderAmount?: number;
  minOrderQuantity?: number;
  orderRemarks?: string;
  wangwangMessage?: string;
}

interface SupplierManagement {
  supplierCode: string;
  minOrderAmount?: number;
  minOrderQuantity?: number;
  orderRemarks?: string;
  wangwangMessage?: string;
}

interface Statistics {
  totalSuppliers: number;
  managedSuppliers: number;
  averageDeliveryDays: number;
}

// API函数
const supplierApi = {
  async getAllSuppliers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    contactPerson?: string,
    officeAddress?: string
  ): Promise<{ data: SupplierFullInfo[]; total: number }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) {
      params.append('search', search);
    }
    if (contactPerson) {
      params.append('contactPerson', contactPerson);
    }
    if (officeAddress) {
      params.append('officeAddress', officeAddress);
    }

    const response = await fetch(`/api/suppliers?${params}`);
    if (!response.ok) {
      throw new Error('获取供应商列表失败');
    }
    return response.json();
  },

  async getSupplier(supplierCode: string): Promise<SupplierFullInfo | null> {
    const response = await fetch(`/api/suppliers/${supplierCode}`);
    if (!response.ok) {
      throw new Error('获取供应商信息失败');
    }
    return response.json();
  },

  async upsertSupplierManagement(data: SupplierManagement): Promise<SupplierManagement> {
    const response = await fetch('/api/suppliers/management', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('保存供应商管理信息失败');
    }
    return response.json();
  },

  async deleteSupplierManagement(supplierCode: string): Promise<boolean> {
    const response = await fetch(`/api/suppliers/management/${supplierCode}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('删除供应商管理信息失败');
    }
    return response.json();
  },

  async getStatistics(): Promise<Statistics> {
    const response = await fetch('/api/suppliers/stats/summary');
    if (!response.ok) {
      throw new Error('获取统计信息失败');
    }
    return response.json();
  },

  async createSupplier(data: {
    supplierCode: string;
    supplierName?: string;
    deliveryDays?: number;
    officeAddress?: string;
    contactPerson?: string;
    contactPhone?: string;
  }): Promise<any> {
    const response = await fetch('/api/supplier-management/create-supplier', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let errorMessage = '创建供应商失败';
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || errorMessage;
      } catch (e) {
        // 如果响应不是 JSON，使用状态文本
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  },
};

export default function SupplierManagementPage() {
  const [suppliers, setSuppliers] = useState<SupplierFullInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  const [contactPersonSearch, setContactPersonSearch] = useState('');
  const [officeAddressSearch, setOfficeAddressSearch] = useState('');
  const [statistics, setStatistics] = useState<Statistics | null>(null);

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierFullInfo | null>(null);
  const [form] = Form.useForm();

  // 新增供应商模态框状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  // 修改日志相关状态
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 加载供应商列表
  const loadSuppliers = async (
    page: number = currentPage,
    search?: string,
    contactPerson?: string,
    officeAddress?: string
  ) => {
    try {
      setLoading(true);
      const result = await supplierApi.getAllSuppliers(page, pageSize, search, contactPerson, officeAddress);
      setSuppliers(result.data);
      setTotal(result.total);
    } catch (error) {
      message.error('加载供应商列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 加载修改日志
  const loadLogs = async (supplierCode: string) => {
    setLogsLoading(true);
    try {
      const response = await fetch(
        `/api/suppliers/management/logs/${encodeURIComponent(supplierCode)}`
      );
      const result = await response.json();
      setLogs(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('[SupplierManagement] Load logs error:', error);
      message.error('加载日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadSuppliers();
  }, []);

  // 从 localStorage 加载列显示偏好和顺序
  useEffect(() => {
    const savedHiddenColumns = localStorage.getItem('supplier_management_hidden_columns');
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    }

    const savedColumnOrder = localStorage.getItem('supplier_management_column_order');
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
    localStorage.setItem('supplier_management_hidden_columns', JSON.stringify(Array.from(hidden)));
  };

  // 保存列顺序到 localStorage
  const saveColumnOrder = (order: string[]) => {
    localStorage.setItem('supplier_management_column_order', JSON.stringify(order));
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

  // 移动列函数（将在allColumns定义后重新实现）
  let handleMoveColumn: (columnKey: string, direction: 'up' | 'down') => void = () => { };

  // 列顺序变更
  const handleColumnOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    saveColumnOrder(newOrder);
  };

  // 搜索处理
  const handleSearch = () => {
    setCurrentPage(1);
    loadSuppliers(1, searchText, contactPersonSearch, officeAddressSearch);
  };

  // 重置处理
  const handleReset = () => {
    setSearchText('');
    setContactPersonSearch('');
    setOfficeAddressSearch('');
    setCurrentPage(1);
    loadSuppliers(1, '', '', '');
  };

  // 打开编辑模态框
  const handleEdit = (supplier: SupplierFullInfo) => {
    setEditingSupplier(supplier);
    setActiveTab('edit');
    setLogs([]);
    form.setFieldsValue({
      supplierCode: supplier.supplierCode,
      minOrderAmount: supplier.minOrderAmount,
      minOrderQuantity: supplier.minOrderQuantity,
      orderRemarks: supplier.orderRemarks,
      wangwangMessage: supplier.wangwangMessage,
    });
    setModalVisible(true);
    // 加载修改日志
    loadLogs(supplier.supplierCode);
  };

  // 保存供应商管理信息
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 获取用户信息
      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
      const displayName = typeof window !== 'undefined' ? (
        localStorage.getItem('displayName') ||
        localStorage.getItem('display_name')
      ) : null;

      // 调用原有的API（包含用户信息）
      await supplierApi.upsertSupplierManagement({
        ...values,
        userId: userId ? parseInt(userId) : undefined,
        userName: displayName || undefined,
      });

      message.success('保存成功');
      setModalVisible(false);
      loadSuppliers(currentPage, searchText, contactPersonSearch, officeAddressSearch);
    } catch (error) {
      message.error('保存失败');
      console.error(error);
    }
  };

  // 清空供应商管理状态
  const handleDelete = async (supplierCode: string) => {
    try {
      await supplierApi.deleteSupplierManagement(supplierCode);
      message.success('清空管理信息成功');
      loadSuppliers(currentPage, searchText, contactPersonSearch, officeAddressSearch);
    } catch (error) {
      message.error('清空管理信息失败');
      console.error(error);
    }
  };

  // 打开新增供应商模态框
  const handleCreate = () => {
    createForm.resetFields();
    setCreateModalVisible(true);
  };

  // 保存新增供应商
  const handleCreateSave = async () => {
    try {
      const values = await createForm.validateFields();
      await supplierApi.createSupplier(values);
      message.success('创建供应商成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      setCurrentPage(1);
      loadSuppliers(1, searchText, contactPersonSearch, officeAddressSearch);
    } catch (error: any) {
      message.error(error.message || '创建供应商失败');
      console.error(error);
    }
  };

  // 供应商管理标签组件
  const ManagementTag = () => (
    <Tag color="green" style={{ marginLeft: 4 }}>
      (供应商管理)
    </Tag>
  );

  // 表格列定义
  const allColumns = [
    {
      title: '供应商编码',
      dataIndex: 'supplierCode',
      key: 'supplierCode',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: '供应商名称',
      dataIndex: 'supplierName',
      key: 'supplierName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 120,
    },
    {
      title: '办公地址',
      dataIndex: 'officeAddress',
      key: 'officeAddress',
      width: 200,
      ellipsis: true,
    },
    {
      title: '交货天数',
      dataIndex: 'deliveryDays',
      key: 'deliveryDays',
      width: 100,
      render: (days: number) => (
        <Tag color={days <= 3 ? 'green' : days <= 7 ? 'orange' : 'red'}>
          {days}天
        </Tag>
      ),
    },
    {
      title: (
        <span>
          最小订货金额
          <ManagementTag />
        </span>
      ),
      dataIndex: 'minOrderAmount',
      key: 'minOrderAmount',
      width: 150,
      render: (amount: number) => amount ? `¥${amount.toLocaleString()}` : '-',
    },
    {
      title: (
        <span>
          最小订货数量
          <ManagementTag />
        </span>
      ),
      dataIndex: 'minOrderQuantity',
      key: 'minOrderQuantity',
      width: 150,
      render: (quantity: number) => quantity ? quantity.toLocaleString() : '-',
    },
    {
      title: (
        <span>
          供应商下单备注
          <ManagementTag />
        </span>
      ),
      dataIndex: 'orderRemarks',
      key: 'orderRemarks',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: (
        <span>
          下单后联系供应商话术
          <ManagementTag />
        </span>
      ),
      dataIndex: 'wangwangMessage',
      key: 'wangwangMessage',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '管理状态',
      key: 'managementStatus',
      width: 100,
      render: (record: SupplierFullInfo) => (
        <Tag color={record.minOrderAmount || record.minOrderQuantity ? 'blue' : 'default'}>
          {record.minOrderAmount || record.minOrderQuantity ? '已管理' : '未管理'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (record: SupplierFullInfo) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {(record.minOrderAmount || record.minOrderQuantity) && (
            <Popconfirm
              title="确定要清空这个供应商的管理信息吗？"
              onConfirm={() => handleDelete(record.supplierCode)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                清空管理信息
              </Button>
            </Popconfirm>
          )}
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

  return (
    <div style={{ padding: 0 }}>
      {/* 主要内容 */}
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>供应商管理</Title>
          </Space>
        }
        extra={
          <Space wrap>
            <Input
              placeholder="搜索供应商名称或编码"
              allowClear
              style={{ width: 200 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={() => handleSearch()}
            />
            <Input
              placeholder="搜索联系人"
              allowClear
              style={{ width: 150 }}
              value={contactPersonSearch}
              onChange={(e) => setContactPersonSearch(e.target.value)}
              onPressEnter={() => handleSearch()}
            />
            <Input
              placeholder="搜索办公地址"
              allowClear
              style={{ width: 200 }}
              value={officeAddressSearch}
              onChange={(e) => setOfficeAddressSearch(e.target.value)}
              onPressEnter={() => handleSearch()}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => handleSearch()}
            >
              搜索
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新增供应商
            </Button>
            <Popover
              content={
                <ColumnSettings
                  columns={allColumns}
                  hiddenColumns={hiddenColumns}
                  columnOrder={columnOrder}
                  onToggleVisibility={handleToggleColumnVisibility}
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
              <Button icon={<SettingOutlined />}>列设置</Button>
            </Popover>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              重置
            </Button>
          </Space>
        }
      >
        <ResponsiveTable<SupplierFullInfo>
          tableId="supplier-management"
          columns={columns as any}
          dataSource={suppliers}
          rowKey="supplierCode"
          loading={loading}
          isMobile={false}
          scroll={{ x: 2000, y: 600 }}
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
              loadSuppliers(page, searchText, contactPersonSearch, officeAddressSearch);
            },
          }}
        />
      </Card>


      {/* 编辑模态框 */}
      <Modal
        title={`编辑供应商管理信息 - ${editingSupplier?.supplierName}`}
        open={modalVisible}
        onOk={activeTab === 'edit' ? handleSave : undefined}
        onCancel={() => {
          setModalVisible(false);
          setEditingSupplier(null);
          form.resetFields();
        }}
        width={800}
        okText="保存"
        cancelText="取消"
        footer={activeTab === 'logs' ? [
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ] : undefined}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'edit',
              label: '编辑信息',
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{
                    minOrderAmount: undefined,
                    minOrderQuantity: undefined,
                    orderRemarks: '',
                    wangwangMessage: '',
                  }}
                >
                  <Form.Item name="supplierCode" hidden>
                    <Input />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="最小订货金额"
                        name="minOrderAmount"
                        rules={[
                          { type: 'number', min: 0, message: '金额不能为负数' }
                        ]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder="请输入最小订货金额"
                          formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value!.replace(/¥\s?|(,*)/g, '')}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="最小订货数量"
                        name="minOrderQuantity"
                        rules={[
                          { type: 'number', min: 0, message: '数量不能为负数' }
                        ]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder="请输入最小订货数量"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label="供应商下单备注"
                    name="orderRemarks"
                  >
                    <TextArea
                      rows={4}
                      placeholder="请输入订货相关的备注信息"
                      maxLength={500}
                      showCount
                    />
                  </Form.Item>

                  <Form.Item
                    label="下单后联系供应商话术"
                    name="wangwangMessage"
                  >
                    <TextArea
                      rows={4}
                      placeholder="请输入下单后联系供应商的话术"
                      maxLength={500}
                      showCount
                    />
                  </Form.Item>

                  {editingSupplier && (
                    <Card size="small" title="供应商基础信息" style={{ marginTop: 16 }}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <p><strong>供应商编码：</strong>{editingSupplier.supplierCode}</p>
                          <p><strong>联系人：</strong>{editingSupplier.contactPerson}</p>
                        </Col>
                        <Col span={12}>
                          <p><strong>联系电话：</strong>{editingSupplier.contactPhone}</p>
                          <p><strong>交货天数：</strong>{editingSupplier.deliveryDays}天</p>
                        </Col>
                      </Row>
                      <p><strong>办公地址：</strong>{editingSupplier.officeAddress}</p>
                    </Card>
                  )}
                </Form>
              ),
            },
            {
              key: 'logs',
              label: (
                <span>
                  <HistoryOutlined /> 修改日志
                </span>
              ),
              children: (
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                  {logsLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
                  ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                      暂无修改记录
                    </div>
                  ) : (
                    <Timeline
                      items={logs.map((log, index) => {
                        const fieldNameMap: Record<string, string> = {
                          minOrderAmount: '最小订货金额',
                          minOrderQuantity: '最小订货数量',
                          orderRemarks: '供应商下单备注',
                          wangwangMessage: '下单后联系供应商话术',
                        };

                        return {
                          children: (
                            <div key={index}>
                              <div style={{ fontWeight: 500, marginBottom: 8 }}>
                                {log.action === 'create' ? '创建记录' : log.action === 'update' ? '修改记录' : '删除记录'}
                              </div>
                              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                操作人：{log.userName || '系统'}
                              </div>
                              <div style={{ fontSize: 12, color: '#999' }}>
                                时间：{formatDateTime(log.createdAt)}
                              </div>
                              {log.changes && Object.keys(log.changes).length > 0 && (
                                <div style={{ marginTop: 8, fontSize: 12 }}>
                                  <div style={{ color: '#666', marginBottom: 4 }}>变更字段：</div>
                                  {Object.entries(log.changes).map(([key, value]: [string, any]) => (
                                    <div key={key} style={{ color: '#999', paddingLeft: 12 }}>
                                      {fieldNameMap[key] || key}: {value?.old || '(空)'} → {value?.new || '(空)'}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ),
                          color: log.action === 'create' ? 'green' : log.action === 'update' ? 'blue' : 'red',
                        };
                      })}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* 新增供应商模态框 */}
      <Modal
        title="新增供应商"
        open={createModalVisible}
        onOk={handleCreateSave}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
        >
          <Form.Item
            label="供应商编码"
            name="supplierCode"
            rules={[
              { required: true, message: '请输入供应商编码' },
              { whitespace: true, message: '供应商编码不能为空' }
            ]}
          >
            <Input placeholder="请输入供应商编码" />
          </Form.Item>

          <Form.Item
            label="供应商名称"
            name="supplierName"
          >
            <Input placeholder="请输入供应商名称" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="到货天数"
                name="deliveryDays"
                rules={[
                  { type: 'number', min: 0, message: '到货天数不能为负数' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入到货天数"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="联系电话"
                name="contactPhone"
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="联系人"
            name="contactPerson"
          >
            <Input placeholder="请输入联系人" />
          </Form.Item>

          <Form.Item
            label="办公地址"
            name="officeAddress"
          >
            <Input placeholder="请输入办公地址" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}