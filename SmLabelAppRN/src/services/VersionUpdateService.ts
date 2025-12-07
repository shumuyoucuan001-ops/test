import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import api from '../api';

interface VersionInfo {
  hasUpdate: boolean;
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  message: string;
}

export class VersionUpdateService {
  private static instance: VersionUpdateService;
  private isChecking = false;

  private constructor() {}

  static getInstance(): VersionUpdateService {
    if (!VersionUpdateService.instance) {
      VersionUpdateService.instance = new VersionUpdateService();
    }
    return VersionUpdateService.instance;
  }

  /**
   * 检查版本更新并阻止（用于启动时强制更新）
   * @param currentVersion 当前版本号
   * @returns 是否需要更新（true=需要更新，false=已是最新版本）
   */
  async checkForUpdateAndBlock(currentVersion: string): Promise<boolean> {
    try {
      const response = await api.get(`/version/check?current=${currentVersion}`);
      const versionInfo: VersionInfo = response.data;

      if (versionInfo.hasUpdate) {
        // 有新版本，显示强制更新对话框
        this.showUpdateDialog(versionInfo);
        return true; // 需要更新
      }
      
      // 已是最新版本，不显示任何提示
      return false;
    } catch (error) {
      console.error('[VersionUpdate] 检查更新失败:', error);
      // 网络错误时允许进入应用
      return false;
    }
  }

  /**
   * 检查版本更新（用于手动检查更新按钮）
   * @param currentVersion 当前版本号
   * @param silent 是否静默检查（不弹提示）
   */
  async checkForUpdate(currentVersion: string, silent = false): Promise<void> {
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;

    try {
      const response = await api.get(`/version/check?current=${currentVersion}`);
      const versionInfo: VersionInfo = response.data;

      if (versionInfo.hasUpdate) {
        // 检查是否今天已经提示过（非强制更新时）
        if (!versionInfo.forceUpdate && !silent) {
          const lastCheckDate = await AsyncStorage.getItem('lastUpdateCheckDate');
          const today = new Date().toDateString();
          if (lastCheckDate === today) {
            console.log('[VersionUpdate] 今天已提示过更新，跳过');
            return;
          }
          await AsyncStorage.setItem('lastUpdateCheckDate', today);
        }

        this.showUpdateDialog(versionInfo);
      } else if (!silent) {
        Alert.alert('提示', versionInfo.message);
      }
    } catch (error) {
      console.error('[VersionUpdate] 检查更新失败:', error);
      if (!silent) {
        Alert.alert('提示', '检查更新失败，请稍后重试');
      }
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 显示更新对话框
   */
  private showUpdateDialog(versionInfo: VersionInfo): void {
    const { version, releaseNotes, forceUpdate, downloadUrl } = versionInfo;

    const message = forceUpdate
      ? `检测到新版本: ${version}\n\n您当前使用的版本过旧，必须更新后才能继续使用。\n\n更新内容:\n${releaseNotes}`
      : `发现新版本: ${version}\n\n更新内容:\n${releaseNotes}`;

    Alert.alert(
      forceUpdate ? '⚠️ 强制更新' : '版本更新',
      message,
      [
        ...(!forceUpdate
          ? [
              {
                text: '稍后更新',
                style: 'cancel' as const,
              },
            ]
          : []),
        {
          text: forceUpdate ? '立即更新（必须）' : '立即更新',
          onPress: () => this.downloadAndInstall(downloadUrl),
        },
      ],
      { cancelable: !forceUpdate }
    );
  }

  /**
   * 下载并安装APK
   * 直接在浏览器中打开下载链接，避免使用设备内置下载器导致安装问题
   */
  private async downloadAndInstall(downloadUrl: string): Promise<void> {
    try {
      // 直接在浏览器中打开下载链接
      console.log('[VersionUpdate] 打开浏览器下载:', downloadUrl);
      
      const supported = await Linking.canOpenURL(downloadUrl);
      if (!supported) {
        Alert.alert('错误', '无法打开下载链接');
        return;
      }
      
      await Linking.openURL(downloadUrl);
      
      // 提示用户后续操作
      Alert.alert(
        '提示',
        '已在浏览器中打开下载链接，请等待下载完成后安装。\n\n安装完成后请重新打开应用。',
        [{ text: '知道了' }]
      );
    } catch (error) {
      console.error('[VersionUpdate] 打开下载链接失败:', error);
      Alert.alert('错误', '打开下载链接失败，请稍后重试');
    }
  }

}

export const versionUpdateService = VersionUpdateService.getInstance();

