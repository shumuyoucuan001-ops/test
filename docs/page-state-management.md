# 页面状态保持功能使用指南

## 功能说明

当用户在功能A中进行搜索、筛选等操作后，切换到功能B，再返回功能A时，功能A会保持之前的状态（搜索条件、筛选条件、分页等），而不需要重新设置。

## 实现原理

页面状态保存在 `localStorage` 中，使用页面唯一标识符（pageKey）作为键。当页面切换时，状态会自动保存；当页面重新加载时，状态会自动恢复。

## 使用方法

### 1. 在页面组件中导入 hooks

```typescript
import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';
```

### 2. 定义默认状态和页面标识符

```typescript
const PAGE_KEY = 'product-supplement'; // 页面唯一标识符

const defaultState = {
  currentPage: 1,
  pageSize: 20,
  searchSku: '',
  searchSupplier: '',
  activeTab: 'edit' as 'edit' | 'history',
};
```

### 3. 恢复保存的状态

```typescript
// 在组件开始处恢复状态
const restoredState = usePageStateRestore(PAGE_KEY, defaultState);

// 使用恢复的状态初始化 state
const [currentPage, setCurrentPage] = useState(
  restoredState?.currentPage ?? defaultState.currentPage
);
const [pageSize, setPageSize] = useState(
  restoredState?.pageSize ?? defaultState.pageSize
);
const [searchSku, setSearchSku] = useState(
  restoredState?.searchSku ?? defaultState.searchSku
);
const [searchSupplier, setSearchSupplier] = useState(
  restoredState?.searchSupplier ?? defaultState.searchSupplier
);
const [activeTab, setActiveTab] = useState(
  restoredState?.activeTab ?? defaultState.activeTab
);
```

### 4. 保存状态

```typescript
// 在组件中保存状态（自动保存，防抖 300ms）
usePageStateSave(PAGE_KEY, {
  currentPage,
  pageSize,
  searchSku,
  searchSupplier,
  activeTab,
});
```

### 5. 在状态恢复后重新加载数据

```typescript
// 如果恢复了状态，需要重新加载数据
useEffect(() => {
  if (restoredState) {
    load(); // 重新加载数据
  }
}, []); // 只在组件挂载时执行一次
```

## 完整示例

```typescript
"use client";

import { useEffect, useState } from 'react';
import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';

const PAGE_KEY = 'product-supplement';

export default function ProductSupplementPage() {
  // 定义默认状态
  const defaultState = {
    currentPage: 1,
    pageSize: 20,
    searchSku: '',
    searchSupplier: '',
    activeTab: 'edit' as 'edit' | 'history',
  };
  
  // 恢复保存的状态
  const restoredState = usePageStateRestore(PAGE_KEY, defaultState);
  
  // 使用恢复的状态初始化
  const [currentPage, setCurrentPage] = useState(
    restoredState?.currentPage ?? defaultState.currentPage
  );
  const [pageSize, setPageSize] = useState(
    restoredState?.pageSize ?? defaultState.pageSize
  );
  const [searchSku, setSearchSku] = useState(
    restoredState?.searchSku ?? defaultState.searchSku
  );
  const [searchSupplier, setSearchSupplier] = useState(
    restoredState?.searchSupplier ?? defaultState.searchSupplier
  );
  const [activeTab, setActiveTab] = useState(
    restoredState?.activeTab ?? defaultState.activeTab
  );
  
  // 保存状态（自动保存）
  usePageStateSave(PAGE_KEY, {
    currentPage,
    pageSize,
    searchSku,
    searchSupplier,
    activeTab,
  });
  
  // 如果恢复了状态，重新加载数据
  useEffect(() => {
    if (restoredState) {
      load();
    }
  }, []); // 只在组件挂载时执行一次
  
  const load = async () => {
    // 加载数据的逻辑
    // ...
  };
  
  // ... 其他代码
}
```

## 高级用法

### 只保存部分状态

```typescript
usePageStateSave(PAGE_KEY, {
  currentPage,
  pageSize,
  searchSku,
  searchSupplier,
  activeTab,
  // 只保存这些字段
}, {
  keysToSave: ['currentPage', 'pageSize', 'searchSku', 'searchSupplier', 'activeTab'],
});
```

### 禁用自动保存

```typescript
usePageStateSave(PAGE_KEY, stateToSave, {
  enabled: false, // 禁用自动保存
});

// 手动保存
const { saveNow } = usePageStateSave(PAGE_KEY, stateToSave, { enabled: false });
saveNow(); // 手动触发保存
```

### 清除保存的状态

```typescript
import { usePageStateClear } from '@/hooks/usePageState';

const { clear } = usePageStateClear(PAGE_KEY);

// 清除保存的状态
const handleReset = () => {
  clear();
  // 重置到默认状态
  setCurrentPage(defaultState.currentPage);
  setPageSize(defaultState.pageSize);
  // ...
};
```

## 注意事项

1. **页面标识符（pageKey）**：应该使用唯一的标识符，建议使用路径或功能名称，如 `'product-supplement'`、`'supplier-management'` 等。

2. **状态序列化**：状态会通过 `JSON.stringify` 序列化保存，所以只能保存可序列化的数据（不能保存函数、undefined 等）。

3. **性能考虑**：状态保存使用了防抖机制（默认 300ms），避免频繁保存。组件卸载时会立即保存状态。

4. **localStorage 限制**：localStorage 有大小限制（通常 5-10MB），如果保存的状态过多，会自动清理旧的状态（保留最近 30 个）。

5. **状态恢复时机**：状态在组件挂载时恢复，如果需要在恢复后重新加载数据，应该在 `useEffect` 中处理。

## 迁移现有页面

要将现有页面迁移到使用状态保持功能：

1. 确定需要保存的状态变量（通常是搜索条件、筛选条件、分页等）
2. 定义默认状态对象
3. 使用 `usePageStateRestore` 恢复状态
4. 使用恢复的状态初始化 state
5. 使用 `usePageStateSave` 保存状态
6. 在状态恢复后重新加载数据

