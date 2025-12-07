# 🚀 版本 25.10.03.04 部署指南

## 📦 版本信息

- **版本号**: 25.10.03.04
- **更新内容**: 支持公网域名访问，所有设备可用
- **API 地址**: http://api.shuzhishanmu.com:4000
- **构建时间**: 2025-10-03 02:38
- **APK 大小**: 81M

---

## ✅ **已完成配置**

### 1. DNS 域名解析

- ✅ api.shuzhishanmu.com → 121.43.139.147
- ✅ DNS 已生效，可正常访问

### 2. 宝塔防火墙

- ✅ 端口 4000 已放行
- ✅ sm-api 项目正常运行

### 3. 应用配置更新

- ✅ API 地址已更新为公网域名
- ✅ 版本号已更新为 25.10.03.04
- ✅ APK 已构建完成

---

## 📤 **上传 APK 到阿里云 OSS**

### 方法 1: 通过阿里云 OSS 控制台上传（推荐）

1. **访问 OSS 控制台**

   - 网址: https://oss.console.aliyun.com/
   - 登录您的阿里云账号

2. **找到您的存储桶**

   - 找到: `shumuyx`（西南 1-成都）
   - 点击进入存储桶

3. **上传文件**

   - 点击左侧 "文件管理"
   - 导航到: `app/android/` 目录
   - 点击 "上传文件"
   - 选择文件:
     ```
     /Users/xiangwork/Documents/GitHub/shumu/SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk
     ```
   - **注意**: 上传时选择 "覆盖同名文件"（自动替换旧版本）
   - 点击 "开始上传"

4. **验证上传成功**

   - 上传完成后，刷新文件列表
   - 确认 `app-release.apk` 的修改时间已更新

5. **验证可访问性**
   - 在浏览器中访问: http://download.shuzhishanmu.com/app/android/app-release.apk
   - 应该开始下载文件（大小约 81M）

---

### 方法 2: 使用 ossutil 命令行工具（可选）

如果您已经配置了 ossutil，可以使用以下命令：

```bash
# 上传APK到OSS
ossutil cp \
  /Users/xiangwork/Documents/GitHub/shumu/SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk \
  oss://shumuyx/app/android/app-release.apk \
  --force
```

---

## 🔄 **更新后端版本配置（已完成）**

后端版本信息已更新为 25.10.03.04，无需额外操作。

---

## 📱 **测试新版本**

### 1. 测试域名访问

```bash
# 测试DNS解析
nslookup api.shuzhishanmu.com

# 测试API健康检查
curl http://api.shuzhishanmu.com:4000/health

# 测试版本检查接口
curl "http://api.shuzhishanmu.com:4000/version/check?current=25.10.03.03"
```

### 2. 测试应用更新流程

1. **在旧版本(25.10.03.03)设备上**:

   - 打开应用
   - 应该自动弹出更新提示
   - 点击更新，应该跳转到浏览器下载

2. **使用下载链接直接安装**:

   - 访问: http://download.shuzhishanmu.com/app/android/app-release.apk
   - 下载并安装
   - 安装后打开，检查版本号是否为 25.10.03.04

3. **测试跨网络功能**:
   - 在非局域网设备（使用移动数据或其他 WiFi）上安装应用
   - 测试登录功能
   - 测试收货单查询
   - 测试打印功能（需要连接打印机）

---

## 🎯 **预期效果**

- ✅ **所有设备都能使用**: 不限局域网，全国可用
- ✅ **旧版本强制更新**: 25.10.03.03 及以下版本必须更新
- ✅ **域名访问**: 使用专业的 api.shuzhishanmu.com 域名
- ✅ **稳定访问**: OSS 成都节点，国内访问快速

---

## 📞 **技术信息**

### 网络架构

```
移动设备
  ↓
api.shuzhishanmu.com:4000
  ↓
阿里云DNS解析
  ↓
121.43.139.147:4000
  ↓
宝塔面板 - sm-api项目
  ↓
NestJS后端服务
```

### APK 下载架构

```
移动设备
  ↓
download.shuzhishanmu.com
  ↓
阿里云DNS解析(CNAME)
  ↓
shumuyx.oss-cn-chengdu.aliyuncs.com
  ↓
阿里云OSS存储
  ↓
app/android/app-release.apk
```

---

## 📝 **注意事项**

1. **首次使用新域名**

   - 如果遇到连接问题，等待 5-10 分钟 DNS 完全生效
   - 可以先在浏览器测试: http://api.shuzhishanmu.com:4000/health

2. **版本更新检测**

   - 应用启动时会自动检查更新
   - 强制更新模式，旧版本无法跳过

3. **网络要求**

   - 需要联网使用（移动数据或 WiFi 均可）
   - 首次使用建议在 WiFi 环境下更新

4. **安全性**
   - 使用 HTTP 协议（端口 4000）
   - 如需 HTTPS，需要另外配置 SSL 证书和反向代理

---

## 🐛 **故障排查**

### 问题 1: 无法访问 API

```bash
# 检查DNS
nslookup api.shuzhishanmu.com

# 检查服务器防火墙
curl http://121.43.139.147:4000/health

# 检查宝塔面板项目状态
登录宝塔面板 → Node项目 → 确认sm-api运行中
```

### 问题 2: 无法下载 APK

```bash
# 检查OSS文件
访问: https://oss.console.aliyun.com/
确认文件存在: app/android/app-release.apk

# 检查CNAME解析
nslookup download.shuzhishanmu.com

# 测试直接下载
curl -I http://download.shuzhishanmu.com/app/android/app-release.apk
```

### 问题 3: 应用内报错

- 检查网络连接
- 确认 API 地址正确
- 查看应用日志（adb logcat）
- 尝试重新安装应用

---

## ✨ **后续优化建议**

1. **配置 HTTPS**: 提升安全性
2. **配置 CDN**: 加速全国访问
3. **版本管理**: 考虑实现灰度发布
4. **监控告警**: 配置服务器监控和告警

---

**部署完成后，请告诉我测试结果！** 🎉
