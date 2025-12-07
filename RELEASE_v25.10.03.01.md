# 🎉 版本 25.10.03.01 发布说明

## ✅ 版本信息

- **版本号**: 25.10.03.01
- **版本代码**: 25100301
- **APK 大小**: 81MB
- **构建时间**: 2025-10-03 01:24
- **发布日期**: 2025-10-03

---

## 🎨 本次更新内容

### **应用图标更新**
- ✅ 全新的应用图标设计
- ✅ 适配所有分辨率（mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi）
- ✅ 支持自适应图标（Android 8.0+）

### **下载体验优化**
- ✅ 版本更新下载改为浏览器模式
- ✅ 避免设备内置下载器兼容性问题
- ✅ 更新说明简化显示

### **其他改进**
- ✅ 自动连接上次使用的打印机
- ✅ 输入框兼容性优化
- ✅ 打印份数控件布局优化

---

## 📦 APK 文件位置

```
SmLabelAppRN/android/app/build/outputs/apk/release/app-release.apk
```

**大小**: 81MB

---

## 🚀 上传到阿里云 OSS

### **步骤 1: 登录 OSS 控制台**
https://oss.console.aliyun.com/

### **步骤 2: 上传 APK**

1. 进入 `shumuyx` Bucket
2. 导航到 `app/android/` 目录
3. 上传 `app-release.apk`（**覆盖旧文件**）
4. 设置文件权限为 "**公共读**"

### **步骤 3: 验证下载链接**

**自定义域名**（推荐）:
```
http://download.shuzhishanmu.com/app/android/app-release.apk
```

**OSS 默认域名**（备用）:
```
https://shumuyx.oss-cn-chengdu.aliyuncs.com/app/android/app-release.apk
```

在浏览器中打开链接，确认可以下载 APK（81MB）。

---

## 🔄 后端配置

后端版本信息已自动更新:

**文件**: `server/src/version/version.service.ts`

```typescript
version: '25.10.03.01'
versionCode: 25100301
downloadUrl: 'http://download.shuzhishanmu.com/app/android/app-release.apk'
releaseNotes: '新版本更新'
forceUpdate: true
releaseDate: '2025-10-03'
```

---

## 📱 测试步骤

### **测试设备要求**
- 当前版本: 25.10.02.03 或更早
- Android 6.0 及以上

### **测试流程**

1. **完全关闭应用**（从后台清除）

2. **重新打开应用**
   - 应显示强制更新对话框
   - 标题: "⚠️ 强制更新"
   - 内容: "检测到新版本: 25.10.03.01"
   - 按钮: "立即更新（必须）"

3. **点击立即更新**
   - ✅ 应在浏览器中打开下载链接
   - ✅ 显示提示: "已在浏览器中打开下载链接，请等待下载完成后安装"
   - ✅ APK 开始下载（81MB）

4. **下载完成后**
   - 点击下载的 APK 文件
   - 安装新版本

5. **验证新版本**
   - 重新打开应用
   - 查看主页底部版本号: 应显示 `25.10.03.01`
   - 查看应用图标: 应显示新图标
   - 手动点击"检查更新": 应显示 "当前已是最新版本"

6. **功能测试**
   - ✅ 测试打印功能（自动连接上次使用的打印机）
   - ✅ 测试收货单打印
   - ✅ 测试商品标签打印

---

## 🔗 下载链接分享

### **方式 1: 二维码**
使用在线工具生成二维码:
- https://cli.im/
- 输入链接: `http://download.shuzhishanmu.com/app/android/app-release.apk`

### **方式 2: 直接分享链接**
```
http://download.shuzhishanmu.com/app/android/app-release.apk
```

**特点**:
- ✅ 链接固定，不会变化
- ✅ 覆盖上传即自动更新
- ✅ 可分享给所有设备

---

## 📋 上传检查清单

- [ ] APK 已上传到 OSS: `app/android/app-release.apk`
- [ ] 文件权限设置为 "公共读"
- [ ] 浏览器可以访问下载链接
- [ ] 下载文件大小约 81MB
- [ ] 后端服务运行中
- [ ] 版本接口返回正确版本信息

**验证命令**:
```bash
# 测试版本检查接口
curl http://192.168.0.109:4000/version/check?current=25.10.02.03 | python3 -m json.tool

# 测试下载链接
curl -I http://download.shuzhishanmu.com/app/android/app-release.apk
```

---

## 🔧 故障排查

### **问题 1: 构建时提示缺少 adaptive 图标**
✅ 已解决: 修改了 `ic_launcher.xml`，使用纯白色背景

### **问题 2: 下载后无法安装**
- 检查设备是否允许安装未知来源应用
- 确认 APK 文件完整（81MB）
- 尝试在设备浏览器中重新下载

### **问题 3: 图标未更新**
- 完全卸载旧版本后重新安装
- 清除启动器缓存（设置 → 应用 → 启动器 → 清除缓存）

---

## 📝 技术说明

### **图标配置**
- 标准图标: `ic_launcher.png` (5个尺寸)
- 圆形图标: `ic_launcher_round.png` (5个尺寸)
- 自适应图标前景: `ic_launcher_adaptive_fore.png` (5个尺寸)
- 自适应图标背景: 使用系统白色背景 (`@android:color/white`)

### **版本更新逻辑**
- 启动时自动检查版本
- 强制更新（旧版本必须更新）
- 使用浏览器下载 APK
- 下载链接: 阿里云 OSS + 自定义域名

---

## 🎉 发布完成后

1. **通知用户更新**
   - 发送下载链接或二维码
   - 说明更新内容（新图标）

2. **监控更新情况**
   - 检查后端日志
   - 收集用户反馈

3. **下次更新准备**
   - 记录本次发布的问题和改进点
   - 规划下一版本功能

---

**准备好后，请上传 APK 到 OSS 并开始测试！** 🚀
