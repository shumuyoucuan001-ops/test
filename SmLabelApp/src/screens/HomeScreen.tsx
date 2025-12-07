import React from 'react';
import { View, Text, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const [name, setName] = React.useState('');
  React.useEffect(() => {
    (async () => {
      const n = (await AsyncStorage.getItem('displayName')) || '';
      setName(n);
    })();
  }, []);
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>欢迎 {name || ''}</Text>
      <Text>后续在此进入“商品搜索与打印”</Text>
    </View>
  );
}


