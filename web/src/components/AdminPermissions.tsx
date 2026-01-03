"use client";

import { aclApi, SysPermission } from "@/lib/api";
import { Button, Card, Form, Input, message, Modal, Space } from "antd";
import { useEffect, useState } from "react";
import ResponsiveTable from "./ResponsiveTable";

const { Search } = Input;

export default function PermissionPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SysPermission[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SysPermission | null>(null);
  const [form] = Form.useForm();

  const load = async (page: number = currentPage, searchText: string = search) => {
    setLoading(true);
    try {
      const result = await aclApi.listPermissions({
        page,
        limit: pageSize,
        search: searchText || undefined,
      });
      setData(result.data);
      setTotal(result.total);
    } catch {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const onEdit = (r?: SysPermission) => {
    setEditing(r || null);
    setOpen(true);
    form.resetFields();
    if (r) form.setFieldsValue(r);
  };
  const onOk = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await aclApi.updatePermission(editing.id, v); else await aclApi.createPermission(v);
      setOpen(false);
      load(currentPage, search);
    } catch { message.error("保存失败"); }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    load(1, search);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '权限编码', dataIndex: 'code' },
    { title: '名称', dataIndex: 'name' },
    { title: '路径(path)', dataIndex: 'path' },
    {
      title: '操作', key: 'action', width: 180, render: (_: any, r: SysPermission) => (
        <Space>
          <Button type="link" onClick={() => onEdit(r)}>编辑</Button>
          <Button type="link" danger onClick={async () => { await aclApi.deletePermission(r.id); load(currentPage, search); }}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="权限管理" extra={<Space><Button onClick={async () => { try { await aclApi.init(); message.success('已初始化表'); } catch { message.error('初始化失败'); } }}>初始化表</Button><Button onClick={async () => {
        try {
          const presets = [
            { code: 'menu:label:purchase', name: '收货单查询打印', path: '/label/purchase' },
            { code: 'menu:label:templates', name: '标签模板', path: '/label/templates' },
            { code: 'menu:label:print', name: '商品标签打印', path: '/label/print' },
            { code: 'menu:admin:permissions', name: '权限管理', path: '/admin/permissions' },
            { code: 'menu:admin:roles', name: '角色管理', path: '/admin/roles' },
            { code: 'menu:admin:users', name: '账号管理', path: '/admin/users' },
          ];
          for (const p of presets) { try { await aclApi.createPermission(p); } catch { } }
          message.success('默认权限已写入'); load(currentPage, search);
        } catch { message.error('写入失败'); }
      }}>初始化默认权限</Button><Button type="primary" onClick={() => onEdit()}>新增权限</Button></Space>}>
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索权限编码/名称/路径"
            allowClear
            style={{ width: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={handleSearch}
            onPressEnter={handleSearch}
          />
        </Space>
        <ResponsiveTable<SysPermission>
          tableId="admin-permissions"
          rowKey="id"
          columns={columns as any}
          dataSource={data}
          scroll={{ y: 600 }}
          loading={loading}
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
              load(page, search);
            },
          }}
        />
      </Card>

      <Modal open={open} onOk={onOk} onCancel={() => setOpen(false)} title={editing ? '编辑权限' : '新增权限'} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="权限编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="path" label="路径(path)" rules={[{ required: true }]}><Input placeholder="例如 /admin/permissions" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}







