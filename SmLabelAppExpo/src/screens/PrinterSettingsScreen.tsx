import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BluetoothPrinter from '../services/BluetoothPrinter';
import PrinterSettings, { PrinterSettings as PrinterSettingsType, PrinterType } from '../services/PrinterSettings';

interface DeviceItem {
  name?: string;
  address?: string;
}

export default function PrinterSettingsScreen() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [connected, setConnected] = useState(BluetoothPrinter.getConnectedDevice());
  const [currentPrinterSettings, setCurrentPrinterSettings] = useState<PrinterSettingsType>(
    PrinterSettings.getCurrentSettings()
  );
  // 仅展示系统已配对设备，不再提供扫描附近设备

  const load = async () => {
    const list = await BluetoothPrinter.getPairedDevices();
    setDevices(list);
    setConnected(await BluetoothPrinter.syncFromSystem());
    
    // 加载打印机设置
    await PrinterSettings.loadSettings();
    setCurrentPrinterSettings(PrinterSettings.getCurrentSettings());
  };

  const connect = async (d: DeviceItem) => {
    const ok = await BluetoothPrinter.connect(String(d.address));
    if (ok) {
      setConnected(BluetoothPrinter.getConnectedDevice());
      Alert.alert('成功', `已连接: ${d.name || d.address}`);
    } else {
      Alert.alert('失败', '连接打印机失败');
    }
  };

  // 扫描入口已移除，统一由系统蓝牙完成配对

  const disconnect = async () => {
    await BluetoothPrinter.disconnect();
    setConnected(null);
  };

  const handlePrinterTypeChange = async (type: PrinterType) => {
    await PrinterSettings.setPrinterType(type);
    setCurrentPrinterSettings(PrinterSettings.getCurrentSettings());
    Alert.alert('设置已保存', `已切换到${type === 'desktop' ? '桌面打印机' : '便携打印机'}模式`);
  };

  useEffect(() => {
    load();
  }, []);

  const renderItem = ({ item }: { item: DeviceItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => connect(item)}>
      <Text style={styles.name}>{item.name || '未知设备'}</Text>
      <Text style={styles.addr}>{item.address}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>打印机设置</Text>
      <View style={styles.row}>
        <Text style={styles.subtitle}>当前连接:</Text>
        <Text style={styles.current}>{connected?.name || connected?.address || '未连接'}</Text>
        {connected && (
          <TouchableOpacity style={styles.btn} onPress={disconnect}><Text style={styles.btnText}>断开</Text></TouchableOpacity>
        )}
      </View>
      {/* 打印机类型设置 */}
      <View style={styles.rowSpace} />
      <Text style={styles.subtitle}>打印机类型</Text>
      <View style={styles.printerTypeSection}>
        <View style={styles.currentTypeCard}>
          <Text style={styles.currentTypeName}>{currentPrinterSettings.name}</Text>
          <Text style={styles.currentTypeDesc}>{currentPrinterSettings.description}</Text>
        </View>
        
        <View style={styles.typeOptions}>
          {PrinterSettings.getAvailableTypes().map((printerType) => (
            <TouchableOpacity
              key={printerType.type}
              style={[
                styles.typeOption,
                currentPrinterSettings.type === printerType.type && styles.typeOptionSelected
              ]}
              onPress={() => handlePrinterTypeChange(printerType.type)}
            >
              <View style={styles.typeInfo}>
                <Text style={[
                  styles.typeName,
                  currentPrinterSettings.type === printerType.type && styles.typeNameSelected
                ]}>
                  {printerType.name}
                </Text>
                <Text style={[
                  styles.typeDesc,
                  currentPrinterSettings.type === printerType.type && styles.typeDescSelected
                ]}>
                  {printerType.description}
                </Text>
              </View>
              {currentPrinterSettings.type === printerType.type && (
                <Text style={styles.selectedIndicator}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.rowSpace} />
      <Text style={styles.subtitle}>已配对设备</Text>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        data={devices}
        keyExtractor={(d) => String(d.address)}
        renderItem={renderItem}
      />
      <View style={[styles.fabBox, { bottom: 12 }] }>
        <TouchableOpacity style={[styles.btn, styles.fab]} onPress={load} activeOpacity={0.8}><Text style={styles.btnText}>刷新</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingTop: 8 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  subtitle: { fontSize: 16, color: '#333', marginRight: 8 },
  current: { fontSize: 14, color: '#666', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowSpace: { height: 12 },
  card: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600', color: '#333' },
  addr: { fontSize: 12, color: '#666', marginTop: 4 },
  btn: { backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  btnText: { color: '#fff', fontSize: 14 },
  fabBox: { position: 'absolute', right: 12, flexDirection: 'row' },
  fab: { backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22 },
  unpairedBox: { marginTop: 12 },
  input: { },
  printerTypeSection: {
    marginVertical: 8,
  },
  currentTypeCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 12,
  },
  currentTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  currentTypeDesc: {
    fontSize: 12,
    color: '#666',
  },
  typeOptions: {
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  typeOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  typeNameSelected: {
    color: '#007AFF',
  },
  typeDesc: {
    fontSize: 11,
    color: '#666',
  },
  typeDescSelected: {
    color: '#007AFF',
  },
  selectedIndicator: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
});



