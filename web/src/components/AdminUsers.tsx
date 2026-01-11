"use client";

import Can from "@/components/Can";
import { aclApi, SysPermission, SysRole, SysUser } from "@/lib/api";
import { groupPermissionsByCategory } from "@/utils/permissionCategory";
import { Button, Card, Checkbox, Collapse, Divider, Form, Input, message, Modal, Select, Space, Tag } from "antd";
import { useEffect, useState } from "react";
import ResponsiveTable from "./ResponsiveTable";

export default function UserPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SysUser[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [roles, setRoles] = useState<SysRole[]>([]);
  const [permissions, setPermissions] = useState<SysPermission[]>([]);
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<number, number[]>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<SysUser | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [form] = Form.useForm();

  const [q, setQ] = useState('');

  const loadUsers = async (page: number = currentPage, searchText: string = q) => {
    setLoading(true);
    try {
      const result = await aclApi.listUsers({
        page,
        limit: pageSize,
        q: searchText || undefined,
      });
      console.log('获取到的用户数据:', result);
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error('加载用户数据失败:', error);
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      // 分配角色时需要所有角色，使用大limit获取
      const result = await aclApi.listRoles({ page: 1, limit: 10000 });
      setRoles(result.data);
    } catch {
      console.error("加载角色失败");
    }
  };

  const loadPermissions = async () => {
    try {
      const result = await aclApi.listPermissions({ page: 1, limit: 10000 });
      setPermissions(result.data);
    } catch {
      console.error("加载权限失败");
    }
  };

  const loadRolePermissions = async (roleIds: number[]) => {
    if (roleIds.length === 0) {
      setRolePermissionsMap({});
      return;
    }
    setLoadingPermissions(true);
    try {
      const newMap: Record<number, number[]> = {};
      await Promise.all(
        roleIds.map(async (roleId) => {
          try {
            const permissionIds = await aclApi.roleGranted(roleId);
            newMap[roleId] = permissionIds;
          } catch (error) {
            console.error(`加载角色 ${roleId} 的权限失败:`, error);
            newMap[roleId] = [];
          }
        })
      );
      setRolePermissionsMap(newMap);
    } catch (error) {
      console.error("加载角色权限失败:", error);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const load = async (page: number = currentPage, searchText: string = q) => {
    await Promise.all([loadUsers(page, searchText), loadRoles()]);
  };

  useEffect(() => { load(); }, []);

  const onEdit = (r?: SysUser) => { setEditing(r || null); setOpen(true); form.resetFields(); if (r) form.setFieldsValue(r); };
  const onOk = async () => {
    try {
      const v = await form.validateFields();
      setLoading(true);
      if (editing) {
        await aclApi.updateUser(editing.id, v);
      } else {
        const payload = { username: v.username, password: v.password, display_name: v.display_name, code: v.code, status: v.status ?? 1 };
        await aclApi.createUser(payload as any);
      }
      setOpen(false);
      await load(currentPage, q);
      message.success('保存成功');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '保存失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onAssign = async (r: SysUser) => {
    console.log('分配角色给用户:', r);
    setEditing(r);
    setAssignOpen(true);

    let roleIds: number[] = [];
    // 首先尝试从用户数据中获取角色ID
    if (r.roles && r.roles.length > 0) {
      roleIds = r.roles.map(role => role.id);
      console.log('从用户数据获取角色ID:', roleIds);
      setChecked(roleIds);
    } else {
      // 如果用户数据中没有角色信息，则通过API获取
      try {
        roleIds = await aclApi.userAssignedRoleIds(r.id);
        console.log('通过API获取用户已分配的角色ID:', roleIds);
        setChecked(roleIds);
      } catch (error) {
        console.error('获取用户角色失败:', error);
        setChecked([]);
        message.error("获取用户角色失败");
      }
    }

    // 加载权限数据和角色权限映射
    await loadPermissions();
    await loadRolePermissions(roleIds);
  };
  const saveAssign = async () => {
    try {
      await aclApi.assignUserRoles(editing!.id, checked);
      setAssignOpen(false);
      await load(currentPage, q); // 重新加载用户列表以更新角色显示
      message.success("角色分配成功");
    } catch {
      message.error("角色分配失败");
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    load(1, q);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '显示名', dataIndex: 'display_name', width: 120 },
    {
      title: '角色',
      key: 'roles',
      width: 200,
      render: (_: any, r: SysUser) => {
        console.log('渲染用户角色:', r.id, r.username, r.roles);
        return (
          <div>
            {r.roles && r.roles.length > 0 ? (
              r.roles.map(role => (
                <Tag key={role.id} color="blue" style={{ marginBottom: 4 }}>
                  {role.name}
                </Tag>
              ))
            ) : (
              <Tag color="default">未分配角色</Tag>
            )}
          </div>
        );
      }
    },
    {
      title: '部门ID',
      dataIndex: 'department_id',
      width: 100,
      render: (departmentId: number | null | undefined) => departmentId ?? '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '操作', key: 'action', width: 220, render: (_: any, r: SysUser) => (
        <Space>
          <Can code="button:user:update"><Button type="link" onClick={() => onEdit(r)}>编辑</Button></Can>
          <Can code="button:user:assign"><Button type="link" onClick={() => onAssign(r)}>分配角色</Button></Can>
          <Can code="button:user:delete"><Button type="link" danger onClick={async () => { await aclApi.deleteUser(r.id); load(currentPage, q); }}>删除</Button></Can>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="账号管理" extra={<Space><Input placeholder="按用户名/显示名搜索" value={q} onChange={(e) => setQ(e.target.value)} onPressEnter={handleSearch} style={{ width: 240 }} /><Button onClick={handleSearch}>搜索</Button><Can code="button:user:create"><Button type="primary" onClick={() => onEdit()}>新增账号</Button></Can></Space>}>
        <ResponsiveTable<SysUser>
          tableId="admin-users"
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
              load(page, q);
            },
          }}
        />
      </Card>

      <Modal open={open} onOk={onOk} onCancel={() => setOpen(false)} confirmLoading={loading} title={editing ? '编辑账号' : '新增账号'} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }, { min: 3, max: 64, message: '3-64个字符' }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: !editing, message: '请输入密码' }, { min: 6, max: 128, message: '6-128个字符' }]}><Input.Password /></Form.Item>
          <Form.Item name="display_name" label="显示名" rules={[{ required: true, message: '请输入显示名' }, { max: 64, message: '不超过64个字符' }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ max: 64, message: '不超过64个字符' }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}><Select options={[{ value: 1, label: '启用' }, { value: 0, label: '禁用' }]} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        open={assignOpen}
        onOk={saveAssign}
        onCancel={() => {
          setAssignOpen(false);
          setRolePermissionsMap({});
        }}
        title={`分配角色 - ${editing?.username || ''}`}
        destroyOnHidden
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#666', marginBottom: 12 }}>
            请选择要分配给用户 <strong>{editing?.display_name || editing?.username}</strong> 的角色：
          </p>
          {editing?.roles && editing.roles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ marginRight: 8 }}>当前角色：</span>
              {editing.roles.map(role => (
                <Tag key={role.id} color="blue" style={{ marginBottom: 4 }}>
                  {role.name}
                </Tag>
              ))}
            </div>
          )}
          <Divider />
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <Checkbox.Group
            style={{ width: '100%' }}
            value={checked}
            onChange={async (vals) => {
              const newChecked = vals as number[];
              setChecked(newChecked);
              // 当选中角色变化时，重新加载权限
              await loadRolePermissions(newChecked);
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {roles.map(r => (
                <div key={r.id} style={{ padding: '8px', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
                  <Checkbox value={r.id}>
                    <span style={{ fontWeight: checked.includes(r.id) ? 'bold' : 'normal' }}>
                      {r.name}
                    </span>
                    {checked.includes(r.id) && (
                      <Tag color="green" style={{ marginLeft: 8, fontSize: '12px' }}>
                        已选择
                      </Tag>
                    )}
                  </Checkbox>
                  {r.remark && (
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginLeft: '24px' }}>
                      {r.remark}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Checkbox.Group>
        </div>

        <div style={{ marginTop: 16, padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            <strong>已选择角色数量：</strong> {checked.length} / {roles.length}
          </div>
          {checked.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>选中的角色：</strong>
              {roles.filter(r => checked.includes(r.id)).map(role => (
                <Tag key={role.id} color="blue" style={{ marginTop: 4 }}>
                  {role.name}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {checked.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Divider />
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: '14px' }}>权限详情（只读）</strong>
            </div>
            {loadingPermissions ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载权限中...</div>
            ) : (
              <Collapse
                defaultActiveKey={roles.filter(r => checked.includes(r.id)).map(r => r.id.toString())}
                items={roles
                  .filter(r => checked.includes(r.id))
                  .map(role => {
                    const permissionIds = rolePermissionsMap[role.id] || [];
                    const rolePermissions = permissions.filter(p => permissionIds.includes(p.id));
                    const allPermissionIds = new Set<number>();
                    checked.forEach(rid => {
                      (rolePermissionsMap[rid] || []).forEach(pid => allPermissionIds.add(pid));
                    });
                    const allPermissions = permissions.filter(p => allPermissionIds.has(p.id));

                    return {
                      key: role.id.toString(),
                      label: (
                        <span>
                          <strong style={{ fontSize: '13px' }}>{role.name}</strong>
                          <Tag color="blue" style={{ marginLeft: 8, fontSize: '11px', padding: '0 6px', lineHeight: '18px' }}>
                            {permissionIds.length} 个权限
                          </Tag>
                        </span>
                      ),
                      children: (
                        <div>
                          {rolePermissions.length > 0 ? (
                            (() => {
                              const grouped = groupPermissionsByCategory(rolePermissions);
                              return Object.keys(grouped).length > 0 ? (
                                <Collapse
                                  defaultActiveKey={Object.keys(grouped)}
                                  items={Object.keys(grouped).map(category => ({
                                    key: category,
                                    label: <strong style={{ fontSize: '12px' }}>{category}</strong>,
                                    children: (
                                      <div style={{ paddingLeft: 16 }}>
                                        {grouped[category].map(permission => (
                                          <div key={permission.id} style={{ padding: '1px 0', fontSize: '12px' }}>
                                            - {permission.name}
                                          </div>
                                        ))}
                                      </div>
                                    ),
                                  }))}
                                  style={{ fontSize: '12px' }}
                                />
                              ) : (
                                <div style={{ color: '#999', textAlign: 'center', padding: '10px', fontSize: '12px' }}>
                                  该角色暂无权限
                                </div>
                              );
                            })()
                          ) : (
                            <div style={{ color: '#999', textAlign: 'center', padding: '10px', fontSize: '12px' }}>
                              该角色暂无权限
                            </div>
                          )}
                        </div>
                      ),
                    };
                  })}
                style={{ marginBottom: 0, fontSize: '12px' }}
              />
            )}
            {checked.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: '14px' }}>合并权限（所有选中角色的权限汇总）</strong>
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    {(() => {
                      const allPermissionIds = new Set<number>();
                      checked.forEach(rid => {
                        (rolePermissionsMap[rid] || []).forEach(pid => allPermissionIds.add(pid));
                      });
                      return allPermissionIds.size;
                    })()} 个权限
                  </Tag>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {(() => {
                    const allPermissionIds = new Set<number>();
                    checked.forEach(rid => {
                      (rolePermissionsMap[rid] || []).forEach(pid => allPermissionIds.add(pid));
                    });
                    const allPermissions = permissions.filter(p => allPermissionIds.has(p.id));
                    return allPermissions.length > 0 ? (
                      (() => {
                        const grouped = groupPermissionsByCategory(allPermissions);
                        return Object.keys(grouped).length > 0 ? (
                          <Collapse
                            defaultActiveKey={Object.keys(grouped)}
                            items={Object.keys(grouped).map(category => ({
                              key: category,
                              label: <strong style={{ fontSize: '12px' }}>{category}</strong>,
                              children: (
                                <div style={{ paddingLeft: 16 }}>
                                  {grouped[category].map(permission => (
                                    <div key={permission.id} style={{ padding: '1px 0', fontSize: '12px' }}>
                                      - {permission.name}
                                    </div>
                                  ))}
                                </div>
                              ),
                            }))}
                            style={{ fontSize: '12px' }}
                          />
                        ) : (
                          <div style={{ color: '#999', textAlign: 'center', padding: '10px', fontSize: '12px' }}>
                            暂无权限
                          </div>
                        );
                      })()
                    ) : (
                      <div style={{ color: '#999', textAlign: 'center', padding: '10px', fontSize: '12px' }}>
                        暂无权限
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}



