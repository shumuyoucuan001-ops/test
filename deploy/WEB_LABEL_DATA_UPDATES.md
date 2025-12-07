# 标签资料管理 - 更新说明

## ✅ 最新更新 (2025-10-03)

### 1. 创建时间显示

在编辑页面顶部显示记录的创建时间：

```
┌─────────────────────────────────────┐
│ 创建时间：2025-10-03 12:30:45      │
├─────────────────────────────────────┤
│ * SKU                               │
│ [192548772230347985        ]        │
│                                     │
│ * 供应商名称                        │
│ [13334436                  ]        │
└─────────────────────────────────────┘
```

**数据来源**: `label_data_audit.created_at`

### 2. 修改日志功能

#### 数据库表自动创建

表名: `sm_xitongkaifa.label_data_change_log`

```sql
CREATE TABLE IF NOT EXISTS label_data_change_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(128) NOT NULL,
  supplier_name VARCHAR(128) NOT NULL,
  action VARCHAR(20) NOT NULL COMMENT 'create, update, delete',
  changes JSON COMMENT '变更内容',
  user_id INT COMMENT '操作用户ID',
  user_name VARCHAR(128) COMMENT '操作用户名称',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sku_supplier (sku, supplier_name),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签资料变更日志表'
```

#### 日志记录时机

1. **创建记录**:
   - 操作类型: `create`
   - 变更内容: 空对象 `{}`
2. **修改记录**:

   - 操作类型: `update`
   - 变更内容: 记录每个字段的变更

   示例：

   ```json
   {
     "productName": {
       "old": "旧产品名",
       "new": "新产品名"
     },
     "executionStandard": {
       "old": "GB/T 123",
       "new": "GB/T 456"
     }
   }
   ```

#### 日志显示

在"修改日志"标签页中：

```
时间轴显示：

🟢 创建记录
   操作人：系统
   时间：2025-10-03 12:30:45

🔵 修改记录
   操作人：系统
   时间：2025-10-03 14:20:15
   变更字段：
     产品名称: 旧产品名 → 新产品名
     执行标准: GB/T 123 → GB/T 456
```

### 3. 字段名映射

后端字段 → 前端显示名称：

| 字段名            | 显示名称 |
| ----------------- | -------- |
| productName       | 产品名称 |
| headerInfo        | 抬头信息 |
| executionStandard | 执行标准 |
| manufacturerName  | 厂家名称 |
| addressInfo       | 地址信息 |
| material          | 材质     |
| otherInfo         | 其他信息 |

### 4. 问题排查

#### 如果看不到修改日志

1. **检查浏览器控制台**:

   - 打开开发者工具 (F12)
   - 查看 Console 标签
   - 应该看到类似以下日志：

   ```
   [ProductSupplement] Loading logs for: { sku: "...", supplierName: "..." }
   [ProductSupplement] Logs loaded: [...]
   ```

2. **检查后端日志**:

   - 后端应该输出：

   ```
   [LabelDataService] Log query result for ... : N records
   ```

3. **检查数据库**:

   ```sql
   -- 查看日志表是否存在
   SHOW TABLES LIKE 'label_data_change_log';

   -- 查看某个SKU的日志
   SELECT * FROM label_data_change_log
   WHERE sku = '192548772230347985'
   AND supplier_name = '13334436';
   ```

4. **手动创建测试日志**:
   ```sql
   INSERT INTO label_data_change_log
   (sku, supplier_name, action, changes, user_name, created_at)
   VALUES
   ('192548772230347985', '13334436', 'create', '{}', '测试用户', NOW());
   ```

### 5. API 接口

**GET** `/label-data/logs?sku={sku}&supplierName={supplierName}`

请求示例：

```
GET http://localhost:4000/label-data/logs?sku=192548772230347985&supplierName=13334436
```

响应示例：

```json
[
  {
    "id": 1,
    "sku": "192548772230347985",
    "supplierName": "13334436",
    "action": "create",
    "changes": {},
    "userId": null,
    "userName": "系统",
    "createdAt": "2025-10-03 12:30:45"
  }
]
```

### 6. 测试步骤

1. **测试创建时间显示**:

   - 打开任意标签资料编辑页面
   - 查看表单顶部是否显示"创建时间"

2. **测试修改日志**:

   - 点击"修改日志"标签
   - 如果是新记录，应该显示"暂无修改记录"
   - 修改一些字段后保存
   - 重新打开编辑页面
   - 切换到"修改日志"，应该能看到修改记录

3. **测试日志内容**:
   - 修改多个字段
   - 查看日志是否正确显示所有变更
   - 字段名是否正确显示为中文

---

## 访问地址

- 本地: http://localhost:3000/home/product-supplement
- 局域网: http://192.168.0.109:3000/home/product-supplement

## 下一步

如果日志功能正常工作，建议：

1. 添加用户身份传递机制
2. 在前端保存时传递当前登录用户信息
3. 实现日志过滤和搜索功能
4. 添加日志导出功能

现在可以在浏览器中测试这些更新了！ 🎉

