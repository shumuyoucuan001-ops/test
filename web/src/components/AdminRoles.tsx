"use client";

import Can from "@/components/Can";
import { aclApi, SysPermission, SysRole } from "@/lib/api";
import { Button, Card, Checkbox, Form, Input, message, Modal, Space } from "antd";
import { useEffect, useState } from "react";
import ResponsiveTable from "./ResponsiveTable";

const { Search } = Input;

export default function RolePage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SysRole[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [perms, setPerms] = useState<SysPermission[]>([]);
  const [open, setOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [editing, setEditing] = useState<SysRole | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [form] = Form.useForm();

  const loadRoles = async (page: number = currentPage, searchText: string = search) => {
    setLoading(true);
    try {
      const result = await aclApi.listRoles({
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

  const loadPermissions = async () => {
    try {
      // 授权时需要所有权限，使用大limit获取
      const result = await aclApi.listPermissions({ page: 1, limit: 10000 });
      setPerms(result.data);
    } catch {
      console.error("加载权限失败");
    }
  };

  const load = async (page: number = currentPage, searchText: string = search) => {
    await Promise.all([loadRoles(page, searchText), loadPermissions()]);
  };

  useEffect(() => { load(); }, []);

  const onEdit = (r?: SysRole) => { setEditing(r || null); setOpen(true); form.resetFields(); if (r) form.setFieldsValue(r); };
  const onOk = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await aclApi.updateRole(editing.id, v);
      else await aclApi.createRole(v);
      setOpen(false);
      load(currentPage, search);
    } catch {
      message.error("保存失败");
    }
  };

  const onGrant = async (r: SysRole) => { setEditing(r); setGrantOpen(true); try { const ids = await aclApi.roleGranted(r.id); setChecked(ids || []); } catch { setChecked([]); } };
  const saveGrant = async () => { try { await aclApi.grantRole(editing!.id, checked); setGrantOpen(false); message.success("已授权"); } catch { message.error("授权失败"); } };

  const handleSearch = () => {
    setCurrentPage(1);
    load(1, search);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '角色名', dataIndex: 'name' },
    { title: '备注', dataIndex: 'remark' },
    {
      title: '操作', key: 'action', width: 220, render: (_: any, r: SysRole) => (
        <Space>
          <Can code="button:role:update"><Button type="link" onClick={() => onEdit(r)}>编辑</Button></Can>
          <Can code="button:role:grant"><Button type="link" onClick={() => onGrant(r)}>授权</Button></Can>
          <Can code="button:role:delete"><Button type="link" danger onClick={async () => { await aclApi.deleteRole(r.id); load(currentPage, search); }}>删除</Button></Can>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="角色管理" extra={<Can code="button:role:create"><Button type="primary" onClick={() => onEdit()}>新增角色</Button></Can>}>
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索角色名/备注"
            allowClear
            style={{ width: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={handleSearch}
            onPressEnter={handleSearch}
          />
        </Space>
        <ResponsiveTable<SysRole>
          rowKey="id"
          columns={columns as any}
          dataSource={data}
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

      <Modal open={open} onOk={onOk} onCancel={() => setOpen(false)} title={editing ? '编辑角色' : '新增角色'} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal open={grantOpen} onOk={saveGrant} onCancel={() => setGrantOpen(false)} title={`角色授权 - ${editing?.name || ''}`} destroyOnClose>
        <Checkbox.Group style={{ width: '100%' }} value={checked} onChange={(vals) => setChecked(vals as number[])}>
          {perms.map(p => (<div key={p.id}><Checkbox value={p.id}>{p.name} ({p.code})</Checkbox></div>))}
        </Checkbox.Group>
      </Modal>
    </div>
  );
}







