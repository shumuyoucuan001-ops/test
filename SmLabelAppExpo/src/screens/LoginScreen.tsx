import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aclApi } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
      const u = await aclApi.login(username, password);
      await AsyncStorage.setItem('userId', String(u.id));
      await AsyncStorage.setItem('displayName', u.display_name || '');
      await AsyncStorage.setItem('sessionToken', u.token || '');
      Alert.alert('成功', '登录成功');
      navigation.replace('Home');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '登录失败';
      Alert.alert('错误', msg);
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
        autoCapitalize="none"
        style={styles.input}
        multiline={false}
        scrollEnabled={false}
        textAlignVertical="center"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="密码"
        secureTextEntry
        style={styles.input}
        multiline={false}
        scrollEnabled={false}
        textAlignVertical="center"
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
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    height: 50,
    textAlignVertical: 'center',
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
