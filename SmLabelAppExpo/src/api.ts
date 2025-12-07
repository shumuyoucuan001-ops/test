import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance } from 'axios';

// 开发环境优先走 adb reverse：设备访问 127.0.0.1:3000 会被映射到电脑 3000 端口
// 若你未连接 adb，可将此处改为你的电脑局域网 IP，例如 http://192.168.0.109:3000
const API_BASE_URL = __DEV__
  ? 'http://192.168.0.109:3000'
  : 'https://your-server.com';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const userId = await AsyncStorage.getItem('userId');
  const token = await AsyncStorage.getItem('sessionToken');
  if (userId) {
    (config.headers as any)['x-user-id'] = userId;
  }
  if (token) {
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export interface LoginResp { 
  id: number; 
  username: string; 
  display_name?: string; 
  token: string; 
}

// 商品接口类型
export interface ProductSalesSpec {
  id: number;
  productCode: string;
  skuCode: string;
  productName: string;
  spec: string;
  unit: string;
  price: number;
  createdAt?: string;
  updatedAt?: string;
}

// 收货单接口类型
export interface ReceiptItem {
  id: number;
  receiptNumber: string;
  productCode: string;
  skuCode: string;
  productName: string;
  spec: string;
  quantity: number;
  unit: string;
  price?: number;
  supplierName?: string;
}

// 标签模板类型
export interface LabelTemplate {
  id: number;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt?: string;
}

// 商品标签资料类型
export interface LabelDataItem {
  skuCode: string;
  spuCode?: string;
  productName?: string;
  spec?: string;
  productCode?: string;
  printBarcode?: string;
  labelRaw: Record<string, any>;
}

export const aclApi = {
  login: async (username: string, password: string): Promise<LoginResp> => {
    const res = await api.post('/acl/login', { username, password });
    return res.data;
  },
};

// 商品API
export const productApi = {
  search: async (keyword: string): Promise<ProductSalesSpec[]> => {
    const res = await api.get(`/products/search?keyword=${encodeURIComponent(keyword)}`);
    return res.data;
  },
  getByBarcode: async (barcode: string): Promise<ProductSalesSpec | null> => {
    const res = await api.get(`/products/barcode/${barcode}`);
    return res.data;
  },
};

// 收货单API
export const receiptApi = {
  getReceiptNumbers: async (): Promise<string[]> => {
    const res = await api.get('/receipts/numbers');
    return res.data;
  },
  searchReceiptNumbers: async (keyword: string): Promise<string[]> => {
    const res = await api.get(`/receipts/numbers/search?keyword=${encodeURIComponent(keyword)}`);
    return res.data;
  },
  getByReceiptNumber: async (receiptNumber: string): Promise<ReceiptItem[]> => {
    const encodedReceiptNumber = encodeURIComponent(receiptNumber);
    const res = await api.get(`/receipts/${encodedReceiptNumber}/details`);
    return res.data.map((item: any) => ({
      id: item.receiptDetail.id,
      receiptNumber: item.receiptDetail.receiptNo,
      productCode: item.productInfo?.productCode || '',
      skuCode: item.receiptDetail.sku,
      productName: item.receiptDetail.productName || item.productInfo?.productName || '',
      spec: item.productInfo?.spec || '',
      quantity: item.receiptDetail.quantity,
      unit: item.receiptDetail.unit || item.productInfo?.unit || '件',
      price: item.receiptDetail.price || item.productInfo?.price || 0,
      supplierName: item.receiptDetail?.supplierName || item.receiptDetail?.supplier || item.receiptDetail?.vendorName || item.receiptDetail?.供应商名称 || '',
    }));
  },
};

// 标签模板API
export const templateApi = {
  getAll: async (): Promise<LabelTemplate[]> => {
    const res = await api.get('/templates');
    return res.data;
  },
  getDefault: async (): Promise<LabelTemplate> => {
    const res = await api.get('/templates/default');
    return res.data;
  },
  render: async (id: number, data: any): Promise<{ rendered: string }> => {
    const res = await api.post(`/templates/${id}/render`, data);
    return res.data;
  },
  // 测试位图（后端生成的简单方块/横线），用于验证打印机BITMAP渲染
  testBitmap: async (): Promise<{ rendered: string }> => {
    const res = await api.post('/templates/test-bitmap', {});
    return res.data;
  },
};

// 标签资料API
export const labelDataApi = {
  bySku: async (skuCode: string): Promise<LabelDataItem[]> => {
    const res = await api.get(`/label-data/by-sku?sku=${encodeURIComponent(skuCode)}`);
    return res.data;
  },
  bySkuAndSupplier: async (skuCode: string, supplier: string): Promise<LabelDataItem | null> => {
    const res = await api.get(`/label-data/by-sku-supplier?sku=${encodeURIComponent(skuCode)}&supplierName=${encodeURIComponent(supplier)}`);
    return res.data;
  },
};

export default api;
