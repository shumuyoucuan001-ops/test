"use client";

import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Card, Select, Space, Table } from "antd";
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

    // 移动端卡片式布局
    if (isMobile) {
        // 过滤掉操作列，单独处理
        // 注意：不再过滤fixed列，因为有些重要字段（如订单编号）需要显示
        const dataColumns = columns.filter(col => {
            const key = (col as any).key || (col as any).dataIndex;
            return key !== 'action';
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
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        width: '100%',
                    }}>
                        {dataSource.map((record, index) => {
                            const key = getRowKey(record, index);
                            return (
                                <Card
                                    key={key}
                                    size="small"
                                    style={{
                                        marginBottom: 0,
                                        borderRadius: 4,
                                        width: '100%',
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
                                                cellValue = render(record[dataIndex], record, index);
                                            } else if (dataIndex) {
                                                const keys = Array.isArray(dataIndex) ? dataIndex : [dataIndex];
                                                cellValue = keys.reduce((obj, k) => obj?.[k], record);
                                            } else {
                                                cellValue = record[colKey];
                                            }

                                            // 如果值为空或 undefined，跳过（除非标记为移动端必须显示）
                                            const mobileRequired = (col as any).mobileRequired;
                                            if (!mobileRequired && (cellValue === null || cellValue === undefined || cellValue === '')) {
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
                                                            : (typeof cellValue === 'object' && cellValue !== null
                                                                ? JSON.stringify(cellValue)
                                                                : String(cellValue))}
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
                {/* 移动端分页信息 */}
                {tableProps.pagination && typeof tableProps.pagination === 'object' && (
                    <div style={{
                        marginTop: 16,
                        padding: '12px',
                        background: '#f5f5f5',
                        borderRadius: 4,
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            alignItems: 'center',
                        }}>
                            {/* 总数信息 */}
                            <div style={{
                                fontSize: 13,
                                color: '#666',
                                textAlign: 'center',
                            }}>
                                {tableProps.pagination.showTotal
                                    ? tableProps.pagination.showTotal(
                                        tableProps.pagination.total || 0,
                                        [
                                            ((tableProps.pagination.current || 1) - 1) * (tableProps.pagination.pageSize || 20) + 1,
                                            Math.min(
                                                (tableProps.pagination.current || 1) * (tableProps.pagination.pageSize || 20),
                                                tableProps.pagination.total || 0
                                            ),
                                        ]
                                    )
                                    : `共 ${tableProps.pagination.total || 0} 条记录`}
                            </div>

                            {/* 分页控件 */}
                            <Space size="middle" align="center">
                                <Button
                                    size="small"
                                    icon={<LeftOutlined />}
                                    disabled={!tableProps.pagination.current || tableProps.pagination.current <= 1}
                                    onClick={() => {
                                        if (tableProps.pagination && typeof tableProps.pagination === 'object' && tableProps.pagination.onChange) {
                                            const current = tableProps.pagination.current || 1;
                                            tableProps.pagination.onChange(current - 1, tableProps.pagination.pageSize || 20);
                                        }
                                    }}
                                >
                                    上一页
                                </Button>

                                <span style={{ fontSize: 13, color: '#666' }}>
                                    第 {tableProps.pagination.current || 1} / {Math.ceil((tableProps.pagination.total || 0) / (tableProps.pagination.pageSize || 20)) || 1} 页
                                </span>

                                <Button
                                    size="small"
                                    icon={<RightOutlined />}
                                    disabled={
                                        !tableProps.pagination.current ||
                                        !tableProps.pagination.total ||
                                        tableProps.pagination.current >= Math.ceil((tableProps.pagination.total || 0) / (tableProps.pagination.pageSize || 20))
                                    }
                                    onClick={() => {
                                        if (tableProps.pagination && typeof tableProps.pagination === 'object' && tableProps.pagination.onChange) {
                                            const current = tableProps.pagination.current || 1;
                                            tableProps.pagination.onChange(current + 1, tableProps.pagination.pageSize || 20);
                                        }
                                    }}
                                >
                                    下一页
                                </Button>
                            </Space>

                            {/* 每页条数选择 */}
                            {tableProps.pagination.showSizeChanger && tableProps.pagination.pageSizeOptions && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 13,
                                    color: '#666',
                                }}>
                                    <span>每页显示：</span>
                                    <Select
                                        size="small"
                                        value={tableProps.pagination.pageSize || 20}
                                        style={{ width: 80 }}
                                        options={tableProps.pagination.pageSizeOptions.map(size => ({
                                            value: typeof size === 'string' ? parseInt(size) : size,
                                            label: `${size} 条`,
                                        }))}
                                        onChange={(size) => {
                                            if (tableProps.pagination && typeof tableProps.pagination === 'object') {
                                                if (tableProps.pagination.onShowSizeChange) {
                                                    tableProps.pagination.onShowSizeChange(1, size);
                                                } else if (tableProps.pagination.onChange) {
                                                    tableProps.pagination.onChange(1, size);
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
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

