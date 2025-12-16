"use client";

import { Card, Pagination, Table } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import React, { useEffect, useState } from "react";

interface ResponsiveTableProps<T> extends Omit<TableProps<T>, 'columns'> {
    columns: ColumnsType<T>;
    dataSource: T[];
    rowKey: string | ((record: T) => string);
    isMobile?: boolean; // 可选，如果不提供则自动检测
}

/**
 * 响应式表格组件
 * 在移动端自动切换为卡片式布局，桌面端使用普通表格
 */
export default function ResponsiveTable<T extends Record<string, any>>({
    columns,
    dataSource,
    rowKey,
    isMobile: propIsMobile,
    ...tableProps
}: ResponsiveTableProps<T>) {
    const [isMobile, setIsMobile] = useState(propIsMobile ?? false);

    // 自动检测移动端（如果未通过 props 传入）
    useEffect(() => {
        if (propIsMobile !== undefined) {
            setIsMobile(propIsMobile);
            return;
        }

        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [propIsMobile]);

    // 获取行键值
    const getRowKey = (record: T, index: number): string => {
        if (typeof rowKey === 'function') {
            return rowKey(record);
        }
        return record[rowKey]?.toString() || index.toString();
    };

    // 抽取分页配置（如果存在且不是 false）
    const pagination = tableProps.pagination && typeof tableProps.pagination === 'object'
        ? tableProps.pagination
        : undefined;

    // 移动端卡片式布局
    if (isMobile) {
        // 过滤掉操作列，单独处理
        const dataColumns = columns.filter(col => {
            const key = (col as any).key || (col as any).dataIndex;
            return key !== 'action' && !(col as any).fixed;
        });
        const actionColumn = columns.find(col => {
            const key = (col as any).key || (col as any).dataIndex;
            return key === 'action';
        });

        return (
            <div>
                {dataSource.length === 0 ? (
                    <div style={{
                        padding: 40,
                        textAlign: 'center',
                        color: '#999',
                        fontSize: 14,
                    }}>
                        暂无数据
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dataSource.map((record, index) => {
                            const key = getRowKey(record, index);
                            return (
                                <Card
                                    key={key}
                                    size="small"
                                    style={{
                                        marginBottom: 0,
                                        borderRadius: 4,
                                    }}
                                    bodyStyle={{
                                        padding: '12px',
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {dataColumns.map((col) => {
                                            const colKey = (col as any).key || (col as any).dataIndex;
                                            const title = (col as any).title;
                                            const render = (col as any).render;
                                            const dataIndex = (col as any).dataIndex;

                                            // 获取单元格值
                                            let cellValue: any;
                                            if (render) {
                                                // 使用列自带的 render 直接渲染，兼容 Tag、按钮等 React 组件
                                                cellValue = render(
                                                    dataIndex ? (Array.isArray(dataIndex)
                                                        ? dataIndex.reduce((obj, k) => obj?.[k], record)
                                                        : record[dataIndex])
                                                        : record,
                                                    record,
                                                    index
                                                );
                                            } else if (dataIndex) {
                                                const keys = Array.isArray(dataIndex) ? dataIndex : [dataIndex];
                                                cellValue = keys.reduce((obj, k) => obj?.[k], record);
                                            } else {
                                                cellValue = record[colKey];
                                            }

                                            // 如果值为空或 undefined，跳过
                                            if (cellValue === null || cellValue === undefined || cellValue === '') {
                                                return null;
                                            }

                                            return (
                                                <div
                                                    key={colKey}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                        gap: 8,
                                                    }}
                                                >
                                                    <div style={{
                                                        fontSize: 12,
                                                        color: '#666',
                                                        fontWeight: 500,
                                                        flexShrink: 0,
                                                        minWidth: 80,
                                                    }}>
                                                        {title}:
                                                    </div>
                                                    <div
                                                        style={{
                                                            flex: 1,
                                                            fontSize: 14,
                                                            color: '#333',
                                                            wordBreak: 'break-all',
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        {React.isValidElement(cellValue)
                                                            ? cellValue
                                                            : String(cellValue)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* 操作列单独显示在底部 */}
                                        {actionColumn && (actionColumn as any).render && (
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                                paddingTop: 8,
                                                borderTop: '1px solid #f0f0f0',
                                                marginTop: 4,
                                            }}>
                                                {(actionColumn as any).render(null, record, index)}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
                {/* 移动端分页控件：使用与桌面端相同的分页配置 */}
                {pagination && dataSource.length > 0 && (
                    <div
                        style={{
                            marginTop: 16,
                            padding: '8px 0',
                            display: 'flex',
                            justifyContent: 'center',
                        }}
                    >
                        <Pagination
                            size="small"
                            {...pagination}
                        />
                    </div>
                )}
            </div>
        );
    }

    // 桌面端使用普通表格
    return (
        <Table
            {...tableProps}
            columns={columns}
            dataSource={dataSource}
            rowKey={rowKey}
        />
    );
}

