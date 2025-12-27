"use client";

import { CreateTemplateDto, LabelTemplate, templateApi, UpdateTemplateDto } from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Space,
  Switch,
  Tabs
} from 'antd';
import { useEffect, useState } from 'react';
import ResponsiveTable from './ResponsiveTable';

const { TextArea } = Input;
const { TabPane } = Tabs;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LabelTemplate | null>(null);
  const [previewData, setPreviewData] = useState<{ template: LabelTemplate; rendered: string } | null>(null);
  const [form] = Form.useForm();

  // 加载模板列表
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await templateApi.getAll();
      setTemplates(data);
    } catch (error) {
      message.error('加载模板失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // 打开新增/编辑模态框
  const openModal = (template?: LabelTemplate) => {
    setEditingTemplate(template || null);
    if (template) {
      form.setFieldsValue(template);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingTemplate(null);
    form.resetFields();
  };

  // 保存模板
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingTemplate) {
        // 更新
        await templateApi.update(editingTemplate.id, values as UpdateTemplateDto);
        message.success('模板更新成功');
      } else {
        // 新增
        await templateApi.create(values as CreateTemplateDto);
        message.success('模板创建成功');
      }

      closeModal();
      loadTemplates();
    } catch (error) {
      message.error('保存失败');
      console.error(error);
    }
  };

  // 删除模板
  // 删除被禁用（后端已禁止）

  // 预览模板
  // 预览在模板列表中不再提供

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '关联商品',
      dataIndex: 'productCode',
      key: 'productCode',
      render: (text: string) => text || '通用模板',
    },
    {
      title: '默认模板',
      dataIndex: 'isDefault',
      key: 'isDefault',
      render: (isDefault: boolean) => isDefault ? '是' : '否',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => formatDateTime(text),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: LabelTemplate) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => openModal(record)}>编辑</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="标签模板管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            新增模板
          </Button>
        }
      >
        <ResponsiveTable<LabelTemplate>
          columns={columns as any}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 新增/编辑模态框 */}
      <Modal
        title={editingTemplate ? '编辑模板' : '新增模板'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={closeModal}
        width={800}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ isDefault: false }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="模板名称"
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="请输入模板名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="productCode"
                label="关联商品编码"
                help="留空表示通用模板"
              >
                <Input placeholder="请输入商品编码（可选）" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isDefault"
            label="设为默认模板"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="模板内容"
            help="支持两种格式：HTML（mm单位）用于网页显示，TSPL（px单位）用于打印机"
          >
            <Tabs defaultActiveKey="html" type="card">
              <TabPane tab="mm单位模板（HTML）" key="html">
                <Form.Item
                  name="content"
                  rules={[{ required: true, message: '请输入HTML模板内容' }]}
                  style={{ marginBottom: 0 }}
                >
                  <TextArea
                    rows={12}
                    placeholder="请输入HTML模板内容，使用mm单位，例如：
<div style='width: 40mm; height: 30mm; position: relative; padding: 1mm; box-sizing: border-box;'>
  <div style='position: absolute; top: 1.5mm; left: 2mm; right: 2mm; text-align: center; font-size: 12px; font-weight: 600;'>
    {{headerInfo}}
  </div>
  <div style='position: absolute; top: 5mm; left: 2mm; font-size: 10px;'>
    产品名称：{{productName}}
  </div>
</div>"
                  />
                </Form.Item>
              </TabPane>
              <TabPane tab="px单位模板（TSPL）" key="tspl">
                <Form.Item
                  name="contentTspl"
                  rules={[{ required: true, message: '请输入TSPL模板内容' }]}
                  style={{ marginBottom: 0 }}
                >
                  <TextArea
                    rows={12}
                    placeholder="请输入TSPL模板内容，使用px单位，例如：
<div style='width: 320px; height: 240px; position: relative; padding: 8px; box-sizing: border-box;'>
  <div style='position: absolute; top: 12px; left: 16px; right: 16px; text-align: center; font-size: 14px; font-weight: 600;'>
    {{headerInfo}}
  </div>
  <div style='position: absolute; top: 40px; left: 16px; font-size: 12px;'>
    产品名称：{{productName}}
  </div>
</div>"
                  />
                </Form.Item>
              </TabPane>
            </Tabs>
          </Form.Item>
        </Form>
      </Modal>

      {/* 模板列表不再提供预览弹窗 */}
    </div>
  );
}
