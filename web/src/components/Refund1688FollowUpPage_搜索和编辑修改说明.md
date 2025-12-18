# 前端修改说明

## 需要修改的部分

### 1. 搜索框改造（在第344-353行附近）

```tsx
// 当前的搜索框
<Input.Search
    placeholder="搜索收货人/订单编号/买家会员名/采购单号/物流单号"
    style={{ width: 400 }}
    value={searchText}
    onChange={(e) => setSearchText(e.target.value)}
    onSearch={handleSearch}
    allowClear
/>

// 改为多个独立搜索框 + 总搜索框
<Space wrap>
    <Input
        placeholder="收货人姓名"
        style={{ width: 150 }}
        value={searchFilters.收货人姓名}
        onChange={(e) => setSearchFilters({...searchFilters, 收货人姓名: e.target.value})}
        allowClear
    />
    <Input
        placeholder="订单编号"
        style={{ width: 150 }}
        value={searchFilters.订单编号}
        onChange={(e) => setSearchFilters({...searchFilters, 订单编号: e.target.value})}
        allowClear
    />
    <Input
        placeholder="订单状态"
        style={{ width: 150 }}
        value={searchFilters.订单状态}
        onChange={(e) => setSearchFilters({...searchFilters, 订单状态: e.target.value})}
        allowClear
    />
    <Select
        placeholder="进度追踪"
        style={{ width: 150 }}
        value={searchFilters.进度追踪}
        onChange={(value) => setSearchFilters({...searchFilters, 进度追踪: value})}
        allowClear
    >
        {PROGRESS_STATUS_OPTIONS.map(status => (
            <Option key={status} value={status}>{status}</Option>
        ))}
    </Select>
    <Input
        placeholder="采购单号"
        style={{ width: 150 }}
        value={searchFilters.采购单号}
        onChange={(e) => setSearchFilters({...searchFilters, 采购单号: e.target.value})}
        allowClear
    />
    <Input.Search
        placeholder="总搜索（全字段）"
        style={{ width: 200 }}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onSearch={handleSearch}
        allowClear
    />
    <Button type="primary" onClick={handleSearch}>搜索</Button>
    <Button onClick={() => {
        setSearchText('');
        setSearchFilters({});
        setCurrentPage(1);
    }}>重置</Button>
</Space>
```

### 2. 编辑表单修改（约第380-440行）

只保留以下可编辑字段的Form.Item：

```tsx
<Form form={form} layout="vertical">
    <Form.Item label="进度追踪" name="进度追踪">
        <Select>
            {PROGRESS_STATUS_OPTIONS.map(status => (
                <Option key={status} value={status}>{status}</Option>
            ))}
        </Select>
    </Form.Item>
    
    <Form.Item label="采购单号" name="采购单号">
        <Input />
    </Form.Item>
    
    <Form.Item label="跟进情况/备注" name="跟进情况备注">
        <TextArea rows={4} />
    </Form.Item>
    
    <Form.Item label="出库单号（回库）" name="出库单号回库">
        <Input />
    </Form.Item>
    
    <Form.Item label="差异单/出库单详情" name="差异单出库单详情">
        <TextArea rows={3} />
    </Form.Item>
    
    <Form.Item label="退款详情" name="退款详情">
        <TextArea rows={3} />
    </Form.Item>
    
    <Form.Item label="物流单号" name="物流单号">
        <Input />
    </Form.Item>
    
    <Form.Item label="发货截图" name="发货截图">
        <TextArea rows={2} placeholder="图片URL，多个用逗号分隔" />
    </Form.Item>
    
    <Form.Item label="跟进人" name="跟进人">
        <Input placeholder="输入跟进人姓名（来自sys_users的display_name）" />
    </Form.Item>
</Form>
```

### 3. API接口类型更新（web/src/lib/api.ts）

在 refund1688Api.getAll 的参数类型中添加：

```typescript
订单状态?: string;
```

## 关于跟进人字段

跟进人应该显示 sys_users 表的 display_name。这需要：
1. 后端JOIN sys_users表
2. 或者前端根据user_id查询display_name
3. 或者在数据库中直接存储display_name

建议直接存储display_name（简单直接）。

