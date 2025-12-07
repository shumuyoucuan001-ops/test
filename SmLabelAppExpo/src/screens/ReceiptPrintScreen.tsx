import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { receiptApi, labelDataApi, templateApi, ReceiptItem, LabelTemplate } from '../api';
import PrintService from '../services/PrintService';
import TsplBuilder from '../services/TsplBuilder';
import PrinterSettings from '../services/PrinterSettings';
import BluetoothPrinter from '../services/BluetoothPrinter';

const API_BASE_URL = 'http://192.168.0.117:3000';
import { renderDefaultHtmlToTspl } from '../services/TemplateHtmlToTspl';

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
  }, []);

  // 处理返回按钮逻辑
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
      if (!searchKeyword.trim()) {
        setFilteredReceiptNumbers(receiptNumbers.slice(0, 10));
      } else {
        // 使用后端API搜索，支持物流信息搜索
        const searchResults = await receiptApi.searchReceiptNumbers(searchKeyword);
        setFilteredReceiptNumbers(searchResults.slice(0, 10));
      }
    } catch (error) {
      console.error('搜索收货单号失败:', error);
      // 回退到本地搜索
      const filtered = receiptNumbers.filter(number => 
        number.toLowerCase().includes(searchKeyword.toLowerCase())
      ).slice(0, 10);
      setFilteredReceiptNumbers(filtered);
    }
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
    setLoading(true);
    try {
      const receiptItems = await receiptApi.getByReceiptNumber(receiptNumber);
      setItems(receiptItems);
      // 异步计算每个条目的模板名用于展示
      computeItemTemplateNames(receiptItems).catch(() => {});
      setSelectedItems(new Set());
      setShowReceiptList(false);
      if (receiptItems.length === 0) {
        Alert.alert('提示', '未找到该收货单的商品');
      }
    } catch (error: any) {
      Alert.alert('错误', error?.response?.data?.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // 计算条目的模板名（默认/合格证）
  const computeItemTemplateNames = async (list: ReceiptItem[]) => {
    const map = new Map<number, string>();
    for (const it of list) {
      let useCert = false;
      const supplierName = it.supplierName || '';
      if (supplierName) {
        try {
          const rec = await labelDataApi.bySkuAndSupplier(it.skuCode, supplierName);
          if (rec?.labelRaw?.['厂家名称']) useCert = true;
        } catch (_) {}
      }
      map.set(it.id, useCert ? '合格证标签' : '默认标签模板');
    }
    setItemTemplateNames(map);
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

  const handleTestCpcl = async () => {
    setLoading(true);
    try {
      // 检查打印机设置
      await PrinterSettings.loadSettings();
      const currentPrinterSettings = PrinterSettings.getCurrentSettings();
      console.log('[ReceiptPrint] Current printer settings:', currentPrinterSettings);
      
      // 测试调用CPCL端点
      const response = await fetch('http://127.0.0.1:3000/templates/test-cpcl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testText: '收货单便携打印机测试' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('[ReceiptPrint] Test CPCL response:', result);
      console.log('[ReceiptPrint] Response type:', typeof result.rendered);
      console.log('[ReceiptPrint] Response preview:', result.rendered?.substring(0, 100));
      
      if (result.rendered) {
        console.log('[ReceiptPrint] Sending test CPCL to printer...');
        const success = await PrintService.printTsplRaw(result.rendered);
        if (success) {
          Alert.alert('成功', 'CPCL测试指令已发送到打印机');
        } else {
          Alert.alert('错误', '打印机连接失败');
        }
      } else {
        Alert.alert('错误', '测试端点返回空结果');
      }
    } catch (error: any) {
      console.error('[ReceiptPrint] Test CPCL failed:', error);
      Alert.alert('错误', `CPCL测试失败: ${error?.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectCpclTest = async () => {
    setLoading(true);
    try {
      // 直接创建CPCL指令，绕过所有后端和App端逻辑
      const directCpcl = `! 0 203 203 240 1\r
PAGE-WIDTH 320\r
LABEL\r
GAP-SENSE\r
SPEED 2\r
TONE 0\r
JOURNAL\r
TEXT 4 0 0 0 Direct CPCL Test\r
TEXT 4 0 0 30 Bypass All Logic\r
FORM\r
PRINT\r
`;

      console.log('[ReceiptPrint] Direct CPCL test:', directCpcl);
      
      // 直接发送到蓝牙打印机，绕过PrintService的所有检查
      const BluetoothPrinterDirect = (await import('../services/BluetoothPrinter')).default;
      if (!BluetoothPrinterDirect.getConnectedDevice()) {
        const devices = await BluetoothPrinterDirect.getPairedDevices();
        if (devices.length > 0) {
          await BluetoothPrinterDirect.connect(devices[0].address!);
        }
      }
      
      // 直接发送原始CPCL字符串
      const success = await BluetoothPrinterDirect.writeRaw(directCpcl);
      
      if (success) {
        Alert.alert('成功', '直接CPCL指令已发送');
      } else {
        Alert.alert('错误', '蓝牙发送失败');
      }
    } catch (error: any) {
      console.error('[ReceiptPrint] Direct CPCL failed:', error);
      Alert.alert('错误', `直接CPCL失败: ${error?.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSettings = async () => {
    try {
      // 检查设置加载前后的状态
      console.log('[ReceiptPrint] Settings before load:', PrinterSettings.getCurrentSettings());
      
      await PrinterSettings.loadSettings();
      const currentSettings = PrinterSettings.getCurrentSettings();
      
      console.log('[ReceiptPrint] Settings after load:', currentSettings);
      
      // 检查AsyncStorage中的原始数据
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const rawStored = await AsyncStorage.getItem('@printer_settings');
      console.log('[ReceiptPrint] Raw stored data:', rawStored);
      
      Alert.alert(
        '当前打印机设置',
        `类型: ${currentSettings.type}\n名称: ${currentSettings.name}\n描述: ${currentSettings.description}\n\n原始存储: ${rawStored || '无'}`
      );
    } catch (error: any) {
      console.error('[ReceiptPrint] Check settings failed:', error);
      Alert.alert('错误', `检查设置失败: ${error?.message || '未知错误'}`);
    }
  };


  const printSelectedLabels = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('提示', '请选择要打印的商品');
      return;
    }

    if (!selectedTemplate) {
      Alert.alert('提示', '请选择标签模板');
      return;
    }

    setLoading(true);
    try {
      // 检查蓝牙连接状态
      const BluetoothPrinter = (await import('../services/BluetoothPrinter')).default;
      if (BluetoothPrinter.isSupported()) {
        const connectedDevice = BluetoothPrinter.getConnectedDevice();
        if (!connectedDevice) {
          // 尝试自动连接到第一个已配对设备
          const devices = await BluetoothPrinter.getPairedDevices();
          if (devices.length > 0) {
            const success = await BluetoothPrinter.connect(devices[0].address!);
            if (!success) {
              throw new Error(`无法连接到蓝牙打印机 ${devices[0].name || devices[0].address}`);
            }
          } else {
            throw new Error('未找到已配对的蓝牙打印机，请先在系统设置中配对打印机');
          }
        }
      }

      const selectedItemsList = items.filter(item => selectedItems.has(item.id));
      const totalLabels = Array.from(selectedItems).reduce((total, itemId) => {
        return total + (printQuantities.get(itemId) || 1);
      }, 0);

      // 获取当前打印机设置
      await PrinterSettings.loadSettings();
      const currentPrinterSettings = PrinterSettings.getCurrentSettings();
      
      let lastPrintData = ''; // 用于显示最后一个商品的打印数据

      // 准备打印任务（每个商品一个任务，包含数量信息）
      const printJobs = [];
      for (const item of selectedItemsList) {
        const quantity = printQuantities.get(item.id) || 1;
        printJobs.push({
          item,
          quantity
        });
      }
      
      console.log(`[ReceiptPrint] 准备打印 ${printJobs.length} 个商品，总计 ${totalLabels} 张标签`);
      
      // 获取蓝牙打印机连接
      const BluetoothPrinterService = (await import('../services/BluetoothPrinter')).default;
      if (!BluetoothPrinterService.getConnectedDevice()) {
        const devices = await BluetoothPrinterService.getPairedDevices();
        if (devices.length > 0) {
          await BluetoothPrinterService.connect(devices[0].address!);
        }
      }
      
      // 便携打印机和桌面打印机都使用逐个打印，但便携打印机间隔更短
      const isPortable = currentPrinterSettings.type === 'portable';
      const printDelay = isPortable ? 50 : 200; // 便携打印机间隔50ms，桌面打印机200ms
      
      console.log(`[ReceiptPrint] 使用${isPortable ? '便携' : '桌面'}打印机逐个打印，间隔${printDelay}ms`);
      
      for (let jobIndex = 0; jobIndex < printJobs.length; jobIndex++) {
        const job = printJobs[jobIndex];
        const item = job.item;
        const quantity = job.quantity;
        
        console.log(`[ReceiptPrint] 处理任务 ${jobIndex + 1}/${printJobs.length}: ${item.productName} (${quantity}份)`);

        // 取默认模板（后台 HTML → 位图 → TSPL/CPCL）
        const defaultTpl = await templateApi.getDefault();
        const rawCode = String(item.productCode || '');
        const barcodeTail = computeBarcodeTail(rawCode);
        const payload: any = {
          spec: item.spec,
          qrDataUrl: item.skuCode,
          barcodeTail,
          skuCode: item.skuCode,
          productCode: item.productCode,
          productName: item.productName,
          renderAsBitmap: true, // 所有打印机都使用位图渲染
          printerType: currentPrinterSettings.type,
          // 便携打印机传递份数给后端，桌面打印机由App端处理
          copies: isPortable ? quantity : 1,
        };

        let printData = '';
        try {
          const rendered = await templateApi.render(defaultTpl.id, payload);
          printData = rendered.rendered;
        } catch (error) {
          console.error('[ReceiptPrint] Template render failed for job', jobIndex + 1, ':', error);
          
          // 回退：简单本地模板
          if (isPortable) {
            // 便携打印机：使用简单的CPCL指令，包含份数
            printData = `! 0 203 203 240 ${quantity}\r
PAGE-WIDTH 320\r
LABEL\r
GAP-SENSE\r
SPEED 2\r
TONE 0\r
JOURNAL\r
TEXT 4 0 0 0 ${item.productName || 'Product'}\r
TEXT 4 0 0 30 ${item.spec || 'Spec'}\r
TEXT 4 0 0 60 SKU: ${item.skuCode || 'N/A'}\r
FORM\r
PRINT\r
`;
          } else {
            // 桌面打印机使用TSPL fallback
            printData = TsplBuilder.buildBackendDefault({
              productName: item.productName,
              spec: item.spec,
              skuCode: item.skuCode,
              productCode: item.productCode,
            } as any, quantity); // 传递打印份数
          }
        }

        // 发送打印数据
        const isCpclData = /^!\s*\d+|\bPAGE-WIDTH\b|\bEG\s+\d+|\bFORM\b|\bLABEL\b/i.test(printData);
        
        if (isCpclData && isPortable) {
          // 便携打印机：直接发送CPCL数据（已包含份数信息）
          const success = await BluetoothPrinterService.writeRaw(printData);
          if (!success) {
            throw new Error(`商品 ${item.productName} 打印失败，请检查打印机连接状态`);
          }
        } else {
          // 桌面打印机：发送多次TSPL指令实现多份打印
          console.log(`[ReceiptPrint] 桌面打印机发送 ${quantity} 次TSPL指令`);
          for (let copy = 1; copy <= quantity; copy++) {
            console.log(`[ReceiptPrint] 发送第 ${copy}/${quantity} 份`);
            const success = await PrintService.printTsplRaw(printData);
            if (!success) {
              throw new Error(`商品 ${item.productName} 第${copy}份打印失败，请检查打印机连接状态`);
            }
            // 桌面打印机连续打印时无需延迟，让打印机自己处理队列
          }
        }
        
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
          <Text style={styles.itemCode}>SKU: {item.skuCode}</Text>
          <Text style={styles.itemCode} numberOfLines={1} ellipsizeMode="tail">条码: {item.productCode}</Text>
          <View style={styles.itemCodeRow}>
            <Text style={styles.itemCode}>核对条码尾号: {computeBarcodeTail(item.productCode)}</Text>
            <Text style={styles.itemQuantity}>采购数量: {item.quantity} {item.unit}</Text>
          </View>
        </TouchableOpacity>
        
        {isSelected && (
          <View style={styles.quantitySection}>
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
            <Text style={styles.sectionTitle}>收货单查询</Text>
            <TextInput
              style={styles.input}
              placeholder="搜索收货单号"
              value={searchKeyword}
              onChangeText={setSearchKeyword}
            />
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
          <FlatList
            data={items}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderReceiptItem}
            style={styles.expandedItemsList}
            showsVerticalScrollIndicator={false}
          />

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
    paddingVertical: 6,
    marginHorizontal: 8,
    minWidth: 40,
    height: 32,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 14,
    backgroundColor: '#fff',
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
