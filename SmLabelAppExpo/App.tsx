import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ReceiptPrintScreen from './src/screens/ReceiptPrintScreen';
import ProductLabelScreen from './src/screens/ProductLabelScreen';
import PrinterSettingsScreen from './src/screens/PrinterSettingsScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  ReceiptPrint: undefined;
  ProductLabel: undefined;
  PrinterSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{
            contentStyle: { backgroundColor: '#f5f5f5' },
            headerStyle: { backgroundColor: '#fff' },
            headerTitleStyle: { color: '#333' },
            headerTintColor: '#007AFF',
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: '登录' }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
          <Stack.Screen name="ReceiptPrint" component={ReceiptPrintScreen} options={{ title: '收货单打印' }} />
          <Stack.Screen name="ProductLabel" component={ProductLabelScreen} options={{ title: '商品标签打印' }} />
          <Stack.Screen name="PrinterSettings" component={PrinterSettingsScreen} options={{ title: '打印机设置' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
