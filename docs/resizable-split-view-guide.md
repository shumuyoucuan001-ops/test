# 可调整大小的分割视图（Resizable Split View）实现指南

## 术语说明

**专业术语：**
- **Split View** / **Split Pane**（分割视图/分割面板）
- **Resizable Panels**（可调整大小的面板）
- **Splitter** / **Resizer**（分割器/调整器）
- **Drag to Resize**（拖拽调整大小）
- **Proportional Resizing**（按比例调整）

**组合术语：**
- **Resizable Split View**（可调整大小的分割视图）
- **Flex Layout with Resizable Split**（Flex 布局的可调整分割）

## 实现原理

### 核心概念

1. **Flexbox 布局**：使用 `display: flex` 和 `flexDirection: 'column'` 实现垂直分割
2. **百分比分配**：使用百分比值（如 `66.67%` 和 `33.33%`）来控制上下容器的高度比例
3. **状态管理**：使用 React state 存储当前的分割比例
4. **拖拽交互**：通过鼠标事件（`mousemove`、`mouseup`）实现拖拽调整

### 布局结构

```
最外层容器 (flex column)
├── 上栏容器 (flex: 0 0 ${topPanelHeight}%)
├── 分割线 (固定高度 4px, flexShrink: 0)
└── 下栏容器 (flex: 1 1 ${100 - topPanelHeight}%)
```

## 代码实现

### 1. 状态定义

```typescript
// 上下分栏高度比例（默认上2/3，下1/3）
const [topPanelHeight, setTopPanelHeight] = useState<number>(66.67); // 百分比
const [isResizing, setIsResizing] = useState(false); // 是否正在调整高度
```

### 2. 布局结构

```tsx
<div style={{ 
  padding: 16, 
  height: '100%', 
  display: 'flex', 
  flexDirection: 'column', 
  overflow: 'hidden', 
  minHeight: 0 
}}>
  {/* 上栏容器 */}
  <Card
    style={{ 
      flex: `0 0 ${topPanelHeight}%`, 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: 0, 
      overflow: 'hidden', 
      boxSizing: 'border-box' 
    }}
  >
    {/* 上栏内容 */}
  </Card>

  {/* 分割线 */}
  <div
    style={{
      height: '4px',
      backgroundColor: isResizing ? '#1890ff' : '#d9d9d9',
      cursor: 'ns-resize',
      position: 'relative',
      flexShrink: 0,
    }}
    onMouseDown={(e) => {
      e.preventDefault();
      setIsResizing(true);
      const startY = e.clientY;
      const startTopHeight = topPanelHeight;
      const containerHeight = e.currentTarget.parentElement?.clientHeight || 600;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const deltaPercent = (deltaY / containerHeight) * 100;
        // 限制在5%-95%之间，确保两个容器都有最小高度
        const newTopHeight = Math.max(5, Math.min(95, startTopHeight + deltaPercent));
        setTopPanelHeight(newTopHeight);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }}
    onMouseEnter={(e) => {
      if (!isResizing) {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#1890ff';
      }
    }}
    onMouseLeave={(e) => {
      if (!isResizing) {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#d9d9d9';
      }
    }}
  />

  {/* 下栏容器 */}
  <div style={{ 
    flex: `1 1 ${100 - topPanelHeight}%`, 
    minHeight: 200, 
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden', 
    boxSizing: 'border-box' 
  }}>
    {/* 下栏内容 */}
  </div>
</div>
```

### 3. 完整的实现示例（简化版）

```typescript
import React, { useState } from 'react';
import { Card } from 'antd';

const ResizableSplitView: React.FC = () => {
  // 上下分栏高度比例（默认上2/3，下1/3）
  const [topPanelHeight, setTopPanelHeight] = useState<number>(66.67);
  const [isResizing, setIsResizing] = useState(false);

  return (
    <div style={{ 
      padding: 16, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden', 
      minHeight: 0 
    }}>
      {/* 上栏容器 */}
      <Card
        title="上栏标题"
        style={{ 
          flex: `0 0 ${topPanelHeight}%`, 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: 0, 
          overflow: 'hidden', 
          boxSizing: 'border-box' 
        }}
      >
        {/* 上栏内容 */}
      </Card>

      {/* 分割线 */}
      <div
        style={{
          height: '4px',
          backgroundColor: isResizing ? '#1890ff' : '#d9d9d9',
          cursor: 'ns-resize',
          position: 'relative',
          flexShrink: 0,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
          const startY = e.clientY;
          const startTopHeight = topPanelHeight;
          const containerHeight = e.currentTarget.parentElement?.clientHeight || 600;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const deltaPercent = (deltaY / containerHeight) * 100;
            const newTopHeight = Math.max(5, Math.min(95, startTopHeight + deltaPercent));
            setTopPanelHeight(newTopHeight);
          };

          const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#1890ff';
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#d9d9d9';
          }
        }}
      />

      {/* 下栏容器 */}
      <div style={{ 
        flex: `1 1 ${100 - topPanelHeight}%`, 
        minHeight: 200, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden', 
        boxSizing: 'border-box' 
      }}>
        <Card title="下栏标题" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {/* 下栏内容 */}
        </Card>
      </div>
    </div>
  );
};

export default ResizableSplitView;
```

## 关键要点

### 1. Flex 布局设置

- **最外层容器**：`display: flex`, `flexDirection: 'column'`, `height: '100%'`
- **上栏容器**：`flex: 0 0 ${topPanelHeight}%`（固定百分比，不伸缩）
- **分割线**：`flexShrink: 0`（不收缩）
- **下栏容器**：`flex: 1 1 ${100 - topPanelHeight}%`（可伸缩，占据剩余空间）

### 2. 百分比计算

- 上栏：`flex: 0 0 ${topPanelHeight}%`
- 下栏：`flex: 1 1 ${100 - topPanelHeight}%`
- 确保总和为 100%，使用百分比而非固定像素值

### 3. 拖拽逻辑

- **起始位置**：记录鼠标按下时的 Y 坐标和当前高度百分比
- **移动计算**：根据鼠标移动距离计算百分比变化
- **限制范围**：通常限制在 5%-95% 之间，确保两个容器都有最小高度
- **事件清理**：在 `mouseup` 时移除事件监听器

### 4. 样式细节

- **分割线高度**：通常 4px
- **光标样式**：`cursor: 'ns-resize'`（垂直调整）或 `cursor: 'ew-resize'`（水平调整）
- **悬停效果**：鼠标悬停时改变颜色，提供视觉反馈
- **boxSizing**：使用 `border-box` 确保 padding 和 border 包含在尺寸计算中

## 水平分割（横向分割）

如果需要水平分割（左右分割），调整如下：

```typescript
// 状态改为宽度百分比
const [leftPanelWidth, setLeftPanelWidth] = useState<number>(66.67);

// 布局改为横向
<div style={{ display: 'flex', flexDirection: 'row', ... }}>
  {/* 左栏 */}
  <div style={{ flex: `0 0 ${leftPanelWidth}%`, ... }}>...</div>
  
  {/* 分割线 */}
  <div
    style={{
      width: '4px',
      cursor: 'ew-resize', // 改为横向光标
      ...
    }}
    onMouseDown={(e) => {
      // deltaX 而不是 deltaY
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      ...
    }}
  />
  
  {/* 右栏 */}
  <div style={{ flex: `1 1 ${100 - leftPanelWidth}%`, ... }}>...</div>
</div>
```

## 最佳实践

1. **最小高度限制**：为上下容器设置 `minHeight`，防止过度压缩
2. **百分比限制**：限制调整范围（如 5%-95%），确保两个面板都可见
3. **性能优化**：使用 `useCallback` 优化事件处理函数（如果需要在组件外部定义）
4. **事件清理**：确保在组件卸载时清理事件监听器
5. **视觉反馈**：提供悬停和拖拽时的视觉反馈（颜色变化）

## 参考实现

- **Ant Design Split 组件**：`<Split>` 组件提供类似功能
- **React Split Pane**：第三方库 `react-split-pane`
- **VS Code 的分割视图**：经典的 Split View 实现

## 常见问题

### Q: 为什么使用百分比而不是像素值？

A: 百分比能够自适应容器大小变化，在不同屏幕尺寸下都能正常工作。像素值需要手动计算和更新，不够灵活。

### Q: 如何保存用户调整后的比例？

A: 可以将 `topPanelHeight` 保存到 localStorage，在组件初始化时读取：

```typescript
const [topPanelHeight, setTopPanelHeight] = useState<number>(() => {
  const saved = localStorage.getItem('splitViewTopHeight');
  return saved ? parseFloat(saved) : 66.67;
});

// 在调整时保存
const handleMouseMove = (moveEvent: MouseEvent) => {
  // ... 计算 newTopHeight
  setTopPanelHeight(newTopHeight);
  localStorage.setItem('splitViewTopHeight', newTopHeight.toString());
};
```

### Q: 如何实现多个分割区域？

A: 可以使用多个分割线，每个分割线管理相邻两个区域的比例。或者使用嵌套的 Split View 结构。

## 总结

Resizable Split View 是一种常见的 UI 模式，通过 Flexbox 布局和鼠标事件实现。关键在于：
- 使用百分比分配空间
- 通过状态管理存储比例
- 使用鼠标事件实现拖拽交互
- 合理设置限制和视觉反馈

这种方法简单、高效，无需引入额外的库，适合大多数场景。

