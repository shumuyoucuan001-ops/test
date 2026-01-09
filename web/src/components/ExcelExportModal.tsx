"use client";

import { DownloadOutlined } from "@ant-design/icons";
import { Button, Checkbox, Modal, Space, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";

export interface ExcelExportField {
    /** 字段名（对应数据对象的key） */
    key: string;
    /** 字段显示名称（Excel表头） */
    label: string;
}

export interface ExcelExportModalProps<T = any> {
    /** 是否显示模态框 */
    open: boolean;
    /** 模态框标题 */
    title?: string;
    /** 字段配置 */
    fields: ExcelExportField[];
    /** 当前选中的数据 */
    selectedData: T[];
    /** 获取全部数据的函数 */
    fetchAllData: () => Promise<T[]>;
    /** 关闭模态框 */
    onCancel: () => void;
    /** 文件名（不包含扩展名） */
    fileName?: string;
}

export default function ExcelExportModal<T = any>({
    open,
    title = "导出数据为Excel",
    fields,
    selectedData,
    fetchAllData,
    onCancel,
    fileName = "导出数据",
}: ExcelExportModalProps<T>) {
    // 生成 localStorage key
    const storageKey = `excel_export_fields_${fileName}`;

    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
    const [exportType, setExportType] = useState<"all" | "selected">("all");
    const [exporting, setExporting] = useState(false);

    // 从 localStorage 加载保存的字段选择
    const loadSavedFields = useCallback((): Set<string> => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const savedKeys = JSON.parse(saved) as string[];
                // 只保留在当前 fields 中存在的字段
                const validKeys = savedKeys.filter(key => fields.some(f => f.key === key));
                if (validKeys.length > 0) {
                    return new Set(validKeys);
                }
            }
        } catch (error) {
            console.error('加载保存的字段选择失败:', error);
        }
        // 默认全选所有字段
        return new Set(fields.map(f => f.key));
    }, [fields, storageKey]);

    // 保存字段选择到 localStorage
    const saveFields = useCallback((fieldsToSave: Set<string>) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(Array.from(fieldsToSave)));
        } catch (error) {
            console.error('保存字段选择失败:', error);
        }
    }, [storageKey]);

    // 初始化选中的字段（从 localStorage 加载或默认全选）
    useEffect(() => {
        if (open) {
            const saved = loadSavedFields();
            setSelectedFields(saved);
        }
    }, [open, loadSavedFields]);

    // 切换字段选择
    const toggleField = (key: string) => {
        const newSelected = new Set(selectedFields);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedFields(newSelected);
        saveFields(newSelected); // 保存到 localStorage
    };

    // 全选/取消全选字段
    const toggleAllFields = (checked: boolean) => {
        const newSelected: Set<string> = checked
            ? new Set<string>(fields.map(f => f.key))
            : new Set<string>();
        setSelectedFields(newSelected);
        saveFields(newSelected); // 保存到 localStorage
    };

    // 格式化数据值
    const formatValue = (value: any): string | number => {
        if (value === null || value === undefined) {
            return "";
        }
        if (typeof value === "number") {
            return value;
        }
        if (typeof value === "boolean") {
            return value ? "是" : "否";
        }
        if (typeof value === "object") {
            return JSON.stringify(value);
        }
        return String(value);
    };

    // 执行导出
    const handleExport = async () => {
        if (selectedFields.size === 0) {
            message.warning("请至少选择一个要导出的字段");
            return;
        }

        setExporting(true);
        try {
            // 获取要导出的数据
            let dataToExport: T[];
            if (exportType === "selected") {
                if (selectedData.length === 0) {
                    message.warning("没有选中的数据");
                    setExporting(false);
                    return;
                }
                dataToExport = selectedData;
            } else {
                message.loading({ content: "正在获取全部数据...", key: "export" });
                dataToExport = await fetchAllData();
                message.destroy("export");
            }

            if (dataToExport.length === 0) {
                message.warning("没有可导出的数据");
                setExporting(false);
                return;
            }

            // 检查数据量限制（100000条）
            const MAX_EXPORT_LIMIT = 100000;
            if (dataToExport.length > MAX_EXPORT_LIMIT) {
                message.warning(`数据量超过限制，仅导出前 ${MAX_EXPORT_LIMIT} 条数据（共 ${dataToExport.length} 条）`);
                dataToExport = dataToExport.slice(0, MAX_EXPORT_LIMIT);
            }

            // 构建表头（只包含选中的字段）
            const selectedFieldsArray = fields.filter(f => selectedFields.has(f.key));
            const headers = selectedFieldsArray.map(f => f.label);

            // 构建数据行
            const rows = dataToExport.map(item => {
                return selectedFieldsArray.map(field => {
                    const value = (item as any)[field.key];
                    return formatValue(value);
                });
            });

            // 创建工作簿
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

            // 设置列宽（自动调整）
            const colWidths = selectedFieldsArray.map((_, index) => {
                const columnData = rows.map(row => row[index]);
                const maxLength = Math.max(
                    headers[index]?.length || 10,
                    ...columnData.map(cell => String(cell).length)
                );
                return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
            });
            ws["!cols"] = colWidths;

            // 将工作表添加到工作簿
            XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

            // 生成文件名（添加时间戳）
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
            const finalFileName = `${fileName}_${timestamp}.xlsx`;

            // 导出文件
            XLSX.writeFile(wb, finalFileName);

            message.success(`成功导出 ${dataToExport.length} 条数据`);
            onCancel();
        } catch (error: any) {
            console.error("导出失败:", error);
            message.error(`导出失败: ${error?.message || "未知错误"}`);
        } finally {
            setExporting(false);
        }
    };

    const allFieldsSelected = selectedFields.size === fields.length;
    const someFieldsSelected = selectedFields.size > 0 && selectedFields.size < fields.length;

    return (
        <Modal
            open={open}
            title={title}
            onCancel={onCancel}
            footer={
                <Space>
                    <Button onClick={onCancel}>取消</Button>
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                        loading={exporting}
                    >
                        导出
                    </Button>
                </Space>
            }
            width={600}
        >
            <div style={{ padding: "16px 0" }}>
                {/* 导出范围选择 */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>导出范围：</div>
                    <Space direction="vertical" style={{ width: "100%" }}>
                        <Checkbox
                            checked={exportType === "all"}
                            onChange={(e) => setExportType(e.target.checked ? "all" : "selected")}
                        >
                            导出全部数据
                        </Checkbox>
                        <Checkbox
                            checked={exportType === "selected"}
                            onChange={(e) => setExportType(e.target.checked ? "selected" : "all")}
                            disabled={selectedData.length === 0}
                        >
                            导出选中的数据 ({selectedData.length} 条)
                        </Checkbox>
                    </Space>
                </div>

                {/* 字段选择 */}
                <div>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>
                        选择要导出的字段：
                    </div>
                    <div style={{ marginBottom: 8 }}>
                        <Checkbox
                            checked={allFieldsSelected}
                            indeterminate={someFieldsSelected}
                            onChange={(e) => toggleAllFields(e.target.checked)}
                        >
                            全选
                        </Checkbox>
                    </div>
                    <div
                        style={{
                            maxHeight: 300,
                            overflowY: "auto",
                            border: "1px solid #d9d9d9",
                            borderRadius: 4,
                            padding: "8px",
                        }}
                    >
                        <Space direction="vertical" style={{ width: "100%" }}>
                            {fields.map((field) => (
                                <Checkbox
                                    key={field.key}
                                    checked={selectedFields.has(field.key)}
                                    onChange={() => toggleField(field.key)}
                                >
                                    {field.label}
                                </Checkbox>
                            ))}
                        </Space>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

