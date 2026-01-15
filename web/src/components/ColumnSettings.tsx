"use client";

import { MenuOutlined } from "@ant-design/icons";
import { Checkbox } from "antd";
import { ColumnType } from "antd/es/table";
import { useMemo, useRef, useState } from "react";

interface ColumnSettingsProps<T = any> {
    columns: ColumnType<T>[];
    hiddenColumns: Set<string>;
    columnOrder: string[];
    onToggleVisibility: (columnKey: string) => void;
    onMoveColumn: (columnKey: string, direction: 'up' | 'down') => void;
    onColumnOrderChange?: (newOrder: string[]) => void; // 可选的直接设置列顺序回调
    fixedColumns?: string[]; // 不能调整顺序的列（只能显示/隐藏）- 已废弃，使用lockedColumns替代
    lockedColumns?: Set<string>; // 锁定的列（可调整锁）
    onToggleLock?: (columnKey: string) => void; // 切换锁定状态
}

export default function ColumnSettings<T = any>({
    columns,
    hiddenColumns,
    columnOrder,
    onToggleVisibility,
    onMoveColumn,
    onColumnOrderChange,
    fixedColumns = [], // 默认没有固定列 - 已废弃，使用lockedColumns替代
    lockedColumns = new Set(), // 锁定的列（可调整锁）
    onToggleLock, // 切换锁定状态
}: ColumnSettingsProps<T>) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    // 使用 ref 保存拖拽状态，避免 handleDragEnd 和 handleDrop 的执行顺序问题
    const dragStateRef = useRef<{ draggedIndex: number | null; dragOverIndex: number | null }>({
        draggedIndex: null,
        dragOverIndex: null,
    });

    // 获取可配置的列（排除 selection 和 action）
    const configurableColumns = (columns || []).filter(col => {
        const key = col?.key as string;
        return key && key !== 'selection' && key !== 'action';
    });

    // 获取默认列顺序
    const getDefaultOrder = (): string[] => {
        return configurableColumns.map(col => col.key as string).filter(Boolean);
    };

    // 使用传入的列顺序，如果为空则使用默认顺序
    // 但是要确保所有可配置的列都在顺序中（合并columnOrder和configurableColumns）
    const defaultOrder = getDefaultOrder();
    const baseOrder = columnOrder.length > 0 ? columnOrder : defaultOrder;

    // 确保所有可配置的列都在顺序中（合并缺失的列）
    const allColumnKeys = configurableColumns.map(col => col.key as string).filter(Boolean);
    const missingKeys = allColumnKeys.filter(key => !baseOrder.includes(key));
    const currentColumnOrder = [...baseOrder, ...missingKeys];

    // 计算预判的最终列顺序（当拖拽时）
    const predictedOrder = useMemo(() => {
        if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
            return currentColumnOrder;
        }

        const newOrder = [...currentColumnOrder];
        const sourceColumnKey = newOrder[draggedIndex];

        // 如果源列是固定列或锁定列，不能主动移动，不进行预判
        const isSourceLocked = sourceColumnKey && (lockedColumns.has(sourceColumnKey) || fixedColumns.includes(sourceColumnKey));
        if (isSourceLocked) {
            return currentColumnOrder;
        }

        // 计算如果放到dragOverIndex位置的最终顺序
        // 即使目标位置是锁定列，也允许移动（锁定列会被被动挤开）
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(dragOverIndex, 0, sourceColumnKey);
        return newOrder;
    }, [currentColumnOrder, draggedIndex, dragOverIndex, lockedColumns, fixedColumns]);

    // 计算每个列在预判顺序中的位置偏移
    const getColumnOffset = (columnKey: string, currentIndex: number): number => {
        if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
            return 0;
        }

        // 被拖拽的列不计算偏移（它会跟随鼠标）
        if (currentIndex === draggedIndex) {
            return 0;
        }

        // 锁定列或固定列可以被被动挤开，所以也要计算偏移
        // 但固定列（fixedColumns）仍然不计算偏移，因为它们完全不能移动
        if (fixedColumns.includes(columnKey)) {
            return 0;
        }

        const predictedIndex = predictedOrder.indexOf(columnKey);
        if (predictedIndex === -1) return 0;

        // 计算偏移量（每个项目高度约为 40px + gap 8px = 48px）
        const itemHeight = 48;
        const offset = (predictedIndex - currentIndex) * itemHeight;
        return offset;
    };

    // 处理拖拽开始
    const handleDragStart = (e: React.DragEvent, index: number) => {
        const columnKey = currentColumnOrder[index];
        // 如果是固定列或锁定列，禁止拖拽
        const isLocked = lockedColumns.has(columnKey) || fixedColumns.includes(columnKey);
        if (isLocked) {
            e.preventDefault();
            return;
        }
        setDraggedIndex(index);
        dragStateRef.current.draggedIndex = index;
        dragStateRef.current.dragOverIndex = null;
        e.dataTransfer.effectAllowed = 'move';

        // 创建一个自定义的拖拽图像，使用克隆的元素
        const target = e.currentTarget as HTMLElement;
        const dragImage = target.cloneNode(true) as HTMLElement;
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        dragImage.style.left = '-1000px';
        dragImage.style.width = `${target.offsetWidth}px`;
        dragImage.style.opacity = '0.8';
        dragImage.style.transform = 'rotate(2deg)';
        dragImage.style.pointerEvents = 'none';
        document.body.appendChild(dragImage);

        // 计算鼠标相对于元素的位置
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        e.dataTransfer.setDragImage(dragImage, x, y);

        // 延迟移除拖拽图像
        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 0);
    };

    // 处理拖拽结束
    const handleDragEnd = (e: React.DragEvent) => {
        // 延迟重置状态，确保 handleDrop 能够先执行
        // 如果 handleDrop 已经执行，这里重置不会影响结果
        setTimeout(() => {
            setDraggedIndex(null);
            setDragOverIndex(null);
            dragStateRef.current.draggedIndex = null;
            dragStateRef.current.dragOverIndex = null;
        }, 100);
    };

    // 处理拖拽悬停
    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedIndex !== null && draggedIndex !== index) {
            const columnKey = currentColumnOrder[index];
            const sourceColumnKey = currentColumnOrder[draggedIndex];

            // 如果源列是固定列或锁定列，不允许主动移动
            const isSourceLocked = sourceColumnKey && (lockedColumns.has(sourceColumnKey) || fixedColumns.includes(sourceColumnKey));
            if (isSourceLocked) {
                return;
            }

            // 目标列是固定列时，不允许拖拽到该位置
            // 但目标列是锁定列时，允许拖拽（锁定列会被被动挤开）
            const isTargetFixed = columnKey && fixedColumns.includes(columnKey);
            if (!isTargetFixed) {
                setDragOverIndex(index);
                dragStateRef.current.dragOverIndex = index;
            }
        }
    };


    // 通用的放置处理函数
    const performDrop = (targetIndex: number) => {
        // 优先使用 ref 中保存的状态，避免状态更新时序问题
        const currentDraggedIndex = dragStateRef.current.draggedIndex ?? draggedIndex;

        if (currentDraggedIndex === null || currentDraggedIndex === targetIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            dragStateRef.current.draggedIndex = null;
            dragStateRef.current.dragOverIndex = null;
            return;
        }

        // 安全检查
        if (currentDraggedIndex < 0 || currentDraggedIndex >= currentColumnOrder.length ||
            targetIndex < 0 || targetIndex >= currentColumnOrder.length) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            dragStateRef.current.draggedIndex = null;
            dragStateRef.current.dragOverIndex = null;
            return;
        }

        const sourceColumnKey = currentColumnOrder[currentDraggedIndex];
        const targetColumnKey = currentColumnOrder[targetIndex];

        if (!sourceColumnKey) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            dragStateRef.current.draggedIndex = null;
            dragStateRef.current.dragOverIndex = null;
            return;
        }

        // 如果源列是固定列或锁定列，禁止主动移动
        const isSourceLocked = lockedColumns.has(sourceColumnKey) || fixedColumns.includes(sourceColumnKey);
        if (isSourceLocked) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            dragStateRef.current.draggedIndex = null;
            dragStateRef.current.dragOverIndex = null;
            return;
        }

        // 目标列是锁定列时，允许移动（锁定列会被被动挤开）
        // 但如果是固定列，仍然禁止移动到该位置
        const isTargetFixed = targetColumnKey && fixedColumns.includes(targetColumnKey);
        if (isTargetFixed) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            dragStateRef.current.draggedIndex = null;
            dragStateRef.current.dragOverIndex = null;
            return;
        }

        // 如果提供了直接设置列顺序的回调，使用它（更高效）
        if (onColumnOrderChange) {
            const newOrder = [...currentColumnOrder];
            newOrder.splice(currentDraggedIndex, 1);
            newOrder.splice(targetIndex, 0, sourceColumnKey);
            onColumnOrderChange(newOrder);
        } else {
            // 否则，通过多次调用onMoveColumn来更新顺序
            const diff = targetIndex - currentDraggedIndex;
            const direction = diff > 0 ? 'down' : 'up';
            const steps = Math.abs(diff);

            // 每次移动一步，直到到达目标位置
            for (let i = 0; i < steps; i++) {
                onMoveColumn(sourceColumnKey, direction);
            }
        }

        // 立即重置状态
        setDraggedIndex(null);
        setDragOverIndex(null);
        dragStateRef.current.draggedIndex = null;
        dragStateRef.current.dragOverIndex = null;
    };

    // 处理放置（元素级别）
    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        // 优先使用 ref 中保存的状态，避免状态更新时序问题
        const currentDraggedIndex = dragStateRef.current.draggedIndex ?? draggedIndex;
        const currentDragOverIndex = dragStateRef.current.dragOverIndex ?? dragOverIndex;

        // 使用 dragOverIndex 作为目标位置，如果没有则使用 dropIndex
        const targetIndex = currentDragOverIndex !== null ? currentDragOverIndex : dropIndex;

        performDrop(targetIndex);
    };

    // 处理容器级别的放置（当鼠标在空白区域时）
    const handleContainerDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 优先使用 ref 中保存的状态
        const currentDraggedIndex = dragStateRef.current.draggedIndex ?? draggedIndex;
        const currentDragOverIndex = dragStateRef.current.dragOverIndex ?? dragOverIndex;

        if (currentDraggedIndex === null) {
            return;
        }

        // 如果 dragOverIndex 存在，使用它（这是最准确的位置）
        if (currentDragOverIndex !== null) {
            performDrop(currentDragOverIndex);
            return;
        }

        // 如果 dragOverIndex 不存在，根据鼠标位置计算目标位置
        const container = e.currentTarget as HTMLElement;
        const rect = container.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        // 获取所有列元素，计算更准确的位置
        const children = Array.from(container.children) as HTMLElement[];
        let calculatedIndex = currentColumnOrder.length - 1;

        // 遍历所有子元素，找到鼠标位置对应的索引
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const childRect = child.getBoundingClientRect();
            const childTop = childRect.top - rect.top;
            const childBottom = childTop + childRect.height;

            // 如果鼠标在元素的上半部分，插入到该元素之前
            if (mouseY >= childTop && mouseY < childTop + childRect.height / 2) {
                calculatedIndex = i;
                break;
            }
            // 如果鼠标在元素的下半部分，插入到该元素之后
            if (mouseY >= childTop + childRect.height / 2 && mouseY <= childBottom) {
                calculatedIndex = i + 1;
                break;
            }
        }

        // 限制在有效范围内
        calculatedIndex = Math.max(0, Math.min(calculatedIndex, currentColumnOrder.length - 1));

        // 如果计算出的位置和原位置相同，不执行操作
        if (calculatedIndex === currentDraggedIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            dragStateRef.current.draggedIndex = null;
            dragStateRef.current.dragOverIndex = null;
            return;
        }

        performDrop(calculatedIndex);
    };

    return (
        <div style={{ width: 300, maxHeight: 500, overflowY: 'auto' }}>
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>列设置</div>
                <div style={{ fontSize: 12, color: '#999' }}>长按列名并拖动进行调序</div>
            </div>
            <div
                style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}
                data-drag-container
                onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={handleContainerDrop}
            >
                {currentColumnOrder.map((columnKey, index) => {
                    const col = configurableColumns.find(c => c.key === columnKey);
                    if (!col) return null;

                    const isVisible = !hiddenColumns.has(columnKey);
                    const isDragging = draggedIndex === index;
                    const isDragOver = dragOverIndex === index;

                    const isFixed = fixedColumns.includes(columnKey);
                    const isLocked = lockedColumns.has(columnKey);
                    const isLockedOrFixed = isLocked || isFixed;

                    // 计算该列的偏移量
                    const offset = getColumnOffset(columnKey, index);
                    const isMoving = draggedIndex !== null && !isDragging && offset !== 0;

                    // 计算预判落点位置：如果当前索引是预判顺序中被拖拽列应该放置的位置，则高亮显示
                    const predictedDropIndex = draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex
                        ? predictedOrder.indexOf(currentColumnOrder[draggedIndex])
                        : -1;
                    const isPredictedDropPosition = predictedDropIndex === index && !isDragging;

                    return (
                        <div
                            key={columnKey}
                            draggable={!isLockedOrFixed}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px',
                                borderRadius: 4,
                                backgroundColor: isPredictedDropPosition ? '#e6f7ff' : isMoving ? '#fafafa' : isDragging ? 'transparent' : '#f5f5f5',
                                border: isPredictedDropPosition ? '2px dashed #1890ff' : isMoving ? '1px solid #e8e8e8' : '2px solid transparent',
                                cursor: isLockedOrFixed ? 'default' : 'move',
                                transition: draggedIndex !== null && !isDragging ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease-out, border-color 0.2s ease-out' : 'all 0.2s',
                                opacity: isDragging ? 0 : 1,
                                transform: offset !== 0 ? `translateY(${offset}px)` : 'none',
                                visibility: isDragging ? 'hidden' : 'visible',
                                zIndex: isMoving ? 1 : 0,
                                position: 'relative',
                                boxShadow: isMoving ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                            }}
                        >
                            {isLockedOrFixed ? (
                                <span
                                    style={{
                                        color: '#999',
                                        fontSize: 14,
                                        width: 14,
                                        height: 14,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: onToggleLock ? 'pointer' : 'default',
                                    }}
                                    onClick={(e) => {
                                        if (onToggleLock && !isFixed) {
                                            e.stopPropagation();
                                            onToggleLock(columnKey);
                                        }
                                    }}
                                    title={isFixed ? '固定列（不可调整）' : '点击解锁'}
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <rect
                                            x="2"
                                            y="5"
                                            width="8"
                                            height="6"
                                            rx="1"
                                            stroke="#999"
                                            strokeWidth="1.2"
                                            fill="none"
                                        />
                                        <path
                                            d="M3.5 5V3C3.5 1.89543 4.39543 1 5.5 1H6.5C7.60457 1 8.5 1.89543 8.5 3V5"
                                            stroke="#999"
                                            strokeWidth="1.2"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </span>
                            ) : (
                                <MenuOutlined
                                    style={{
                                        color: '#999',
                                        cursor: 'grab',
                                        fontSize: 14,
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                            )}
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
                            {!isFixed && onToggleLock && (
                                <span
                                    style={{
                                        marginLeft: 'auto',
                                        fontSize: 12,
                                        color: '#999',
                                        cursor: 'pointer',
                                        padding: '2px 4px',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleLock(columnKey);
                                    }}
                                    title="点击锁定"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <rect
                                            x="2"
                                            y="5"
                                            width="8"
                                            height="6"
                                            rx="1"
                                            stroke="#999"
                                            strokeWidth="1.2"
                                            fill="none"
                                            strokeDasharray="2 2"
                                        />
                                        <path
                                            d="M3.5 5V3C3.5 1.89543 4.39543 1 5.5 1H6.5C7.60457 1 8.5 1.89543 8.5 3V5"
                                            stroke="#999"
                                            strokeWidth="1.2"
                                            strokeLinecap="round"
                                            strokeDasharray="2 2"
                                        />
                                    </svg>
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

