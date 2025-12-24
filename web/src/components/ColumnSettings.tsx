"use client";

import { MenuOutlined } from "@ant-design/icons";
import { Checkbox } from "antd";
import { ColumnType } from "antd/es/table";
import { useState } from "react";

interface ColumnSettingsProps<T = any> {
    columns: ColumnType<T>[];
    hiddenColumns: Set<string>;
    columnOrder: string[];
    onToggleVisibility: (columnKey: string) => void;
    onMoveColumn: (columnKey: string, direction: 'up' | 'down') => void;
    onColumnOrderChange?: (newOrder: string[]) => void; // 可选的直接设置列顺序回调
}

export default function ColumnSettings<T = any>({
    columns,
    hiddenColumns,
    columnOrder,
    onToggleVisibility,
    onMoveColumn,
    onColumnOrderChange,
}: ColumnSettingsProps<T>) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // 获取可配置的列（排除 selection 和 action）
    const configurableColumns = columns.filter(col => {
        const key = col.key as string;
        return key !== 'selection' && key !== 'action';
    });

    // 获取默认列顺序
    const getDefaultOrder = (): string[] => {
        return configurableColumns.map(col => col.key as string);
    };

    // 使用传入的列顺序，如果为空则使用默认顺序
    const currentColumnOrder = columnOrder.length > 0 ? columnOrder : getDefaultOrder();

    // 处理拖拽开始
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // 设置拖拽时的视觉效果
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.5';
        }
    };

    // 处理拖拽结束
    const handleDragEnd = (e: React.DragEvent) => {
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // 处理拖拽悬停
    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };

    // 处理拖拽离开
    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    // 处理放置
    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const sourceColumnKey = currentColumnOrder[draggedIndex];
        const targetIndex = dropIndex;

        // 如果提供了直接设置列顺序的回调，使用它（更高效）
        if (onColumnOrderChange) {
            const newOrder = [...currentColumnOrder];
            newOrder.splice(draggedIndex, 1);
            newOrder.splice(targetIndex, 0, sourceColumnKey);
            onColumnOrderChange(newOrder);
        } else {
            // 否则，通过多次调用onMoveColumn来更新顺序
            const diff = targetIndex - draggedIndex;
            const direction = diff > 0 ? 'down' : 'up';
            const steps = Math.abs(diff);

            // 每次移动一步，直到到达目标位置
            for (let i = 0; i < steps; i++) {
                onMoveColumn(sourceColumnKey, direction);
            }
        }

        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div style={{ width: 300, maxHeight: 500, overflowY: 'auto' }}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>列设置</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentColumnOrder.map((columnKey, index) => {
                    const col = configurableColumns.find(c => c.key === columnKey);
                    if (!col) return null;

                    const isVisible = !hiddenColumns.has(columnKey);
                    const isDragging = draggedIndex === index;
                    const isDragOver = dragOverIndex === index;

                    return (
                        <div
                            key={columnKey}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px',
                                borderRadius: 4,
                                backgroundColor: isDragOver ? '#e6f7ff' : isDragging ? '#f0f0f0' : '#f5f5f5',
                                border: isDragOver ? '2px dashed #1890ff' : '2px solid transparent',
                                cursor: 'move',
                                transition: 'all 0.2s',
                                opacity: isDragging ? 0.5 : 1,
                            }}
                        >
                            <MenuOutlined
                                style={{
                                    color: '#999',
                                    cursor: 'grab',
                                    fontSize: 14,
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                            <Checkbox
                                checked={isVisible}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onToggleVisibility(columnKey);
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {col.title as string}
                            </Checkbox>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

