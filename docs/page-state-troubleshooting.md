# 页面状态保持功能故障排除

## 问题：切换回来状态并没有保存，还是被重置了

如果您发现状态没有被保存，请检查以下几点：

### 1. 确认是否正确使用 hooks

确保在页面组件中正确使用了 `usePageStateRestore` 和 `usePageStateSave`：

```typescript
import { usePageStateRestore, usePageStateSave } from '@/hooks/usePageState';

const PAGE_KEY = 'your-page-key'; // 确保使用唯一的 pageKey

export default function YourPage() {
  // 1. 定义默认状态
  const defaultState = {
    currentPage: 1,
    pageSize: 20,
    searchText: '',
    // ... 其他需要保存的状态
  };
  
  // 2. 恢复状态（必须在所有 useState 之前调用）
  const restoredState = usePageStateRestore(PAGE_KEY, defaultState);
  
  // 3. 使用恢复的状态初始化 state
  const [currentPage, setCurrentPage] = useState(
    restoredState?.currentPage ?? defaultState.currentPage
  );
  const [pageSize, setPageSize] = useState(
    restoredState?.pageSize ?? defaultState.pageSize
  );
  const [searchText, setSearchText] = useState(
    restoredState?.searchText ?? defaultState.searchText
  );
  
  // 4. 保存状态（放在组件顶层，在所有 state 定义之后）
  usePageStateSave(PAGE_KEY, {
    currentPage,
    pageSize,
    searchText,
  });
  
  // 5. 如果恢复了状态，重新加载数据
  useEffect(() => {
    if (restoredState) {
      loadData(); // 重新加载数据
    }
  }, []); // 只在组件挂载时执行一次
  
  // ... 其他代码
}
```

### 2. 检查 pageKey 是否唯一

确保每个页面使用不同的 `pageKey`，否则状态可能会被覆盖：

```typescript
// ✅ 正确：使用唯一的 pageKey
const PAGE_KEY = 'product-supplement';
const PAGE_KEY = 'supplier-management';

// ❌ 错误：多个页面使用相同的 pageKey
const PAGE_KEY = 'page'; // 多个页面都用这个
```

### 3. 检查 localStorage 是否可用

打开浏览器开发者工具，检查 localStorage 中是否有 `pageStates` 键：

```javascript
// 在浏览器控制台中运行
localStorage.getItem('pageStates')
```

如果返回 `null` 或 `undefined`，可能是：
- 浏览器禁用了 localStorage
- localStorage 已满
- 状态没有被保存

### 4. 检查状态是否被正确保存

在组件中添加调试代码：

```typescript
usePageStateSave(PAGE_KEY, {
  currentPage,
  pageSize,
  searchText,
}, {
  saveDebounce: 100, // 减少防抖延迟以便测试
});

// 添加调试代码
useEffect(() => {
  console.log('Current state:', { currentPage, pageSize, searchText });
  console.log('Saved state:', localStorage.getItem('pageStates'));
}, [currentPage, pageSize, searchText]);
```

### 5. 检查 PageStateProvider 是否正确包裹

确保 `PageStateProvider` 在布局中正确包裹了页面组件。检查 `web/src/app/home/layout.tsx`：

```typescript
<PageStateProvider>
  {children}
</PageStateProvider>
```

### 6. 常见错误

#### 错误 1：在条件语句中使用 hooks

```typescript
// ❌ 错误
if (someCondition) {
  usePageStateSave(PAGE_KEY, state);
}

// ✅ 正确
usePageStateSave(PAGE_KEY, state);
```

#### 错误 2：使用对象字面量每次都创建新对象

```typescript
// ⚠️ 可能有问题：每次渲染都创建新对象
usePageStateSave(PAGE_KEY, {
  currentPage,
  pageSize,
  searchText,
});

// ✅ 更好的做法：使用 useMemo（可选）
const stateToSave = useMemo(() => ({
  currentPage,
  pageSize,
  searchText,
}), [currentPage, pageSize, searchText]);

usePageStateSave(PAGE_KEY, stateToSave);
```

#### 错误 3：没有在状态恢复后重新加载数据

```typescript
// ❌ 错误：状态恢复了，但数据没有重新加载
const restoredState = usePageStateRestore(PAGE_KEY, defaultState);
const [currentPage, setCurrentPage] = useState(restoredState?.currentPage ?? 1);

// ... 直接使用 currentPage，但数据还是旧的数据

// ✅ 正确：状态恢复后重新加载数据
useEffect(() => {
  if (restoredState) {
    loadData(); // 重新加载数据
  }
}, [restoredState]);
```

### 7. 测试步骤

1. 打开一个页面（如"标签资料管理"）
2. 设置一些搜索条件或筛选条件
3. 切换到另一个页面
4. 再切换回第一个页面
5. 检查状态是否被恢复

### 8. 如果问题仍然存在

1. 检查浏览器控制台是否有错误信息
2. 检查网络标签页，确认是否有 localStorage 相关错误
3. 尝试清除浏览器缓存和 localStorage，然后重新测试
4. 检查代码中是否有其他逻辑覆盖了状态（如 useEffect 中重置状态）

### 9. 调试工具

可以添加以下代码来调试：

```typescript
import { usePageStateManager } from '@/contexts/PageStateContext';

// 在组件中使用
const { getPageState, savePageState } = usePageStateManager();

// 查看当前保存的状态
console.log('Saved state:', getPageState(PAGE_KEY));

// 手动保存状态（用于测试）
const handleManualSave = () => {
  savePageState(PAGE_KEY, {
    currentPage,
    pageSize,
    searchText,
  });
  console.log('State saved:', getPageState(PAGE_KEY));
};
```

