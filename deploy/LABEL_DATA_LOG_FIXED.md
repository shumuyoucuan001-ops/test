# 标签资料修改日志功能 - 修复完成

## ✅ 已修复的问题

### 1. 修改日志无法显示

**问题原因**:

- MySQL 的 JSON 列在查询时会自动解析为 JavaScript 对象
- 后端代码对已解析的对象再次执行`JSON.parse()`导致错误

**解决方案**:

```typescript
// server/src/label-data/label-data.service.ts
changes: typeof row.changes === "string"
  ? JSON.parse(row.changes)
  : row.changes || {};
```

### 2. 操作人名称未记录

**问题原因**:

- 前端未正确获取用户的显示名称（`display_name`）
- 只尝试获取`userName`或`username`字段

**解决方案**:

```typescript
// web/src/components/ProductSupplementPage.tsx
const userName =
  localStorage.getItem("displayName") ||
  localStorage.getItem("display_name") ||
  localStorage.getItem("userName") ||
  localStorage.getItem("username");
```

### 3. 多个后端进程冲突

**问题原因**:

- 多个`nest start --watch`进程同时运行
- 请求被旧的进程处理，新代码未生效

**解决方案**:

```bash
# 停止所有旧进程
killall -9 node

# 重新启动后端服务
cd /Users/xiangwork/Documents/GitHub/shumu/server
nohup npm run start:dev > /tmp/nest.log 2>&1 &
```

## 📊 数据库结构

### `label_data_change_log` 表

| 字段          | 类型         | 说明                             |
| ------------- | ------------ | -------------------------------- |
| id            | BIGINT       | 主键                             |
| sku           | VARCHAR(128) | 商品 SKU                         |
| supplier_name | VARCHAR(128) | 供应商名称                       |
| action        | VARCHAR(20)  | 操作类型: create, update, delete |
| changes       | JSON         | 变更内容 (字段级变更)            |
| user_id       | INT          | 操作用户 ID                      |
| user_name     | VARCHAR(128) | 操作用户显示名称                 |
| created_at    | TIMESTAMP    | 创建时间                         |

## 🔍 已知的 Supplier Name 格式

数据库中存在 3 种 supplier_name 格式：

1. `(推)13334436` - 3 条记录
2. `2400281` - 3 条记录
3. `13334436` - 2 条记录

前端会根据实际保存的格式进行查询，无需特殊处理。

## 📝 测试步骤

### 1. 刷新页面并登录

确保 localStorage 中有用户信息：

- `userId`
- `displayName` 或 `display_name`

### 2. 编辑标签资料

1. 打开 `http://192.168.0.109:3000/home/product-supplement`
2. 点击任意记录的"编辑"按钮
3. 修改一些字段（如"抬头信息"、"执行标准"等）
4. 点击"确定"保存

### 3. 查看修改日志

1. 重新打开同一条记录的"编辑"弹窗
2. 切换到"修改日志"标签
3. 应该能看到：
   - ✅ 创建时间显示
   - ✅ 操作记录列表
   - ✅ 操作人显示（如果 localStorage 中有 displayName）
   - ✅ 操作时间
   - ✅ 变更字段详情

## 🐛 后端日志监控

查看后端日志：

```bash
tail -f /tmp/nest.log
```

关键日志：

```
[LabelDataController] getLogs called with: { sku: ..., supplierName: ... }
[LabelDataService] Querying logs for SKU: ... Supplier: ...
[LabelDataService] Log query result: N records
```

## ⚠️ 注意事项

1. **用户信息获取**: 需要确保登录时正确设置了`displayName`到 localStorage
2. **JSON 解析**: 不要手动修改数据库中的 JSON 字段，MySQL 会自动处理
3. **后端进程**: 避免同时运行多个后端进程，会导致代码热重载失效

## 🎯 下一步优化

1. 在登录时确保`displayName`被正确保存到 localStorage
2. 添加"修改人"和"创建人"字段的区分
3. 支持导出修改日志
4. 添加日志搜索和过滤功能

