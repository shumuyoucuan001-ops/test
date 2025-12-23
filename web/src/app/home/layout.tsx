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
  Drawer,
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
        d={`M ${centerX - 7} ${centerY - 3.5} Q ${centerX - 4.5} ${centerY - 5.5}, ${centerX - 1.5} ${centerY - 3.5}`}
        stroke="#ffffff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* 左侧波浪线 - 下 */}
      <path
        d={`M ${centerX - 7} ${centerY + 2.5} Q ${centerX - 4.5} ${centerY + 0.5}, ${centerX - 1.5} ${centerY + 2.5}`}
        stroke="#ffffff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* 右侧波浪线 - 上 */}
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

      {/* 右上角橙色弧形装饰 */}
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
  'purchase-pass-difference': {
    title: '采购通过差异单',
    icon: <ShoppingOutlined />,
    url: '/home/purchase-pass-difference',
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
  'ops-shelf-exclusion': {
    title: '排除上下架商品',
    icon: <SettingOutlined />,
    url: '/home/ops-shelf-exclusion',
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
  'refund-1688-follow-up': {
    title: '1688退款(退货)跟进情况',
    icon: <ShoppingOutlined />,
    url: '/home/refund-1688-follow-up',
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
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { permissions, loading, hasPermission, hasMenuPermission } = usePermissions();

  // 检测移动端
  useEffect(() => {
    let prevIsMobile = window.innerWidth < 768;

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // 移动端默认隐藏侧边栏，使用抽屉
      if (mobile) {
        setSiderVisible(false);
        setCollapsed(false);
      } else {
        // 只在从移动端切换到桌面端时才恢复侧边栏显示
        // 如果用户手动隐藏了侧边栏，则不会自动恢复
        if (prevIsMobile && !mobile) {
          setSiderVisible(true);
        }
      }
      prevIsMobile = mobile;
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  // 优化：增加重试机制，避免因网络问题导致的误退出
  useEffect(() => {
    let consecutiveFailures = 0; // 连续失败次数
    const MAX_FAILURES = 3; // 最大连续失败次数，超过此次数才退出登录

    const checkToken = async (isRetry = false) => {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('sessionToken');

      if (!userId || !token) {
        return;
      }

      try {
        const { aclApi } = await import('@/lib/api');
        const isValid = await aclApi.validateToken(Number(userId), token);

        if (!isValid) {
          consecutiveFailures++;
          console.log(`[单点登录] Token验证失败 (连续失败${consecutiveFailures}次)`);

          // 只有在连续失败多次后才退出登录（避免网络波动导致误退出）
          if (consecutiveFailures >= MAX_FAILURES) {
            console.log('[单点登录] Token已失效或账号已在其他设备登录');
            localStorage.clear();
            router.push('/login');
          } else if (!isRetry) {
            // 如果不是重试，等待一段时间后重试
            setTimeout(() => checkToken(true), 5000);
          }
        } else {
          // 验证成功，重置失败计数
          if (consecutiveFailures > 0) {
            console.log('[单点登录] Token验证恢复成功');
            consecutiveFailures = 0;
          }
        }
      } catch (error) {
        consecutiveFailures++;
        console.error(`[单点登录] Token验证失败 (连续失败${consecutiveFailures}次):`, error);

        // 网络错误时，如果连续失败多次才退出
        if (consecutiveFailures >= MAX_FAILURES) {
          console.log('[单点登录] Token验证连续失败，可能是网络问题，退出登录');
          localStorage.clear();
          router.push('/login');
        } else if (!isRetry) {
          // 等待后重试
          setTimeout(() => checkToken(true), 5000);
        }
      }
    };

    // 立即执行一次检查
    checkToken();

    // 每 30 秒检查一次
    const interval = setInterval(() => {
      consecutiveFailures = 0; // 重置失败计数（定期检查时重置）
      checkToken();
    }, 30000);

    // 页面可见性变化时检查token（用户从后台返回时）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[单点登录] 页面重新可见，检查token');
        consecutiveFailures = 0; // 重置失败计数
        checkToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 页面获得焦点时检查token（用户切换回应用时）
    const handleFocus = () => {
      console.log('[单点登录] 页面获得焦点，检查token');
      consecutiveFailures = 0;
      checkToken();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
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

      // 移动端点击菜单后关闭抽屉
      if (isMobile) {
        setDrawerVisible(false);
      }
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
          {
            key: 'purchase-pass-difference',
            icon: <ShoppingOutlined />,
            label: '采购通过差异单',
          },
          {
            key: 'refund-1688-follow-up',
            icon: <ShoppingOutlined />,
            label: '1688退款(退货)跟进情况',
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
          {
            key: 'ops-shelf-exclusion',
            icon: <SettingOutlined />,
            label: '排除上下架商品',
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

  // 侧边栏内容组件（用于桌面端和移动端抽屉）
  const siderContent = (
    <>
      <div style={{
        height: 48,
        margin: 16,
        color: '#fff',
        fontSize: collapsed && !isMobile ? 14 : 18,
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
          justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start'
        }}>
          {(!collapsed || isMobile) && (
            <span style={{
              flex: 1,
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 15
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
            <LogoIcon size={20} />
          </div>
        </div>
        {!isMobile && (
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
        )}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={getFilteredMenuItems()}
        onClick={handleMenuClick}
        inlineCollapsed={collapsed && !isMobile}
      />
    </>
  );

  return (
    <App>
      <Layout style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
        {/* 桌面端侧边栏 */}
        {siderVisible && !isMobile && (
          <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            theme="dark"
            style={{
              height: '100vh',
              position: 'sticky',
              top: 0,
              overflow: 'auto',
            }}
          >
            {siderContent}
          </Sider>
        )}

        {/* 移动端抽屉 */}
        {isMobile && (
          <Drawer
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogoIcon size={20} />
                <span>术木优选</span>
              </div>
            }
            placement="left"
            onClose={() => setDrawerVisible(false)}
            open={drawerVisible}
            bodyStyle={{ padding: 0 }}
            width={280}
            styles={{
              body: { padding: 0 }
            }}
          >
            <div style={{ background: '#001529', height: '100%' }}>
              {siderContent}
            </div>
          </Drawer>
        )}

        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
          <Header style={{
            padding: isMobile ? '0 8px' : '0 16px',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48,
            lineHeight: '48px',
            flexWrap: 'nowrap',
          }}>
            {/* 菜单按钮 */}
            {isMobile ? (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setDrawerVisible(true)}
                style={{
                  fontSize: '16px',
                  width: 48,
                  height: 48,
                  minWidth: 48,
                }}
                title="打开菜单"
              />
            ) : siderVisible ? (
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

            {/* 右侧用户信息和操作 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 4 : 12,
              flexWrap: 'nowrap',
              overflow: 'hidden',
            }}>
              {editingDisplayName ? (
                <Space size="small" wrap={false}>
                  <Input
                    value={editInputValue}
                    onChange={(e) => setEditInputValue(e.target.value)}
                    onPressEnter={handleSaveDisplayName}
                    onBlur={handleSaveDisplayName}
                    autoFocus
                    maxLength={64}
                    style={{ width: isMobile ? 100 : 150 }}
                    disabled={loadingEdit}
                  />
                  <Button
                    size="small"
                    type="primary"
                    onClick={handleSaveDisplayName}
                    loading={loadingEdit}
                  >
                    {isMobile ? '保存' : '保存'}
                  </Button>
                  <Button
                    size="small"
                    onClick={handleCancelEdit}
                    disabled={loadingEdit}
                  >
                    {isMobile ? '取消' : '取消'}
                  </Button>
                </Space>
              ) : (
                <Space size="small" wrap={false}>
                  <div
                    style={{
                      color: '#666',
                      fontSize: isMobile ? 12 : 14,
                      cursor: remainingEdits > 0 ? 'pointer' : 'default',
                      padding: '4px 8px',
                      borderRadius: 4,
                      transition: 'background-color 0.2s',
                      maxWidth: isMobile ? 80 : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={handleStartEdit}
                    onMouseEnter={(e) => {
                      if (remainingEdits > 0 && !isMobile) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isMobile) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    title={remainingEdits > 0 ? `点击编辑（剩余 ${remainingEdits} 次）` : '已达到编辑上限'}
                  >
                    {displayName}
                  </div>
                  {!isMobile && remainingEdits > 0 && (
                    <span style={{ color: '#999', fontSize: 12 }}>
                      (可编辑 {remainingEdits} 次)
                    </span>
                  )}
                </Space>
              )}
              <Button
                size="small"
                onClick={handleLogout}
                style={{ flexShrink: 0 }}
              >
                {isMobile ? '退出' : '退出登录'}
              </Button>
            </div>
          </Header>

          {/* 标签栏 - 移动端简化显示 */}
          {!isMobile && (
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
          )}

          {/* 移动端简化标签栏 */}
          {isMobile && (
            <div style={{
              background: '#f5f5f5',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              height: 40,
              position: 'relative',
            }}>
              <div style={{
                flex: 1,
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                msOverflowStyle: '-ms-autohiding-scrollbar',
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
                  items={tabItems.map(item => ({
                    ...item,
                    label: (
                      <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {PAGE_CONFIGS[item.key]?.title}
                      </span>
                    ),
                  }))}
                  style={{
                    marginBottom: 0,
                    height: 40,
                    minWidth: 'max-content',
                  }}
                  tabBarStyle={{
                    marginBottom: 0,
                    borderBottom: 'none',
                  }}
                />
              </div>
              {openTabs.length > 1 && (
                <div style={{
                  flexShrink: 0,
                  marginLeft: 8,
                  paddingLeft: 8,
                  borderLeft: '1px solid #d9d9d9',
                }}>
                  <Button
                    size="small"
                    icon={<ClearOutlined />}
                    onClick={handleClearOtherTabs}
                    title="清除其他标签页"
                    style={{
                      fontSize: 12,
                      height: 28,
                      padding: '0 8px',
                    }}
                  >
                    清除其他
                  </Button>
                </div>
              )}
            </div>
          )}

          <Content style={{
            flex: 1,
            margin: isMobile ? '4px 4px 8px' : '8px 16px 16px',
            overflow: 'hidden',
            background: '#ffffff',
            borderRadius: isMobile ? 4 : 8,
            display: 'flex',
            flexDirection: 'column',
            width: isMobile ? 'calc(100% - 8px)' : 'auto',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}>
            <div style={{
              padding: isMobile ? 4 : 16,
              minHeight: 360,
              height: '100%',
              overflow: 'auto',
              overflowX: 'hidden',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}>
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
