import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { aclApi } from '../api';

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    try {
      if (!username || !password) return Alert.alert('提示', '请输入用户名和密码');
      setLoading(true);
      console.log('[LoginScreen] 开始登录:', username);
      console.log('[LoginScreen] API URL:', 'http://192.168.0.109:4000/acl/login');
      
      // 获取设备信息
      const deviceInfo = `Android-${new Date().getTime()}`;
      
      const u = await aclApi.login(username, password, deviceInfo);
      // 不记录完整的用户信息，避免暴露 token 等敏感信息
      console.log('[LoginScreen] 登录成功，用户ID:', u.id);
      await AsyncStorage.setItem('userId', String(u.id));
      await AsyncStorage.setItem('displayName', u.display_name || '');
      await AsyncStorage.setItem('sessionToken', u.token || '');
      Alert.alert('成功', '登录成功');
      navigation.replace('Home');
    } catch (e: any) {
      // 不记录完整的错误对象，避免暴露敏感信息
      console.error('[LoginScreen] 登录错误:', e?.message || '登录失败');
      const errorMsg = e?.response?.data?.message || e?.message || '登录失败';
      console.error('[LoginScreen] 错误消息:', errorMsg);
      const msg = e?.response?.data?.message || e?.message || '登录失败';
      Alert.alert('错误', `network error\n详细: ${msg}\n请检查网络连接`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>登录到术木优选</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="用户名"
        placeholderTextColor="#999"
        autoCapitalize="none"
        style={styles.input}
        multiline={false}
        scrollEnabled={false}
        textAlignVertical="center"
        autoCorrect={false}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="密码"
        placeholderTextColor="#999"
        secureTextEntry
        style={styles.input}
        multiline={false}
        scrollEnabled={false}
        textAlignVertical="center"
        autoCorrect={false}
        textContentType="password"
      />
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={onSubmit} 
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? '登录中...' : '登录'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
    paddingHorizontal: 15,
    paddingVertical: 0,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    height: 52,
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 20,
    color: '#000',
  },
  button: {
    width: '100%',
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
