# APK托管方案指南

## 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| GitHub Release | 免费、版本管理 | 国内访问慢/不稳定 | 海外用户 |
| 阿里云OSS | 快速、稳定 | 需付费 | 国内生产环境 |
| 自建服务器 | 完全可控 | 需维护服务器 | 有服务器资源 |
| 内网文件服务器 | 完全内部控制 | 仅内网访问 | 企业内部使用 |

---

## 方案1: 阿里云OSS（推荐）

### 步骤1: 创建OSS Bucket
```bash
1. 登录阿里云控制台
2. 进入对象存储OSS
3. 创建Bucket
   - 名称: your-app-bucket
   - 区域: 华东1（杭州）
   - 读写权限: 公共读
4. 创建目录: /shumu/
```

### 步骤2: 上传APK
```bash
# 使用OSS控制台上传
# 或使用ossutil命令行工具
ossutil cp app-release.apk oss://your-app-bucket/shumu/app-release-v25.10.02.02.apk
```

### 步骤3: 获取URL
```
公网访问URL:
https://your-app-bucket.oss-cn-hangzhou.aliyuncs.com/shumu/app-release-v25.10.02.02.apk
```

### 步骤4: 更新后端配置
```typescript
// server/src/version/version.service.ts
downloadUrl: 'https://your-app-bucket.oss-cn-hangzhou.aliyuncs.com/shumu/app-release-v25.10.02.02.apk'
```

### 费用估算
- 存储: 81MB × 0.12元/GB/月 ≈ 0.01元/月
- 流量: 按下载次数，约0.5元/GB
- 总计: 每月几元到几十元

---

## 方案2: 自建服务器

### 使用现有NestJS服务器托管

#### 步骤1: 在服务器创建public目录
```bash
cd /Users/xiangwork/Documents/GitHub/shumu/server
mkdir -p public/downloads
```

#### 步骤2: 配置静态文件服务
```typescript
// server/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // 启用静态文件服务
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/downloads/',
  });
  
  app.enableCors();
  await app.listen(4000);
}
bootstrap();
```

#### 步骤3: 复制APK到public目录
```bash
cp SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk \
   server/public/downloads/app-release-v25.10.02.02.apk
```

#### 步骤4: 更新后端配置
```typescript
downloadUrl: 'http://your-server-ip:4000/downloads/app-release-v25.10.02.02.apk'
```

**注意**: 需要确保服务器有公网IP且端口4000可访问

---

## 方案3: 内网文件服务器（企业内部）

### 适用场景
- 仅企业内部员工使用
- 设备都在同一局域网
- 不需要外网访问

### 实现方式
```typescript
downloadUrl: 'http://192.168.1.100:4000/downloads/app-release.apk'
```

**优点**:
- 完全内部控制
- 无需公网
- 无流量费用

---

## 方案4: GitHub Release + 国内镜像加速

### 使用镜像服务
```typescript
// 使用GitHub文件加速服务
downloadUrl: 'https://ghproxy.com/https://github.com/xuxiang6/shumu/releases/download/v25.10.02.02/app-release.apk'
```

**注意**: 第三方加速服务可能不稳定

---

## 推荐方案

### 小规模使用（<100人）
**方案2: 自建服务器**
- 使用现有NestJS服务器
- 成本低
- 配置简单

### 中大规模使用（>100人）
**方案1: 阿里云OSS**
- 稳定可靠
- 速度快
- 成本可控

### 企业内部使用
**方案3: 内网服务器**
- 完全可控
- 无外网依赖

---

## 实施建议

1. **开发/测试阶段**: 使用自建服务器或内网服务器
2. **生产环境**: 使用阿里云OSS或腾讯云COS
3. **备用方案**: GitHub Release作为备份下载源

---

## 多下载源配置（推荐）

```typescript
// server/src/version/version.service.ts
private latestVersion: VersionInfo = {
  version: '25.10.02.02',
  versionCode: 25100202,
  // 主下载源（国内OSS）
  downloadUrl: 'https://your-bucket.oss-cn-hangzhou.aliyuncs.com/shumu/app-release.apk',
  // 备用下载源（可在前端实现失败重试）
  downloadUrlBackup: 'http://your-server:4000/downloads/app-release.apk',
  downloadUrlGithub: 'https://github.com/xuxiang6/shumu/releases/download/v25.10.02.02/app-release.apk',
  releaseNotes: '...',
  forceUpdate: true,
  releaseDate: '2025-10-02',
};
```

