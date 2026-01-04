"use client";

import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Input, message, Modal, Table, Tag, Upload } from 'antd';
import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';

const { TextArea } = Input;

export interface FieldConfig<T = any> {
    /** 字段名（对应数据对象的key） */
    key: keyof T;
    /** 字段显示名称 */
    label: string;
    /** Excel表头名称（如果不指定，则使用label进行匹配，必须完全一致） */
    excelHeaderName?: string;
    /** 是否必填 */
    required?: boolean;
    /** 字段在Excel/粘贴数据中的索引位置（从0开始，仅用于粘贴时按顺序解析） */
    index: number;
    /** 自定义验证函数，返回错误信息数组 */
    validator?: (value: any, row: Partial<T>) => string[];
    /** 自定义转换函数，将字符串转换为目标类型 */
    transform?: (value: string) => any;
    /** 表格列配置 */
    tableColumn?: {
        title: string;
        dataIndex: string | string[];
        render?: (text: any, record: T) => React.ReactNode;
    };
}

export interface BatchAddModalProps<T = any> {
    /** 是否显示模态框 */
    open: boolean;
    /** 模态框标题 */
    title: string;
    /** 提示信息 */
    hint?: string;
    /** 字段配置 */
    fields: FieldConfig<T>[];
    /** 字段格式说明（用于placeholder） */
    formatHint?: string;
    /** 字段示例（用于placeholder） */
    example?: string;
    /** 关闭模态框 */
    onCancel: () => void;
    /** 保存回调，返回有效数据 */
    onSave: (validItems: T[]) => Promise<void>;
    /** 创建新数据对象的函数 */
    createItem: (parts: string[]) => Partial<T>;
    /** 验证数据项的函数 */
    validateItem?: (item: Partial<T>) => string[];
    /** 模态框宽度 */
    width?: number;
}

export default function BatchAddModal<T = any>({
    open,
    title,
    hint,
    fields,
    formatHint,
    example,
    onCancel,
    onSave,
    createItem,
    validateItem,
    width = 900,
}: BatchAddModalProps<T>) {
    const [batchItems, setBatchItems] = useState<T[]>([]);
    const [invalidItems, setInvalidItems] = useState<Array<{ item: Partial<T>; reasons: string[] }>>([]);
    const [uploading, setUploading] = useState(false);

    // 解析文本数据（粘贴或Excel导入）
    const parseTextData = useCallback((text: string): { valid: T[]; invalid: Array<{ item: Partial<T>; reasons: string[] }> } => {
        const lines = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            return { valid: [], invalid: [] };
        }

        const valid: T[] = [];
        const invalid: Array<{ item: Partial<T>; reasons: string[] }> = [];

        for (const line of lines) {
            let parts: string[];
            // 优先使用制表符分隔（Excel 粘贴通常是制表符）
            if (line.includes('\t')) {
                parts = line.split('\t').map(p => p.trim());
            } else if (line.includes(',')) {
                parts = line.split(',').map(p => p.trim());
            } else {
                parts = line.split(/\s{2,}/).map(p => p.trim());
            }

            if (parts.length === 0) {
                continue;
            }

            // 创建数据项
            const item = createItem(parts) as Partial<T>;

            // 验证数据
            const reasons: string[] = [];

            // 使用自定义验证函数
            if (validateItem) {
                const customReasons = validateItem(item);
                reasons.push(...customReasons);
            } else {
                // 使用字段配置进行验证
                for (const field of fields) {
                    const value = item[field.key];
                    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
                        reasons.push(`${field.label}为必填`);
                    }
                    if (field.validator) {
                        const fieldReasons = field.validator(value, item);
                        reasons.push(...fieldReasons);
                    }
                }
            }

            if (reasons.length > 0) {
                invalid.push({ item, reasons });
            } else {
                valid.push(item as T);
            }
        }

        return { valid, invalid };
    }, [fields, createItem, validateItem]);

    // 处理粘贴事件
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');

        if (!pastedText || pastedText.trim().length === 0) {
            message.warning('粘贴的内容为空');
            return;
        }

        const { valid, invalid } = parseTextData(pastedText);

        if (valid.length > 0 || invalid.length > 0) {
            setBatchItems(prev => [...prev, ...valid]);
            setInvalidItems(prev => [...prev, ...invalid]);
            if (valid.length > 0 && invalid.length > 0) {
                message.warning(`已粘贴 ${valid.length} 条有效数据，${invalid.length} 条数据验证失败，请查看下方验证失败列表`);
            } else if (valid.length > 0) {
                message.success(`已粘贴 ${valid.length} 条数据`);
            } else {
                message.error(`粘贴的 ${invalid.length} 条数据全部验证失败，请查看下方验证失败列表`);
            }
        } else {
            message.warning('未能解析出有效数据，请检查格式');
        }

        const target = e.target as HTMLTextAreaElement;
        if (target) {
            target.value = '';
        }
    }, [parseTextData]);

    // 解析带表头的Excel数据
    const parseExcelWithHeader = useCallback((jsonData: string[][]): { valid: T[]; invalid: Array<{ item: Partial<T>; reasons: string[] }> } => {
        if (jsonData.length === 0) {
            return { valid: [], invalid: [] };
        }

        // 第一行作为表头
        const headerRow = jsonData[0].map(cell => String(cell || '').trim());

        // 建立表头名称到字段配置的映射
        const headerToFieldMap = new Map<number, FieldConfig<T>>();

        for (const field of fields) {
            // 获取字段在Excel中的表头名称（必须完全一致）
            const expectedHeaderName = field.excelHeaderName || field.label;

            // 在表头中查找完全匹配的列
            for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
                const headerName = headerRow[colIndex].trim();
                if (headerName === expectedHeaderName.trim()) {
                    headerToFieldMap.set(colIndex, field);
                    break; // 找到匹配的就停止
                }
            }
        }

        // 检查是否有字段未匹配到
        const unmatchedFields = fields.filter(field => {
            const expectedHeaderName = field.excelHeaderName || field.label;
            return !headerRow.some(header => header.trim() === expectedHeaderName.trim());
        });

        if (unmatchedFields.length > 0 && unmatchedFields.some(f => f.required)) {
            message.warning(`以下必填字段在Excel中未找到匹配的表头：${unmatchedFields.map(f => f.label).join('、')}`);
        }

        // 从第二行开始解析数据
        const dataRows = jsonData.slice(1);
        const valid: T[] = [];
        const invalid: Array<{ item: Partial<T>; reasons: string[] }> = [];

        for (const row of dataRows) {
            // 跳过空行
            if (row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            // 根据表头映射提取数据
            const parts: string[] = [];
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                const matchedColIndex = Array.from(headerToFieldMap.entries())
                    .find(([_, f]) => f.key === field.key)?.[0];

                if (matchedColIndex !== undefined && matchedColIndex < row.length) {
                    parts.push(String(row[matchedColIndex] || '').trim());
                } else {
                    // 如果未匹配到，使用index作为后备（兼容旧方式）
                    const colIndex = field.index < row.length ? field.index : i;
                    parts.push(String(row[colIndex] || '').trim());
                }
            }

            // 创建数据项
            const item = createItem(parts) as Partial<T>;

            // 验证数据
            const reasons: string[] = [];

            if (validateItem) {
                const customReasons = validateItem(item);
                reasons.push(...customReasons);
            } else {
                for (const field of fields) {
                    const value = item[field.key];
                    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
                        reasons.push(`${field.label}为必填`);
                    }
                    if (field.validator) {
                        const fieldReasons = field.validator(value, item);
                        reasons.push(...fieldReasons);
                    }
                }
            }

            if (reasons.length > 0) {
                invalid.push({ item, reasons });
            } else {
                valid.push(item as T);
            }
        }

        return { valid, invalid };
    }, [fields, createItem, validateItem]);

    // 处理Excel文件上传
    const handleExcelUpload = useCallback(async (file: File) => {
        setUploading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // 将工作表转换为JSON（第一行作为标题）
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];

            if (jsonData.length === 0) {
                message.warning('Excel文件为空');
                setUploading(false);
                return false;
            }

            // 判断第一行是否是表头（如果第一行有文本内容，且第二行存在，则认为是表头）
            const hasHeader = jsonData.length > 1 &&
                jsonData[0].some(cell => typeof cell === 'string' && String(cell).trim() !== '');

            let valid: T[] = [];
            let invalid: Array<{ item: Partial<T>; reasons: string[] }> = [];

            if (hasHeader) {
                // 使用表头匹配方式解析
                const result = parseExcelWithHeader(jsonData);
                valid = result.valid;
                invalid = result.invalid;
            } else {
                // 没有表头，使用原来的按顺序解析方式
                const dataRows = jsonData;
                const textLines = dataRows
                    .map(row => row.map(cell => String(cell || '').trim()).join('\t'))
                    .join('\n');
                const result = parseTextData(textLines);
                valid = result.valid;
                invalid = result.invalid;
            }

            if (valid.length > 0 || invalid.length > 0) {
                setBatchItems(prev => [...prev, ...valid]);
                setInvalidItems(prev => [...prev, ...invalid]);
                if (valid.length > 0 && invalid.length > 0) {
                    message.warning(`已导入 ${valid.length} 条有效数据，${invalid.length} 条数据验证失败，请查看下方验证失败列表`);
                } else if (valid.length > 0) {
                    message.success(`已导入 ${valid.length} 条数据`);
                } else {
                    message.error(`导入的 ${invalid.length} 条数据全部验证失败，请查看下方验证失败列表`);
                }
            } else {
                message.warning('未能解析出有效数据，请检查Excel格式');
            }

            setUploading(false);
            return false; // 阻止自动上传
        } catch (error) {
            console.error('Excel导入失败:', error);
            message.error('Excel文件解析失败，请检查文件格式');
            setUploading(false);
            return false;
        }
    }, [parseTextData, parseExcelWithHeader]);

    // 批量保存
    const handleBatchSave = async () => {
        if (batchItems.length === 0 && invalidItems.length === 0) {
            message.warning('请先粘贴或导入数据');
            return;
        }

        // 再次验证所有数据
        const newInvalidItems: Array<{ item: Partial<T>; reasons: string[] }> = [];

        const validItems = batchItems.filter(item => {
            const reasons: string[] = [];

            if (validateItem) {
                const customReasons = validateItem(item as Partial<T>);
                reasons.push(...customReasons);
            } else {
                for (const field of fields) {
                    const value = item[field.key];
                    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
                        reasons.push(`${field.label}为必填`);
                    }
                    if (field.validator) {
                        const fieldReasons = field.validator(value, item as Partial<T>);
                        reasons.push(...fieldReasons);
                    }
                }
            }

            if (reasons.length > 0) {
                newInvalidItems.push({ item: item as Partial<T>, reasons });
                return false;
            }
            return true;
        });

        if (newInvalidItems.length > 0) {
            setInvalidItems(prev => [...prev, ...newInvalidItems]);
            message.error(`有 ${newInvalidItems.length} 条数据验证失败，请查看下方验证失败列表`);
            return;
        }

        if (validItems.length === 0) {
            message.warning('请至少填写一条有效数据');
            return;
        }

        try {
            await onSave(validItems);
            setBatchItems([]);
            setInvalidItems([]);
        } catch (error) {
            console.error('批量保存失败:', error);
        }
    };

    // 关闭模态框
    const handleCancel = () => {
        setBatchItems([]);
        setInvalidItems([]);
        onCancel();
    };

    // 构建表格列
    const buildTableColumns = () => {
        const columns: any[] = [];

        // 添加数据列
        for (const field of fields) {
            if (field.tableColumn) {
                columns.push({
                    ...field.tableColumn,
                    key: field.key,
                });
            } else {
                columns.push({
                    title: field.label,
                    dataIndex: field.key as string,
                    key: field.key,
                    render: (text: any) => {
                        const displayValue = text != null ? String(text) : (field.required ? '(必填)' : '-');
                        return (
                            <span style={{ color: !text ? 'red' : 'inherit' }}>
                                {displayValue}
                            </span>
                        );
                    },
                });
            }
        }

        // 添加操作列
        columns.push({
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: any, record: T, index: number) => (
                <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                        setBatchItems(prev => prev.filter((_, i) => i !== index));
                    }}
                >
                    删除
                </Button>
            ),
        });

        return columns;
    };

    // 构建无效数据表格列
    const buildInvalidTableColumns = () => {
        const columns: any[] = [];

        // 添加数据列
        for (const field of fields) {
            if (field.tableColumn) {
                columns.push({
                    ...field.tableColumn,
                    key: field.key,
                    render: (_: any, record: { item: Partial<T>; reasons: string[] }) => {
                        const value = record.item[field.key];
                        if (field.tableColumn?.render) {
                            return field.tableColumn.render(value, record.item as T);
                        }
                        const displayValue = value != null ? String(value) : (field.required ? '(必填)' : '-');
                        return (
                            <span style={{ color: !value ? 'red' : 'inherit' }}>
                                {displayValue}
                            </span>
                        );
                    },
                });
            } else {
                columns.push({
                    title: field.label,
                    key: field.key,
                    render: (_: any, record: { item: Partial<T>; reasons: string[] }) => {
                        const value = record.item[field.key];
                        const displayValue = value != null ? String(value) : (field.required ? '(必填)' : '-');
                        return (
                            <span style={{ color: !value ? 'red' : 'inherit' }}>
                                {displayValue}
                            </span>
                        );
                    },
                });
            }
        }

        // 添加失败原因列
        columns.push({
            title: '失败原因',
            key: 'reasons',
            width: 300,
            render: (_: any, record: { item: Partial<T>; reasons: string[] }) => (
                <div>
                    {record.reasons.map((reason, idx) => (
                        <Tag key={idx} color="error" style={{ marginBottom: 4, display: 'block' }}>
                            {reason}
                        </Tag>
                    ))}
                </div>
            ),
        });

        // 添加操作列
        columns.push({
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: any, record: { item: Partial<T>; reasons: string[] }, index: number) => (
                <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                        setInvalidItems(prev => prev.filter((_, i) => i !== index));
                    }}
                >
                    删除
                </Button>
            ),
        });

        return columns;
    };

    // 构建格式提示
    const buildFormatHint = () => {
        if (formatHint) return formatHint;
        const fieldNames = fields.map(f => f.label).join('\t');
        return `格式：${fieldNames}${example ? `\n示例：${example}` : ''}`;
    };

    return (
        <Modal
            open={open}
            title={title}
            onCancel={handleCancel}
            onOk={handleBatchSave}
            okText="确定创建"
            cancelText="取消"
            width={width}
            destroyOnClose
        >
            <div style={{
                marginBottom: 16,
                padding: '16px',
                background: '#f5f5f5',
                borderRadius: '4px',
            }}>
                {hint && (
                    <div style={{
                        marginBottom: 8,
                        color: '#666',
                        fontSize: 14,
                    }}>
                        {hint}
                    </div>
                )}
                <div style={{ marginBottom: 8 }}>
                    <TextArea
                        placeholder={buildFormatHint()}
                        rows={4}
                        onPaste={handlePaste}
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 14,
                        }}
                    />
                </div>
                <Upload
                    accept=".xlsx,.xls"
                    beforeUpload={(file) => {
                        handleExcelUpload(file);
                        return false; // 阻止自动上传
                    }}
                    showUploadList={false}
                >
                    <Button icon={<UploadOutlined />} loading={uploading}>
                        导入Excel文件
                    </Button>
                </Upload>
            </div>

            {/* 有效数据预览表格 */}
            {batchItems.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#52c41a' }}>
                        ✓ 有效数据 ({batchItems.length} 条)
                    </div>
                    <Table
                        columns={buildTableColumns()}
                        dataSource={batchItems.map((item, index) => ({ ...item, key: index }))}
                        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条记录` }}
                        size="small"
                    />
                </div>
            )}

            {/* 验证失败数据表格 */}
            {invalidItems.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#ff4d4f' }}>
                        ✗ 验证失败数据 ({invalidItems.length} 条)
                    </div>
                    <Table
                        columns={buildInvalidTableColumns()}
                        dataSource={invalidItems.map((item, index) => ({ ...item, key: index }))}
                        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条记录` }}
                        size="small"
                        style={{
                            backgroundColor: '#fff1f0',
                        }}
                    />
                </div>
            )}

            {/* 无数据提示 */}
            {batchItems.length === 0 && invalidItems.length === 0 && (
                <div style={{
                    padding: 40,
                    textAlign: 'center',
                    color: '#999',
                    fontSize: 14
                }}>
                    暂无数据，请粘贴数据到上方输入框或导入Excel文件
                </div>
            )}
        </Modal>
    );
}

