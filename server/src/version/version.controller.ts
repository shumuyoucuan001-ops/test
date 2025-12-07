import { Controller, Get, Query } from '@nestjs/common';
import { VersionService } from './version.service';

@Controller('version')
export class VersionController {
  constructor(private service: VersionService) {}

  /**
   * 检查版本更新
   * @param currentVersion 当前客户端版本号
   * @returns 版本信息和更新提示
   */
  @Get('check')
  async checkVersion(@Query('current') currentVersion: string) {
    return this.service.checkVersion(currentVersion);
  }

  /**
   * 获取最新版本信息
   */
  @Get('latest')
  async getLatestVersion() {
    return this.service.getLatestVersion();
  }
}

