import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { aclApi } from '../api';

/**
 * Token验证服务
 * 实现单点登录：定期验证token是否有效，如果在其他设备登录，会自动退出当前设备
 */
class TokenValidationService {
  private intervalId: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;
  private onLogout: (() => void) | null = null;

  /**
   * 开始心跳检查
   * @param onLogoutCallback 登出回调函数
   * @param intervalMs 检查间隔（毫秒），默认30秒
   */
  start(onLogoutCallback: () => void, intervalMs: number = 30000) {
    // 如果已经在运行，先停止
    this.stop();

    this.onLogout = onLogoutCallback;

    // 立即执行一次检查
    this.checkToken();

    // 设置定时检查
    this.intervalId = setInterval(() => {
      this.checkToken();
    }, intervalMs);

    console.log('[TokenValidation] 心跳检查已启动，间隔:', intervalMs, 'ms');
  }

  /**
   * 停止心跳检查
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[TokenValidation] 心跳检查已停止');
    }
  }

  /**
   * 检查token是否有效
   */
  private async checkToken() {
    // 防止并发检查
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;

    try {
      const userId = await AsyncStorage.getItem('userId');
      const token = await AsyncStorage.getItem('sessionToken');

      if (!userId || !token) {
        console.log('[TokenValidation] 未找到userId或token，跳过检查');
        this.isChecking = false;
        return;
      }

      // 调用后端验证token
      const isValid = await aclApi.validateToken(Number(userId), token);

      if (!isValid) {
        // Token失效，说明在其他设备登录了
        console.log('[TokenValidation] Token已失效，准备退出登录');
        
        // 清除本地存储
        await AsyncStorage.multiRemove(['userId', 'displayName', 'sessionToken']);
        
        // 停止心跳检查
        this.stop();
        
        // 显示提示
        Alert.alert(
          '账号已在其他设备登录',
          '您的账号已在其他设备登录，当前设备已退出',
          [
            {
              text: '确定',
              onPress: () => {
                // 调用登出回调
                if (this.onLogout) {
                  this.onLogout();
                }
              },
            },
          ],
          { cancelable: false }
        );
      } else {
        console.log('[TokenValidation] Token验证通过');
      }
    } catch (error) {
      console.error('[TokenValidation] Token验证失败:', error);
      // 网络错误等情况不自动登出，等待下次检查
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 手动触发一次检查
   */
  async manualCheck(): Promise<boolean> {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const token = await AsyncStorage.getItem('sessionToken');

      if (!userId || !token) {
        return false;
      }

      const isValid = await aclApi.validateToken(Number(userId), token);
      return isValid;
    } catch (error) {
      console.error('[TokenValidation] 手动检查失败:', error);
      return true; // 网络错误时返回true，避免误判
    }
  }
}

export const tokenValidationService = new TokenValidationService();

