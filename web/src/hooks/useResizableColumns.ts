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
      if (!state.resizing || !state.currentColumnKey) return;

      // 计算新的宽度（自由调整，最小 20px）
      const deltaX = e.clientX - state.startX;
      const newWidth = Math.max(20, state.startWidth + deltaX);

      // 实时更新 DOM，提供流畅的拖拽体验
      if (state.currentTh) {
        state.currentTh.style.width = `${newWidth}px`;
        state.currentTh.style.minWidth = `${newWidth}px`;
        state.currentTh.style.maxWidth = `${newWidth}px`;
      }
      if (state.currentCol) {
        state.currentCol.style.width = `${newWidth}px`;
      }

      // 同时更新所有相同列的 th（处理表头多行的情况）
      if (tableRef.current && state.currentColumnKey) {
        const allThs = tableRef.current.querySelectorAll(
          `th[data-column-key="${state.currentColumnKey}"]`
        );
        allThs.forEach((th) => {
          (th as HTMLElement).style.width = `${newWidth}px`;
          (th as HTMLElement).style.minWidth = `${newWidth}px`;
          (th as HTMLElement).style.maxWidth = `${newWidth}px`;
        });

        // 同步更新所有对应数据列的 td 宽度
        // 找到表头在列中的索引位置
        if (state.currentTh) {
          const headerRow = state.currentTh.closest('tr');
          if (headerRow) {
            const thIndex = Array.from(headerRow.children).indexOf(state.currentTh);
            if (thIndex >= 0) {
              // 找到所有数据行的对应 td
              const tbody = tableRef.current.querySelector('tbody');
              if (tbody) {
                const allRows = tbody.querySelectorAll('tr');
                allRows.forEach((row) => {
                  const tds = row.querySelectorAll('td');
                  if (tds[thIndex]) {
                    const td = tds[thIndex] as HTMLElement;
                    td.style.width = `${newWidth}px`;
                    td.style.minWidth = `${newWidth}px`;
                    td.style.maxWidth = `${newWidth}px`;
                  }
                });
              }
            }
          }
        }
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

