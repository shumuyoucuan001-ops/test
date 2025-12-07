import React, { useEffect, useState } from 'react';
import { Alert, FlatList, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CtplPrinter, { PrinterDevice } from '../services/CtplPrinter';
import PrinterSettings, { PrinterSettings as PrinterSettingsType } from '../services/PrinterSettings';

interface DeviceItem {
  name?: string;
  address?: string;
}

export default function PrinterSettingsScreen() {
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [connected, setConnected] = useState<PrinterDevice | null>(null);
  const [currentPrinterSettings, setCurrentPrinterSettings] = useState<PrinterSettingsType>(
    PrinterSettings.getCurrentSettings()
  );
  // 仅展示系统已配对设备，不再提供扫描附近设备

  // 请求蓝牙权限
  const requestBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const apiLevel = Platform.Version;
      
      if (apiLevel >= 31) {
        // Android 12+ 需要 BLUETOOTH_CONNECT 和 BLUETOOTH_SCAN 权限
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);
        
        return (
          granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 11 及以下需要位置权限
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '位置权限',
            message: '需要位置权限以扫描蓝牙设备',
            buttonPositive: '确定',
            buttonNegative: '取消',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.error('[PrinterSettings] 请求权限失败:', err);
      return false;
    }
  };

  const load = async () => {
    try {
      // 先请求权限
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        Alert.alert('权限不足', '需要蓝牙权限才能查看设备列表');
        return;
      }

      const list = await CtplPrinter.scanDevices();
      setDevices(list);
      const connectedDevice = await CtplPrinter.getConnectedPrinter();
      setConnected(connectedDevice);
      
      // 加载打印机设置
      await PrinterSettings.loadSettings();
      setCurrentPrinterSettings(PrinterSettings.getCurrentSettings());
    } catch (error) {
      console.error('[PrinterSettings] 加载失败:', error);
      Alert.alert('错误', '加载设备列表失败');
    }
  };

  const connect = async (d: PrinterDevice) => {
    try {
      await CtplPrinter.connect(d.address);
      const connectedDevice = await CtplPrinter.getConnectedPrinter();
      setConnected(connectedDevice);
      
      // 保存上次连接的打印机信息
      await PrinterSettings.saveLastConnectedPrinter(d.address, d.name);
      
      Alert.alert('成功', `已连接: ${d.name || d.address}`);
    } catch (error) {
      console.error('[PrinterSettings] 连接失败:', error);
      Alert.alert('失败', '连接打印机失败');
    }
  };

  // 扫描入口已移除，统一由系统蓝牙完成配对

  const disconnect = async () => {
    try {
      await CtplPrinter.disconnect();
      setConnected(null);
      console.log('[PrinterSettings] 断开连接成功');
    } catch (error) {
      console.error('[PrinterSettings] 断开连接失败:', error);
      // 即使断开失败，也清除连接状态
      setConnected(null);
    }
  };

  // 删除打印机类型选择功能

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
      {/* 打印机类型设置已删除 */}
      
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



