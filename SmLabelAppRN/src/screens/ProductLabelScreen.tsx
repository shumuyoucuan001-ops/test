import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LabelDataAudit, LabelTemplate, ProductSalesSpec, labelDataAuditApi, productApi, templateApi } from '../api';
import CtplPrinter from '../services/CtplPrinter';
import PrinterSettings from '../services/PrinterSettings';

export default function ProductLabelScreen() {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [products, setProducts] = useState<ProductSalesSpec[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSalesSpec | null>(null);
  const [copies, setCopies] = useState('1');
  const [loading, setLoading] = useState(false);
  
  // 模板相关状态
  const [templateType, setTemplateType] = useState<'default' | 'certificate'>('default'); // 默认标签 | 合格证标签
  const [suppliers, setSuppliers] = useState<string[]>([]); // 供应商列表
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null); // 选中的供应商
  const [auditData, setAuditData] = useState<LabelDataAudit | null>(null); // 审核资料数据
  const [showSupplierModal, setShowSupplierModal] = useState(false); // 供应商选择弹窗
  const [showPrintModal, setShowPrintModal] = useState(false); // 打印设置弹窗


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
    setLoading(true);
    
    try {
      // 查询该SKU的所有供应商
      const supplierList = await labelDataAuditApi.getSuppliersBySku(product.skuCode);
      setSuppliers(supplierList);
      
      if (supplierList.length > 0) {
        // 有供应商数据,默认选择第一个供应商并使用合格证标签
        setTemplateType('certificate');
        setSelectedSupplier(supplierList[0]);
        
        // 加载第一个供应商的审核数据
        const data = await labelDataAuditApi.getBySkuAndSupplier(product.skuCode, supplierList[0]);
        setAuditData(data);
      } else {
        // 没有供应商数据,使用默认标签
        setTemplateType('default');
        setSelectedSupplier(null);
        setAuditData(null);
      }
      
      // 打开打印设置弹窗
      setShowPrintModal(true);
    } catch (error) {
      console.error('查询供应商失败:', error);
      // 出错时使用默认标签
      setTemplateType('default');
      setSuppliers([]);
      setSelectedSupplier(null);
      setAuditData(null);
      setShowPrintModal(true);
    } finally {
      setLoading(false);
    }
  };

  // 切换模板类型
  const switchTemplate = (type: 'default' | 'certificate') => {
    if (type === 'certificate' && suppliers.length === 0) {
      Alert.alert('提示', '该商品没有合格证标签数据');
      return;
    }
    
    setTemplateType(type);
    
    // 如果切换到合格证标签但没有选中供应商,自动选择第一个
    if (type === 'certificate' && !selectedSupplier && suppliers.length > 0) {
      selectSupplierForCertificate(suppliers[0]);
    }
  };

  // 选择供应商(用于合格证标签)
  const selectSupplierForCertificate = async (supplierName: string) => {
    if (!selectedProduct) return;
    
    setSelectedSupplier(supplierName);
    setShowSupplierModal(false);
    setLoading(true);
    
    try {
      // 加载该供应商的审核数据
      const data = await labelDataAuditApi.getBySkuAndSupplier(selectedProduct.skuCode, supplierName);
      setAuditData(data);
    } catch (error) {
      console.error('加载审核数据失败:', error);
      Alert.alert('错误', '加载审核数据失败');
    } finally {
      setLoading(false);
    }
  };

  const printLabel = async () => {
    if (!selectedProduct) {
      Alert.alert('提示', '请选择商品');
      return;
    }

    if (templateType === 'certificate' && !selectedSupplier) {
      Alert.alert('提示', '请选择供应商');
      return;
    }

    const copyCount = parseInt(copies) || 1;
    if (copyCount < 1 || copyCount > 100) {
      Alert.alert('提示', '打印份数应在 1-100 之间');
      return;
    }

    setLoading(true);
    setShowPrintModal(false); // 关闭弹窗
    try {
      // 计算条码尾号
      const rawCode = String(selectedProduct.productCode || '');
      const barcodeTail = rawCode.includes(',')
        ? rawCode.split(',')[0].trim().replace(/\D/g, '').slice(-8)
        : rawCode.replace(/\D/g, '').slice(-8);
      
      let template: LabelTemplate;
      let payload: any;
      
      if (templateType === 'certificate' && auditData) {
        // 使用合格证标签
        // 假设合格证标签模板ID为2
        template = { id: 2, name: '合格证标签', content: '', isDefault: false };
        
        // 计算上月年月
        const now = new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1);
        const prevMonthStr = `${prevMonth.getFullYear()}.${(prevMonth.getMonth() + 1).toString().padStart(2, '0')}`;
        
        payload = {
          headerInfo: auditData.headerInfo || '',
          productSpec: auditData.productSpec || selectedProduct.spec || '',
          productName: auditData.productName || selectedProduct.productName || '',
          factoryName: auditData.manufacturerName || '',
          addressInfo: auditData.addressInfo || '',
          material: auditData.material || '',
          otherInfo: auditData.otherInfo || '',
          executeStandard: auditData.executionStandard || '',
          prevMonth: prevMonthStr,
          qrDataUrl: selectedProduct.skuCode,
          barcodeTail,
          skuCode: selectedProduct.skuCode,
          renderAsBitmap: true,
          printerType: 'portable',
          copies: copyCount,
        };
      } else {
        // 使用默认标签
        // 假设默认标签模板ID为1
        template = { id: 1, name: '默认标签模板', content: '', isDefault: true };
        
        payload = {
          spec: selectedProduct.spec,
          qrDataUrl: selectedProduct.skuCode,
          barcodeTail,
          skuCode: selectedProduct.skuCode,
          productCode: selectedProduct.productCode,
          productName: selectedProduct.productName,
          simpleText: false, // 使用HTML模板渲染
          renderAsBitmap: true, // 启用位图渲染（HTML转TSPL位图）
          printerType: 'portable',
          copies: copyCount,
        };
      }
      
      console.log('[ProductLabel] 渲染模板:', template.name, payload);
      
      // 调用后端渲染模板
      const rendered = await templateApi.render(template.id, payload);
      const printData = rendered.rendered;
      
      console.log('[ProductLabel] 模板渲染成功,准备打印');
      
      // 检查打印机连接状态
      const connectedPrinter = await CtplPrinter.getConnectedPrinter();
      
      if (!connectedPrinter) {
        console.log('[ProductLabel] 打印机未连接，尝试自动连接...');
        
        // 先尝试连接上次使用的打印机
        await PrinterSettings.loadSettings();
        const lastAddress = PrinterSettings.getLastConnectedAddress();
        const lastName = PrinterSettings.getLastConnectedName();
        
        let connected = false;
        
        if (lastAddress) {
          try {
            console.log('[ProductLabel] 尝试连接上次使用的打印机:', lastName || lastAddress);
            await CtplPrinter.connect(lastAddress);
            console.log('[ProductLabel] 连接上次打印机成功');
            connected = true;
            
            // 等待连接稳定
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.log('[ProductLabel] 连接上次打印机失败:', error);
          }
        }
        
        // 如果连接上次打印机失败，扫描并连接第一个设备
        if (!connected) {
          const devices = await CtplPrinter.scanDevices();
          console.log('[ProductLabel] 扫描到设备:', devices);
          
          if (devices.length === 0) {
            throw new Error('未找到已配对的蓝牙打印机，请先在打印机设置中连接打印机');
          }
          
          console.log('[ProductLabel] 尝试连接到:', devices[0]);
          await CtplPrinter.connect(devices[0].address);
          console.log('[ProductLabel] 打印机连接成功');
          
          // 保存新连接的打印机
          await PrinterSettings.saveLastConnectedPrinter(devices[0].address, devices[0].name);
          
          // 等待连接稳定
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // 使用CTPL SDK打印
      const success = await CtplPrinter.print(printData);
      
      if (success) {
        Alert.alert('成功', `已成功打印 ${copyCount} 份标签`);
      } else {
        Alert.alert('错误', '打印失败，请检查打印机连接');
      }
    } catch (error: any) {
      console.error('[ProductLabel] 打印失败:', error);
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
      </TouchableOpacity>
    );
  };


  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 搜索区域 - 缩小版 */}
      <View style={styles.searchSectionCompact}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="输入商品名称、SKU或条码"
            placeholderTextColor="#999"
            value={searchKeyword}
            onChangeText={setSearchKeyword}
            onSubmitEditing={searchProducts}
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchProducts} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>搜索</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 搜索结果 - 占满剩余空间 */}
      {products.length > 0 ? (
        <View style={styles.resultsSection}>
          <Text style={styles.resultCount}>共找到 {products.length} 个商品</Text>
          <FlatList
            data={products}
            keyExtractor={(item, index) => `${item.skuCode}-${index}`}
            renderItem={renderProduct}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>请输入关键词搜索商品</Text>
        </View>
      )}

      {/* 打印设置弹窗 */}
      <Modal
        visible={showPrintModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPrintModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.printModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>打印设置</Text>
              <TouchableOpacity onPress={() => setShowPrintModal(false)}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.printModalBody}>
              {/* 商品信息 */}
              {selectedProduct && (
                <View style={styles.productInfo}>
                  <Text style={styles.productInfoName}>{selectedProduct.productName}</Text>
                  <Text style={styles.productInfoDetail}>规格: {selectedProduct.spec}</Text>
                  <View style={styles.skuBarcodeRow}>
                    <View style={styles.skuBarcodeText}>
                      <Text style={styles.productInfoDetail} numberOfLines={1} ellipsizeMode="tail">
                        SKU: {selectedProduct.skuCode}
                      </Text>
                      <Text style={styles.productInfoDetail} numberOfLines={1} ellipsizeMode="tail">
                        条码: {selectedProduct.productCode}
                      </Text>
                    </View>
                    <View style={styles.quantityControlsInline}>
                      <TouchableOpacity
                        style={styles.quantityButtonSmall}
                        onPress={() => {
                          const num = parseInt(copies) || 1;
                          setCopies(String(Math.max(1, num - 1)));
                        }}
                      >
                        <Text style={styles.quantityButtonTextSmall}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.copiesInputSmall}
                        value={copies}
                        onChangeText={setCopies}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#999"
                        selectTextOnFocus
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.quantityButtonSmall}
                        onPress={() => {
                          const num = parseInt(copies) || 1;
                          setCopies(String(num + 1));
                        }}
                      >
                        <Text style={styles.quantityButtonTextSmall}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* 模板类型选择 */}
              <View style={styles.templateTypeSection}>
                <Text style={styles.label}>标签类型</Text>
                <View style={styles.templateTypeButtons}>
                  <TouchableOpacity
                    style={[styles.templateTypeButton, templateType === 'default' && styles.templateTypeButtonActive]}
                    onPress={() => switchTemplate('default')}
                  >
                    <Text style={[styles.templateTypeButtonText, templateType === 'default' && styles.templateTypeButtonTextActive]}>
                      默认标签
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.templateTypeButton, templateType === 'certificate' && styles.templateTypeButtonActive, suppliers.length === 0 && styles.templateTypeButtonDisabled]}
                    onPress={() => switchTemplate('certificate')}
                    disabled={suppliers.length === 0}
                  >
                    <Text style={[styles.templateTypeButtonText, templateType === 'certificate' && styles.templateTypeButtonTextActive]}>
                      合格证标签 {suppliers.length > 0 ? `(${suppliers.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 供应商选择(仅合格证标签显示) */}
              {templateType === 'certificate' && suppliers.length > 0 && (
                <View style={styles.supplierSection}>
                  <Text style={styles.label}>选择供应商</Text>
                  <TouchableOpacity
                    style={styles.supplierSelector}
                    onPress={() => setShowSupplierModal(true)}
                  >
                    <Text style={styles.supplierText}>
                      {selectedSupplier || '请选择供应商'}
                    </Text>
                    <Text style={styles.arrow}>›</Text>
                  </TouchableOpacity>
                </View>
              )}

            </ScrollView>

            {/* 打印按钮 */}
            <View style={styles.printModalFooter}>
              <TouchableOpacity
                style={styles.printButton}
                onPress={printLabel}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>开始打印</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 供应商选择弹窗 */}
      <Modal
        visible={showSupplierModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSupplierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择供应商</Text>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.supplierList}>
              {suppliers.map((supplier, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.supplierItem, selectedSupplier === supplier && styles.supplierItemSelected]}
                  onPress={() => selectSupplierForCertificate(supplier)}
                >
                  <Text style={[styles.supplierItemText, selectedSupplier === supplier && styles.supplierItemTextSelected]}>
                    {supplier}
                  </Text>
                  {selectedSupplier === supplier && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchSectionCompact: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    paddingVertical: 0,
    borderRadius: 6,
    fontSize: 16,
    height: 48,
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 20,
    color: '#000',
    backgroundColor: '#fff',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    minWidth: 70,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsSection: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  resultCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
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
    flex: 1,
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
  templateTypeSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  templateTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  templateTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  templateTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  templateTypeButtonDisabled: {
    opacity: 0.5,
  },
  templateTypeButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  templateTypeButtonTextActive: {
    color: '#fff',
  },
  supplierSection: {
    marginBottom: 16,
  },
  supplierSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  supplierText: {
    fontSize: 14,
    color: '#333',
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
    paddingVertical: 10,
    borderRadius: 6,
    fontSize: 14,
    width: 100,
    height: 40,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    fontSize: 32,
    color: '#999',
    lineHeight: 32,
  },
  supplierList: {
    padding: 20,
  },
  supplierItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
  },
  supplierItemSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  supplierItemText: {
    fontSize: 16,
    color: '#333',
  },
  supplierItemTextActive: {
    fontWeight: '600',
  },
  supplierItemTextSelected: {
    color: '#2196f3',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#2196f3',
    fontWeight: 'bold',
  },
  // 打印设置弹窗样式
  printModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    height: '85%',
  },
  printModalBody: {
    padding: 20,
    flex: 1,
  },
  printModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  productInfo: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  productInfoName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  productInfoDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  skuBarcodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  skuBarcodeText: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  quantityControlsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityButtonSmall: {
    backgroundColor: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonTextSmall: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  copiesInputSmall: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 4,
    fontSize: 14,
    width: 50,
    height: 28,
    textAlignVertical: 'center',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 18,
    backgroundColor: '#fff',
    color: '#000',
  },
});

