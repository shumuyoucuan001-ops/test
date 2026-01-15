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

  // 使用 ref 存储拖拽状态，避免状态更新导致的重新渲染中断拖拽
  const resizeStateRef = useRef<{
    resizing: boolean;
    startX: number;
    startWidth: number;
    currentColumnKey: string | null;
    currentTh: HTMLElement | null;
    currentCol: HTMLElement | null;
  }>({
    resizing: false,
    startX: 0,
    startWidth: 0,
    currentColumnKey: null,
    currentTh: null,
    currentCol: null,
  });

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
        onHeaderCell: (column: any) => {
          const originalProps = originalOnHeaderCell
            ? originalOnHeaderCell(column as any)
            : {};

          // 允许固定列也可以调整列宽（移除这个限制）
          // const isFixed = col.fixed === "left" || col.fixed === "right";
          // if (isFixed) {
          //   return originalProps;
          // }

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

    const handleMouseDown = (e: MouseEvent) => {
      if (!tableRef.current) return;

      const target = e.target as HTMLElement;
      const th = target.closest("th[data-column-key]");
      if (!th) return;

      const columnKey = th.getAttribute("data-column-key");
      if (!columnKey) return;

      // 检查是否点击在列边界区域（右侧 8px 范围内，扩大可点击区域）
      const rect = th.getBoundingClientRect();
      const isNearRightEdge = e.clientX >= rect.right - 8 && e.clientX <= rect.right + 8;

      if (isNearRightEdge) {
        e.preventDefault();
        e.stopPropagation();

        // 获取当前列的实际宽度（从 DOM 读取，更准确）
        const currentWidth = rect.width;

        // 找到对应的 col 元素
        const table = tableRef.current;
        const colgroup = table.querySelector("colgroup");
        let col: HTMLElement | null = null;
        if (colgroup) {
          const cols = Array.from(colgroup.querySelectorAll("col"));
          const thIndex = Array.from(th.parentElement?.children || []).indexOf(th);
          if (thIndex >= 0 && cols[thIndex]) {
            col = cols[thIndex] as HTMLElement;
          }
        }

        resizeStateRef.current = {
          resizing: true,
          startX: e.clientX,
          startWidth: currentWidth,
          currentColumnKey: columnKey,
          currentTh: th as HTMLElement,
          currentCol: col,
        };

        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state.resizing || !state.currentColumnKey || !tableRef.current || !state.currentTh) return;

      // 计算新的宽度（自由调整，最小 20px）
      const deltaX = e.clientX - state.startX;
      const newWidth = Math.max(20, state.startWidth + deltaX);
      const newWidthStr = `${newWidth}px`;

      // 找到表头在行中的索引位置
      const headerRow = state.currentTh.closest('tr');
      if (!headerRow) return;

      const thIndex = Array.from(headerRow.children).indexOf(state.currentTh);
      if (thIndex < 0) return;

      // 1. 更新 colgroup 中的 col 元素（这是最关键的，控制整列的宽度）
      const colgroup = tableRef.current.querySelector('colgroup');
      if (colgroup) {
        const cols = colgroup.querySelectorAll('col');
        if (cols[thIndex]) {
          const col = cols[thIndex] as HTMLElement;
          col.style.width = newWidthStr;
          col.style.minWidth = newWidthStr;
          // 更新 state 中的 col 引用
          if (!state.currentCol) {
            resizeStateRef.current.currentCol = col;
          }
        }
      }

      // 2. 更新所有相同列的 th（表头）
      const allThs = tableRef.current.querySelectorAll(
        `th[data-column-key="${state.currentColumnKey}"]`
      );
      allThs.forEach((th) => {
        const thEl = th as HTMLElement;
        thEl.style.width = newWidthStr;
        thEl.style.minWidth = newWidthStr;
        thEl.style.maxWidth = newWidthStr;
      });

      // 3. 同步更新所有对应数据列的 td 宽度（实时同步，关键步骤）
      const tbody = tableRef.current.querySelector('tbody');
      if (tbody) {
        const allRows = tbody.querySelectorAll('tr');
        allRows.forEach((row) => {
          const tds = Array.from(row.querySelectorAll('td'));
          if (tds[thIndex]) {
            const td = tds[thIndex] as HTMLElement;
            // 直接设置样式，确保实时更新
            td.style.width = newWidthStr;
            td.style.minWidth = newWidthStr;
            td.style.maxWidth = newWidthStr;
            // 强制重排，确保样式立即生效
            td.offsetHeight; // 触发重排
          }
        });
      }

      // 4. 同时更新固定列区域（如果有固定列）
      const fixedLeftBody = tableRef.current.querySelector('.ant-table-body-outer .ant-table-fixed-left tbody');
      if (fixedLeftBody) {
        const allRows = fixedLeftBody.querySelectorAll('tr');
        allRows.forEach((row) => {
          const tds = Array.from(row.querySelectorAll('td'));
          if (tds[thIndex]) {
            const td = tds[thIndex] as HTMLElement;
            td.style.width = newWidthStr;
            td.style.minWidth = newWidthStr;
            td.style.maxWidth = newWidthStr;
            td.offsetHeight; // 触发重排
          }
        });
      }

      const fixedRightBody = tableRef.current.querySelector('.ant-table-body-outer .ant-table-fixed-right tbody');
      if (fixedRightBody) {
        const allRows = fixedRightBody.querySelectorAll('tr');
        allRows.forEach((row) => {
          const tds = Array.from(row.querySelectorAll('td'));
          if (tds[thIndex]) {
            const td = tds[thIndex] as HTMLElement;
            td.style.width = newWidthStr;
            td.style.minWidth = newWidthStr;
            td.style.maxWidth = newWidthStr;
            td.offsetHeight; // 触发重排
          }
        });
      }
    };

    const handleMouseUp = () => {
      const state = resizeStateRef.current;
      if (state.resizing && state.currentColumnKey) {
        // 从 DOM 读取实际宽度（更准确）
        let actualWidth = state.startWidth;
        if (state.currentTh) {
          const rect = state.currentTh.getBoundingClientRect();
          actualWidth = Math.max(20, rect.width); // 确保最小宽度
        }

        // 保存到状态和 localStorage
        setColumnWidths((prev) => {
          const updated = { ...prev, [state.currentColumnKey!]: actualWidth };
          saveColumnWidths(updated);
          return updated;
        });

        // 重置状态
        resizeStateRef.current = {
          resizing: false,
          startX: 0,
          startWidth: 0,
          currentColumnKey: null,
          currentTh: null,
          currentCol: null,
        };
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const setupResizeHandlers = () => {
      if (!tableRef.current) return null;

      const table = tableRef.current;
      table.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        table.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    };

    // 使用 setTimeout 确保表格已渲染
    let cleanup: (() => void) | null = null;
    const timeoutId = setTimeout(() => {
      cleanup = setupResizeHandlers();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (cleanup) {
        cleanup();
      }
    };
  }, [enabled, tableId, columns, getColumnKey, saveColumnWidths]);

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

