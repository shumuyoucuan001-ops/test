import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LabelDataAudit, LabelTemplate, ReceiptItem, labelDataAuditApi, receiptApi, templateApi } from '../api';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import CtplPrinter from '../services/CtplPrinter';
import PrinterSettings from '../services/PrinterSettings';

// 移除未使用的硬编码API地址，使用api.ts中的配置

export default function ReceiptPrintScreen() {
  const navigation = useNavigation();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [receiptNumbers, setReceiptNumbers] = useState<string[]>([]);
  const [filteredReceiptNumbers, setFilteredReceiptNumbers] = useState<string[]>([]);
  const [selectedReceiptNumber, setSelectedReceiptNumber] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [printQuantities, setPrintQuantities] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null);
  const [showReceiptList, setShowReceiptList] = useState(true);
  const [itemTemplateNames, setItemTemplateNames] = useState<Map<number, string>>(new Map());
  const [itemAuditData, setItemAuditData] = useState<Map<number, LabelDataAudit | null>>(new Map());
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  
  // 用于循环五种测试图案
  

  const computeBarcodeTail = (code?: string): string => {
    const raw = String(code || '');
    if (raw.includes(',')) {
      // 多个条码时，取第一个条码的后8位数字
      const firstBarcode = raw.split(',')[0].trim();
      const digits = firstBarcode.replace(/\D/g, '');
      return digits.slice(-8);
    }
    // 单个条码时，取后8位数字
    return raw.replace(/\D/g, '').slice(-8);
  };

  useEffect(() => {
    loadReceiptNumbers();
    loadTemplates();
    
    // 自动聚焦搜索框
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 500);
  }, []);

  // 处理返回按钮逻辑和搜索框自动聚焦
  useFocusEffect(
    React.useCallback(() => {
      // 动态设置导航栏的返回按钮行为
      if (!showReceiptList) {
        // 在商品明细页面时，设置自定义的返回行为
        navigation.setOptions({
          headerLeft: () => (
            <TouchableOpacity 
              onPress={backToReceiptList}
              style={{ marginLeft: 10, padding: 8 }}
            >
              <Text style={{ color: '#007AFF', fontSize: 28, fontWeight: '300' }}>‹</Text>
            </TouchableOpacity>
          ),
        });
      } else {
        // 在收货单列表页面时，恢复默认的返回行为
        navigation.setOptions({
          headerLeft: undefined,
        });
        
        // 返回到列表页面时,自动聚焦搜索框
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 300);
      }

      const onBackPress = () => {
        if (!showReceiptList) {
          // 如果在商品明细页面，返回到收货单列表
          backToReceiptList();
          return true; // 阻止默认返回行为
        }
        return false; // 允许默认返回行为（返回到主页面）
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [showReceiptList, navigation])
  );

  const loadReceiptNumbers = async () => {
    try {
      const numbers = await receiptApi.getReceiptNumbers();
      setReceiptNumbers(numbers);
      setFilteredReceiptNumbers(numbers);
    } catch (error) {
      console.error('加载收货单号失败:', error);
    }
  };

  const searchReceiptNumbers = async () => {
    try {
      // 去除首尾空格
      const trimmedKeyword = searchKeyword.trim();
      
      if (!trimmedKeyword) {
        setFilteredReceiptNumbers(receiptNumbers.slice(0, 10));
      } else {
        // 使用后端API搜索，支持物流信息搜索
        const searchResults = await receiptApi.searchReceiptNumbers(trimmedKeyword);
        setFilteredReceiptNumbers(searchResults.slice(0, 10));
      }
    } catch (error) {
      console.error('搜索收货单号失败:', error);
      // 回退到本地搜索
      const trimmedKeyword = searchKeyword.trim();
      const filtered = receiptNumbers.filter(number => 
        number.toLowerCase().includes(trimmedKeyword.toLowerCase())
      ).slice(0, 10);
      setFilteredReceiptNumbers(filtered);
    }
  };


  // 相机扫描条码/二维码
  const handleCameraScan = (code: string) => {
    console.log('扫描到条码:', code);
    // 去除首尾空格和多余的空白字符
    const cleanCode = code.trim().replace(/\s+/g, '');
    // 直接设置搜索关键词(覆盖原有内容)
    setSearchKeyword(cleanCode);
    setShowCameraScanner(false);
    // 扫描后自动触发搜索
    // searchReceiptNumbers会通过useEffect自动执行
  };

  useEffect(() => {
    searchReceiptNumbers();
  }, [searchKeyword, receiptNumbers]);

  const loadTemplates = async () => {
    try {
      const templateList = await templateApi.getAll();
      setTemplates(templateList);
      const defaultTemplate = templateList.find(t => t.isDefault) || templateList[0];
      setSelectedTemplate(defaultTemplate);
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  };

  const selectReceiptNumber = async (receiptNumber: string) => {
    setSelectedReceiptNumber(receiptNumber);
    // 立即进入明细页面
    setShowReceiptList(false);
    setLoading(true);
    
    try {
      // 确保模板已加载
      if (templates.length === 0) {
        await loadTemplates();
      }
      
      const receiptItems = await receiptApi.getByReceiptNumber(receiptNumber);
      setItems(receiptItems);
      // 异步计算每个条目的模板名用于展示
      computeItemTemplateNames(receiptItems).catch(() => {});
      setSelectedItems(new Set());
      
      if (receiptItems.length === 0) {
        Alert.alert('提示', '未找到该收货单的商品');
      }
    } catch (error: any) {
      Alert.alert('错误', error?.response?.data?.message || '查询失败');
      // 出错时返回列表页面
      setShowReceiptList(true);
    } finally {
      setLoading(false);
    }
  };

  // 计算条目的模板名（默认/合格证）
  const computeItemTemplateNames = async (list: ReceiptItem[]) => {
    const templateMap = new Map<number, string>();
    const auditMap = new Map<number, LabelDataAudit | null>();
    
    for (const item of list) {
      let useCert = false;
      let auditData: LabelDataAudit | null = null;
      
      const supplierName = item.supplierName || '';
      if (supplierName && item.skuCode) {
        try {
          // 查询label_data_audit表
          // 只要能查询到记录,就使用合格证标签,不再检查manufacturerName
          auditData = await labelDataAuditApi.getBySkuAndSupplier(item.skuCode, supplierName);
          if (auditData) {
            useCert = true;
            console.log(`商品使用合格证标签: SKU=${item.skuCode}, 供应商=${supplierName}`);
          } else {
            console.log(`商品使用默认标签: SKU=${item.skuCode}, 供应商=${supplierName}, 原因=未查询到审核数据`);
          }
        } catch (error) {
          console.log(`查询审核数据失败: SKU=${item.skuCode}, 供应商=${supplierName}`, error);
        }
      }
      
      templateMap.set(item.id, useCert ? '合格证标签' : '默认标签');
      auditMap.set(item.id, auditData);
    }
    
    setItemTemplateNames(templateMap);
    setItemAuditData(auditMap);
  };

  const backToReceiptList = () => {
    setShowReceiptList(true);
    setItems([]);
    setSelectedItems(new Set());
    setSelectedReceiptNumber('');
  };

  const toggleItemSelection = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    const newQuantities = new Map(printQuantities);
    
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      newQuantities.delete(itemId);
    } else {
      newSelected.add(itemId);
      // 使用计划采购数量作为默认打印份数
      const item = items.find(item => item.id === itemId);
      const defaultQuantity = item ? item.quantity : 1;
      newQuantities.set(itemId, defaultQuantity);
    }
    setSelectedItems(newSelected);
    setPrintQuantities(newQuantities);
  };

  const updatePrintQuantity = (itemId: number, quantity: number) => {
    const newQuantities = new Map(printQuantities);
    if (quantity > 0) {
      newQuantities.set(itemId, quantity);
    } else {
      newQuantities.set(itemId, 1);
    }
    setPrintQuantities(newQuantities);
  };

  const selectAllItems = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
      setPrintQuantities(new Map());
    } else {
      const allIds = items.map(item => item.id);
      setSelectedItems(new Set(allIds));
      const newQuantities = new Map();
      // 使用每个商品的计划采购数量作为默认打印份数
      items.forEach(item => {
        newQuantities.set(item.id, item.quantity);
      });
      setPrintQuantities(newQuantities);
    }
  };



  const printSelectedLabels = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('提示', '请选择要打印的商品');
      return;
    }

    // 确保模板已加载
    if (templates.length === 0) {
      console.log('[ReceiptPrint] 加载模板...');
      await loadTemplates();
    }
    console.log('[ReceiptPrint] 当前模板列表:', templates.map(t => ({ id: t.id, name: t.name })));

    if (!selectedTemplate) {
      Alert.alert('提示', '请选择标签模板');
      return;
    }

    setLoading(true);
    try {
      // 使用CTPL官方SDK连接打印机
      console.log('[ReceiptPrint] 检查打印机连接状态...');
      
      // 检查是否已经有连接的打印机
      const connectedPrinter = await CtplPrinter.getConnectedPrinter();
      
      if (connectedPrinter) {
        console.log('[ReceiptPrint] 打印机已连接:', connectedPrinter);
      } else {
        console.log('[ReceiptPrint] 打印机未连接，尝试自动连接...');
        
        // 先尝试连接上次使用的打印机
        await PrinterSettings.loadSettings();
        const lastAddress = PrinterSettings.getLastConnectedAddress();
        const lastName = PrinterSettings.getLastConnectedName();
        
        let connected = false;
        
        if (lastAddress) {
          try {
            console.log('[ReceiptPrint] 尝试连接上次使用的打印机:', lastName || lastAddress);
            await CtplPrinter.connect(lastAddress);
            console.log('[ReceiptPrint] 连接上次打印机成功');
            connected = true;
            
            // 等待连接稳定
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.log('[ReceiptPrint] 连接上次打印机失败:', error);
          }
        }
        
        // 如果连接上次打印机失败，扫描并连接第一个设备
        if (!connected) {
          const devices = await CtplPrinter.scanDevices();
          console.log('[ReceiptPrint] 扫描到设备:', devices);
          
          if (devices.length === 0) {
            throw new Error('未找到已配对的蓝牙打印机，请先在打印机设置中连接打印机');
          }
          
          console.log('[ReceiptPrint] 尝试连接到:', devices[0]);
          await CtplPrinter.connect(devices[0].address);
          console.log('[ReceiptPrint] 打印机连接成功');
          
          // 保存新连接的打印机
          await PrinterSettings.saveLastConnectedPrinter(devices[0].address, devices[0].name);
          
          // 等待连接稳定
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const selectedItemsList = items.filter(item => selectedItems.has(item.id));
      const totalLabels = Array.from(selectedItems).reduce((total, itemId) => {
        return total + (printQuantities.get(itemId) || 1);
      }, 0);

      // 准备打印任务（每个商品一个任务，包含数量信息）
      const printJobs = [];
      for (const item of selectedItemsList) {
        const quantity = printQuantities.get(item.id) || 1;
        printJobs.push({
          item,
          quantity
        });
      }
      
      console.log(`[ReceiptPrint] 准备打印 ${printJobs.length} 个商品，总计 ${totalLabels} 张标签`)
      
      // 统一使用模板渲染打印
      const printDelay = 200; // 打印间隔200ms
      
      console.log(`[ReceiptPrint] 开始逐个打印，间隔${printDelay}ms`);
      
      for (let jobIndex = 0; jobIndex < printJobs.length; jobIndex++) {
        const job = printJobs[jobIndex];
        const item = job.item;
        const quantity = job.quantity;
        
        console.log(`[ReceiptPrint] 处理任务 ${jobIndex + 1}/${printJobs.length}: ${item.productName} (${quantity}份)`);

        // 根据模板类型选择模板和数据
        const templateName = itemTemplateNames.get(item.id) || '默认标签';
        const auditData = itemAuditData.get(item.id);
        
        console.log(`[ReceiptPrint] 商品 ${item.productName} 使用模板: ${templateName}`);
        console.log(`[ReceiptPrint] 审核数据:`, auditData);
        
        // 获取对应的模板
        let template: LabelTemplate;
        let payload: any;
        
        if (templateName === '合格证标签' && auditData) {
          // 使用合格证标签模板
          const certTemplate = templates.find(t => t.name === '合格证标签');
          console.log(`[ReceiptPrint] 查找合格证标签模板:`, certTemplate ? `找到 ID=${certTemplate.id}` : '未找到');
          if (!certTemplate) {
            throw new Error('未找到合格证标签模板');
          }
          template = certTemplate;
          
          // 获取上月年月信息
          const now = new Date();
          const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1);
          const prevMonthStr = `${prevMonth.getFullYear()}.${(prevMonth.getMonth() + 1).toString().padStart(2, '0')}`;
          
          const rawCode = String(item.productCode || '');
          const barcodeTail = computeBarcodeTail(rawCode);
          
          payload = {
            headerInfo: auditData.headerInfo || '',
            productSpec: auditData.productSpec || item.spec || '',
            productName: auditData.productName || item.productName || '',
            factoryName: auditData.manufacturerName || '',
            addressInfo: auditData.addressInfo || '',
            material: auditData.material || '',
            otherInfo: auditData.otherInfo || '',
            executeStandard: auditData.executionStandard || '',
            prevMonth: prevMonthStr,
            qrDataUrl: item.skuCode,
            barcodeTail,
            skuCode: item.skuCode, // 添加SKU字段
            testBitmap: false, // 关闭测试模式，使用真实模板
            printerType: 'portable',
            renderAsBitmap: true, // 强制使用位图渲染
            copies: quantity,
          };
        } else {
          // 使用默认标签模板
          const defaultTemplate = templates.find(t => t.name === '默认标签模板');
          console.log(`[ReceiptPrint] 查找默认标签模板:`, defaultTemplate ? `找到 ID=${defaultTemplate.id}` : '未找到');
          if (!defaultTemplate) {
            console.log('[ReceiptPrint] 从API获取默认模板...');
            template = await templateApi.getDefault();
          } else {
            template = defaultTemplate;
          }
          
          const rawCode = String(item.productCode || '');
          const barcodeTail = computeBarcodeTail(rawCode);
          
          payload = {
            spec: item.spec,
            qrDataUrl: item.skuCode,
            barcodeTail,
            skuCode: item.skuCode,
            productCode: item.productCode,
            productName: item.productName,
            testBitmap: false, // 关闭测试模式，使用真实模板
            printerType: 'portable',
            simpleText: false, // 使用HTML模板渲染
            renderAsBitmap: true, // 启用位图渲染（HTML转TSPL位图）
            copies: quantity,
          };
        }

        let printData = '';
        console.log(`[ReceiptPrint] 调用模板渲染 API: template.id=${template.id}`);
        console.log(`[ReceiptPrint] 渲染参数:`, JSON.stringify(payload, null, 2));
        const rendered = await templateApi.render(template.id, payload);
        printData = rendered.rendered;
        console.log(`[ReceiptPrint] 模板渲染成功，数据长度: ${printData.length}`);
        console.log(`[ReceiptPrint] 渲染结果前100字符:`, printData.substring(0, 100));
        
        // 使用CTPL官方SDK打印
        console.log(`[ReceiptPrint] 使用CTPL SDK打印，数据长度: ${printData.length}`);
        const success = await CtplPrinter.print(printData);
        if (!success) {
          throw new Error(`商品 ${item.productName} 打印失败，请检查打印机连接状态`);
        }
        console.log(`[ReceiptPrint] 打印成功`)
        
        
        // 在任务之间添加小延迟，确保打印机处理完成
        if (jobIndex < printJobs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, printDelay));
        }
      }
      

      Alert.alert('成功', `已成功打印 ${totalLabels} 张标签`);
      setSelectedItems(new Set());
      setPrintQuantities(new Map());
    } catch (error: any) {
      Alert.alert('错误', error?.message || '打印失败');
    } finally {
      setLoading(false);
    }
  };


  const renderReceiptNumber = ({ item }: { item: string }) => {
    return (
      <TouchableOpacity
        style={styles.receiptNumberCard}
        onPress={() => selectReceiptNumber(item)}
      >
        <Text style={styles.receiptNumberText}>{item}</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderReceiptItem = ({ item }: { item: ReceiptItem }) => {
    const isSelected = selectedItems.has(item.id);
    const printQuantity = printQuantities.get(item.id) || 1;
    
    return (
      <View style={[styles.itemCard, isSelected && styles.itemCardSelected]}>
        <TouchableOpacity
          style={styles.itemMainContent}
          onPress={() => toggleItemSelection(item.id)}
        >
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.productName}</Text>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
          <Text style={styles.itemSpec} numberOfLines={1} ellipsizeMode="tail">规格: {item.spec}</Text>
          <View style={styles.itemSkuRow}>
            <Text style={styles.itemCode}>SKU: {item.skuCode}</Text>
            <Text style={[styles.templateLabel, 
              itemTemplateNames.get(item.id) === '合格证标签' ? styles.templateLabelCert : styles.templateLabelDefault
            ]}>
              {itemTemplateNames.get(item.id) || '默认标签'}
            </Text>
          </View>
          <Text style={styles.itemCode} numberOfLines={1} ellipsizeMode="tail">条码: {item.productCode}</Text>
          <View style={styles.itemCodeRow}>
            <Text style={styles.itemCode}>核对条码尾号: {computeBarcodeTail(item.productCode)}</Text>
            <Text style={styles.itemQuantity}>采购数量: {item.quantity} {item.unit}</Text>
          </View>
        </TouchableOpacity>
        
        {isSelected && (
          <View 
            style={styles.quantitySection}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <Text style={styles.quantityLabel}>打印份数:</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updatePrintQuantity(item.id, Math.max(1, printQuantity - 1))}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                value={printQuantity.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 1;
                  updatePrintQuantity(item.id, num);
                }}
                keyboardType="numeric"
                selectTextOnFocus
                blurOnSubmit={false}
                returnKeyType="done"
                placeholderTextColor="#999"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updatePrintQuantity(item.id, printQuantity + 1)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {showReceiptList ? (
        // 收货单列表页面
        <>
          <View style={styles.searchSection}>
            <View style={styles.searchInputRow}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="搜索收货单号或扫码"
                placeholderTextColor="#999"
                value={searchKeyword}
                onChangeText={(text) => {
                  // PDA扫码或手动输入时，去除首尾空格
                  const trimmed = text.trim();
                  setSearchKeyword(trimmed);
                }}
                onSubmitEditing={searchReceiptNumbers}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => setShowCameraScanner(true)}
              >
                <View style={styles.scanIcon}>
                  <View style={styles.scanCornerTL} />
                  <View style={styles.scanCornerTR} />
                  <View style={styles.scanCornerBL} />
                  <View style={styles.scanCornerBR} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>收货单列表 ({filteredReceiptNumbers.length})</Text>
            <FlatList
              data={filteredReceiptNumbers}
              keyExtractor={(item) => item}
              renderItem={renderReceiptNumber}
              style={styles.receiptList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </>
      ) : (
        // 商品明细页面 - 优化布局
        <>
          {/* 收货单号和全选按钮 - 合并到一行 */}
          <View style={styles.compactHeader}>
            <Text style={styles.receiptTitle}>{selectedReceiptNumber}</Text>
            <TouchableOpacity style={styles.compactSelectButton} onPress={selectAllItems}>
              <Text style={styles.compactSelectText}>
                {selectedItems.size === items.length ? '取消全选' : '全选'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 商品列表 - 扩大显示区域 */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>正在加载商品明细...</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderReceiptItem}
              style={styles.expandedItemsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              removeClippedSubviews={false}
            />
          )}

          {/* 底部操作区 - 压缩版 */}
          <View style={styles.compactActionSection}>
            <Text style={styles.compactSelectedCount}>
              已选择: {selectedItems.size}/{items.length}
            </Text>
            <TouchableOpacity
              style={[styles.compactPrintButton, selectedItems.size === 0 && styles.printButtonDisabled]}
              onPress={printSelectedLabels}
              disabled={selectedItems.size === 0 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.compactButtonText}>打印标签</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* 相机扫描弹窗 */}
      <BarcodeScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
      />
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
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  scanButton: {
    width: 48,
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  scanCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#fff',
  },
  scanCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#fff',
  },
  scanCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#fff',
  },
  scanCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#fff',
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
  searchButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllButton: {
    padding: 8,
  },
  selectAllText: {
    color: '#007AFF',
    fontSize: 14,
  },
  itemsList: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  itemMainContent: {
    padding: 12,
    flex: 1,
  },
  itemCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    lineHeight: 18,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemSpec: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    lineHeight: 16,
  },
  itemCode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    lineHeight: 16,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    lineHeight: 16,
  },
  itemCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  itemSkuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  templateLabel: {
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  templateLabelDefault: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
  },
  templateLabelCert: {
    backgroundColor: '#e8f5e8',
    color: '#388e3c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  actionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  selectedCount: {
    fontSize: 14,
    color: '#666',
  },
  printButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  printButtonDisabled: {
    backgroundColor: '#ccc',
  },
  receiptList: {
    flex: 1,
  },
  receiptNumberCard: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptNumberText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  arrow: {
    fontSize: 18,
    color: '#ccc',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  quantitySection: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 0,
    marginHorizontal: 8,
    minWidth: 50,
    height: 36,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
    backgroundColor: '#fff',
    includeFontPadding: false,
    color: '#000',
  },
  // 新增的优化布局样式
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  compactSelectButton: {
    padding: 6,
  },
  compactSelectText: {
    color: '#007AFF',
    fontSize: 14,
  },
  expandedItemsList: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  compactActionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  compactSelectedCount: {
    fontSize: 14,
    color: '#666',
  },
  compactPrintButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  compactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
