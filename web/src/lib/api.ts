import axios from 'axios';

// 动态确定后端 API 地址：
// 1) 优先读取 NEXT_PUBLIC_API_BASE_URL（适用于自定义反代）
// 2) 浏览器端统一走相对路径 /api（由 Next.js 反代到后端）
// 3) SSR 环境：Docker 环境使用容器名称，本地开发使用 5002 端口
const getApiBaseUrl = () => {
  // 环境变量优先
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // 浏览器端使用相对路径（由 Next.js rewrites 反代）
  if (typeof window !== 'undefined') {
    return '/api';
  }

  // SSR 环境：根据环境选择后端地址
  if (process.env.NODE_ENV === 'production') {
    // Docker 生产环境：通过容器名称访问
    return process.env.API_URL || 'http://api:5000';
  } else {
    // 本地开发环境
    return 'http://127.0.0.1:5002';
  }
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000, // 增加到90秒
});

// 带上用户ID，用于后端权限校验
api.interceptors.request.use((config) => {
  try {
    const uid = typeof window !== 'undefined' ? (localStorage.getItem('userId') || '') : '';
    if (uid) {
      (config.headers as any)['x-user-id'] = uid;
    }
    const token = typeof window !== 'undefined' ? (localStorage.getItem('sessionToken') || '') : '';
    if (token) {
      (config.headers as any)['Authorization'] = `Bearer ${token}`;
    }
  } catch { }
  return config;
});

// 标签模板接口
export interface LabelTemplate {
  id: number;
  name: string;
  content: string;
  contentTspl?: string;
  isDefault: boolean;
  productCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDto {
  name: string;
  content: string;
  contentTspl?: string;
  isDefault?: boolean;
  productCode?: string;
}

export interface UpdateTemplateDto {
  name?: string;
  content?: string;
  contentTspl?: string;
  isDefault?: boolean;
  productCode?: string;
}

// 商品接口
export interface ProductSalesSpec {
  id: number;
  productCode: string;  // 商品条码
  skuCode: string;      // SKU编码
  productName: string;  // 商品名称
  spec?: string;        // 规格
  unit?: string;        // 单位
  price?: number;       // 价格
  barcodeTail?: string; // 条码尾号
  labelData?: any;      // 标签资料（动态数据）
  createdAt: string;
  updatedAt: string;
}

export interface ProductLabel {
  id: number;
  productCode: string;  // 商品条码
  labelName: string;    // 标签名称
  labelContent: string; // 标签内容HTML
  isActive: boolean;    // 是否启用
  createdAt: string;
  updatedAt: string;
}

export interface ProductWithLabels {
  product: ProductSalesSpec;
  labels: ProductLabel[];
}

// 收货单接口
export interface ReceiptDetail {
  id: number;
  receiptNo: string;     // 收货单号
  sku: string;           // SKU编码
  productName: string;   // 商品名称
  quantity: number;      // 数量
  price?: number;        // 价格
  totalAmount?: number;  // 总金额
  supplierName?: string; // 供应商名称
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptDetailWithProduct {
  receiptDetail: ReceiptDetail;
  productInfo?: ProductSalesSpec;
}

export interface ReceiptSummary {
  receiptNo: string;
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  details: ReceiptDetailWithProduct[];
}

// 新增：商品标签资料接口类型
export interface LabelDataItem {
  skuCode: string;
  spuCode?: string;
  productName?: string;
  spec?: string;
  productCode?: string;
  printBarcode?: string;
  labelRaw: Record<string, any>;
}

export interface LabelPrintItem {
  templateName: string;
  spuCode: string;
  productName: string;
  skuCode: string;
  spec: string;
  productCode: string;
  barcodeTail: string;
  factoryName?: string;
  headerInfo?: string;
  productSpec?: string;
  executeStandard?: string;
  addressInfo?: string;
  material?: string;
  otherInfo?: string;
}

// 模板API
export const templateApi = {
  // 获取所有模板
  getAll: (): Promise<LabelTemplate[]> => api.get('/templates').then(res => res.data),

  // 获取默认模板
  getDefault: (): Promise<LabelTemplate> => api.get('/templates/default').then(res => res.data),

  // 根据商品编码获取模板
  getByProductCode: (productCode: string): Promise<LabelTemplate> =>
    api.get(`/templates/by-product?productCode=${productCode}`).then(res => res.data),

  // 根据ID获取模板
  getById: (id: number): Promise<LabelTemplate> => api.get(`/templates/${id}`).then(res => res.data),

  // 创建模板
  create: (data: CreateTemplateDto): Promise<LabelTemplate> =>
    api.post('/templates', data).then(res => res.data),

  // 更新模板
  update: (id: number, data: UpdateTemplateDto): Promise<LabelTemplate> =>
    api.patch(`/templates/${id}`, data).then(res => res.data),

  // 删除模板（已禁用，保留占位返回拒绝）
  delete: async (_id: number): Promise<LabelTemplate> => { throw new Error('标签模板禁止删除'); },

  // 渲染模板为HTML (用于web端打印预览)
  renderHtml: (id: number, data: any): Promise<{ rendered: string }> =>
    api.post(`/templates/${id}/render-html`, data).then(res => res.data),

  // 渲染模板为打印指令 (TSPL/CPCL)
  render: (id: number, data: any): Promise<{ rendered: string }> =>
    api.post(`/templates/${id}/render`, data).then(res => res.data),

  // 批量生成TSPL指令 - 用于app标签机批量打印优化
  generateBatchTspl: (items: Array<{ templateId: number; data: any; copies: number }>): Promise<{
    success: boolean;
    tspl: string;
    totalLabels: number;
    message: string;
  }> => api.post('/templates/batch-tspl', { items }).then(res => res.data),
};

// 商品API
export const productApi = {
  // 获取所有商品
  getAll: (): Promise<ProductSalesSpec[]> => api.get('/products').then(res => res.data),

  // 获取所有商品及其标签信息
  getAllWithLabels: (): Promise<ProductWithLabels[]> => api.get('/products/with-labels').then(res => res.data),

  // 搜索商品
  search: (keyword: string): Promise<ProductSalesSpec[]> =>
    api.get(`/products/search?keyword=${encodeURIComponent(keyword)}`).then(res => res.data),

  // 根据条码获取商品
  getByBarcode: (barcode: string): Promise<ProductSalesSpec | null> =>
    api.get(`/products/barcode/${barcode}`).then(res => res.data),

  // 根据SKU获取商品
  getBySku: (skuCode: string): Promise<ProductSalesSpec | null> =>
    api.get(`/products/sku/${skuCode}`).then(res => res.data),

  // 根据ID获取商品
  getById: (id: number): Promise<ProductSalesSpec> => api.get(`/products/${id}`).then(res => res.data),

  // 更新商品信息
  update: (id: number, updateData: Partial<ProductSalesSpec>): Promise<ProductSalesSpec> =>
    api.put(`/products/${id}`, updateData).then(res => res.data),

  // 根据商品条码获取标签
  getLabelsByProductCode: (productCode: string): Promise<ProductLabel[]> =>
    api.get(`/products/${productCode}/labels`).then(res => res.data),

  // 创建商品标签
  createLabel: (labelData: Omit<ProductLabel, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductLabel> =>
    api.post('/products/labels', labelData).then(res => res.data),

  // 更新商品标签
  updateLabel: (id: number, updateData: Partial<ProductLabel>): Promise<ProductLabel> =>
    api.put(`/products/labels/${id}`, updateData).then(res => res.data),

  // 删除商品标签
  deleteLabel: (id: number): Promise<ProductLabel> =>
    api.delete(`/products/labels/${id}`).then(res => res.data),
};

// 收货单API
export const receiptApi = {
  // 获取所有收货单号
  getReceiptNumbers: (): Promise<string[]> => api.get('/receipts/numbers').then(res => res.data),

  // 搜索收货单号
  searchReceiptNumbers: (keyword: string): Promise<string[]> =>
    api.get(`/receipts/numbers/search?keyword=${encodeURIComponent(keyword)}`).then(res => res.data),

  // 根据收货单号获取明细
  getDetailsByReceiptNo: (receiptNo: string): Promise<ReceiptDetailWithProduct[]> =>
    api.get(`/receipts/${receiptNo}/details`).then(res => res.data),

  // 获取收货单汇总信息
  getSummary: (receiptNo: string): Promise<ReceiptSummary> =>
    api.get(`/receipts/${receiptNo}/summary`).then(res => res.data),
};

// 新的标签资料管理接口类型
export interface LabelDataRecord {
  sku: string;
  supplierName: string;
  headerInfo?: string | null;
  productSpec?: string | null; // 只读字段，从sm_shangping库自动获取
  executionStandard?: string | null;
  productName?: string | null;
  manufacturerName?: string | null;
  addressInfo?: string | null;
  material?: string | null;
  otherInfo?: string | null;
  action?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabelDataStatistics {
  totalRecords: number;
  totalSuppliers: number;
  totalSkus: number;
}

// 商品标签资料API
export const labelDataApi = {
  // 新的API方法
  getAll: (params?: {
    sku?: string;
    supplierName?: string;
    limit?: number;
    offset?: number
  }): Promise<{ data: LabelDataRecord[]; total: number }> =>
    api.get('/label-data/all', { params }).then(res => res.data),

  getStatistics: (): Promise<LabelDataStatistics> =>
    api.get('/label-data/statistics').then(res => res.data),

  getSuppliers: (): Promise<string[]> =>
    api.get('/label-data/suppliers').then(res => res.data),

  create: (data: {
    sku: string;
    supplierName: string;
    headerInfo?: string;
    // productSpec 已移除，现在从sm_shangping库自动获取
    executionStandard?: string;
    productName?: string;
    manufacturerName?: string;
    addressInfo?: string;
    material?: string;
    otherInfo?: string;
    userId?: number;
    userName?: string;
  }): Promise<{ success: boolean }> =>
    api.post('/label-data/create-or-update', data).then(res => res.data),

  getLogs: (sku: string, supplierName?: string): Promise<any[]> =>
    api.get('/label-data/logs', { params: { sku, supplierName } }).then(res => res.data),

  getOne: (sku: string, supplierName: string): Promise<LabelDataRecord | null> =>
    api.get(`/label-data/${encodeURIComponent(sku)}/${encodeURIComponent(supplierName)}`).then(res => res.data),

  delete: (sku: string, supplierName: string): Promise<boolean> =>
    api.delete(`/label-data/delete/${encodeURIComponent(sku)}/${encodeURIComponent(supplierName)}`).then(res => res.data),

  batchDelete: (items: { sku: string; supplierName: string }[]): Promise<number> =>
    api.post('/label-data/batch-delete', { items }).then(res => res.data),

  // 兼容旧API的方法
  list: (params?: { sku?: string; q?: string; limit?: number }): Promise<LabelDataItem[]> =>
    api.get('/label-data', { params }).then(res => res.data),
  columns: (): Promise<{ name: string; type?: string }[]> =>
    api.get('/label-data/columns').then(res => res.data),
  bySku: (sku: string): Promise<LabelDataItem[]> =>
    api.get('/label-data/by-sku', { params: { sku } }).then(res => res.data),
  bySkuAndSupplier: (sku: string, supplierName: string): Promise<Record<string, any> | null> =>
    api.get('/label-data/by-sku-supplier', { params: { sku, supplierName } }).then(res => res.data),
  upsert: (sku: string, values: Record<string, any>): Promise<{ success: boolean }> =>
    api.post('/label-data/upsert', { sku, values }).then(res => res.data),
  remove: (sku: string, supplier: string): Promise<{ success: boolean }> =>
    api.delete(`/label-data/delete/${encodeURIComponent(sku)}/${encodeURIComponent(supplier)}`).then(res => res.data),
};

// 商品主档 API
export const productMasterApi = {
  columns: (): Promise<{ name: string; type?: string }[]> =>
    api.get('/product-master/columns').then(res => res.data),
  list: (params?: { q?: string; limit?: number }): Promise<Array<{ spuCode: string; productName: string; spec: string; skuCode: string; productCode: string; pickingStandard?: string | null }>> =>
    api.get('/product-master', { params }).then(res => res.data),
  detail: (sku: string): Promise<Record<string, any>> =>
    api.get(`/product-master/${sku}`).then(res => res.data),
};

// 商品标签打印 API
export const labelPrintApi = {
  search: (q: string): Promise<LabelPrintItem[]> => api.get('/label-print/search', { params: { q } }).then(res => res.data),
};

// 运营组管理 - 排除活动商品
export interface OpsExclusionItem {
  视图名称: string;
  门店编码: string;
  SKU编码: string;
  SPU编码: string;
  商品名称?: string | null;
  商品条码?: string | null;
  规格名称?: string | null;
}

export const opsExclusionApi = {
  list: (params?: {
    视图名称?: string;
    门店编码?: string;
    SKU编码?: string;
    SPU编码?: string;
    keyword?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: OpsExclusionItem[]; total: number }> => {
    const queryParams: any = {};
    if (params?.视图名称) queryParams.视图名称 = params.视图名称;
    if (params?.门店编码) queryParams.门店编码 = params.门店编码;
    if (params?.SKU编码) queryParams.SKU编码 = params.SKU编码;
    if (params?.SPU编码) queryParams.SPU编码 = params.SPU编码;
    if (params?.keyword) queryParams.keyword = params.keyword;
    queryParams.page = params?.page || 1;
    queryParams.limit = params?.limit || 20;
    return api.get('/ops-exclusion', { params: queryParams }).then(res => res.data);
  },
  create: (data: OpsExclusionItem): Promise<{ success: boolean }> =>
    api.post('/ops-exclusion', data).then(res => res.data),
  update: (
    original: OpsExclusionItem,
    data: OpsExclusionItem
  ): Promise<{ success: boolean }> =>
    api.patch('/ops-exclusion', { original, data }).then(res => res.data),
  remove: (data: OpsExclusionItem): Promise<{ success: boolean }> =>
    api.delete('/ops-exclusion', { data }).then(res => res.data),
  batchDelete: (items: OpsExclusionItem[]): Promise<{ success: boolean; message: string; deletedCount: number }> =>
    api.post('/ops-exclusion/batch-delete', { items }).then(res => res.data),
  batchCreate: (items: OpsExclusionItem[]): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> =>
    api.post('/ops-exclusion/batch-create', { items }).then(res => res.data),
};

// 运营组管理 - 手动强制活动分发
export interface OpsActivityDispatchItem {
  SKU: string;
  活动价: string | number | null;
  最低活动价: string | number | null;
  活动类型: string | null;
  门店名称: string | null;
  活动备注: string | null;
  剩余活动天数: string | number | null;
  活动确认人: string | null;
  数据更新时间: string | null;
  商品名称?: string | null;
  商品条码?: string | null;
  规格名称?: string | null;
}

export const opsActivityDispatchApi = {
  list: (params?: {
    SKU?: string;
    活动价?: string;
    最低活动价?: string;
    活动类型?: string;
    门店名称?: string;
    活动备注?: string;
    剩余活动天数?: string;
    活动确认人?: string;
    keyword?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: OpsActivityDispatchItem[]; total: number }> => {
    const queryParams: any = {};
    if (params?.SKU) queryParams.SKU = params.SKU;
    if (params?.活动价) queryParams.活动价 = params.活动价;
    if (params?.最低活动价) queryParams.最低活动价 = params.最低活动价;
    if (params?.活动类型) queryParams.活动类型 = params.活动类型;
    if (params?.门店名称) queryParams.门店名称 = params.门店名称;
    if (params?.活动备注) queryParams.活动备注 = params.活动备注;
    if (params?.剩余活动天数) queryParams.剩余活动天数 = params.剩余活动天数;
    if (params?.活动确认人) queryParams.活动确认人 = params.活动确认人;
    if (params?.keyword) queryParams.keyword = params.keyword;
    queryParams.page = params?.page || 1;
    queryParams.limit = params?.limit || 20;
    return api.get('/ops-activity-dispatch', { params: queryParams }).then(res => res.data);
  },
  create: (data: OpsActivityDispatchItem): Promise<{ success: boolean }> =>
    api.post('/ops-activity-dispatch', data).then(res => res.data),
  update: (
    original: OpsActivityDispatchItem,
    data: OpsActivityDispatchItem
  ): Promise<{ success: boolean }> =>
    api.patch('/ops-activity-dispatch', { original, data }).then(res => res.data),
  remove: (data: OpsActivityDispatchItem): Promise<{ success: boolean }> =>
    api.delete('/ops-activity-dispatch', { data }).then(res => res.data),
  batchDelete: (items: OpsActivityDispatchItem[]): Promise<{ success: boolean; message: string; deletedCount: number }> =>
    api.post('/ops-activity-dispatch/batch-delete', { items }).then(res => res.data),
  batchCreate: (items: OpsActivityDispatchItem[]): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> =>
    api.post('/ops-activity-dispatch/batch-create', { items }).then(res => res.data),
  getStoreNames: (): Promise<string[]> =>
    api.get('/ops-activity-dispatch/store-names').then(res => res.data),
};

// 运营组管理 - 手动常规活动分发
export interface OpsRegularActivityDispatchItem {
  SKU: string;
  活动价: string | number | null;
  活动类型: string | null;
  活动备注: string | null;
  活动确认人: string | null;
  数据更新时间: string | null;
  商品名称?: string | null;
  商品条码?: string | null;
  规格名称?: string | null;
}

export const opsRegularActivityDispatchApi = {
  list: (params?: {
    SKU?: string;
    活动价?: string;
    活动类型?: string;
    活动备注?: string;
    活动确认人?: string;
    keyword?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: OpsRegularActivityDispatchItem[]; total: number }> => {
    const queryParams: any = {};
    if (params?.SKU) queryParams.SKU = params.SKU;
    if (params?.活动价) queryParams.活动价 = params.活动价;
    if (params?.活动类型) queryParams.活动类型 = params.活动类型;
    if (params?.活动备注) queryParams.活动备注 = params.活动备注;
    if (params?.活动确认人) queryParams.活动确认人 = params.活动确认人;
    if (params?.keyword) queryParams.keyword = params.keyword;
    queryParams.page = params?.page || 1;
    queryParams.limit = params?.limit || 20;
    return api.get('/ops-regular-activity-dispatch', { params: queryParams }).then(res => res.data);
  },
  create: (data: OpsRegularActivityDispatchItem): Promise<{ success: boolean }> =>
    api.post('/ops-regular-activity-dispatch', data).then(res => res.data),
  update: (
    original: OpsRegularActivityDispatchItem,
    data: OpsRegularActivityDispatchItem
  ): Promise<{ success: boolean }> =>
    api.patch('/ops-regular-activity-dispatch', { original, data }).then(res => res.data),
  remove: (data: OpsRegularActivityDispatchItem): Promise<{ success: boolean }> =>
    api.delete('/ops-regular-activity-dispatch', { data }).then(res => res.data),
  batchDelete: (items: OpsRegularActivityDispatchItem[]): Promise<{ success: boolean; message: string; deletedCount: number }> =>
    api.post('/ops-regular-activity-dispatch/batch-delete', { items }).then(res => res.data),
  batchCreate: (items: OpsRegularActivityDispatchItem[]): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> =>
    api.post('/ops-regular-activity-dispatch/batch-create', { items }).then(res => res.data),
};

// 运营组管理 - 排除上下架商品
export interface OpsShelfExclusionItem {
  SPU: string;
  门店编码: string;
  渠道编码: string;
}

export const opsShelfExclusionApi = {
  list: (params?: {
    门店编码?: string;
    SPU?: string;
    渠道编码?: string;
    keyword?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: OpsShelfExclusionItem[]; total: number }> => {
    const queryParams: any = {};
    if (params?.门店编码) queryParams.门店编码 = params.门店编码;
    if (params?.SPU) queryParams.SPU = params.SPU;
    if (params?.渠道编码) queryParams.渠道编码 = params.渠道编码;
    if (params?.keyword) queryParams.keyword = params.keyword;
    queryParams.page = params?.page || 1;
    queryParams.limit = params?.limit || 20;
    return api.get('/ops-shelf-exclusion', { params: queryParams }).then(res => res.data);
  },
  create: (data: OpsShelfExclusionItem): Promise<{ success: boolean }> =>
    api.post('/ops-shelf-exclusion', data).then(res => res.data),
  update: (
    original: OpsShelfExclusionItem,
    data: OpsShelfExclusionItem
  ): Promise<{ success: boolean }> =>
    api.patch('/ops-shelf-exclusion', { original, data }).then(res => res.data),
  remove: (data: OpsShelfExclusionItem): Promise<{ success: boolean }> =>
    api.delete('/ops-shelf-exclusion', { data }).then(res => res.data),
  batchDelete: (items: OpsShelfExclusionItem[]): Promise<{ success: boolean; message: string; deletedCount: number }> =>
    api.post('/ops-shelf-exclusion/batch-delete', { items }).then(res => res.data),
  batchCreate: (items: OpsShelfExclusionItem[]): Promise<{ success: boolean; message: string; createdCount: number; errors?: string[] }> =>
    api.post('/ops-shelf-exclusion/batch-create', { items }).then(res => res.data),
};

// 门店管理 - 驳回差异单
export interface StoreRejectionItem {
  '门店/仓': string;
  '商品名称': string;
  'sku_id': string;
  'upc': string;
  '采购单号': string;
  '关联收货单号': string;
}

export const storeRejectionApi = {
  list: (
    filters?: {
      store?: string;
      productName?: string;
      skuId?: string;
      upc?: string;
      purchaseOrderNo?: string;
      receiptNo?: string;
    },
    page?: number,
    limit?: number
  ): Promise<{ data: StoreRejectionItem[]; total: number }> => {
    const params: any = {};
    if (filters) {
      if (filters.store) params.store = filters.store;
      if (filters.productName) params.productName = filters.productName;
      if (filters.skuId) params.skuId = filters.skuId;
      if (filters.upc) params.upc = filters.upc;
      if (filters.purchaseOrderNo) params.purchaseOrderNo = filters.purchaseOrderNo;
      if (filters.receiptNo) params.receiptNo = filters.receiptNo;
    }
    params.page = page || 1;
    params.limit = limit || 20;
    return api.get('/store-rejection', { params }).then(res => res.data);
  },
  sendRejectionEmail: (item: StoreRejectionItem, email?: string): Promise<{ success: boolean; message: string }> =>
    api.post('/store-rejection/send-rejection-email', { item, email }).then(res => res.data),
  sendRejectionAllEmail: (item: StoreRejectionItem, email?: string): Promise<{ success: boolean; message: string }> =>
    api.post('/store-rejection/send-rejection-all-email', { item, email }).then(res => res.data),
};

// 采购管理 - 采购通过差异单
export const purchasePassDifferenceApi = {
  sendEmail: (items: string[], email?: string): Promise<{ success: boolean; message: string }> =>
    api.post('/purchase-pass-difference/send-email', { items, email }).then(res => res.data),
};

// 门店管理 - 单次最高采购量
export interface MaxPurchaseQuantityItem {
  '仓店名称': string;
  'SKU': string;
  '单次最高采购量(基本单位)': number;
  '修改人': string;
  '商品名称'?: string | null;
  '商品条码'?: string | null;
  '规格名称'?: string | null;
}

export const maxPurchaseQuantityApi = {
  getStoreNames: (): Promise<string[]> =>
    api.get('/max-purchase-quantity/store-names').then(res => res.data),

  getUserDisplayName: (): Promise<{ displayName: string | null }> =>
    api.get('/max-purchase-quantity/user-display-name').then(res => res.data),

  list: (
    filters?: {
      storeName?: string;
      sku?: string;
      maxQuantity?: string;
      modifier?: string;
    },
    page?: number,
    limit?: number
  ): Promise<{ data: MaxPurchaseQuantityItem[]; total: number }> => {
    const params: any = {};
    if (filters) {
      if (filters.storeName) params.storeName = filters.storeName;
      if (filters.sku) params.sku = filters.sku;
      if (filters.maxQuantity) params.maxQuantity = filters.maxQuantity;
      if (filters.modifier) params.modifier = filters.modifier;
    }
    params.page = page || 1;
    params.limit = limit || 20;
    return api.get('/max-purchase-quantity', { params }).then(res => res.data);
  },

  create: (data: {
    storeName: string;
    sku: string;
    maxQuantity: number;
  }): Promise<MaxPurchaseQuantityItem> =>
    api.post('/max-purchase-quantity', data).then(res => res.data),

  update: (
    original: {
      storeName: string;
      sku: string;
    },
    data: {
      storeName?: string;
      sku?: string;
      maxQuantity?: number;
    }
  ): Promise<MaxPurchaseQuantityItem> =>
    api.put('/max-purchase-quantity', { original, data }).then(res => res.data),

  delete: (data: {
    storeName: string;
    sku: string;
  }): Promise<{ success: boolean }> =>
    api.delete('/max-purchase-quantity', {
      data,
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.data),
};

// 门店管理 - 仓店sku最高库存
export interface MaxStoreSkuInventoryItem {
  '仓店名称': string;
  'SKU编码': string;
  '最高库存量（基础单位）': number;
  '备注（说明设置原因）': string;
  '修改人': string;
  '商品名称'?: string | null;
  '商品条码'?: string | null;
  '规格名称'?: string | null;
}

export const maxStoreSkuInventoryApi = {
  getStoreNames: (): Promise<string[]> =>
    api.get('/max-store-sku-inventory/store-names').then(res => res.data),

  getUserDisplayName: (): Promise<{ displayName: string | null }> =>
    api.get('/max-store-sku-inventory/user-display-name').then(res => res.data),

  list: (
    filters?: {
      storeName?: string;
      sku?: string;
      maxInventory?: string;
      remark?: string;
      modifier?: string;
    },
    page?: number,
    limit?: number
  ): Promise<{ data: MaxStoreSkuInventoryItem[]; total: number }> => {
    const params: any = {};
    if (filters) {
      if (filters.storeName) params.storeName = filters.storeName;
      if (filters.sku) params.sku = filters.sku;
      if (filters.maxInventory) params.maxInventory = filters.maxInventory;
      if (filters.remark) params.remark = filters.remark;
      if (filters.modifier) params.modifier = filters.modifier;
    }
    params.page = page || 1;
    params.limit = limit || 20;
    return api.get('/max-store-sku-inventory', { params }).then(res => res.data);
  },

  create: (data: {
    storeName: string;
    sku: string;
    maxInventory: number;
    remark: string;
  }): Promise<MaxStoreSkuInventoryItem> =>
    api.post('/max-store-sku-inventory', data).then(res => res.data),

  update: (
    original: {
      storeName: string;
      sku: string;
    },
    data: {
      storeName?: string;
      sku?: string;
      maxInventory?: number;
      remark?: string;
    }
  ): Promise<MaxStoreSkuInventoryItem> =>
    api.put('/max-store-sku-inventory', { original, data }).then(res => res.data),

  delete: (data: {
    storeName: string;
    sku: string;
  }): Promise<{ success: boolean }> =>
    api.delete('/max-store-sku-inventory', { data }).then(res => res.data),
};

// ACL 类型
export interface SysPermission { id: number; code: string; name: string; path: string }
export interface SysRole { id: number; name: string; remark?: string }
export interface SysUser {
  id: number;
  username: string;
  display_name?: string;
  status: number;
  roles?: SysRole[]; // 用户关联的角色列表
}

// 钉钉API
export const dingTalkApi = {
  getAuthUrl: (state?: string): Promise<{ url: string }> => api.get('/dingtalk/auth-url', { params: { state } }).then(res => res.data),
  callback: (code: string): Promise<any> => api.post('/dingtalk/callback', { code }).then(res => res.data),
  autoLogin: (code: string, deviceInfo?: string): Promise<{ success: boolean; id: number; username: string; display_name?: string; token: string; message: string }> =>
    api.post('/dingtalk/auto-login', { code }, { params: { deviceInfo } }).then(res => res.data),
  verifyMember: (userId: string): Promise<{ isMember: boolean; message: string }> => api.post('/dingtalk/verify-member', { userId }).then(res => res.data),
};

// ACL API
export const aclApi = {
  init: (): Promise<any> => api.post('/acl/init').then(res => res.data),
  login: (username: string, password: string, dingTalkCode?: string): Promise<{ id: number; username: string; display_name?: string; token: string }> => api.post('/acl/login', { username, password, dingTalkCode }).then(res => res.data),
  logout: (userId: number, token: string): Promise<{ success: boolean }> => api.post('/acl/logout', { userId, token }).then(res => res.data),
  // 会话校验（用于单点登录心跳）
  validateToken: (userId: number, token: string): Promise<boolean> => api.post('/acl/validate-token', { userId, token }).then(res => res.data),

  // permissions
  listPermissions: (): Promise<SysPermission[]> => api.get('/acl/permissions').then(res => res.data),
  createPermission: (p: Partial<SysPermission>) => api.post('/acl/permissions/create', p).then(res => res.data),
  updatePermission: (id: number, p: Partial<SysPermission>) => api.post('/acl/permissions/update', { id, ...p }).then(res => res.data),
  deletePermission: (id: number) => api.post('/acl/permissions/delete', { id }).then(res => res.data),

  // roles
  listRoles: (): Promise<SysRole[]> => api.get('/acl/roles').then(res => res.data),
  createRole: (r: Partial<SysRole>) => api.post('/acl/roles/create', r).then(res => res.data),
  updateRole: (id: number, r: Partial<SysRole>) => api.post('/acl/roles/update', { id, ...r }).then(res => res.data),
  deleteRole: (id: number) => api.post('/acl/roles/delete', { id }).then(res => res.data),
  grantRole: (roleId: number, permissionIds: number[]) => api.post('/acl/roles/grant', { roleId, permissionIds }).then(res => res.data),
  roleGranted: (roleId: number): Promise<number[]> => api.get('/acl/roles/granted', { params: { roleId } }).then(res => res.data),

  // users
  listUsers: (q?: string): Promise<SysUser[]> => api.get('/acl/users', { params: { q } }).then(res => res.data),
  createUser: (u: Partial<SysUser>) => api.post('/acl/users/create', u).then(res => res.data),
  updateUser: (id: number, u: Partial<SysUser>) => api.post('/acl/users/update', { id, ...u }).then(res => res.data),
  deleteUser: (id: number) => api.post('/acl/users/delete', { id }).then(res => res.data),
  assignUserRoles: (userId: number, roleIds: number[]) => api.post('/acl/users/assign', { userId, roleIds }).then(res => res.data),

  // user assigned role ids (用于列表展示与弹窗预勾选)
  userAssignedRoleIds: (userId: number): Promise<number[]> =>
    api.get('/acl/users/assigned', { params: { userId } }).then(res => res.data),

  // user permissions
  userPermissions: (userId: number): Promise<SysPermission[]> => api.get('/acl/user-permissions', { params: { userId } }).then(res => res.data),

  // user edit count (用于显示 display_name 编辑次数)
  getUserEditCount: (userId: number): Promise<{ editCount: number; remaining: number }> =>
    api.get('/acl/users/edit-count', { params: { userId } }).then(res => res.data),
};

// 1688退款跟进接口
export interface Refund1688FollowUp {
  订单编号: string; // 主键
  收货人姓名?: string;
  买家会员名?: string;
  订单状态?: string;
  订单详情页?: string;
  http请求url?: string;
  请求获取订单状态?: string;
  请求获取退款状态?: string;
  进度追踪?: string;
  采购单号?: string;
  跟进情况备注?: string;
  差异单出库单详情?: string;
  跟进相关附件?: string;
  牵牛花物流单号?: string;
  跟进情况图片?: string; // 列表查询时不返回，需要通过单独接口查询（原发货截图）
  有跟进情况图片?: number; // 列表查询时返回，0表示无图片，1表示有图片
  跟进人?: string;
  跟进时间?: string; // 最后编辑时间
}

export const refund1688Api = {
  // 获取所有退款跟进记录（支持分页）
  getAll: (params?: {
    page?: number;
    limit?: number;
    收货人姓名?: string;
    订单编号?: string;
    订单状态?: string;
    买家会员名?: string;
    采购单号?: string;
    牵牛花物流单号?: string;
    进度追踪?: string;
    keyword?: string;
  }): Promise<{ data: Refund1688FollowUp[]; total: number; canEdit?: boolean }> =>
    api.get('/refund-1688-follow-up', { params }).then(res => res.data),

  // 更新退款跟进记录
  update: (orderNo: string, data: Partial<Refund1688FollowUp>): Promise<{ success: boolean; message: string }> =>
    api.put(`/refund-1688-follow-up/${encodeURIComponent(orderNo)}`, data).then(res => res.data),

  // 获取订单状态
  getOrderStatus: (orderNo: string): Promise<{ status: string }> =>
    api.post(`/refund-1688-follow-up/${encodeURIComponent(orderNo)}/order-status`).then(res => res.data),

  // 获取退款状态
  getRefundStatus: (orderNo: string): Promise<{ refundStatus: string }> =>
    api.post(`/refund-1688-follow-up/${encodeURIComponent(orderNo)}/refund-status`).then(res => res.data),

  // 自动匹配采购单号
  autoMatchPurchaseOrderNos: (): Promise<{ success: boolean; count: number; message: string }> =>
    api.post('/refund-1688-follow-up/auto-match-purchase-orders').then(res => res.data),

  // 获取跟进情况图片（按需查询，原发货截图）
  getFollowUpImage: (orderNo: string): Promise<{ 跟进情况图片: string | null }> =>
    api.get(`/refund-1688-follow-up/${encodeURIComponent(orderNo)}/follow-up-image`).then(res => res.data),

  // 同步数据：从采购单信息表同步采购单号和物流单号
  syncData: (): Promise<{ success: boolean; updatedCount: number; message: string }> =>
    api.post('/refund-1688-follow-up/sync-data').then(res => res.data),

  // 删除退款跟进记录
  delete: (orderNo: string): Promise<{ success: boolean; message: string }> =>
    api.delete(`/refund-1688-follow-up/${orderNo}`).then(res => res.data),

  // 批量删除退款跟进记录
  batchDelete: (orderNos: string[]): Promise<{ success: boolean; message: string; deletedCount: number }> =>
    api.post('/refund-1688-follow-up/batch-delete', { orderNos }).then(res => res.data),
};

export default api;
