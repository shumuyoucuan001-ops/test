"use client";

import { LabelPrintItem, LabelTemplate, labelDataApi, labelPrintApi, templateApi } from "@/lib/api";
import { PrinterOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Input, InputNumber, Select, Space, message } from "antd";
import { useEffect, useState } from "react";
import ResponsiveTable from "./ResponsiveTable";

const { Option } = Select;

// 扩展的搜索结果项，包含供应商选项
interface ExtendedLabelPrintItem extends LabelPrintItem {
  auditData?: Array<{
    supplierName: string;
    headerInfo?: string;
    executionStandard?: string;
    productName?: string;
    manufacturerName?: string;
    addressInfo?: string;
    material?: string;
    otherInfo?: string;
  }>;
  selectedSupplier?: string;
  selectedTemplate?: 'qualified' | 'default';
}

export default function LabelPrint() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExtendedLabelPrintItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 模板缓存
  const [defaultTemplate, setDefaultTemplate] = useState<LabelTemplate | null>(null);
  const [qualifiedTemplate, setQualifiedTemplate] = useState<LabelTemplate | null>(null);

  // 预加载模板
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const all = await templateApi.getAll();
        const qualified = (all || []).find(t => t.name === "合格证标签") || (all || []).find(t => t.name?.includes("合格证"));
        const defaultT = (all || []).find(t => t.name === "默认标签模板") || (all || []).find(t => t.isDefault);

        setQualifiedTemplate(qualified || null);
        setDefaultTemplate(defaultT || await templateApi.getDefault());
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };
    loadTemplates();
  }, []);

  const doSearch = async () => {
    setLoading(true);
    try {
      if (!q || !q.trim()) {
        setData([]);
        setSearched(true);
        setLoading(false);
        return;
      }

      const res = await labelPrintApi.search(q);

      // 对每个搜索结果，查询 label_data_audit 表
      const enhancedData = await Promise.all((res || []).map(async (item) => {
        try {
          // 使用 getAll API 查询 label_data_audit 表
          const result = await labelDataApi.getAll({ sku: item.skuCode, limit: 100 });
          const auditRecords = result?.data || [];

          if (auditRecords && auditRecords.length > 0) {
            // 有审核数据，解析供应商信息
            const auditData = auditRecords.map((record: any) => ({
              supplierName: record.supplierName || '',
              headerInfo: record.headerInfo || '',
              executionStandard: record.executionStandard || '',
              productName: record.productName || '',
              manufacturerName: record.manufacturerName || '',
              addressInfo: record.addressInfo || '',
              material: record.material || '',
              otherInfo: record.otherInfo || '',
            }));

            console.log('[LabelPrint] Found audit data for SKU:', item.skuCode, 'count:', auditData.length);

            return {
              ...item,
              auditData,
              selectedSupplier: auditData[0]?.supplierName || '',
              selectedTemplate: 'qualified' as const,
            };
          }
        } catch (error) {
          console.error('Failed to load audit data for SKU:', item.skuCode, error);
        }

        console.log('[LabelPrint] No audit data for SKU:', item.skuCode);

        return {
          ...item,
          selectedTemplate: 'default' as const,
        };
      }));

      setData(enhancedData);
      setSearched(true);
    } catch (e) {
      message.error("搜索失败");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (index: number, templateType: 'qualified' | 'default') => {
    const newData = [...data];
    newData[index].selectedTemplate = templateType;
    setData(newData);
  };

  const handleSupplierChange = (index: number, supplierName: string) => {
    const newData = [...data];
    newData[index].selectedSupplier = supplierName;
    setData(newData);
  };

  const handlePrint = async (item: ExtendedLabelPrintItem, copies = 1) => {
    try {
      const hide = message.loading('正在准备打印...', 0);

      // 根据选择的模板类型获取模板
      const template = item.selectedTemplate === 'qualified' ? qualifiedTemplate : defaultTemplate;

      if (!template) {
        message.error('模板未加载完成');
        hide();
        return;
      }

      // 上月日期格式 YYYY.MM
      const prevMonth = (() => {
        const now = new Date();
        const m = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${m.getFullYear()}.${String(m.getMonth() + 1).padStart(2, '0')}`;
      })();

      // 准备渲染数据（与收货单打印逻辑一致）
      let renderData: any = {
        skuCode: item.skuCode,
        spec: item.spec || "",
        productSpec: item.spec || "",
        barcodeTail: item.barcodeTail || "",
        prevMonth: prevMonth,
        qrDataUrl: item.skuCode, // SKU编码用于生成二维码
      };

      // 如果使用合格证模板且有审核数据
      if (item.selectedTemplate === 'qualified' && item.auditData && item.selectedSupplier) {
        const selectedAudit = item.auditData.find(a => a.supplierName === item.selectedSupplier);
        if (selectedAudit) {
          // 合格证模板数据（与收货单打印一致）
          renderData = {
            ...renderData,
            productName: selectedAudit.productName || '',
            headerInfo: selectedAudit.headerInfo || '',
            executeStandard: selectedAudit.executionStandard || '',
            addressInfo: selectedAudit.addressInfo || '',
            material: selectedAudit.material || '',
            otherInfo: selectedAudit.otherInfo || '',
            factoryName: selectedAudit.manufacturerName || '',
            manufacturerName: selectedAudit.manufacturerName || '',
          };
        }
      } else {
        // 使用默认模板（与收货单打印一致）
        renderData = {
          ...renderData,
          productName: '',
          headerInfo: '',
          executeStandard: '',
          addressInfo: '',
          material: '',
          otherInfo: '',
          factoryName: '',
          manufacturerName: '',
        };
      }

      console.log('[LabelPrint] Rendering with data:', renderData);

      // 使用 renderHtml 而不是 render，获取 HTML 内容而不是 TSPL 指令
      const html = await templateApi.renderHtml(template.id, renderData);
      const pages = Array.from({ length: Math.max(1, Number(copies) || 1) }, () => html.rendered);

      hide();
      openPrintInline(pages);
    } catch (e) {
      message.destroy();
      console.error('[LabelPrint] Print error:', e);
      message.error("打印失败");
    }
  };

  const openPrintInline = (labels: string[]) => {
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <style>
        @font-face { font-family: 'AlibabaPuHuiTi'; src: url('/fonts/AlibabaPuHuiTi--Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
        @font-face { font-family: 'AlibabaPuHuiTi'; src: url('/fonts/AlibabaPuHuiTi--Medium.ttf') format('truetype'); font-weight: 500; font-style: normal; font-display: swap; }
        @font-face { font-family: 'AlibabaPuHuiTi'; src: url('/fonts/AlibabaPuHuiTi--Bold.ttf') format('truetype'); font-weight: 700; font-style: normal; font-display: swap; }
        @page { size: 40mm 30mm; margin: 0; }
        html, body { margin: 0; padding: 0; }
        .label { width: 40mm; height: 30mm; overflow: hidden; }
        .label { page-break-after: always; }
        .label:last-child { page-break-after: auto; }
        .label, .label * { font-family: 'AlibabaPuHuiTi','Alibaba PuHuiTi', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif !important; }
        .label [style*="font-family"], .label [style*="Courier"], .label [style*="monospace"] { font-family: 'AlibabaPuHuiTi','Alibaba PuHuiTi', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif !important; }
      </style>
    </head><body>${labels.map(l => `<div class="label">${l}</div>`).join('')}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      message.error('无法创建打印上下文');
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          document.body.removeChild(iframe);
        }
      }, 100);
    };
  };

  const columns = [
    { title: 'SPU编码', dataIndex: 'spuCode', key: 'spuCode', width: 140 },
    { title: '商品名称', dataIndex: 'productName', key: 'productName' },
    { title: 'SKU编码', dataIndex: 'skuCode', key: 'skuCode', width: 220, ellipsis: true },
    { title: '规格', dataIndex: 'spec', key: 'spec', width: 180, ellipsis: true },
    { title: '商品条码', dataIndex: 'productCode', key: 'productCode', width: 180, ellipsis: true },
    {
      title: '核对条码尾号',
      dataIndex: 'barcodeTail',
      key: 'barcodeTail',
      width: 120
    },
    {
      title: '标签模板',
      key: 'templateSelect',
      width: 130,
      render: (_: any, record: ExtendedLabelPrintItem, index: number) => {
        // 没有审核数据时，只显示"默认标签"文本
        if (!record.auditData || record.auditData.length === 0) {
          return <span>默认标签</span>;
        }

        // 有审核数据时，提供选择
        return (
          <Select
            size="small"
            value={record.selectedTemplate}
            onChange={(value) => handleTemplateChange(index, value)}
            style={{ width: '100%' }}
          >
            <Option value="qualified">合格证标签</Option>
            <Option value="default">默认标签</Option>
          </Select>
        );
      }
    },
    {
      title: '供应商名称',
      key: 'supplierSelect',
      width: 160,
      render: (_: any, record: ExtendedLabelPrintItem, index: number) => {
        if (record.selectedTemplate === 'qualified' && record.auditData && record.auditData.length > 0) {
          if (record.auditData.length === 1) {
            return <span>{record.auditData[0].supplierName}</span>;
          }
          return (
            <Select
              size="small"
              value={record.selectedSupplier}
              onChange={(value) => handleSupplierChange(index, value)}
              style={{ width: '100%' }}
            >
              {record.auditData.map((audit, i) => (
                <Option key={i} value={audit.supplierName}>
                  {audit.supplierName}
                </Option>
              ))}
            </Select>
          );
        }
        return <span style={{ color: '#999' }}>-</span>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, r: ExtendedLabelPrintItem) => {
        return (
          <Space>
            <InputNumber min={1} defaultValue={1} size="small" onChange={(v) => (r as any).__printCount = v} style={{ width: 60 }} />
            <Button type="primary" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(r, (r as any).__printCount || 1)}>打印</Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="商品标签打印"
        extra={
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <Input
                allowClear
                placeholder="按 SPU/SKU/商品条码 搜索（最多20条）"
                prefix={<SearchOutlined />}
                value={q}
                onChange={e => setQ(e.target.value)}
                onPressEnter={doSearch}
                style={{ width: '100%' }}
              />
              <Button onClick={doSearch} icon={<SearchOutlined />} type="primary" block>搜索</Button>
            </div>
          ) : (
            <Space>
              <Input
                allowClear
                placeholder="按 SPU/SKU/商品条码 搜索（最多20条）"
                prefix={<SearchOutlined />}
                value={q}
                onChange={e => setQ(e.target.value)}
                onPressEnter={doSearch}
                style={{ width: 420 }}
              />
              <Button onClick={doSearch} icon={<SearchOutlined />} type="primary">搜索</Button>
            </Space>
          )
        }
      >
        {searched ? (
          <ResponsiveTable<ExtendedLabelPrintItem>
            columns={columns as any}
            dataSource={data}
            loading={loading}
            rowKey={(r) => r.skuCode + r.productCode}
            pagination={false}
          />
        ) : (
          <div style={{ padding: 32, color: '#888' }}>请输入 SPU/SKU/商品条码后点击"搜索"以展示商品列表。</div>
        )}
      </Card>
    </div>
  );
}
