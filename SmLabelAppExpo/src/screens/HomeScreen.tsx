import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  ReceiptPrint: undefined;
  ProductLabel: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      const displayName = (await AsyncStorage.getItem('displayName')) || '';
      setName(displayName);
    })();
  }, []);

  const logout = async () => {
    await AsyncStorage.multiRemove(['userId', 'displayName', 'sessionToken']);
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.welcome}>欢迎 {name}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>标签打印系统</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => navigation.navigate('PrinterSettings' as any)}
          >
            <Text style={styles.menuIcon}>🖨️</Text>
            <Text style={styles.menuTitle}>打印机设置</Text>
            <Text style={styles.menuDesc}>连接/断开蓝牙打印机</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => navigation.navigate('ReceiptPrint')}
          >
            <Text style={styles.menuIcon}>📦</Text>
            <Text style={styles.menuTitle}>收货单打印</Text>
            <Text style={styles.menuDesc}>查询收货单并批量打印标签</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => navigation.navigate('ProductLabel')}
          >
            <Text style={styles.menuIcon}>🏷️</Text>
            <Text style={styles.menuTitle}>商品标签打印</Text>
            <Text style={styles.menuDesc}>搜索商品并打印标签</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  welcome: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#eee',
    borderRadius: 6,
  },
  logoutText: {
    color: '#333',
    fontSize: 14,
  },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 12, textAlign: 'center' },
  menuContainer: {
    flex: 1,
  },
  menuButton: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 10, alignItems: 'center', elevation: 2 },
  menuIcon: { fontSize: 28, marginBottom: 8 },
  menuTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  menuDesc: { fontSize: 12, color: '#666', textAlign: 'center' },
});
