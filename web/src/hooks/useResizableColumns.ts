"use client";

import { ColumnType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ColumnWidths {
  [key: string]: number;
}

/**
 * 可调整列宽的 Hook
 * @param tableId 表格唯一标识，用于在 localStorage 中存储列宽设置
 * @param columns 表格列配置
 * @param enabled 是否启用列宽调整功能，默认为 true
 * @returns 包含调整后的列配置和列宽状态的元组
 */
export function useResizableColumns<T = any>(
  tableId: string,
  columns: ColumnType<T>[],
  enabled: boolean = true
) {
  const storageKey = `table_column_widths_${tableId}`;
  const tableRef = useRef<HTMLDivElement>(null);

  // 从 localStorage 加载保存的列宽
  const loadColumnWidths = useCallback((): ColumnWidths => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("加载列宽设置失败:", error);
    }
    return {};
  }, [storageKey]);

  // 保存列宽到 localStorage
  const saveColumnWidths = useCallback(
    (widths: ColumnWidths) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(widths));
      } catch (error) {
        console.error("保存列宽设置失败:", error);
      }
    },
    [storageKey]
  );

  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() =>
    loadColumnWidths()
  );

  // 获取列的唯一标识
  const getColumnKey = useCallback((col: ColumnType<T>): string | null => {
    return (col.key as string) || (col.dataIndex as string) || null;
  }, []);

  // 合并列配置和保存的列宽
  const resizableColumns = useMemo(() => {
    if (!enabled) return columns;

    return columns.map((col, index) => {
      const key = getColumnKey(col);
      if (!key) return col;

      const savedWidth = columnWidths[key];
      const defaultWidth = (col.width as number) || 100;
      const currentWidth = savedWidth || defaultWidth;

      // 获取原有的 onHeaderCell
      const originalOnHeaderCell = col.onHeaderCell;

      return {
        ...col,
        width: currentWidth,
        onHeaderCell: (column: ColumnType<T>) => {
          const originalProps = originalOnHeaderCell
            ? originalOnHeaderCell(column)
            : {};

          // 如果是固定列，不添加调整功能
          const isFixed = col.fixed === "left" || col.fixed === "right";
          if (isFixed) {
            return originalProps;
          }

          return {
            ...originalProps,
            style: {
              ...originalProps.style,
              position: "relative",
              userSelect: "none",
            } as React.CSSProperties,
            "data-column-key": key,
            "data-column-index": index,
          };
        },
      };
    });
  }, [columns, columnWidths, enabled, getColumnKey]);

  // 处理列宽调整
  useEffect(() => {
    if (!enabled) return;

    // 添加 CSS 样式来显示可调整的列边界（只添加一次）
    const styleId = `resizable-columns-style-${tableId}`;
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      styleElement.textContent = `
        .ant-table-thead > tr > th[data-column-key]:not([data-fixed]) {
          position: relative;
          border-right: 2px solid transparent;
          transition: border-color 0.2s;
        }
        .ant-table-thead > tr > th[data-column-key]:not([data-fixed]):hover {
          border-right-color: #1890ff;
        }
        .ant-table-thead > tr > th[data-column-key]:not([data-fixed])::after {
          content: '';
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          cursor: col-resize;
          z-index: 1;
        }
      `;
      document.head.appendChild(styleElement);
    }

    // 等待表格渲染完成后再绑定事件
    let cleanup: (() => void) | null = null;
    let resizing = false;
    let startX = 0;
    let startWidth = 0;
    let currentColumnKey: string | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      if (!tableRef.current) return;
      
      const target = e.target as HTMLElement;
      const th = target.closest("th[data-column-key]");
      if (!th) return;

      const columnKey = th.getAttribute("data-column-key");
      if (!columnKey) return;

      // 检查是否点击在列边界区域（右侧 5px 范围内）
      const rect = th.getBoundingClientRect();
      const isNearRightEdge = e.clientX >= rect.right - 5 && e.clientX <= rect.right + 5;

      if (isNearRightEdge) {
        e.preventDefault();
        e.stopPropagation();

        resizing = true;
        startX = e.clientX;
        currentColumnKey = columnKey;

        const col = columns.find((c) => getColumnKey(c) === currentColumnKey);
        if (col) {
          const savedWidth = columnWidths[currentColumnKey];
          startWidth = savedWidth || (col.width as number) || 100;
        }

        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing || currentColumnKey === null) return;

      const deltaX = e.clientX - startX;
      const newWidth = Math.max(50, Math.min(800, startWidth + deltaX)); // 最小 50px，最大 800px

      // 实时更新列宽
      setColumnWidths((prev) => {
        const updated = { ...prev, [currentColumnKey!]: newWidth };
        saveColumnWidths(updated);
        return updated;
      });
    };

    const handleMouseUp = () => {
      if (resizing) {
        resizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        currentColumnKey = null;
      }
    };

    const setupResizeHandlers = () => {
      if (!tableRef.current) return;

      const table = tableRef.current;
      table.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      cleanup = () => {
        table.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    };

    // 使用 setTimeout 确保表格已渲染
    const timeoutId = setTimeout(setupResizeHandlers, 100);

    return () => {
      clearTimeout(timeoutId);
      if (cleanup) {
        cleanup();
      }
    };
  }, [enabled, tableId, columns, columnWidths, getColumnKey, saveColumnWidths]);

  // 重置列宽
  const resetColumnWidths = useCallback(() => {
    setColumnWidths({});
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    columns: resizableColumns,
    columnWidths,
    resetColumnWidths,
    tableRef,
  };
}

