"use client";

import {
  ClearOutlined,
  FileTextOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PrinterOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingOutlined,
  TagOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Input,
  Layout,
  Menu,
  message,
  Space,
  Spin,
  Tabs,
} from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { aclApi } from '../../lib/api';

const { Header, Sider, Content } = Layout;

// Logo 组件 - 用代码生成的logo
const LogoIcon = ({ size = 24 }: { size?: number }) => {
  const viewBox = 32;
  const centerX = viewBox / 2;
  const centerY = viewBox / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      style={{ display: 'block' }}
    >
      {/* 中央垂直条 */}
      <rect
        x={centerX - 1.5}
        y={centerY - 8}
        width={3}
        height={16}
        fill="#ffffff"
      />

      {/* 左侧波浪线 - 上 */}
      <path
        d={`M ${centerX - 7} ${centerY - 3} Q ${centerX - 4.5} ${centerY - 5}, ${centerX - 1.5} ${centerY - 3}`}
        stroke="#ffffff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* 左侧波浪线 - 下（弧度反转） */}
      <path
        d={`M ${centerX - 7} ${centerY + 3} Q ${centerX - 4.5} ${centerY + 1}, ${centerX - 1.5} ${centerY + 3}`}
        stroke="#ffffff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* 右侧波浪线 - 上（弧度反转） */}
      <path
        d={`M ${centerX + 1.5} ${centerY - 3} Q ${centerX + 4.5} ${centerY - 1}, ${centerX + 7} ${centerY - 3}`}
        stroke="#ffffff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* 右侧波浪线 - 下 */}
      <path
        d={`M ${centerX + 1.5} ${centerY + 3} Q ${centerX + 4.5} ${centerY + 5}, ${centerX + 7} ${centerY + 3}`}
        stroke="#ffffff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* 右上角橙色弧形装饰（弧度反转） */}
      <path
        d={`M ${centerX + 2.6} ${centerY - 7} Q ${centerX + 4.8} ${centerY - 5}, ${centerX + 7} ${centerY - 7}`}
        stroke="#ff6b35"
        strokeWidth="2.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

// 页面配置
interface PageConfig {
  title: string;
  icon: React.ReactNode;
  url: string;
  component?: React.ComponentType;
}

const PAGE_CONFIGS: Record<string, PageConfig> = {
  'home': {
    title: '首页',
    icon: <HomeOutlined />,
    url: '/home',
  },
  'products': {
    title: '商品资料',
    icon: <ShopOutlined />,
    url: '/home/products',
  },
  'product-supplement': {
    title: '标签资料管理',
    icon: <TagOutlined />,
    url: '/home/product-supplement',
  },
  'supplier-management': {
    title: '供应商管理',
    icon: <TeamOutlined />,
    url: '/home/supplier-management',
  },
  'purchase': {
    title: '收货单查询打印',
    icon: <ShoppingOutlined />,
    url: '/home/purchase',
  },
  'templates': {
    title: '标签模板',
    icon: <FileTextOutlined />,
    url: '/home/templates',
  },
  'print': {
    title: '商品搜索打印',
    icon: <PrinterOutlined />,
    url: '/home/print',
  },
  'ops-exclusion': {
    title: '排除活动商品',
    icon: <SettingOutlined />,
    url: '/home/ops-exclusion',
  },
  'store-rejection': {
    title: '驳回差异单',
    icon: <ShopOutlined />,
    url: '/home/store-rejection',
  },
  'max-purchase-quantity': {
    title: '单次最高采购量',
    icon: <ShopOutlined />,
    url: '/home/max-purchase-quantity',
  },
  'max-store-sku-inventory': {
    title: '仓店sku最高库存',
    icon: <ShopOutlined />,
    url: '/home/max-store-sku-inventory',
  },
  'admin-permissions': {
    title: '权限管理',
    icon: <SafetyOutlined />,
    url: '/home/admin-permissions',
  },
  'admin-roles': {
    title: '角色管理',
    icon: <UserOutlined />,
    url: '/home/admin-roles',
  },
  'admin-users': {
    title: '账号管理',
    icon: <TeamOutlined />,
    url: '/home/admin-users',
  },
};

// 允许无需权限展示的路径格式['/home/ops-exclusion'];
const PUBLIC_PATHS: string[] = [];

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [siderVisible, setSiderVisible] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [editInputValue, setEditInputValue] = useState('');
  const [editCount, setEditCount] = useState(0);
  const [remainingEdits, setRemainingEdits] = useState(2);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [selectedKey, setSelectedKey] = useState('home');
  const [openTabs, setOpenTabs] = useState<string[]>(['home']);
  const [activeTab, setActiveTab] = useState('home');
  const { permissions, loading, hasPermission, hasMenuPermission } = usePermissions();

  // 根据当前路径确定选中的菜单项和活动标签
  useEffect(() => {
    const pageKey = Object.keys(PAGE_CONFIGS).find(key =>
      PAGE_CONFIGS[key].url === pathname
    ) || 'home';

    // 检查页面权限
    if (!loading && pageKey !== 'home') {
      const pageConfig = PAGE_CONFIGS[pageKey];
      const canBypass = pageConfig && PUBLIC_PATHS.includes(pageConfig.url);
      if (pageConfig && !canBypass && !hasPermission(pageConfig.url)) {
        // 没有权限，跳转到首页
        router.replace('/home');
        return;
      }
    }

    setSelectedKey(pageKey);
    setActiveTab(pageKey);

    // 只有当路径改变时才添加新标签，避免关闭标签时被重新添加
    setOpenTabs(prev => {
      if (!prev.includes(pageKey)) {
        return [...prev, pageKey];
      }
      return prev; // 保持原有顺序，不重新创建数组
    });
  }, [pathname, loading, hasPermission, router]);

  // 初始化用户信息
  useEffect(() => {
    const dn = localStorage.getItem('displayName') || '';
    setDisplayName(dn);
    setEditInputValue(dn);

    // 获取编辑次数信息
    const userId = localStorage.getItem('userId');
    if (userId) {
      aclApi.getUserEditCount(Number(userId))
        .then((info) => {
          setEditCount(info.editCount);
          setRemainingEdits(info.remaining);
        })
        .catch((err) => {
          console.error('获取编辑次数失败:', err);
        });
    }
  }, []);

  // 单点登录心跳检查：定期验证 token 是否有效
  useEffect(() => {
    const checkToken = async () => {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('sessionToken');

      if (!userId || !token) {
        return;
      }

      try {
        const { aclApi } = await import('@/lib/api');
        const isValid = await aclApi.validateToken(Number(userId), token);

        if (!isValid) {
          // Token 失效，退出登录
          console.log('[单点登录] 您的账号已在其他设备登录');
          localStorage.clear();
          router.push('/login');
        }
      } catch (error) {
        console.error('Token 验证失败:', error);
      }
    };

    // 立即执行一次检查
    checkToken();

    // 每 30 秒检查一次
    const interval = setInterval(checkToken, 30000);

    return () => clearInterval(interval);
  }, [router]);

  // 菜单点击处理
  const handleMenuClick = ({ key }: { key: string }) => {
    const config = PAGE_CONFIGS[key];
    if (config) {
      setSelectedKey(key);
      setActiveTab(key);

      if (!openTabs.includes(key)) {
        setOpenTabs(prev => [...prev, key]);
      }

      router.push(config.url);
    }
  };

  // 标签页切换处理
  const handleTabChange = (key: string) => {
    const config = PAGE_CONFIGS[key];
    if (config) {
      setActiveTab(key);
      setSelectedKey(key);
      router.push(config.url);
    }
  };

  // 关闭标签页
  const handleTabClose = (targetKey: string) => {
    if (targetKey === 'home') return; // 首页不能关闭

    // 使用函数式更新确保状态一致性
    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(tab => tab !== targetKey);

      // 如果关闭的是当前激活的标签，需要切换到其他标签
      if (activeTab === targetKey) {
        const newActiveTab = newTabs[newTabs.length - 1] || 'home';
        setActiveTab(newActiveTab);
        setSelectedKey(newActiveTab);
        router.push(PAGE_CONFIGS[newActiveTab].url);
      }

      return newTabs;
    });
  };

  // 清除其他标签页
  const handleClearOtherTabs = () => {
    setOpenTabs([activeTab]);
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  // 开始编辑 display_name
  const handleStartEdit = () => {
    if (remainingEdits <= 0) {
      message.warning('display_name 最多只能编辑2次，已达到上限');
      return;
    }
    setEditingDisplayName(true);
    setEditInputValue(displayName);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingDisplayName(false);
    setEditInputValue(displayName);
  };

  // 保存 display_name
  const handleSaveDisplayName = async () => {
    const trimmedValue = editInputValue.trim();
    if (!trimmedValue) {
      message.error('显示名不能为空');
      return;
    }
    if (trimmedValue === displayName) {
      setEditingDisplayName(false);
      return;
    }

    setLoadingEdit(true);
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        message.error('用户信息不存在');
        return;
      }

      await aclApi.updateUser(Number(userId), { display_name: trimmedValue });

      // 更新本地状态
      setDisplayName(trimmedValue);
      localStorage.setItem('displayName', trimmedValue);

      // 更新编辑次数
      const editInfo = await aclApi.getUserEditCount(Number(userId));
      setEditCount(editInfo.editCount);
      setRemainingEdits(editInfo.remaining);

      message.success('显示名更新成功');
      setEditingDisplayName(false);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || '更新失败';
      message.error(errorMsg);
    } finally {
      setLoadingEdit(false);
    }
  };

  // 菜单项配置（根据权限过滤）
  const getFilteredMenuItems = () => {
    if (loading) return [];

    const filterMenuItem = (item: any): any => {
      // 首页始终显示
      if (item.key === 'home') return item;

      // 检查子菜单
      if (item.children) {
        const filteredChildren = item.children
          .map((child: any) => filterMenuItem(child))
          .filter((child: any) => child !== null);

        // 如果有可见的子菜单，显示父菜单
        if (filteredChildren.length > 0) {
          return { ...item, children: filteredChildren };
        }
        return null;
      }

      // 检查单个菜单项权限
      const pageConfig = PAGE_CONFIGS[item.key];
      if (pageConfig && (PUBLIC_PATHS.includes(pageConfig.url) || hasPermission(pageConfig.url))) {
        return item;
      }

      return null;
    };

    const menuItems = [
      {
        key: 'home',
        icon: <HomeOutlined />,
        label: '首页',
      },
      {
        key: 'product-management',
        icon: <ShopOutlined />,
        label: '商品管理',
        children: [
          {
            key: 'products',
            icon: <ShopOutlined />,
            label: '商品资料',
          },
          {
            key: 'product-supplement',
            icon: <TagOutlined />,
            label: '标签资料管理',
          },
        ],
      },
      {
        key: 'purchase-management',
        icon: <ShoppingOutlined />,
        label: '采购管理',
        children: [
          {
            key: 'supplier-management',
            icon: <TeamOutlined />,
            label: '供应商管理',
          },
        ],
      },
      {
        key: 'label-print',
        icon: <TagOutlined />,
        label: '标签打印',
        children: [
          {
            key: 'purchase',
            icon: <ShoppingOutlined />,
            label: '收货单查询打印',
          },
          {
            key: 'templates',
            icon: <FileTextOutlined />,
            label: '标签模板',
          },
          {
            key: 'print',
            icon: <PrinterOutlined />,
            label: '商品搜索打印',
          },
        ],
      },
      {
        key: 'ops',
        icon: <SettingOutlined />,
        label: '运营组管理',
        children: [
          {
            key: 'ops-exclusion',
            icon: <SettingOutlined />,
            label: '排除活动商品',
          },
        ],
      },
      {
        key: 'store-management',
        icon: <ShopOutlined />,
        label: '门店管理',
        children: [
          {
            key: 'store-rejection',
            icon: <ShopOutlined />,
            label: '驳回差异单',
          },
          {
            key: 'max-purchase-quantity',
            icon: <ShopOutlined />,
            label: '单次最高采购量',
          },
          {
            key: 'max-store-sku-inventory',
            icon: <ShopOutlined />,
            label: '仓店sku最高库存',
          },
        ],
      },
      {
        key: 'system-management',
        icon: <SettingOutlined />,
        label: '系统管理',
        children: [
          {
            key: 'admin-permissions',
            icon: <SafetyOutlined />,
            label: '权限管理',
          },
          {
            key: 'admin-roles',
            icon: <UserOutlined />,
            label: '角色管理',
          },
          {
            key: 'admin-users',
            icon: <TeamOutlined />,
            label: '账号管理',
          },
        ],
      },
    ];

    return menuItems
      .map(item => filterMenuItem(item))
      .filter(item => item !== null);
  };

  // 生成标签页项
  const tabItems = openTabs.map(key => ({
    key,
    label: (
      <Space size={4}>
        {PAGE_CONFIGS[key]?.icon}
        <span>{PAGE_CONFIGS[key]?.title}</span>
      </Space>
    ),
    closable: key !== 'home',
  }));

  return (
    <App>
      <Layout style={{ minHeight: '100vh' }}>
        {siderVisible && (
          <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            theme="dark"
          >
            <div style={{
              height: 48,
              margin: 16,
              color: '#fff',
              fontSize: collapsed ? 14 : 18,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              overflow: 'hidden'
            }}>
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start'
              }}>
                {!collapsed && (
                  <span style={{
                    flex: 1,
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    术木优选
                  </span>
                )}
                <div style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <LogoIcon size={24} />
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
                marginLeft: 8
              }}>
                <Button
                  type="text"
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setCollapsed(!collapsed)}
                  style={{
                    color: '#fff',
                    fontSize: '16px',
                    width: 32,
                    height: 32,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={collapsed ? '展开' : '收缩'}
                />
                {!collapsed && (
                  <Button
                    type="text"
                    icon={<MenuFoldOutlined />}
                    onClick={() => setSiderVisible(false)}
                    style={{
                      color: '#fff',
                      fontSize: '16px',
                      width: 32,
                      height: 32,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="隐藏侧边栏"
                  />
                )}
              </div>
            </div>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={getFilteredMenuItems()}
              onClick={handleMenuClick}
              inlineCollapsed={collapsed}
            />
          </Sider>
        )}

        <Layout>
          <Header style={{
            padding: '0 16px',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48,
            lineHeight: '48px'
          }}>
            {siderVisible ? (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: '16px',
                  width: 48,
                  height: 48,
                }}
                title={collapsed ? '展开侧边栏' : '收缩侧边栏'}
              />
            ) : (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => {
                  setSiderVisible(true);
                  setCollapsed(false);
                }}
                style={{
                  fontSize: '16px',
                  width: 48,
                  height: 48,
                }}
                title="显示侧边栏"
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {editingDisplayName ? (
                <Space size="small">
                  <Input
                    value={editInputValue}
                    onChange={(e) => setEditInputValue(e.target.value)}
                    onPressEnter={handleSaveDisplayName}
                    onBlur={handleSaveDisplayName}
                    autoFocus
                    maxLength={64}
                    style={{ width: 150 }}
                    disabled={loadingEdit}
                  />
                  <Button
                    size="small"
                    type="primary"
                    onClick={handleSaveDisplayName}
                    loading={loadingEdit}
                  >
                    保存
                  </Button>
                  <Button
                    size="small"
                    onClick={handleCancelEdit}
                    disabled={loadingEdit}
                  >
                    取消
                  </Button>
                </Space>
              ) : (
                <Space size="small">
                  <div
                    style={{
                      color: '#666',
                      fontSize: 14,
                      cursor: remainingEdits > 0 ? 'pointer' : 'default',
                      padding: '4px 8px',
                      borderRadius: 4,
                      transition: 'background-color 0.2s',
                    }}
                    onClick={handleStartEdit}
                    onMouseEnter={(e) => {
                      if (remainingEdits > 0) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title={remainingEdits > 0 ? `点击编辑（剩余 ${remainingEdits} 次）` : '已达到编辑上限'}
                  >
                    {displayName}
                  </div>
                  {remainingEdits > 0 && (
                    <span style={{ color: '#999', fontSize: 12 }}>
                      (可编辑 {remainingEdits} 次)
                    </span>
                  )}
                </Space>
              )}
              <Button size="small" onClick={handleLogout}>
                退出登录
              </Button>
            </div>
          </Header>

          {/* 标签栏 */}
          <div style={{
            background: '#f5f5f5',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            height: 36,
            position: 'relative',
          }}>
            <div style={{
              flex: 1,
              overflow: 'hidden',
              minWidth: 0,
            }}>
              <Tabs
                type="editable-card"
                size="small"
                activeKey={activeTab}
                onChange={handleTabChange}
                onEdit={(targetKey, action) => {
                  if (action === 'remove') {
                    handleTabClose(targetKey as string);
                  }
                }}
                items={tabItems}
                style={{
                  marginBottom: 0,
                  height: 36,
                }}
                tabBarStyle={{
                  marginBottom: 0,
                  borderBottom: 'none',
                }}
              />
            </div>

            <div style={{
              flexShrink: 0,
              marginLeft: 8,
            }}>
              <Space size="small">
                <Button
                  size="small"
                  icon={<ClearOutlined />}
                  onClick={handleClearOtherTabs}
                  disabled={openTabs.length <= 1}
                  title="关闭其他标签页"
                >
                  清除其他
                </Button>
              </Space>
            </div>
          </div>

          <Content style={{
            margin: '8px 16px 16px',
            overflow: 'auto',
            background: '#ffffff',
            borderRadius: 8,
          }}>
            <div style={{ padding: 16, minHeight: 360 }}>
              {loading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 200
                }}>
                  <Spin size="large" />
                </div>
              ) : (
                children
              )}
            </div>
          </Content>
        </Layout>
      </Layout>
    </App>
  );
}
