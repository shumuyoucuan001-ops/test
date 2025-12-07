"use client";

import {
    LabelDataItem,
    labelDataApi,
    productMasterApi,
} from "@/lib/api";
import {
    EditOutlined,
    PlusOutlined,
    SaveOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import {
    App,
    Button,
    Card,
    Col,
    Descriptions,
    Drawer,
    Form,
    Input,
    Modal,
    Row,
    Space,
    Table,
    Tabs,
    Typography,
    message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

const { Search } = Input;
const { Text } = Typography;

type MasterListItem = {
  spuCode: string;
  productName: string;
  spec: string;
  skuCode: string;
  productCode: string;
  pickingStandard?: string | null;
};

export default function ProductMasterPage() {
  const { modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MasterListItem[]>([]);
  const [sku, setSku] = useState("");
  const [q, setQ] = useState("");

  // 编辑抽屉
  const [open, setOpen] = useState(false);
  const [currentSku, setCurrentSku] = useState<string>("");
  const [masterDetail, setMasterDetail] = useState<Record<string, any> | null>(null);
  const [labelList, setLabelList] = useState<LabelDataItem[]>([]);
  const [labelColumns, setLabelColumns] = useState<{ name: string; type?: string }[]>([]);
  const [editLabelModalOpen, setEditLabelModalOpen] = useState(false);
  const [labelForm] = Form.useForm();

  const load = async (params?: { sku?: string; q?: string }) => {
    setLoading(true);
    try {
      const list = await productMasterApi.list({ q: params?.q, limit: 500 });
      let final = list;
      if (params?.sku) {
        final = list.filter((i) => i.skuCode.includes(params.sku!));
      }
      setData(final);
    } finally {
      setLoading(false);
    }
  };

  const openDrawer = async (row: MasterListItem) => {
    setCurrentSku(row.skuCode);
    setOpen(true);
    
    // 载入左侧主档全部字段
    const detail = await productMasterApi.detail(row.skuCode);
    setMasterDetail(detail || {});
    
    // 获取标签列定义（用于表单字段）
    const cols = await labelDataApi.columns();
    setLabelColumns(cols || []);
    
    // 从 label_data_audit 表获取标签补充信息
    try {
      console.log('[ProductMaster] Loading label data for SKU:', row.skuCode);
      const result = await labelDataApi.getAll({ sku: row.skuCode, limit: 100 });
      const labelRecords = result?.data || [];
      
      console.log('[ProductMaster] Label data loaded:', labelRecords);
      
      // 转换为旧格式以兼容现有表格显示
      const formatted = labelRecords.map((record: any) => ({
        skuCode: record.sku,
        labelRaw: {
          'SKU': record.sku,
          'SKU编码': record.sku,
          '供应商名称': record.supplierName,
          '抬头信息': record.headerInfo,
          '执行标准': record.executionStandard,
          '产品名称': record.productName,
          '厂家名称': record.manufacturerName,
          '地址信息': record.addressInfo,
          '材质': record.material,
          '其他信息': record.otherInfo,
          '产品规格': record.productSpec,
        }
      }));
      
      setLabelList(formatted);
    } catch (error) {
      console.error('[ProductMaster] Failed to load label data:', error);
      setLabelList([]);
    }
  };

  const showCreateLabel = () => {
    setEditLabelModalOpen(true);
    const initial: Record<string, any> = {};
    // 预填充 SKU
    const skuKey = ["SKU", "SKU编码", "sku"].find((k) => labelColumns.some((c) => c.name === k));
    if (skuKey) initial[skuKey] = currentSku;
    labelForm.setFieldsValue(initial);
  };

  const showEditLabel = (item: LabelDataItem) => {
    setEditLabelModalOpen(true);
    labelForm.setFieldsValue(item.labelRaw);
  };

  const handleSaveLabel = async () => {
    try {
      const values = await labelForm.validateFields();
      
      // 必填校验：供应商名称
      if (!values["供应商名称"]) {
        message.error("供应商名称为必填");
        return;
      }
      
      // 字段名映射：中文 -> 英文
      const fieldMapping: Record<string, string> = {
        '供应商名称': 'supplierName',
        '抬头信息': 'headerInfo',
        '执行标准': 'executionStandard',
        '产品名称': 'productName',
        '厂家名称': 'manufacturerName',
        '地址信息': 'addressInfo',
        '材质': 'material',
        '其他信息': 'otherInfo',
      };
      
      // 转换字段名
      const data: Record<string, any> = {
        sku: currentSku,
      };
      
      for (const [chineseName, englishName] of Object.entries(fieldMapping)) {
        if (values[chineseName] !== undefined && values[chineseName] !== null) {
          data[englishName] = values[chineseName];
        }
      }
      
      console.log('[ProductMaster] Saving label data:', data);
      
      // 使用新的 create-or-update API
      await labelDataApi.create(data);
      
      message.success("保存成功");
      setEditLabelModalOpen(false);
      
      // 重新加载标签列表
      const result = await labelDataApi.getAll({ sku: currentSku, limit: 100 });
      const labelRecords = result?.data || [];
      
      // 转换为旧格式以兼容现有表格显示
      const formatted = labelRecords.map((record: any) => ({
        skuCode: record.sku,
        labelRaw: {
          'SKU': record.sku,
          'SKU编码': record.sku,
          '供应商名称': record.supplierName,
          '抬头信息': record.headerInfo,
          '执行标准': record.executionStandard,
          '产品名称': record.productName,
          '厂家名称': record.manufacturerName,
          '地址信息': record.addressInfo,
          '材质': record.material,
          '其他信息': record.otherInfo,
          '产品规格': record.productSpec,
        }
      }));
      
      setLabelList(formatted);
    } catch (error) {
      console.error('[ProductMaster] Save failed:', error);
      message.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const columns = [
    { title: "SPU编码", dataIndex: "spuCode", key: "spuCode", width: 180 },
    { title: "商品名称", dataIndex: "productName", key: "productName" },
    { title: "规格", dataIndex: "spec", key: "spec", width: 160 },
    { title: "SKU编码", dataIndex: "skuCode", key: "skuCode", width: 180 },
    { title: "商品条码", dataIndex: "productCode", key: "productCode", width: 220 },
    { title: "拣货标准", dataIndex: "pickingStandard", key: "pickingStandard", width: 180 },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_: any, record: MasterListItem) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openDrawer(record)}>
          编辑
        </Button>
      ),
    },
  ];

  const labelTableCols = useMemo(() => {
    const fixedCols = [
      { title: "SKU", dataIndex: ["labelRaw", "SKU"], key: "sku" },
      { title: "供应商名称", dataIndex: ["labelRaw", "供应商名称"], key: "vendor" },
    ];
    const dynamicCols = (labelColumns || [])
      .filter(
        (c) => c.name !== "SKU" && c.name !== "SKU编码" && c.name !== "sku" && c.name !== "供应商名称"
      )
      .map((c) => ({ title: c.name, dataIndex: ["labelRaw", c.name], key: c.name, ellipsis: true }));
    return [
      ...fixedCols,
      ...dynamicCols,
      {
        title: "操作",
        key: "op",
        width: 160,
        render: (_: any, r: LabelDataItem) => (
          <Space>
            <Button type="link" onClick={() => showEditLabel(r)}>编辑</Button>
            <Button
              type="link"
              danger
              onClick={() => {
                console.log('[ProductMaster] Delete button clicked, record:', r);
                const supplier = r.labelRaw?.["供应商名称"];
                console.log('[ProductMaster] Supplier name:', supplier);
                
                if (!supplier) { 
                  message.error('缺少供应商名称'); 
                  return; 
                }
                
                console.log('[ProductMaster] Showing confirm dialog');
                modal.confirm({
                  title: '确认删除',
                  content: `确定要删除 SKU: ${currentSku}, 供应商: ${supplier} 的标签资料吗？`,
                  okText: '确定',
                  cancelText: '取消',
                  onOk: async () => {
                    try {
                      console.log('[ProductMaster] Deleting label:', { sku: currentSku, supplier });
                      await labelDataApi.remove(currentSku, String(supplier));
                      message.success('已删除');
                      
                      // 重新加载标签列表
                      const result = await labelDataApi.getAll({ sku: currentSku, limit: 100 });
                      const labelRecords = result?.data || [];
                      
                      // 转换为旧格式以兼容现有表格显示
                      const formatted = labelRecords.map((record: any) => ({
                        skuCode: record.sku,
                        labelRaw: {
                          'SKU': record.sku,
                          'SKU编码': record.sku,
                          '供应商名称': record.supplierName,
                          '抬头信息': record.headerInfo,
                          '执行标准': record.executionStandard,
                          '产品名称': record.productName,
                          '厂家名称': record.manufacturerName,
                          '地址信息': record.addressInfo,
                          '材质': record.material,
                          '其他信息': record.otherInfo,
                          '产品规格': record.productSpec,
                        }
                      }));
                      
                      setLabelList(formatted);
                    } catch (error) {
                      console.error('[ProductMaster] Delete failed:', error);
                      message.error('删除失败: ' + (error instanceof Error ? error.message : '未知错误'));
                    }
                  }
                });
              }}
            >删除</Button>
          </Space>
        ),
      },
    ];
  }, [labelColumns, currentSku]);

  // 渲染前再次按 currentSku 过滤（防御性）
  const labelDataSource = useMemo(() => {
    return (labelList || []).filter((it) => {
      const raw = it.labelRaw || {};
      const skuFromRaw = raw["SKU"] || raw["SKU编码"] || raw["sku"] || it.skuCode;
      return String(skuFromRaw) === String(currentSku);
    });
  }, [labelList, currentSku]);

  const headerInfo = useMemo(() => {
    const name = (masterDetail as any)?.["商品名称"] || "";
    const spec = (masterDetail as any)?.["规格"] || "";
    return (
      <Space size={24}>
        <Text>SKU编号：{currentSku}</Text>
        <Text>商品名称：{name}</Text>
        <Text>规格：{spec}</Text>
      </Space>
    );
  }, [masterDetail, currentSku]);

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="商品资料"
        extra={
          <Space>
            <Search
              placeholder="SKU 精确搜索"
              allowClear
              enterButton={<SearchOutlined />}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onSearch={(v) => load({ sku: v.trim(), q })}
              style={{ width: 220 }}
            />
            <Search
              placeholder="关键字搜索（SPU/名称/SKU/条码）"
              allowClear
              enterButton={<SearchOutlined />}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onSearch={(v) => load({ sku, q: v.trim() })}
              style={{ width: 320 }}
            />
            <Button onClick={() => { setSku(""); setQ(""); load(); }}>重置</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(r) => r.skuCode}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Drawer
        title={headerInfo}
        open={open}
        onClose={() => setOpen(false)}
        width={1000}
      >
        <Tabs
          items={[
            {
              key: "master",
              label: "主档信息",
              children: (
                <Descriptions
                  bordered
                  size="small"
                  column={2}
                  items={Object.keys(masterDetail || {}).map((k) => ({
                    key: k,
                    label: k,
                    children: String((masterDetail as any)?.[k] ?? ""),
                  }))}
                />
              ),
            },
            {
              key: "labels",
              label: (
                <Space>
                  <span>标签补充信息</span>
                  <Button size="small" icon={<PlusOutlined />} onClick={showCreateLabel}>
                    新增
                  </Button>
                </Space>
              ),
              children: (
                <Table
                  columns={labelTableCols}
                  dataSource={labelDataSource}
                  rowKey={(r) => r.skuCode + (r.labelRaw?.["供应商名称"] || "")}
                  size="small"
                  pagination={false}
                />
              ),
            },
          ]}
        />
      </Drawer>

      <Modal
        title="编辑标签资料"
        open={editLabelModalOpen}
        onCancel={() => setEditLabelModalOpen(false)}
        onOk={handleSaveLabel}
        okText={<Space><SaveOutlined />保存</Space>}
      >
        <Form form={labelForm} layout="vertical">
          <Row gutter={12}>
            {(labelColumns || []).map((c) => {
              const max: Record<string, number> = {
                'SKU': 50,
                '供应商名称': 50,
                '抬头信息': 15,
                '产品规格': 15,
                '执行标准': 30,
                '产品名称': 13,
                '厂家名称': 26,
                '地址信息': 26,
                '材质': 13,
                '其他信息': 12,
              };
              const maxLen = max[c.name] || undefined;
              return (
                <Col span={12} key={c.name}>
                  <Form.Item
                    name={c.name}
                    label={c.name}
                  >
                    <Input maxLength={maxLen} showCount={!!maxLen} />
                  </Form.Item>
                </Col>
              );
            })}
          </Row>
        </Form>
      </Modal>
    </div>
  );
}







