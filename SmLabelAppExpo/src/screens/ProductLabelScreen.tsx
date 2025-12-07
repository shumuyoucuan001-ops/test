import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LabelTemplate, ProductSalesSpec, labelDataApi, productApi, templateApi } from '../api';
import PrintService from '../services/PrintService';
import PrinterSettings from '../services/PrinterSettings';
import TsplBuilder from '../services/TsplBuilder';

export default function ProductLabelScreen() {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [products, setProducts] = useState<ProductSalesSpec[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSalesSpec | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null);
  const [copies, setCopies] = useState('1');
  const [loading, setLoading] = useState(false);


  const searchProducts = async () => {
    if (!searchKeyword.trim()) {
      Alert.alert('提示', '请输入搜索关键词');
      return;
    }

    setLoading(true);
    try {
      const results = await productApi.search(searchKeyword);
      setProducts(results);
      if (results.length === 0) {
        Alert.alert('提示', '未找到相关商品');
      }
    } catch (error: any) {
      Alert.alert('错误', error?.response?.data?.message || '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const selectProduct = async (product: ProductSalesSpec) => {
    setSelectedProduct(product);
    
    // 自动选择模板逻辑
    try {
      // 查询商品标签资料
      const labelDataList = await labelDataApi.bySku(product.skuCode);
      
      // 检查是否有厂家名称
      let hasFactory = false;
      for (const labelData of labelDataList) {
        const factoryName = labelData.labelRaw?.['厂家名称'];
        if (factoryName && String(factoryName).trim()) {
          hasFactory = true;
          break;
        }
      }
      
      // 根据是否有厂家名称，设置本地占位模板名
      setSelectedTemplate({ id: hasFactory ? 2 : 1, name: hasFactory ? '合格证标签' : '默认标签模板', content: '', isDefault: !hasFactory });
    } catch (error) {
      console.error('自动选择模板失败:', error);
      // 出错时使用默认模板占位
      setSelectedTemplate({ id: 1, name: '默认标签模板', content: '', isDefault: true });
    }
  };


  const printLabel = async () => {
    if (!selectedProduct) {
      Alert.alert('提示', '请选择商品');
      return;
    }

    if (!selectedTemplate) {
      Alert.alert('提示', '请选择标签模板');
      return;
    }

    const copyCount = parseInt(copies) || 1;
    if (copyCount < 1 || copyCount > 100) {
      Alert.alert('提示', '打印份数应在 1-100 之间');
      return;
    }

    setLoading(true);
    try {
      // 获取标签资料（用于判断是否合格证并填充额外字段）
      const labelDataList = await labelDataApi.bySku(selectedProduct.skuCode);
      const raw = labelDataList?.[0]?.labelRaw || {};
      const factoryName = raw?.['厂家名称'] || '';
      // 计算 prevMonth
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prev.getFullYear()}.${String(prev.getMonth() + 1).padStart(2, '0')}`;

      const tsplData = {
        productName: raw?.['产品名称'] || selectedProduct.productName || '',
        spec: selectedProduct.spec || raw?.['产品规格'] || '',
        skuCode: selectedProduct.skuCode,
        productCode: selectedProduct.productCode,
        unit: selectedProduct.unit,
        price: selectedProduct.price,
        factoryName: factoryName,
        executeStandard: raw?.['执行标准'] || '',
        addressInfo: raw?.['地址'] || raw?.['地址信息'] || '',
        material: raw?.['材质'] || '',
        otherInfo: raw?.['其他信息'] || '',
        prevMonth,
      } as any;

      // 直接调用后台“默认模板”渲染，确保与后台保持一致
      const defaultTpl = await templateApi.getDefault();
      // 规则：二维码内容=SKU；底部数字=核对条码尾号
      // 若商品条码包含逗号：取第一个条码的后8位数字；否则取后8位数字
      const rawCode = String(selectedProduct.productCode || '');
      const barcodeTail = rawCode.includes(',')
        ? rawCode.split(',')[0].trim().replace(/\D/g, '').slice(-8)
        : rawCode.replace(/\D/g, '').slice(-8);
      // 获取当前打印机设置
      await PrinterSettings.loadSettings();
      const currentPrinterSettings = PrinterSettings.getCurrentSettings();
      
      const payload: any = {
        spec: tsplData.spec,
        qrDataUrl: selectedProduct.skuCode, // 后端按内容生成二维码
        barcodeTail,
        skuCode: selectedProduct.skuCode,
        productCode: selectedProduct.productCode,
        productName: tsplData.productName,
        renderAsBitmap: true, // 所有打印机都使用位图渲染
        printerType: currentPrinterSettings.type,
      };
      let tspl = '';
      try {
        console.log('[ProductLabel] Calling backend API with payload:', JSON.stringify(payload, null, 2));
        const rendered = await templateApi.render(defaultTpl.id, payload);
        console.log('[ProductLabel] Backend API success, rendered type:', typeof rendered.rendered);
        console.log('[ProductLabel] Rendered preview:', rendered.rendered.substring(0, 200) + '...');
        tspl = rendered.rendered;
      } catch (error) {
        console.error('[ProductLabel] Template render failed:', error);
        console.error('[ProductLabel] Error details:', (error as any)?.response?.data || (error as any)?.message);
        console.error('[ProductLabel] Payload was:', JSON.stringify(payload, null, 2));
        console.error('[ProductLabel] Printer type:', currentPrinterSettings.type);
        
        // 回退：简单本地模板
        if (currentPrinterSettings.type === 'portable') {
          // 便携打印机暂时不支持本地fallback，抛出错误
          throw new Error(`便携打印机模板渲染失败: ${(error as any)?.message || '未知错误'}`);
        } else {
          // 桌面打印机使用TSPL fallback
          console.log('[ProductLabel] Using TSPL fallback for desktop printer');
          tspl = TsplBuilder.buildBackendDefault(tsplData, copyCount);
        }
      }
      const success = await PrintService.printTsplRaw(tspl);
      
      if (success) {
        Alert.alert('成功', `已成功打印 ${copyCount} 份标签`);
      } else {
        Alert.alert('错误', '打印失败，请检查打印机连接');
      }
    } catch (error: any) {
      Alert.alert('错误', error?.message || '打印失败');
    } finally {
      setLoading(false);
    }
  };

  const renderProduct = ({ item }: { item: ProductSalesSpec }) => {
    const isSelected = selectedProduct?.skuCode === item.skuCode;
    
    return (
      <TouchableOpacity
        style={[styles.productCard, isSelected && styles.productCardSelected]}
        onPress={() => selectProduct(item)}
      >
        <Text style={styles.productName}>{item.productName}</Text>
        <Text style={styles.productSpec}>规格: {item.spec}</Text>
        <Text style={styles.productCode}>SKU: {item.skuCode}</Text>
        <Text style={styles.productCode}>条码: {item.productCode}</Text>
        <Text style={styles.productPrice}>价格: ¥{item.price}/{item.unit}</Text>
      </TouchableOpacity>
    );
  };


  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 搜索区域 */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>商品搜索</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="输入商品名称、SKU或条码"
            value={searchKeyword}
            onChangeText={setSearchKeyword}
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchProducts}>
            <Text style={styles.buttonText}>搜索</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 搜索结果 */}
      {products.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>搜索结果 ({products.length})</Text>
          <FlatList
            data={products}
            keyExtractor={(item, index) => `${item.skuCode}-${index}`}
            renderItem={renderProduct}
            style={styles.productsList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* 选中商品信息 */}
      {selectedProduct && (
        <View style={styles.selectedSection}>
          <Text style={styles.sectionTitle}>已选择商品</Text>
          <View style={styles.selectedProduct}>
            <Text style={styles.selectedProductName}>{selectedProduct.productName}</Text>
            <Text style={styles.selectedProductInfo}>
              {selectedProduct.spec} | {selectedProduct.skuCode}
            </Text>
          </View>

          {/* 模板选择 */}
          <View style={styles.templateSection}>
            <Text style={styles.label}>标签模板</Text>
            <View style={styles.templateDisplay}>
              <Text style={styles.templateText}>
                {selectedTemplate?.name || '自动选择中...'}
              </Text>
            </View>
          </View>

          {/* 份数设置 */}
          <View style={styles.copiesSection}>
            <Text style={styles.label}>打印份数</Text>
            <TextInput
              style={styles.copiesInput}
              value={copies}
              onChangeText={setCopies}
              keyboardType="numeric"
              placeholder="1"
            />
          </View>

          {/* 打印按钮 */}
          <TouchableOpacity
            style={styles.printButton}
            onPress={printLabel}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>打印标签</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* 模板选择弹窗 */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  searchSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 16,
    height: 48,
    textAlignVertical: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 6,
    fontSize: 16,
    height: 48,
    textAlignVertical: 'center',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flex: 1,
  },
  productsList: {
    flex: 1,
  },
  productCard: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  productCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
    lineHeight: 18,
  },
  productSpec: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    lineHeight: 16,
  },
  productCode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    lineHeight: 16,
  },
  productPrice: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    lineHeight: 16,
  },
  selectedSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  selectedProduct: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  selectedProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  selectedProductInfo: {
    fontSize: 14,
    color: '#666',
  },
  templateSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  templateDisplay: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#f8f8f8',
  },
  templateText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  arrow: {
    fontSize: 18,
    color: '#ccc',
  },
  copiesSection: {
    marginBottom: 16,
  },
  copiesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
    fontSize: 16,
    width: 100,
    height: 44,
    textAlignVertical: 'center',
    textAlign: 'center',
  },
  printButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 20,
  },
});
