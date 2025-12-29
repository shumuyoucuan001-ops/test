# 数据库表使用统计

本文档统计了 shumu-main 项目中使用的所有数据库表。

## 数据库概览

项目共使用了 **5 个数据库**，包含 **20+ 个数据表和视图**：

1. **sm_xitongkaifa** - 系统开发库（主数据库）
2. **sm_shangping** - 商品库
3. **sm_chaigou** - 采购库
4. **sm_cuxiaohuodong** - 促销活动库
5. **sm_zhangdan_caiwu** - 账单财务库

---

## 1. sm_xitongkaifa（系统开发库）

这是项目的主数据库，使用 Prisma ORM 管理。

### 1.1 系统管理相关表

| 表名 | 说明 | 主要用途 | 使用位置 |
|------|------|----------|----------|
| `sys_users` | 系统用户表 | 存储用户信息（用户名、密码、显示名称、状态等） | acl.service.ts, store-rejection.service.ts, max-store-sku-inventory.service.ts, max-purchase-quantity.service.ts, purchase-amount-adjustment.service.ts, finance-management.service.ts, supplier-management.service.ts |
| `sys_roles` | 角色表 | 存储角色信息（角色名称、备注等） | acl.service.ts, store-rejection.service.ts, max-store-sku-inventory.service.ts, max-purchase-quantity.service.ts |
| `sys_permissions` | 权限表 | 存储权限定义（权限代码、名称、路径等） | acl.service.ts |
| `sys_user_roles` | 用户角色关联表 | 关联用户和角色 | acl.service.ts, store-rejection.service.ts, max-store-sku-inventory.service.ts, max-purchase-quantity.service.ts |
| `sys_role_permissions` | 角色权限关联表 | 关联角色和权限 | acl.service.ts |

### 1.2 业务数据表

| 表名 | 说明 | 主要用途 | 使用位置 |
|------|------|----------|----------|
| `label_data_audit` | 标签数据审核表 | 存储标签资料数据（SKU、供应商名称、产品信息等） | label-data.service.ts, receipt.service.ts |
| `label_templates` | 标签模板表 | 存储标签模板（模板名称、内容、是否默认等） | template.service.ts |
| `supplier_management` | 供应商管理表 | 存储供应商管理信息（供应商编码、最小订单金额、最小订单数量等） | supplier-management.service.ts |
| `supplier_management_change_log` | 供应商管理变更日志表 | 记录供应商管理信息的变更历史 | supplier-management.service.ts |

### 1.3 备份表（已忽略）

| 表名 | 说明 | 状态 |
|------|------|------|
| `label_data_audit_backup_20250921132232` | 标签数据审核备份表 | 已标记为 @@ignore |
| `sys_permissions_bk09241350` | 权限备份表 | 备份表 |

---

## 2. sm_shangping（商品库）

商品相关数据存储。

| 表名 | 类型 | 说明 | 主要用途 | 使用位置 |
|------|------|------|----------|----------|
| `商品主档销售规格` | 表 | 商品主档销售规格表 | 存储商品信息（SPU编码、SKU编码、商品名称、规格名称、商品条码等） | product/master.controller.ts, product/product.service.ts, label-data.service.ts, label-print.service.ts, receipt.service.ts, ops-exclusion.service.ts, ops-activity-dispatch.service.ts, ops-regular-activity-dispatch.service.ts |
| `商品标签` | 表 | 商品标签表 | 存储商品标签信息（产品名称、SKU等） | label-data.service.ts, label-print.service.ts |
| `商品标签打印` | 视图 | 商品标签打印视图 | 标签打印功能的数据视图 | label-print.service.ts |
| `商品上下架排除规则` | 表 | 商品上下架排除规则表 | 存储商品上下架排除规则（SPU、门店编码、渠道编码等） | ops-shelf-exclusion.service.ts |

---

## 3. sm_chaigou（采购库）

采购相关数据存储。

| 表名 | 类型 | 说明 | 主要用途 | 使用位置 |
|------|------|------|----------|----------|
| `仓店补货参考` | 表 | 仓店补货参考表 | 存储补货参考信息（商品SKU、采购单价、商品名称、规格等） | ops-exclusion.service.ts, ops-activity-dispatch.service.ts, ops-regular-activity-dispatch.service.ts, max-store-sku-inventory.service.ts, max-purchase-quantity.service.ts |
| `仓店sku最高库存` | 表 | 仓店SKU最高库存表 | 存储各门店/仓的SKU最高库存限制 | max-store-sku-inventory.service.ts |
| `仓库优先级` | 表 | 仓库优先级表 | 存储仓库优先级信息（门店/仓名称、门店/仓编码等） | max-store-sku-inventory.service.ts, max-purchase-quantity.service.ts |
| `单次最高采购量` | 表 | 单次最高采购量表 | 存储单次最高采购量限制（仓店名称、SKU、单次最高采购量等） | max-purchase-quantity.service.ts |
| `待收货采购收货单号` | 视图 | 待收货采购收货单号视图 | 提供待收货单号信息 | receipt.service.ts |
| `采购单信息` | 表 | 采购单信息表 | 存储采购单基本信息（采购单号、关联收货单号、状态等） | receipt.service.ts |
| `采购单商品明细` | 表 | 采购单商品明细表 | 存储采购单的商品明细信息 | receipt.service.ts |
| `供应商基础资料` | 表 | 供应商基础资料表 | 存储供应商基础信息（供应商编码、供应商名称、到货天数、办公地址、联系人等） | supplier-management.service.ts |
| `待处理差异单` | 表 | 待处理差异单表 | 存储待处理的差异单信息 | store-rejection.service.ts |

---

## 4. sm_cuxiaohuodong（促销活动库）

促销活动相关数据存储。

| 表名 | 类型 | 说明 | 主要用途 | 使用位置 |
|------|------|------|----------|----------|
| `活动视图排除规则` | 表 | 活动视图排除规则表 | 存储活动视图排除规则（视图名称、门店编码、SKU编码、SPU编码等） | ops-exclusion.service.ts |
| `手动强制活动分发` | 表 | 手动强制活动分发表 | 存储手动强制的活动分发信息（SKU、活动价、最低活动价、活动类型、门店名称等） | ops-activity-dispatch.service.ts |
| `手动常规活动分发` | 表 | 手动常规活动分发表 | 存储手动常规的活动分发信息（SKU、活动价、活动类型、活动备注等） | ops-regular-activity-dispatch.service.ts |

---

## 5. sm_zhangdan_caiwu（账单财务库）

财务账单相关数据存储。

| 表名 | 类型 | 说明 | 主要用途 | 使用位置 |
|------|------|------|----------|----------|
| `采购单收货金额异常调整` | 表 | 采购单收货金额异常调整表 | 存储采购单收货金额的异常调整记录（采购单号、调整金额、异常调整原因备注、图片等） | purchase-amount-adjustment.service.ts |
| `手动绑定对账单号` | 表 | 手动绑定对账单号表 | 存储手动绑定的对账单号信息（交易单号、牵牛花采购单号、导入异常备注、图片等） | finance-management.service.ts |

---

## 统计汇总

### 按数据库分类

- **sm_xitongkaifa**: 9 个表（包含2个备份表）
- **sm_shangping**: 4 个表/视图
- **sm_chaigou**: 9 个表/视图
- **sm_cuxiaohuodong**: 3 个表
- **sm_zhangdan_caiwu**: 2 个表

**总计：27 个表/视图**（包含备份表）

### 按功能模块分类

- **系统管理模块**: 5 个表（sys_users, sys_roles, sys_permissions, sys_user_roles, sys_role_permissions）
- **标签管理模块**: 3 个表（label_data_audit, label_templates, 商品标签）
- **商品管理模块**: 2 个表/视图（商品主档销售规格, 商品标签打印）
- **采购管理模块**: 9 个表/视图
- **活动管理模块**: 4 个表（活动视图排除规则, 手动强制活动分发, 手动常规活动分发, 商品上下架排除规则）
- **财务管理模块**: 2 个表
- **供应商管理模块**: 2 个表（supplier_management, supplier_management_change_log, 供应商基础资料）

---

## 主要使用的服务文件

以下文件是数据库表使用的主要入口：

1. **系统权限管理**: `server/src/acl/acl.service.ts`
2. **标签数据管理**: `server/src/label-data/label-data.service.ts`
3. **标签模板管理**: `server/src/template/template.service.ts`
4. **商品管理**: `server/src/product/product.service.ts`, `server/src/product/master.controller.ts`
5. **标签打印**: `server/src/label-print/label-print.service.ts`
6. **采购管理**: `server/src/receipt/receipt.service.ts`
7. **活动管理**: 
   - `server/src/ops-exclusion/ops-exclusion.service.ts`
   - `server/src/ops-activity-dispatch/ops-activity-dispatch.service.ts`
   - `server/src/ops-regular-activity-dispatch/ops-regular-activity-dispatch.service.ts`
   - `server/src/ops-shelf-exclusion/ops-shelf-exclusion.service.ts`
8. **库存管理**: 
   - `server/src/max-store-sku-inventory/max-store-sku-inventory.service.ts`
   - `server/src/max-purchase-quantity/max-purchase-quantity.service.ts`
9. **财务管理**: 
   - `server/src/purchase-amount-adjustment/purchase-amount-adjustment.service.ts`
   - `server/src/finance-management/finance-management.service.ts`
10. **供应商管理**: `server/src/supplier-management/supplier-management.service.ts`
11. **门店拒收管理**: `server/src/store-rejection/store-rejection.service.ts`

---

## 注意事项

1. **Prisma Schema**: `sm_xitongkaifa` 数据库中的表在 `server/prisma/schema.prisma` 中有定义
2. **原始SQL查询**: 大部分业务表使用 `$queryRawUnsafe` 直接执行 SQL 查询
3. **数据库连接**: 除了 Prisma 连接外，部分服务使用 `mysql2/promise` 直接连接数据库
4. **视图**: 部分数据以视图（VIEW）形式提供，如 `商品标签打印`、`待收货采购收货单号`
5. **备份表**: `label_data_audit_backup_20250921132232` 和 `sys_permissions_bk09241350` 是备份表，已标记为忽略

---

## 最后更新

- **统计日期**: 2025-01-XX
- **代码库版本**: shumu-main
- **数据库环境**: 阿里云 RDS MySQL

