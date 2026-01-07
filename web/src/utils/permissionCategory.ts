import { SysPermission } from "@/lib/api";

// 根据主页菜单配置的权限分类映射
const PERMISSION_CATEGORIES: Record<string, string> = {
    // 商品管理
    '/home/products': '商品管理',
    '/home/product-supplement': '商品管理',

    // 门店管理
    '/home/store-rejection': '门店管理',
    '/home/max-purchase-quantity': '门店管理',
    '/home/max-store-sku-inventory': '门店管理',

    // 供应商管理
    '/home/supplier-management': '供应商管理',

    // 采购管理
    '/home/purchase-pass-difference': '采购管理',
    '/home/purchase': '采购管理',
    '/home/supplier-conversion-relation': '采购管理',
    '/home/refund-1688-follow-up': '采购管理',

    // 运营管理
    '/home/ops-exclusion': '运营管理',
    '/home/ops-activity-dispatch': '运营管理',
    '/home/ops-regular-activity-dispatch': '运营管理',
    '/home/ops-shelf-exclusion': '运营管理',

    // 财务管理
    '/home/finance-management': '财务管理',
    '/home/finance-reconciliation-difference': '财务管理',
    '/home/transaction-record': '财务管理',
    '/home/non-purchase-bill-record': '财务管理',
    '/home/purchase-amount-adjustment': '财务管理',
    '/home/supplier-quotation': '财务管理',

    // 系统管理
    '/home/admin-permissions': '系统管理',
    '/home/admin-roles': '系统管理',
    '/home/admin-users': '系统管理',

    // 其他
    '/home/templates': '其他',
    '/home/print': '其他',
    '/home': '其他',
};

// 获取权限的分类
export function getPermissionCategory(permission: SysPermission): string {
    // 直接匹配路径
    if (PERMISSION_CATEGORIES[permission.path]) {
        return PERMISSION_CATEGORIES[permission.path];
    }

    // 如果路径以 /home/ 开头，尝试匹配前缀
    if (permission.path.startsWith('/home/')) {
        // 尝试匹配最长的路径前缀
        const pathParts = permission.path.split('/');
        for (let i = pathParts.length; i >= 2; i--) {
            const prefix = pathParts.slice(0, i).join('/');
            if (PERMISSION_CATEGORIES[prefix]) {
                return PERMISSION_CATEGORIES[prefix];
            }
        }
    }

    // 默认分类
    return '其他';
}

// 按分类分组权限
export function groupPermissionsByCategory(permissions: SysPermission[]): Record<string, SysPermission[]> {
    const grouped: Record<string, SysPermission[]> = {};

    permissions.forEach(permission => {
        const category = getPermissionCategory(permission);
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(permission);
    });

    // 按分类名称排序
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const order = ['商品管理', '门店管理', '供应商管理', '采购管理', '运营管理', '财务管理', '系统管理', '其他'];
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    const sortedGrouped: Record<string, SysPermission[]> = {};
    sortedCategories.forEach(category => {
        sortedGrouped[category] = grouped[category];
    });

    return sortedGrouped;
}

