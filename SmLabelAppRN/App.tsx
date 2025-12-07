import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import PrinterSettingsScreen from './src/screens/PrinterSettingsScreen';
import ProductLabelScreen from './src/screens/ProductLabelScreen';
import ReceiptPrintScreen from './src/screens/ReceiptPrintScreen';
import { versionUpdateService } from './src/services/VersionUpdateService';

const Stack = createNativeStackNavigator();

// 当前应用版本号（需要与build.gradle中的versionName保持一致）
const APP_VERSION = '25.10.03.05';

function App(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<'Login' | 'Home'>('Login');

  useEffect(() => {
    // 初始化应用
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 1. 先检查版本更新（强制更新时阻止进入应用）
      // silent=true: 如果是最新版本不提示，如果不是最新版本会弹出强制更新对话框
      const needsUpdate = await versionUpdateService.checkForUpdateAndBlock(APP_VERSION);
      
      if (needsUpdate) {
        // 需要更新，保持在加载状态，等待用户下载更新
        // 不设置 isLoading=false，阻止进入应用
        return;
      }

      // 2. 检查是否已登录
      const userId = await AsyncStorage.getItem('userId');
      const token = await AsyncStorage.getItem('sessionToken');
      
      if (userId && token) {
        // 已登录,直接进入主页
        setInitialRoute('Home');
      } else {
        // 未登录,显示登录页
        setInitialRoute('Login');
      }
    } catch (error) {
      console.error('初始化应用失败:', error);
      setInitialRoute('Login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    // 显示加载中
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ title: '登录' }}
        />
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: '主页' }}
        />
        <Stack.Screen 
          name="ProductLabel" 
          component={ProductLabelScreen} 
          options={{ title: '商品标签打印' }}
        />
        <Stack.Screen 
          name="ReceiptPrint" 
          component={ReceiptPrintScreen} 
          options={{ title: '收货单打印' }}
        />
        <Stack.Screen 
          name="PrinterSettings" 
          component={PrinterSettingsScreen} 
          options={{ title: '打印机设置' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
