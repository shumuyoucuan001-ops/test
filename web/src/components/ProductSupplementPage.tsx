"use client";

import { LabelDataRecord, labelDataApi } from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';
import { DeleteOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Tabs,
  Tag,
  Timeline,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import ResponsiveTable from './ResponsiveTable';

const { Search } = Input;

export default function ProductSupplementPage() {
  const { modal } = App.useApp();
  const [data, setData] = useState<LabelDataRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchSku, setSearchSku] = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<LabelDataRecord | null>(null);
  const [form] = Form.useForm();
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const result = await labelDataApi.getAll({
        sku: searchSku || undefined,
        supplierName: searchSupplier || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });
      setData(result.data || []);
      setTotal(result.total || 0);
    } catch (error) {
      message.error('加载失败');
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentPage, pageSize]);

  const loadLogs = async (sku: string, supplierName: string) => {
    setLogsLoading(true);
    try {
      const result = await labelDataApi.getLogs(sku, supplierName);
      setLogs(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('[ProductSupplement] Load logs error:', error);
      message.error('加载日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  const openModal = (item?: LabelDataRecord) => {
    setEditing(item || null);
    setActiveTab('edit');
    setLogs([]);

    if (item) {
      form.setFieldsValue({
        sku: item.sku,
        supplierName: item.supplierName,
        headerInfo: item.headerInfo,
        executionStandard: item.executionStandard,
        productName: item.productName,
        manufacturerName: item.manufacturerName,
        addressInfo: item.addressInfo,
        material: item.material,
        otherInfo: item.otherInfo,
      });
      // 加载日志
      loadLogs(item.sku, item.supplierName);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 从 localStorage 获取用户信息
      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
      const displayName = typeof window !== 'undefined' ? (
        localStorage.getItem('displayName') ||
        localStorage.getItem('display_name')
      ) : null;

      console.log('[ProductSupplement] Saving with user info:', { userId, displayName });

      // 使用正确的后端API端点
      await labelDataApi.create({
        sku: values.sku,
        supplierName: values.supplierName,
        headerInfo: values.headerInfo,
        executionStandard: values.executionStandard,
        productName: values.productName,
        manufacturerName: values.manufacturerName,
        addressInfo: values.addressInfo,
        material: values.material,
        otherInfo: values.otherInfo,
        userId: userId ? parseInt(userId, 10) : undefined,
        userName: displayName || undefined,
      });

      message.success('保存成功');
      setModalVisible(false);
      load();
    } catch (error) {
      console.error('Save error:', error);
      message.error('保存失败');
    }
  };

  const handleDelete = async (record: LabelDataRecord) => {
    console.log('[ProductSupplement] handleDelete called with record:', record);
    modal.confirm({
      title: '确认删除',
      content: `确定要删除 SKU: ${record.sku}, 供应商: ${record.supplierName} 的标签资料吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          console.log('[ProductSupplement] Deleting:', { sku: record.sku, supplier: record.supplierName });
          await labelDataApi.delete(record.sku, record.supplierName);
          message.success('删除成功');
          load();
        } catch (error) {
          console.error('[ProductSupplement] Delete error:', error);
          message.error('删除失败');
        }
      },
    });
  };

  const columns: ColumnsType<LabelDataRecord> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 220,
      fixed: 'left',
    },
    {
      title: '产品规格',
      dataIndex: 'productSpec',
      key: 'productSpec',
      width: 120,
      ellipsis: true,
      render: (text) => (
        <Tag color="blue">{text || '未找到规格信息'}</Tag>
      ),
    },
    {
      title: '供应商名称',
      dataIndex: 'supplierName',
      key: 'supplierName',
      width: 150,
    },
    {
      title: '抬头信息',
      dataIndex: 'headerInfo',
      key: 'headerInfo',
      width: 120,
      ellipsis: true,
    },
    {
      title: '执行标准',
      dataIndex: 'executionStandard',
      key: 'executionStandard',
      width: 150,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '厂家名称',
      dataIndex: 'manufacturerName',
      key: 'manufacturerName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '地址信息',
      dataIndex: 'addressInfo',
      key: 'addressInfo',
      width: 150,
      ellipsis: true,
    },
    {
      title: '材质',
      dataIndex: 'material',
      key: 'material',
      width: 100,
      ellipsis: true,
    },
    {
      title: '其他信息',
      dataIndex: 'otherInfo',
      key: 'otherInfo',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_: any, record: LabelDataRecord) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
            size="small"
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            size="small"
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="商品标签资料"
        extra={
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <Search
                placeholder="SKU 搜索"
                allowClear
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                onSearch={() => {
                  setCurrentPage(1);
                  load();
                }}
                style={{ width: '100%' }}
              />
              <Search
                placeholder="供应商搜索"
                allowClear
                value={searchSupplier}
                onChange={(e) => setSearchSupplier(e.target.value)}
                onSearch={() => {
                  setCurrentPage(1);
                  load();
                }}
                style={{ width: '100%' }}
              />
              <Button type="primary" onClick={() => openModal()} block>新增</Button>
            </div>
          ) : (
            <Space>
              <Search
                placeholder="SKU 搜索"
                allowClear
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                onSearch={() => {
                  setCurrentPage(1);
                  load();
                }}
                style={{ width: 200 }}
              />
              <Search
                placeholder="供应商搜索"
                allowClear
                value={searchSupplier}
                onChange={(e) => setSearchSupplier(e.target.value)}
                onSearch={() => {
                  setCurrentPage(1);
                  load();
                }}
                style={{ width: 200 }}
              />
              <Button type="primary" onClick={() => openModal()}>新增</Button>
            </Space>
          )
        }
      >
        <ResponsiveTable<LabelDataRecord>
          tableId="product-supplement"
          columns={columns}
          dataSource={data}
          rowKey={(r) => `${r.sku}_${r.supplierName}`}
          loading={loading}
          scroll={{ y: 600 }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
        />
      </Card>

      <Modal
        open={modalVisible}
        title={editing ? '编辑标签资料' : '新增标签资料'}
        onOk={activeTab === 'edit' ? handleSave : undefined}
        onCancel={() => setModalVisible(false)}
        width={800}
        okText="确定"
        cancelText="取消"
        footer={activeTab === 'edit' ? undefined : [
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'edit',
              label: '编辑信息',
              children: (
                <Form form={form} layout="vertical">
                  <Form.Item
                    name="sku"
                    label="SKU"
                    rules={[{ required: true, message: '请输入SKU' }]}
                  >
                    <Input maxLength={50} showCount disabled={!!editing} />
                  </Form.Item>

                  <Form.Item
                    name="supplierName"
                    label="供应商名称"
                    rules={[{ required: true, message: '请输入供应商名称' }]}
                  >
                    <Input maxLength={50} showCount disabled={!!editing} />
                  </Form.Item>

                  <Form.Item name="headerInfo" label="抬头信息">
                    <Input maxLength={30} showCount />
                  </Form.Item>

                  <Form.Item name="executionStandard" label="执行标准">
                    <Input maxLength={30} showCount />
                  </Form.Item>

                  <Form.Item name="productName" label="产品名称">
                    <Input maxLength={30} showCount />
                  </Form.Item>

                  <Form.Item name="manufacturerName" label="厂家名称">
                    <Input maxLength={26} showCount />
                  </Form.Item>

                  <Form.Item name="addressInfo" label="地址信息">
                    <Input maxLength={26} showCount />
                  </Form.Item>

                  <Form.Item name="material" label="材质">
                    <Input maxLength={30} showCount />
                  </Form.Item>

                  <Form.Item name="otherInfo" label="其他信息">
                    <Input maxLength={50} showCount />
                  </Form.Item>
                </Form>
              ),
            },
            ...(editing ? [{
              key: 'logs',
              label: (
                <span>
                  <HistoryOutlined /> 修改日志
                </span>
              ),
              children: (
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                  {editing && editing.createdAt && (
                    <div style={{
                      marginBottom: 16,
                      padding: 12,
                      background: '#f5f5f5',
                      borderRadius: 4,
                      fontSize: 13,
                      color: '#666'
                    }}>
                      创建时间：{formatDateTime(editing.createdAt)}
                    </div>
                  )}
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
                          productName: '产品名称',
                          headerInfo: '抬头信息',
                          executionStandard: '执行标准',
                          manufacturerName: '厂家名称',
                          addressInfo: '地址信息',
                          material: '材质',
                          otherInfo: '其他信息',
                        };

                        return {
                          children: (
                            <div key={index}>
                              <div style={{ fontWeight: 500, marginBottom: 8 }}>
                                {log.action === 'create' ? '创建记录' : '修改记录'}
                              </div>
                              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                操作人：{log.userName || log.userId || '系统'}
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
                          color: log.action === 'create' ? 'green' : 'blue',
                        };
                      })}
                    />
                  )}
                </div>
              ),
            }] : []),
          ]}
        />
      </Modal>
    </div>
  );
}





