# Web 版标签资料管理已更新

## ✅ 更新完成！

### 修改内容

1. **数据源修改**：

   - 从 `sm_shangping.商品标签` 表 ❌
   - 改为 `sm_xitongkaifa.label_data_audit` 表 ✅

2. **字段映射**：

   - `sku` - SKU 编码
   - `supplier_name` → `supplierName` - 供应商名称
   - `header_info` → `headerInfo` - 抬头信息
   - `product_spec` → `productSpec` - 产品规格（只读，从 sm_shangping 库自动获取）
   - `execution_standard` → `executionStandard` - 执行标准
   - `product_name` → `productName` - 产品名称
   - `manufacturer_name` → `manufacturerName` - 厂家名称
   - `address_info` → `addressInfo` - 地址信息
   - `material` - 材质
   - `other_info` → `otherInfo` - 其他信息

3. **新功能**：
   - ✅ SKU 搜索
   - ✅ 供应商搜索
   - ✅ 分页显示
   - ✅ 产品规格自动从 sm_shangping 库获取并显示
   - ✅ 表单字段长度验证
   - ✅ 新增/编辑/删除功能

### 字段长度限制

| 字段       | 最大长度         |
| ---------- | ---------------- |
| SKU        | 50 字            |
| 供应商名称 | 50 字            |
| 抬头信息   | 15 字            |
| 产品规格   | 只读（自动获取） |
| 执行标准   | 30 字            |
| 产品名称   | 13 字            |
| 厂家名称   | 26 字            |
| 地址信息   | 26 字            |
| 材质       | 13 字            |
| 其他信息   | 12 字            |

### 访问地址

- 本地: http://localhost:3000/home/product-supplement
- 局域网: http://192.168.0.109:3000/home/product-supplement

### 注意事项

- 产品规格字段自动从 `sm_shangping.商品主档销售规格` 表根据 SKU 获取
- 编辑时 SKU 和供应商名称不可修改（复合主键）
- 所有更改实时保存到 `sm_xitongkaifa.label_data_audit` 表

---

**现在可以在浏览器中测试标签资料管理功能了！** 🎉

