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
  Layout,
  Menu,
  Space,
  Spin,
  Tabs,
} from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';

const { Header, Sider, Content } = Layout;

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
    title: '运营组管理',
    icon: <SettingOutlined />,
    url: '/home/ops-exclusion',
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

// 允许无需权限展示的路径（运营组管理默认开放菜单入口）
const PUBLIC_PATHS = ['/home/ops-exclusion'];

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [displayName, setDisplayName] = useState('');
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

    if (!openTabs.includes(pageKey)) {
      setOpenTabs(prev => [...prev, pageKey]);
    }
  }, [pathname, openTabs, loading, hasPermission, router]);

  // 初始化用户信息
  useEffect(() => {
    const dn = localStorage.getItem('displayName') || '';
    setDisplayName(dn);
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

    const newTabs = openTabs.filter(tab => tab !== targetKey);
    setOpenTabs(newTabs);

    if (activeTab === targetKey) {
      const newActiveTab = newTabs[newTabs.length - 1] || 'home';
      setActiveTab(newActiveTab);
      setSelectedKey(newActiveTab);
      router.push(PAGE_CONFIGS[newActiveTab].url);
    }
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
            textAlign: 'left',
            overflow: 'hidden'
          }}>
            {collapsed ? '术木' : '术木优选'}
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
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 48,
                height: 48,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: '#666', fontSize: 14 }}>
                {displayName}
              </div>
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
            justifyContent: 'space-between',
            height: 36,
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
                flex: 1,
                marginBottom: 0,
                height: 36,
              }}
              tabBarStyle={{
                marginBottom: 0,
                borderBottom: 'none',
              }}
            />

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
