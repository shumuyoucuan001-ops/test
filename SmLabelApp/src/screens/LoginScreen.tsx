import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
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
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20 }}>
      <Text style={{ fontSize: 20, marginBottom: 16 }}>登录到术木优选</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="用户名"
        autoCapitalize="none"
        style={{ width:'100%', borderWidth:1, borderColor:'#ccc', marginBottom:12, padding:10, borderRadius:6 }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="密码"
        secureTextEntry
        style={{ width:'100%', borderWidth:1, borderColor:'#ccc', marginBottom:12, padding:10, borderRadius:6 }}
      />
      <Button title={loading ? '登录中...' : '登录'} onPress={onSubmit} disabled={loading} />
    </View>
  );
}


