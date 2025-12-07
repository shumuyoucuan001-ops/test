# 📱 SmLabelAppExpo 使用指南

## 🎯 **应用概述**

SmLabelAppExpo是一个基于Expo开发的React Native标签打印应用，主要功能包括：
- 🔐 用户登录认证
- 📦 收货单打印
- 🏷️ 商品标签打印
- 🖨️ 蓝牙打印机管理
- ⚙️ 打印机设置

## 🚨 **闪退问题分析与解决**

### **常见闪退原因：**

#### **1. API连接问题（最常见）**
**问题**：应用启动时尝试连接API服务器失败
**原因**：`src/api.ts` 中的API地址配置不正确

**当前配置**：
```typescript
const API_BASE_URL = __DEV__
  ? 'http://192.168.0.109:3000'  // ❌ 可能不正确
  : 'https://your-server.com';
```

**解决方案**：
1. **检查后端服务是否启动**
2. **修改API地址为正确的IP**
3. **确保网络连通性**

#### **2. 依赖版本冲突**
**问题**：React Native 0.79.5 + React 19.0.0 + Expo 54.0.0 版本组合可能不稳定
**解决方案**：重新安装依赖

#### **3. 蓝牙权限问题**
**问题**：Android蓝牙权限未正确授予
**解决方案**：手动授予权限或重新安装应用

## 🛠️ **完整解决方案**

### **方案1：修复API连接（推荐）**

#### **步骤1：确认后端服务状态**
```bash
# 在项目根目录
cd server
npm start

# 确认看到：Application is running on: http://[::1]:4000
```

#### **步骤2：获取正确的IP地址**
```bash
# 获取本机IP地址
# macOS/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows:
ipconfig | findstr "IPv4"

# 例如得到：192.168.0.117
```

#### **步骤3：修改API配置**
编辑 `SmLabelAppExpo/src/api.ts`：
```typescript
const API_BASE_URL = __DEV__
  ? 'http://192.168.0.117:4000'  // ✅ 使用正确的IP和端口
  : 'https://your-server.com';
```

#### **步骤4：重新启动应用**
```bash
cd SmLabelAppExpo
npx expo start --clear
```

### **方案2：完全重置应用**

#### **步骤1：清理缓存**
```bash
cd SmLabelAppExpo

# 清理所有缓存
npx expo start --clear
rm -rf node_modules
rm -rf .expo
npm install
```

#### **步骤2：重新生成应用**
```bash
# 重新启动开发服务器
npx expo start

# 在手机上重新安装应用
# 扫描二维码或使用Expo Go
```

### **方案3：使用预编译版本**

#### **步骤1：构建开发版本**
```bash
cd SmLabelAppExpo

# 构建Android开发版本
npx expo run:android

# 或构建iOS开发版本（需要Mac）
npx expo run:ios
```

## 📱 **正确的启动流程**

### **在另一台设备上操作：**

#### **步骤1：确保环境准备**
```bash
# 1. 确认项目已同步
cd /Users/xiangwork/Documents/GitHub/shumu
git pull origin develop

# 2. 确认后端服务运行
cd server
npm start
# 记住显示的端口，通常是4000

# 3. 获取本机IP
ifconfig | grep "inet " | grep -v 127.0.0.1
# 例如：192.168.0.117
```

#### **步骤2：配置API地址**
编辑 `SmLabelAppExpo/src/api.ts`：
```typescript
const API_BASE_URL = __DEV__
  ? 'http://[你的IP地址]:4000'  // 替换为实际IP
  : 'https://your-server.com';
```

#### **步骤3：启动移动应用**
```bash
cd SmLabelAppExpo

# 安装依赖（如果需要）
npm install

# 启动Expo开发服务器
npx expo start

# 选择启动方式：
# - 按 'a' 启动Android模拟器
# - 扫描二维码在真机上运行
# - 按 'w' 在浏览器中运行（测试用）
```

## 📋 **应用功能说明**

### **🔐 登录功能**
- **用户名/密码**：使用后端系统的用户账号
- **API接口**：`POST /acl/login`
- **存储**：登录成功后保存用户ID和token到本地

### **📦 收货单打印**
- **功能**：查询收货单，批量打印标签
- **API接口**：`/receipts/*`
- **打印**：支持蓝牙打印机（桌面型/便携型）

### **🏷️ 商品标签打印**
- **功能**：搜索商品，打印单个标签
- **API接口**：`/products/*`, `/label-data/*`, `/templates/*`
- **模板**：支持HTML模板转TSPL打印指令

### **🖨️ 打印机设置**
- **蓝牙连接**：自动扫描并连接蓝牙打印机
- **打印机类型**：桌面型（TSPL）/ 便携型（ESC/POS）
- **设置保存**：打印机配置保存到本地存储

## 🔧 **开发调试指南**

### **调试API连接**
```bash
# 在应用中测试API连接
# 1. 打开Expo开发工具
# 2. 查看Console日志
# 3. 检查网络请求状态
```

### **查看应用日志**
```bash
# 启动时添加调试参数
npx expo start --dev-client

# 或查看详细日志
npx expo start --verbose
```

### **蓝牙调试**
- **Android**：确保位置权限已授予
- **iOS**：确保蓝牙权限已授予
- **配对**：先在系统设置中配对打印机

## 🎯 **告诉Cursor理解SmLabelAppExpo**

### **在Cursor中询问：**

```
我正在使用SmLabelAppExpo移动应用，这是一个基于Expo的React Native标签打印应用。

应用结构：
- 登录系统：连接后端API进行用户认证
- 收货单打印：查询收货单数据并批量打印标签
- 商品标签打印：搜索商品并打印单个标签
- 蓝牙打印：支持桌面型和便携型打印机
- 模板系统：HTML模板转TSPL打印指令

技术栈：
- Expo 54.0.0
- React Native 0.79.5
- React Navigation 7.x
- Axios API客户端
- 蓝牙打印（react-native-bluetooth-classic）

当前问题：
- 应用启动时闪退
- API连接配置需要调整
- 需要在另一台设备上正确配置和运行

请帮我理解应用架构并解决启动问题。
```

## 🚀 **快速启动脚本**

创建启动脚本 `start-mobile.sh`：
```bash
#!/bin/bash
echo "🚀 启动SmLabelAppExpo..."

# 检查后端服务
echo "📡 检查后端服务..."
cd server
if ! pgrep -f "nest start" > /dev/null; then
    echo "启动后端服务..."
    npm start &
    sleep 5
fi

# 获取IP地址
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
echo "🌐 本机IP地址: $IP"

# 启动移动应用
echo "📱 启动移动应用..."
cd ../SmLabelAppExpo
npx expo start

echo "✅ 请在手机上扫描二维码或按 'a' 启动Android模拟器"
```

## ⚠️ **注意事项**

### **网络要求**
- 手机和电脑必须在同一WiFi网络
- 防火墙不能阻止相关端口（3000, 4000, 19000等）
- 确保IP地址配置正确

### **权限要求**
- **Android**: 蓝牙、位置、存储权限
- **iOS**: 蓝牙权限

### **设备要求**
- **Android 6.0+** 或 **iOS 11.0+**
- **蓝牙4.0+** 支持
- **网络连接** 稳定

## 🆘 **常见问题解决**

### **Q: 扫描二维码后应用闪退**
**A**: 检查API地址配置，确保后端服务正常运行

### **Q: 无法连接蓝牙打印机**
**A**: 检查权限设置，先在系统设置中配对设备

### **Q: 打印内容乱码**
**A**: 检查打印机类型设置，桌面型用TSPL，便携型用ESC/POS

### **Q: 登录失败**
**A**: 检查用户名密码，确认后端数据库连接正常

---

**现在您可以按照这个指南在另一台设备上正确配置和运行SmLabelAppExpo了！** 📱✨
