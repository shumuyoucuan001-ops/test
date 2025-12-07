# 📱 在测试设备上安装 APK 指南

## 方法 1：使用无线 ADB（推荐）

### 步骤 1：确保设备和 Mac 在同一 WiFi 网络

### 步骤 2：在 Mac 终端执行以下命令

```bash
# 1. 连接设备（替换为您设备的IP地址）
adb connect 192.168.0.119:39889

# 2. 验证连接
adb devices

# 3. 卸载旧版本
adb -s 192.168.0.119:39889 uninstall com.smlabelapprn

# 4. 安装新APK
adb -s 192.168.0.119:39889 install /Users/xiangwork/Documents/GitHub/shumu/SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk
```

---

## 方法 2：直接从设备安装（最简单）

### 步骤 1：找到 APK 文件

APK 文件位置：

```
/Users/xiangwork/Documents/GitHub/shumu/SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk
```

### 步骤 2：传输 APK 到设备

**选项 A：使用微信/QQ 传输**

1. 在 Mac 上打开微信/QQ
2. 将 APK 文件发送到"文件传输助手"或您的手机
3. 在设备上下载 APK

**选项 B：使用云盘**

1. 将 APK 上传到阿里云盘/百度网盘
2. 在设备上下载

**选项 C：使用浏览器下载**

1. 将 APK 上传到服务器（如果有）
2. 在设备浏览器中下载

### 步骤 3：安装 APK

1. 在设备上找到下载的 APK 文件
2. 点击安装
3. 如果提示"不允许安装未知来源的应用"：
   - 点击"设置"
   - 允许该来源
   - 返回继续安装

---

## 方法 3：使用 ADB 有线连接

### 步骤 1：USB 连接

1. 用 USB 线连接设备和 Mac
2. 在设备上开启"USB 调试"
3. 允许"USB 调试"授权

### 步骤 2：在 Mac 终端执行

```bash
# 1. 验证连接
adb devices

# 2. 卸载旧版本
adb uninstall com.smlabelapprn

# 3. 安装新APK
adb install /Users/xiangwork/Documents/GitHub/shumu/SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk
```

---

## ✅ 安装完成后测试

1. 打开"术木"应用
2. 允许所有权限请求（蓝牙、位置、存储等）
3. 测试以下功能：
   - ✅ 登录
   - ✅ 收货单查询
   - ✅ 打印机设置（重点测试）
   - ✅ 产品标签打印
   - ✅ 版本检查

---

## 📝 当前版本信息

- **版本号**: 25.10.03.04
- **API 地址**: http://api.shuzhishanmu.com:5000
- **APK 大小**: 约 81MB
- **构建时间**: 刚刚构建完成

---

## 🔧 如果遇到问题

1. **安装失败**：

   - 卸载旧版本后重试
   - 检查存储空间是否足够

2. **打开失败**：

   - 清除应用数据后重试
   - 重启设备后重试

3. **权限问题**：
   - 设置 → 应用 → 术木 → 权限
   - 手动授予所有权限

---

**请选择最方便的方法安装，完成后告诉我测试结果！** 🚀

