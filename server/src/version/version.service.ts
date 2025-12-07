import { Injectable } from '@nestjs/common';

interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  releaseDate: string;
}

@Injectable()
export class VersionService {
  // 最新版本信息（生产环境应该从数据库或配置文件读取）
  private latestVersion: VersionInfo = {
    version: '25.10.03.05',
    versionCode: 25100305,
    // 使用阿里云OSS + 自定义域名托管APK（成都节点，国内访问快速稳定）
    downloadUrl: 'http://download.shuzhishanmu.com/app/android/app-release.apk',
    releaseNotes: '新版本更新：支持单点登录，账号安全升级',
    forceUpdate: true,  // 启用强制更新：旧版本必须更新才能使用
    releaseDate: '2025-10-03',
  };

  /**
   * 检查版本更新
   */
  async checkVersion(currentVersion: string) {
    const currentCode = this.parseVersionCode(currentVersion);
    const latestCode = this.latestVersion.versionCode;

    if (currentCode < latestCode) {
      return {
        hasUpdate: true,
        ...this.latestVersion,
        message: this.latestVersion.forceUpdate 
          ? '发现新版本，请立即更新' 
          : '发现新版本，建议更新',
      };
    }

    return {
      hasUpdate: false,
      version: currentVersion,
      message: '当前已是最新版本',
    };
  }

  /**
   * 获取最新版本信息
   */
  async getLatestVersion() {
    return {
      ...this.latestVersion,
      currentVersion: this.latestVersion.version,
    };
  }

  /**
   * 解析版本号为数字（格式: YY.MM.DD.NN -> YYMMDDNN）
   */
  private parseVersionCode(version: string): number {
    try {
      const parts = version.split('.');
      if (parts.length === 4) {
        return parseInt(parts.join(''), 10);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * 更新最新版本信息（管理员使用）
   * 生产环境应该通过管理后台或配置文件更新
   */
  updateLatestVersion(versionInfo: Partial<VersionInfo>) {
    this.latestVersion = {
      ...this.latestVersion,
      ...versionInfo,
    };
  }
}

