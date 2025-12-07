import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.API_BASE_URL || 'http://10.0.2.2:3000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const userId = await AsyncStorage.getItem('userId');
  const token = await AsyncStorage.getItem('sessionToken');
  if (userId) {
    (config.headers as any)['x-user-id'] = userId;
  }
  if (token) {
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export interface LoginResp { id: number; username: string; display_name?: string; token: string }

export const aclApi = {
  login: async (username: string, password: string): Promise<LoginResp> => {
    const res = await api.post('/acl/login', { username, password });
    return res.data;
  },
};

export default api;


